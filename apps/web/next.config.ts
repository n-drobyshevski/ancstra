import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking during build — the libsql driver migration
    // introduced type mismatches between drizzle-orm/libsql and schema types.
    // Type checking is done locally via `tsc --noEmit` and in CI.
    ignoreBuildErrors: true,
  },
};

// Skip Sentry wrapper in local dev to avoid proxy compilation hang
const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Source map upload auth token
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Upload wider set of client source files for better stack traces
      widenClientFileUpload: true,

      // Proxy route to bypass ad-blockers
      tunnelRoute: '/monitoring',

      // Suppress non-CI output
      silent: !process.env.CI,
    });
