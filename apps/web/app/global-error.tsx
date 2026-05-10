'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './globals.css';
import { SpilledInkwell } from '@/components/errors/illustrations/spilled-inkwell';

const DICT = {
  en: {
    title: 'Something went wrong',
    description:
      "An unexpected error tipped the inkwell. Try reloading the page — and if it keeps happening, share the reference below with support.",
    tryAgain: 'Try again',
    backToHome: 'Back to home',
    referenceLabel: 'Reference',
  },
  ru: {
    title: 'Что-то пошло не так',
    description:
      'Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу — если ошибка повторится, отправьте код ниже в поддержку.',
    tryAgain: 'Попробовать снова',
    backToHome: 'На главную',
    referenceLabel: 'Код ошибки',
  },
} as const;

type Locale = keyof typeof DICT;

function readLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const value = match?.[1];
  return value === 'ru' ? 'ru' : 'en';
}

export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  // Default to 'en' on first render so SSR HTML matches; once the client
  // mounts, swap in the user's actual locale from the NEXT_LOCALE cookie.
  // Reading the cookie inside an effect is required because document is
  // not available during SSR, and reading it during render would cause a
  // hydration mismatch.
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: cookie read is a client-only side effect, must defer until mount
    setLocale(readLocale());
  }, []);

  useEffect(() => {
    // The instrumentation.ts onRequestError already captured server-side
    // throws (those carry a digest). Capture here only for client-only
    // crashes, fingerprinted to dedup with the server event when both fire.
    if (!error.digest) {
      Sentry.captureException(error, {
        tags: { errorBoundary: 'global-error' },
        fingerprint: ['global-error', error.message || error.name || 'unknown'],
      });
    }
  }, [error]);

  const t = DICT[locale];
  const retry = unstable_retry ?? reset;

  return (
    <html lang={locale}>
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="text-muted-foreground/40 dark:text-muted-foreground/55">
            <SpilledInkwell className="size-32 sm:size-40" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-3 max-w-md text-base text-muted-foreground">
            {t.description}
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:w-auto sm:flex-row">
            {retry ? (
              <button
                type="button"
                onClick={retry}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
              >
                {t.tryAgain}
              </button>
            ) : null}
            <Link
              href="/"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto"
            >
              {t.backToHome}
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-8 text-xs text-muted-foreground/70">
              <span>{t.referenceLabel}:</span>{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                {error.digest}
              </code>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
