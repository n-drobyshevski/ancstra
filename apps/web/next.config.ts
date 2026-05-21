import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Single source of truth for app version: apps/web/package.json (kept in
// lockstep with root package.json by release-please's node-workspace plugin).
// pnpm sets `npm_package_version` automatically when running package scripts
// (build, dev, test), so no fs read is required — which avoids Turbopack's
// NFT tracer flagging next.config.ts as a dynamic-import source for routes.
const APP_VERSION = process.env.npm_package_version ?? '0.0.0';
const APP_COMMIT =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GITHUB_SHA?.slice(0, 7) ??
  'local';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_APP_COMMIT: APP_COMMIT,
  },
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
    ignoreBuildErrors: false,
  },
  devIndicators: {
    // Default 'bottom-left' overlaps the sidebar footer's "More" collapsible.
    // The dev toast's z-index is INT32_MAX so it wins hit-testing and
    // silently eats clicks on anything in that corner.
    position: 'bottom-right',
  },
};

// Skip Sentry wrapper in local dev to avoid proxy compilation hang
const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? withNextIntl(withAnalyzer(nextConfig))
  : withSentryConfig(withNextIntl(withAnalyzer(nextConfig)), {
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
