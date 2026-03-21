// docs/architecture/patterns/cookie-security.ts
// Integration target: apps/web/auth.ts (NextAuth.js v5 config)
//
// Addresses: AA-2 (session token security in local vs web mode)
//
// NextAuth.js v5 cookie configuration must be environment-aware:
// - Local mode (localhost): Secure flag cannot be set (no TLS)
// - Web mode (Vercel): Secure, HttpOnly, SameSite=Strict required

const isWebMode = process.env.DEPLOYMENT_MODE === 'web';

/**
 * Cookie configuration for NextAuth.js v5.
 * Add to NextAuthConfig.cookies in apps/web/auth.ts
 */
export const cookieConfig = {
  sessionToken: {
    name: isWebMode ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
      path: '/',
      // Secure flag: true for web mode (requires HTTPS), false for localhost
      secure: isWebMode,
    },
  },
  csrfToken: {
    name: isWebMode ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
      path: '/',
      secure: isWebMode,
    },
  },
};

// Usage in apps/web/auth.ts:
//
// import { cookieConfig } from '@/lib/auth/cookie-security';
//
// export const { handlers, auth, signIn, signOut } = NextAuth({
//   cookies: cookieConfig,
//   // ... other config
// });
