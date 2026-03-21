// docs/architecture/patterns/security-headers.ts
// Integration target: apps/web/next.config.ts
//
// Addresses: IS-1 (CSP), IS-6 (security headers)
// Usage: Import the headers function into next.config.ts

import type { NextConfig } from 'next';

const isWebMode = process.env.DEPLOYMENT_MODE === 'web';

const securityHeaders = [
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'",                    // No unsafe-inline, no unsafe-eval
      "style-src 'self' 'unsafe-inline'",     // Required by shadcn/ui
      "img-src 'self' data: blob:",           // data: for inline images, blob: for media
      "font-src 'self'",
      "connect-src 'self'",                   // API calls to same origin
      "frame-ancestors 'none'",               // Equivalent to X-Frame-Options: DENY
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // HSTS only in web mode (not localhost)
  ...(isWebMode
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

// Add to next.config.ts:
// async headers() {
//   return [{ source: '/(.*)', headers: securityHeaders }];
// }

export { securityHeaders };
