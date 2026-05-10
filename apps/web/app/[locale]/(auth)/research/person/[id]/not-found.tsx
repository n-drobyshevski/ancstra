'use client';

import { useTranslations } from 'next-intl';
import { NotFoundState } from '@/components/errors/not-found-state';

export default function ResearchPersonNotFound() {
  const t = useTranslations('error-pages');
  return (
    <NotFoundState
      title={t('perRoute.researchPersonId.notFoundTitle')}
      description={t('perRoute.researchPersonId.notFoundDescription')}
      primaryAction={{
        label: t('actions.backToResearch'),
        href: '/research',
      }}
    />
  );
}
