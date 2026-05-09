'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('activity.error');
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="size-12 text-destructive/50" />
      <h2 className="mt-4 text-lg font-semibold">{t('heading')}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {error.message || t('fallbackMessage')}
      </p>
      <Button variant="outline" className="mt-6" onClick={reset}>
        {t('tryAgain')}
      </Button>
    </div>
  );
}
