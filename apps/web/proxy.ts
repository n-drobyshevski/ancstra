import { NextResponse } from 'next/server';
import { auth } from './auth';

export const proxy = auth((request) => {
  const session = request.auth;

  if (!session?.user?.id) {
    // API routes get 401 JSON; browser pages get redirected to login
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Pass user info via request headers to downstream routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.user.id);

  // Resolve active family from cookie / URL param against memberships
  // baked into the JWT. This lets getAuthContext() in server components
  // read everything from headers without hitting the central DB.
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

  if (selected) {
    requestHeaders.set('x-family-id', selected.familyId);
    requestHeaders.set('x-family-role', selected.role);
    requestHeaders.set('x-family-db', selected.dbFilename);
  } else if (requestedFamilyId) {
    // Stale token / brand-new membership not yet in JWT — pass id only,
    // getAuthContext will fall back to a DB lookup.
    requestHeaders.set('x-family-id', requestedFamilyId);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // If family was set via URL param, save to cookie for future requests
  if (familyParam && familyParam !== familyCookie) {
    response.cookies.set('active-family', familyParam, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
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
