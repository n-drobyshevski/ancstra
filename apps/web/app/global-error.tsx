'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>We&apos;ve been notified and are looking into it.</p>
          <button onClick={() => unstable_retry()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
