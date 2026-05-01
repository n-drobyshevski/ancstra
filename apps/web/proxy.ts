import { NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { JWT_REFRESH_COOKIE_NAME } from '@ancstra/auth';
import { auth } from './auth';
import { getCentralDb, getCentralDbSync } from './lib/db-singleton';
import { bumpLastSeenAt } from './lib/auth/last-seen-tracker';

async function fetchMembershipsVersion(userId: string): Promise<number> {
  const db = await getCentralDb();
  const row = await db
    .select({ v: centralSchema.users.membershipsVersion })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  return row?.v ?? 0;
}

export const proxy = auth(async (request) => {
  const session = request.auth;

  if (!session?.user?.id) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Defense in depth: strip inbound x-user-* / x-family-* headers before setting our own.
  // Closes the gap if a request bypasses the proxy or tries header forgery.
  const requestHeaders = new Headers(request.headers);
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.startsWith('x-user-') || name.startsWith('x-family-')) {
      requestHeaders.delete(name);
    }
  }

  // Lazy memberships_version check — detect stale JWT.
  // Cost: one indexed SELECT per request. Acceptable; cache later if needed.
  let staleJwtDetected = false;
  try {
    const dbVersion = await fetchMembershipsVersion(session.user.id);
    const jwtVersion = session.user.membershipsVersion ?? 0;
    if (dbVersion !== jwtVersion) {
      staleJwtDetected = true;
    }
  } catch (err) {
    // DB read failure shouldn't block the request; log and continue with current JWT
    console.warn('[PROXY] memberships_version fetch failed, continuing with JWT', err);
  }

  // Sub-spec A: refuse mutations on stale JWT — the user's role may have changed.
  // GETs are allowed (read-only stale data clears on next request after JWT refresh).
  const isMutation = request.method === 'POST'
    || request.method === 'PUT'
    || request.method === 'PATCH'
    || request.method === 'DELETE';
  if (staleJwtDetected && isMutation && request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.json(
      { error: 'Session stale, please retry', code: 'JWT_STALE' },
      { status: 409 },
    );
    // Cookie is non-httpOnly so client-side <JwtRefreshObserver> can read it.
    // Carries no secret — only a signal that the server detected staleness.
    // The actual JWT cookie remains correctly httpOnly.
    response.cookies.set(JWT_REFRESH_COOKIE_NAME, '1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
    return response;
  }

  const memberships = session.user.memberships;
  const familyParam = request.nextUrl.searchParams.get('family');
  const familyCookie = request.cookies.get('active-family')?.value;
  const requestedFamilyId = familyParam || familyCookie || '';

  // Platform-admin v1: /admin/* paths are family-agnostic. Bypass the
  // create-family redirect and family-scope header injection. The page-level
  // requirePlatformAdmin() guard verifies the claim; non-admins get notFound().
  // We still set x-user-id so server components can identify the user.
  if (request.nextUrl.pathname.startsWith('/admin')) {
    requestHeaders.set('x-user-id', session.user.id);
    const adminResponse = NextResponse.next({ request: { headers: requestHeaders } });
    if (staleJwtDetected) {
      adminResponse.cookies.set(JWT_REFRESH_COOKIE_NAME, '1', {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60,
      });
    }
    return adminResponse;
  }

  // Authenticated user with no family yet → redirect to /create-family.
  // `memberships === undefined` means the JWT predates this code (existing
  // session) — let getAuthContext fall back to DB rather than wrongly
  // redirecting. Only redirect when the JWT explicitly has zero memberships.
  if (Array.isArray(memberships) && memberships.length === 0) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No family membership' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/create-family', request.url));
  }

  const list = memberships ?? [];

  // Change B — URL-mismatch redirect: requested family not in memberships → strip param.
  // Proxy is the single source of truth; client-side useActiveMembership never sees the bad case.
  // Applies to both ?family= query param and stale active-family cookie.
  if (requestedFamilyId && !list.find((m) => m.familyId === requestedFamilyId)) {
    const cleanUrl = new URL(request.nextUrl);
    cleanUrl.searchParams.delete('family');
    const redirect = NextResponse.redirect(cleanUrl);
    // Clear the active-family cookie on every URL-mismatch redirect.
    // Without this, a stale cookie (e.g. user was removed from that family)
    // causes an infinite redirect loop: the redirect strips the ?family= param
    // but the cookie is still present on the follow-up request, so the proxy
    // re-enters this block forever. Clearing always is safe because the
    // default-family selection (lastSeenAt) will pick the right family on the
    // next request without needing the cookie as a hint.
    redirect.cookies.delete('active-family');
    return redirect;
  }

  let selected = requestedFamilyId
    ? list.find((m) => m.familyId === requestedFamilyId)
    : undefined;

  // Change A — Default-family selection by lastSeenAt.
  // When no requestedFamilyId was given, query DB for the most-recently-seen family
  // rather than blindly picking list[0].
  if (!selected && list.length > 0) {
    try {
      const rows = await getCentralDbSync()
        .select({ familyId: centralSchema.familyMembers.familyId })
        .from(centralSchema.familyMembers)
        .where(and(
          eq(centralSchema.familyMembers.userId, session.user.id),
          eq(centralSchema.familyMembers.isActive, 1),
        ))
        .orderBy(
          sql`${centralSchema.familyMembers.lastSeenAt} DESC NULLS LAST`,
          desc(centralSchema.familyMembers.joinedAt),
        )
        .limit(1)
        .all();
      const topFamilyId = rows[0]?.familyId;
      if (topFamilyId) {
        selected = list.find((m) => m.familyId === topFamilyId);
      }
    } catch (err) {
      console.warn('[PROXY] default-family query failed, falling back to memberships[0]:', err);
    }
    // Safety fallback: if DB query failed or returned nothing, use list[0]
    if (!selected) {
      selected = list[0];
    }
  }

  requestHeaders.set('x-user-id', session.user.id);
  if (selected) {
    requestHeaders.set('x-family-id', selected.familyId);
    requestHeaders.set('x-family-db', selected.dbFilename);
    // x-family-role intentionally NOT set — role re-derived from JWT downstream (sub-spec A)
  } else if (requestedFamilyId) {
    // Stale token / brand-new membership not yet in JWT — pass id only,
    // getAuthContext will fall back to a DB lookup.
    requestHeaders.set('x-family-id', requestedFamilyId);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (familyParam && familyParam !== familyCookie) {
    response.cookies.set('active-family', familyParam, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    // Fire-and-forget: track when user last switched to this family.
    void bumpLastSeenAt(getCentralDbSync(), session.user.id, familyParam);
  }

  if (staleJwtDetected) {
    // Non-httpOnly: read by client-side <JwtRefreshObserver> (sub-spec D1).
    response.cookies.set(JWT_REFRESH_COOKIE_NAME, '1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
  }

  return response;
});

// Only run proxy on protected routes
export const config = {
  matcher: [
    // Match all paths EXCEPT public routes and static files
    '/((?!login|signup|join|create-family|api/auth|api/debug|monitoring|_next/static|_next/image|favicon.ico).*)',
  ],
};
