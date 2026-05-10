'use client';

import * as React from 'react';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import {
  classifyError,
  type ErrorClassification,
} from './classify-error';
import { ErrorState } from './error-state';
import { ForbiddenState } from './forbidden-state';
import { UnauthorizedState } from './unauthorized-state';
import { OfflineState } from './offline-state';
import type { ErrorShellAction } from './error-shell';

export type StandardBackLink =
  | 'home'
  | 'persons'
  | 'research'
  | 'admin'
  | 'settings'
  | 'tree';

export type RouteErrorProps = {
  error: Error & { digest?: string };
  /** Next.js 16.2+ retry callback (preferred). */
  unstable_retry?: () => void;
  /** Next.js < 16.2 retry callback (still supported, but only clears state). */
  reset?: () => void;
  /** Stable identifier for this route — sent to Sentry as a tag. */
  segment: string;
  /**
   * Optional secondary "back to <parent>" link. Pass a standard key for the
   * common targets, or a fully custom `{ label, href }` for one-offs.
   */
  back?: StandardBackLink | { label: string; href: string };
  /** Override per-state title (already translated). */
  title?: React.ReactNode;
  /** Override per-state description (already translated). */
  description?: React.ReactNode;
  /**
   * Force a specific classification, bypassing auto-detection. Useful when
   * the wrapper knows the route's expected failure modes (e.g. permission
   * gate → 'forbidden') and the production message has been sanitized.
   */
  classifyAs?: ErrorClassification;
};

export function RouteError({
  error,
  unstable_retry,
  reset,
  segment,
  back,
  title,
  description,
  classifyAs,
}: RouteErrorProps) {
  const t = useTranslations('error-pages');

  useEffect(() => {
    // The instrumentation.ts onRequestError already captured server-side
    // throws (those have a digest). Capture here only when the client
    // raised something the server never saw — avoids duplicate Sentry events.
    if (!error.digest) {
      Sentry.captureException(error, {
        tags: { route: segment, errorBoundary: 'route' },
        fingerprint: [
          `route:${segment}`,
          error.message || error.name || 'unknown',
        ],
      });
    }
  }, [error, segment]);

  const classification = classifyAs ?? classifyError(error);
  const retry = unstable_retry ?? reset;

  const backAction = resolveBack(back, t);
  const tryAgainAction: ErrorShellAction | undefined = retry
    ? { label: t('actions.tryAgain'), onClick: retry }
    : undefined;

  switch (classification) {
    case 'forbidden':
      return (
        <ForbiddenState
          title={title}
          description={description}
          primaryAction={backAction ?? defaultHomeAction(t)}
          secondaryAction={tryAgainAction}
          digest={error.digest}
        />
      );
    case 'unauthorized':
      return (
        <UnauthorizedState
          title={title}
          description={description}
          primaryAction={{ label: t('actions.signIn'), href: '/login' }}
          secondaryAction={backAction}
          digest={error.digest}
        />
      );
    case 'offline':
      return (
        <OfflineState
          title={title}
          description={description}
          primaryAction={tryAgainAction}
          secondaryAction={backAction}
          digest={error.digest}
        />
      );
    case 'generic':
    default:
      return (
        <ErrorState
          title={title}
          description={description}
          primaryAction={tryAgainAction}
          secondaryAction={backAction}
          digest={error.digest}
        />
      );
  }
}

function defaultHomeAction(
  t: ReturnType<typeof useTranslations<'error-pages'>>,
): ErrorShellAction {
  return { label: t('actions.backToHome'), href: '/' };
}

function resolveBack(
  back: RouteErrorProps['back'],
  t: ReturnType<typeof useTranslations<'error-pages'>>,
): ErrorShellAction | undefined {
  if (!back) return undefined;
  if (typeof back !== 'string') {
    return { variant: 'ghost', ...back };
  }
  switch (back) {
    case 'home':
      return { label: t('actions.backToHome'), href: '/', variant: 'ghost' };
    case 'persons':
      return {
        label: t('actions.backToPersons'),
        href: '/persons',
        variant: 'ghost',
      };
    case 'research':
      return {
        label: t('actions.backToResearch'),
        href: '/research',
        variant: 'ghost',
      };
    case 'admin':
      return {
        label: t('actions.backToAdmin'),
        href: '/admin',
        variant: 'ghost',
      };
    case 'settings':
      return {
        label: t('actions.backToSettings'),
        href: '/settings',
        variant: 'ghost',
      };
    case 'tree':
      return {
        label: t('actions.backToTree'),
        href: '/tree',
        variant: 'ghost',
      };
  }
}
