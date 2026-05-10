'use client';

import { useTranslations } from 'next-intl';
import { NotFoundState } from '@/components/errors/not-found-state';

export default function AdminUserNotFound() {
  const t = useTranslations('error-pages');
  return (
    <NotFoundState
      title={t('perRoute.adminUsersId.notFoundTitle')}
      description={t('perRoute.adminUsersId.notFoundDescription')}
      primaryAction={{
        label: t('actions.backToAdmin'),
        href: '/admin/users',
      }}
    />
  );
}
