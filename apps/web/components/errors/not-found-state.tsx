'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorShell, type ErrorShellAction } from './error-shell';
import { BrokenBranch } from './illustrations';

export type NotFoundStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
};

export function NotFoundState({
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
}: NotFoundStateProps) {
  const t = useTranslations('error-pages');
  return (
    <ErrorShell
      illustration={<BrokenBranch className="size-32 sm:size-40" />}
      title={title ?? t('notFound.title')}
      description={description ?? t('notFound.description')}
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
