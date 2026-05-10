'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorShell, type ErrorShellAction } from './error-shell';
import { SealedScroll } from './illustrations';

export type ForbiddenStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
};

export function ForbiddenState({
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
}: ForbiddenStateProps) {
  const t = useTranslations('error-pages');
  return (
    <ErrorShell
      illustration={<SealedScroll className="size-32 sm:size-40" />}
      title={title ?? t('forbidden.title')}
      description={description ?? t('forbidden.description')}
      primaryAction={
        primaryAction ?? {
          label: t('actions.backToHome'),
          href: '/',
        }
      }
      secondaryAction={secondaryAction}
      digest={digest}
      referenceLabel={t('reference.label')}
    />
  );
}
