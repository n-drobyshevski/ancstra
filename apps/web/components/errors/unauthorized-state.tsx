'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorShell, type ErrorShellAction } from './error-shell';
import { ClosedGate } from './illustrations';

export type UnauthorizedStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
};

export function UnauthorizedState({
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
}: UnauthorizedStateProps) {
  const t = useTranslations('error-pages');
  return (
    <ErrorShell
      illustration={<ClosedGate className="size-32 sm:size-40" />}
      title={title ?? t('unauthorized.title')}
      description={description ?? t('unauthorized.description')}
      primaryAction={
        primaryAction ?? {
          label: t('actions.signIn'),
          href: '/login',
        }
      }
      secondaryAction={secondaryAction}
      digest={digest}
      referenceLabel={t('reference.label')}
    />
  );
}
