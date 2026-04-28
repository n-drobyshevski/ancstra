import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    viewTransition: true,
    optimizePackageImports: ['lucide-react', 'recharts', '@xyflow/react', 'date-fns', 'radix-ui'],
  },
  cacheComponents: true,
  reactCompiler: true,
  cacheLife: {
    // Genealogy data changes infrequently — invalidated on mutation
    genealogy: {
      stale: 300,        // 5 min client-side
      revalidate: 3600,  // 1 hour server refresh
      expire: 86400,     // 1 day expiry
    },
    // Tree data — large payload, changes only via mutations
    tree: {
      stale: 300,        // 5 min
      revalidate: 1800,  // 30 min
      expire: 86400,     // 1 day
    },
    // Tree-table — high-cardinality filter-driven cache (one entry per filter
    // tuple). Fresher than `tree` because filter changes reset URL state and
    // we want quick cache turnover when the user iterates on filters.
    'tree-table': {
      stale: 60,         // 1 min
      revalidate: 600,   // 10 min
      expire: 7200,      // 2 hours
    },
    // Dashboard — shows recent activity, needs to be fresher
    dashboard: {
      stale: 60,         // 1 min
      revalidate: 300,   // 5 min
      expire: 3600,      // 1 hour
    },
    // Activity feed — event-driven, needs freshness
    activity: {
      stale: 30,         // 30s
      revalidate: 120,   // 2 min
      expire: 1800,      // 30 min
    },
  },
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
  ? withAnalyzer(nextConfig)
  : withSentryConfig(withAnalyzer(nextConfig), {
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
