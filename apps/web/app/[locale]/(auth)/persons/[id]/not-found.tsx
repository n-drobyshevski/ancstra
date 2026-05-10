'use client';

import { useTranslations } from 'next-intl';
import { NotFoundState } from '@/components/errors/not-found-state';

export default function PersonNotFound() {
  const t = useTranslations('error-pages');
  return (
    <NotFoundState
      title={t('perRoute.personsId.notFoundTitle')}
      description={t('perRoute.personsId.notFoundDescription')}
      primaryAction={{
        label: t('actions.backToPersons'),
        href: '/persons',
      }}
    />
  );
}
