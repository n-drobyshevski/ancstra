'use client';

import { useTranslations } from 'next-intl';
import { NotFoundState } from '@/components/errors/not-found-state';

export default function AdminFamilyNotFound() {
  const t = useTranslations('error-pages');
  return (
    <NotFoundState
      title={t('perRoute.adminFamiliesId.notFoundTitle')}
      description={t('perRoute.adminFamiliesId.notFoundDescription')}
      primaryAction={{
        label: t('actions.backToAdmin'),
        href: '/admin/families',
      }}
    />
  );
}
