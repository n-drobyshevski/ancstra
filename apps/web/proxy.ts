import { NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import createIntlMiddleware from 'next-intl/middleware';
import { centralSchema } from '@ancstra/db';
import { JWT_REFRESH_COOKIE_NAME } from '@ancstra/auth';
import { auth } from './auth';
import { getCentralDb, getCentralDbSync } from './lib/db-singleton';
import { bumpLastSeenAt } from './lib/auth/last-seen-tracker';
import { routing } from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

const PUBLIC_PATHNAMES = ['/login', '/signup', '/join', '/create-family'];
const LOCALE_PREFIX_RE = new RegExp(
  `^/(?:${routing.locales.join('|')})(?=/|$)`,
);

/** Strip a leading /:locale segment so we can compare against canonical paths. */
function canonicalPath(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_RE, '') || '/';
}

function isPublicPath(pathname: string): boolean {
  const stripped = canonicalPath(pathname);
  return PUBLIC_PATHNAMES.some((p) => stripped === p || stripped.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return canonicalPath(pathname).startsWith('/admin');
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/** Copy locale-related cookies from the intl response onto a downstream response. */
function mergeIntlCookies(target: NextResponse, intlResponse: NextResponse): NextResponse {
  intlResponse.cookies.getAll().forEach((c) => {
    target.cookies.set(c);
  });
  return target;
}

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
  // ── 1. Run next-intl first to handle locale routing ────────────────────
  // Intl middleware may redirect (unsupported locale) or rewrite internally
  // (locale prefix → [locale] segment). For redirects, honor immediately.
  const intlResponse = handleI18n(request);
  const intlLocation = intlResponse.headers.get('location');
  if (intlLocation && intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const pathname = request.nextUrl.pathname;
  const session = request.auth;

  // ── 2. Public routes (login/signup/join/create-family) — no auth check ─
  // These pages handle their own authentication flow. Return intl response
  // so locale rewriting still applies.
  if (isPublicPath(pathname)) {
    return intlResponse;
  }

  // ── 3. Auth gate ───────────────────────────────────────────────────────
  if (!session?.user?.id) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect to /login — intl middleware on the next request handles locale.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── 4. Defense in depth: strip inbound x-user-* / x-family-* headers ──
  const requestHeaders = new Headers(request.headers);
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.startsWith('x-user-') || name.startsWith('x-family-')) {
      requestHeaders.delete(name);
    }
  }

  // ── 5. Lazy memberships_version check — detect stale JWT ──────────────
  let staleJwtDetected = false;
  try {
    const dbVersion = await fetchMembershipsVersion(session.user.id);
    const jwtVersion = session.user.membershipsVersion ?? 0;
    if (dbVersion !== jwtVersion) {
      staleJwtDetected = true;
    }
  } catch (err) {
    console.warn('[PROXY] memberships_version fetch failed, continuing with JWT', err);
  }

  // ── 6. Sub-spec A: refuse mutations on stale JWT ──────────────────────
  const isMutation = request.method === 'POST'
    || request.method === 'PUT'
    || request.method === 'PATCH'
    || request.method === 'DELETE';
  if (staleJwtDetected && isMutation && isApiPath(pathname)) {
    const response = NextResponse.json(
      { error: 'Session stale, please retry', code: 'JWT_STALE' },
      { status: 409 },
    );
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

  // ── 7. Platform-admin paths — family-agnostic ─────────────────────────
  if (isAdminPath(pathname)) {
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
    return mergeIntlCookies(adminResponse, intlResponse);
  }

  // ── 8. No-membership user → /create-family ─────────────────────────────
  if (Array.isArray(memberships) && memberships.length === 0) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'No family membership' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/create-family', request.url));
  }

  const list = memberships ?? [];

  // ── 9. URL-mismatch redirect (unknown family in URL/cookie) ───────────
  if (requestedFamilyId && !list.find((m) => m.familyId === requestedFamilyId)) {
    const cleanUrl = new URL(request.nextUrl);
    cleanUrl.searchParams.delete('family');
    const redirect = NextResponse.redirect(cleanUrl);
    redirect.cookies.delete('active-family');
    return redirect;
  }

  let selected = requestedFamilyId
    ? list.find((m) => m.familyId === requestedFamilyId)
    : undefined;

  // ── 10. Default-family selection by lastSeenAt ────────────────────────
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
    if (!selected) {
      selected = list[0];
    }
  }

  // ── 11. Set family-scope headers ──────────────────────────────────────
  requestHeaders.set('x-user-id', session.user.id);
  if (selected) {
    requestHeaders.set('x-family-id', selected.familyId);
    requestHeaders.set('x-family-db', selected.dbFilename);
  } else if (requestedFamilyId) {
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
    void bumpLastSeenAt(getCentralDbSync(), session.user.id, familyParam);
  }

  if (staleJwtDetected) {
    response.cookies.set(JWT_REFRESH_COOKIE_NAME, '1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
  }

  return mergeIntlCookies(response, intlResponse);
});

// Matcher: include all UI routes (so intl middleware fires) but skip api/auth,
// api/debug (no session), monitoring tunnel, Next internals, and dotted files.
// Auth API routes still get the next-auth handler at the route level, just
// not this proxy.
export const config = {
  matcher: [
    '/((?!api/auth|api/debug|monitoring|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)',
  ],
};
