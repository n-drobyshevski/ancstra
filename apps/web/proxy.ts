import { NextResponse } from 'next/server';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
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

function isApiPath(pathname: string | null | undefined): boolean {
  // Defensive: NextAuth's wrapper occasionally passes a request whose
  // `nextUrl.pathname` is undefined (observed during hot-reload of dev
  // server during error recovery). Treat unknown paths as non-API so the
  // rewrite header is propagated — page routes need it; the worst case for
  // a misclassified API path is a 404 which is the same as the bug we're
  // fixing.
  return typeof pathname === 'string' && pathname.startsWith('/api/');
}

/**
 * Merge next-intl's response into our downstream response.
 *
 * We must propagate two things from intl middleware:
 *   1. Locale cookies — so the user's preferred locale persists.
 *   2. `x-middleware-rewrite` header for *page* routes — `localePrefix:
 *      'as-needed'` rewrites unprefixed default-locale URLs (e.g. `/dashboard`)
 *      to the `/[locale]/dashboard` internal form. Without forwarding this,
 *      Next.js routes `/dashboard` as `/[locale]/page` with `locale='dashboard'`
 *      and the locale-layout's `hasLocale` check 404s.
 *
 * API routes (e.g. `/api/trpc/...`) must NOT carry the rewrite — they live
 * outside the `[locale]` segment, and forwarding the rewrite would point
 * Next.js at a non-existent `/en/api/trpc/...` path and 404.
 */
function mergeIntlCookies(target: NextResponse, intlResponse: NextResponse, pathname: string): NextResponse {
  intlResponse.cookies.getAll().forEach((c) => {
    target.cookies.set(c);
  });
  if (!isApiPath(pathname)) {
    const rewriteUrl = intlResponse.headers.get('x-middleware-rewrite');
    if (rewriteUrl) {
      target.headers.set('x-middleware-rewrite', rewriteUrl);
    }
  }
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

/**
 * Re-fetch a user's active memberships directly from the central DB. Used as
 * a recovery path when the JWT is stale: useSession().update() is unreliable
 * in next-auth v5 (the JWT callback's shouldRefresh check `!token.memberships`
 * evaluates to false for an empty array, so memberships are never re-fetched
 * on update). Without this, a freshly-signed-up user who creates their first
 * family is bounced back to /create-family because the JWT still claims
 * memberships=[] even though the DB has the new membership.
 *
 * Cost: one additional Turso roundtrip per request when the JWT is stale.
 * Staleness is rare (it only happens immediately after a membership change),
 * so amortized cost is near-zero.
 */
async function fetchUserMemberships(userId: string): Promise<{
  familyId: string;
  role: string;
  dbFilename: string;
}[]> {
  const db = await getCentralDb();
  return await db
    .select({
      familyId: centralSchema.familyMembers.familyId,
      role: centralSchema.familyMembers.role,
      dbFilename: centralSchema.familyRegistry.dbFilename,
    })
    .from(centralSchema.familyMembers)
    .innerJoin(
      centralSchema.familyRegistry,
      eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
    )
    .where(
      and(
        eq(centralSchema.familyMembers.userId, userId),
        eq(centralSchema.familyMembers.isActive, 1),
        // Soft-deleted families must never resurface in fresh memberships.
        isNull(centralSchema.familyRegistry.deletedAt),
      ),
    )
    .all();
}

/**
 * Returns true if the user has been soft-deleted by a platform admin. Hot-path
 * gate alongside the membershipsVersion staleness probe — one DB read per
 * request when the JWT is otherwise current.
 */
async function isUserSoftDeleted(userId: string): Promise<boolean> {
  const db = await getCentralDb();
  const row = await db
    .select({ deletedAt: centralSchema.users.deletedAt })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  return Boolean(row?.deletedAt);
}

export const proxy = auth(async (request) => {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;

  // ── 1. Run next-intl first to handle locale routing ────────────────────
  // Intl middleware may redirect (unsupported locale) or rewrite internally
  // (locale prefix → [locale] segment). For redirects, honor immediately —
  // EXCEPT on API routes: intl treats `/api/trpc` like a page and tries to
  // redirect to `/ru/api/trpc`, which 404s. API routes live outside the
  // [locale] segment and must keep their unprefixed URL.
  const intlResponse = handleI18n(request);
  const intlLocation = intlResponse.headers.get('location');
  if (
    intlLocation &&
    intlResponse.status >= 300 &&
    intlResponse.status < 400 &&
    !isApiPath(pathname)
  ) {
    return intlResponse;
  }

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

  // ── 3b. Soft-deleted user gate ────────────────────────────────────────
  // A platform admin may have soft-deleted this user since their JWT was
  // issued. Cut them off here — refusing API calls and redirecting page
  // requests to /login. The next sign-in attempt is rejected by `authorize`.
  try {
    if (await isUserSoftDeleted(session.user.id)) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ error: 'Account deactivated' }, { status: 401 });
      }
      const redirect = NextResponse.redirect(new URL('/login', request.url));
      redirect.cookies.set(JWT_REFRESH_COOKIE_NAME, '1', {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60,
      });
      return redirect;
    }
  } catch (err) {
    console.warn('[PROXY] soft-delete probe failed, continuing with JWT', err);
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

  // When the JWT is stale, the cached `memberships` may not reflect a
  // recently-joined or recently-created family. Pulling fresh memberships
  // from the DB here lets the user proceed even though their JWT cookie
  // hasn't been re-encoded yet (the JWT_REFRESH_COOKIE set later in the
  // pipeline takes care of the eventual refresh).
  let memberships = session.user.memberships;
  if (staleJwtDetected) {
    try {
      const fresh = await fetchUserMemberships(session.user.id);
      memberships = fresh as typeof memberships;
    } catch (err) {
      console.warn('[PROXY] live memberships fetch failed, falling back to JWT cache', err);
    }
  }
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
    return mergeIntlCookies(adminResponse, intlResponse, pathname);
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

  return mergeIntlCookies(response, intlResponse, pathname);
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
