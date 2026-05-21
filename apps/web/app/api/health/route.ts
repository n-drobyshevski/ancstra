import { NextResponse } from 'next/server';

// Lightweight liveness + version endpoint. Used by ops dashboards, uptime
// checks, and bug-report flows. Values come from build-time env injection in
// next.config.ts (NEXT_PUBLIC_APP_VERSION / _COMMIT). Under cacheComponents
// the handler runs per request — cheap because there's no IO. The legacy
// `export const dynamic = 'force-static'` is intentionally absent: Next 16's
// cacheComponents model rejects that route segment config.
export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? 'local',
    builtAt:
      process.env.VERCEL_DEPLOYMENT_CREATED_AT ??
      process.env.BUILD_TIMESTAMP ??
      null,
    env:
      process.env.VERCEL_ENV ??
      process.env.SENTRY_ENVIRONMENT ??
      process.env.NODE_ENV,
  });
}
