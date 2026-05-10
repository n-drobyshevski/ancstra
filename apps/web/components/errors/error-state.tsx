'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorShell, type ErrorShellAction } from './error-shell';
import { SpilledInkwell } from './illustrations';

export type ErrorStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
};

export function ErrorState({
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
}: ErrorStateProps) {
  const t = useTranslations('error-pages');
  return (
    <ErrorShell
      illustration={<SpilledInkwell className="size-32 sm:size-40" />}
      title={title ?? t('generic.title')}
      description={description ?? t('generic.description')}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      digest={digest}
      referenceLabel={t('reference.label')}
    />
  );
}
