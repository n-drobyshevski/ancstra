import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: true,
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,

  enableLogs: true,

  integrations: [
    // Vercel AI SDK (covers @ai-sdk/anthropic)
    Sentry.vercelAIIntegration(),
  ],
});
