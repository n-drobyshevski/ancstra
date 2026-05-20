// Renamed from Nextra docs' "proxy.ts" — Next.js 15 only auto-discovers middleware.ts.
export { proxy as middleware } from 'nextra/locales';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest|_pagefind|sitemap.xml|robots.txt).*)',
  ],
};
