export { auth as proxy } from './auth';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/person/:path*',
    '/tree/:path*',
    '/research/:path*',
    '/import/:path*',
    '/export/:path*',
    '/settings/:path*',
  ],
};
