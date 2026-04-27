import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: true,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Session Replay: disabled by default to keep client bundle small.
  // Replay is lazy-loaded below; sample rates kick in only after the
  // replay bundle has been downloaded for a particular session.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,
});

// Lazy-load Replay so its ~70KB worth of JS isn't shipped on every page load.
// Trade-off: replay buffer starts after the integration loads, so the very
// first paint of a session won't be captured if an error fires before it
// finishes loading. Acceptable for our usage.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.lazyLoadIntegration('replayIntegration')
    .then((replayIntegration) => {
      Sentry.addIntegration(
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        })
      );
    })
    .catch(() => {
      // Replay is best-effort — ignore load failures
    });
}

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
