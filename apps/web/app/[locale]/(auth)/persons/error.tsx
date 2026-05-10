'use client';

import { useTranslations } from 'next-intl';
import { RouteError } from '@/components/errors/route-error';

export default function PersonsError(props: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  const t = useTranslations('error-pages');
  return (
    <RouteError
      {...props}
      segment="persons"
      description={t('perRoute.persons.genericDescription')}
      back="home"
    />
  );
}
