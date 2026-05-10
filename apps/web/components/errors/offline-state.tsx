'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorShell, type ErrorShellAction } from './error-shell';
import { DisconnectedBranches } from './illustrations';

export type OfflineStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
};

export function OfflineState({
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
}: OfflineStateProps) {
  const t = useTranslations('error-pages');
  return (
    <ErrorShell
      illustration={<DisconnectedBranches className="size-32 sm:size-40" />}
      title={title ?? t('offline.title')}
      description={description ?? t('offline.description')}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      digest={digest}
      referenceLabel={t('reference.label')}
    />
  );
}
