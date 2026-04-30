import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { auth } from './auth';
import { getCentralDb } from './lib/db-singleton';

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

  const memberships = session.user.memberships;
  const familyParam = request.nextUrl.searchParams.get('family');
  const familyCookie = request.cookies.get('active-family')?.value;
  const requestedFamilyId = familyParam || familyCookie || '';

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
  let selected = requestedFamilyId
    ? list.find((m) => m.familyId === requestedFamilyId)
    : undefined;
  if (!selected && list.length > 0) {
    selected = list[0];
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
  }

  if (staleJwtDetected) {
    // Set a short-lived cookie that signals staleness. Auth.js v5 jwt() callbacks
    // don't receive request cookies directly, so forcing an in-place JWT refresh
    // from middleware is not supported. The deferred path: on the next request the
    // proxy re-detects staleness, and a future Task will wire trigger='update' from
    // a client component that reads a response header/cookie. For now, setting this
    // cookie is the staleness signal; Task 9 verifies the detection logic end-to-end.
    response.cookies.set('force-jwt-refresh', '1', {
      httpOnly: true,
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
