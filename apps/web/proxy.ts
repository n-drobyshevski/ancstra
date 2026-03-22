import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  // Read the JWT session token directly (proxy runs in a separate context)
  const token = await getToken({ req: request });

  if (!token?.userId) {
    // Not authenticated — redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Pass user info via request headers to downstream routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', token.userId as string);

  // Read active family from cookie or URL param
  const familyParam = request.nextUrl.searchParams.get('family');
  const familyCookie = request.cookies.get('active-family')?.value;
  const activeFamilyId = familyParam || familyCookie || '';

  if (activeFamilyId) {
    requestHeaders.set('x-family-id', activeFamilyId);
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
}

// Only run proxy on protected routes
export const config = {
  matcher: [
    // Match all paths EXCEPT public routes and static files
    '/((?!login|signup|join|create-family|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
