import { NextResponse } from 'next/server';

// Lightweight liveness + version endpoint. Used by ops dashboards, uptime
// checks, and bug-report flows. Values come from build-time env injection in
// next.config.ts so the response is static per-deploy (no DB reads here on
// purpose — keep it cheap and dependency-free).
export const dynamic = 'force-static';

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
