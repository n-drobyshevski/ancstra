'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('admin.error');
  useEffect(() => {
    console.error('[admin] route error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="size-12 text-destructive mb-4" aria-hidden />
      <h2 className="text-xl font-semibold mb-2">{t('heading')}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || t('fallbackMessage')}
      </p>
      <Button onClick={reset}>{t('tryAgain')}</Button>
    </div>
  );
}
