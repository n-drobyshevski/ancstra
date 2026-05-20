import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Explicit env tag — Sentry SDK doesn't auto-read VERCEL_ENV.
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  sendDefaultPii: true,
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  enableLogs: true,
});
