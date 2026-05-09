import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ErrorCardProps {
  message?: string;
}

export async function ErrorCard({ message }: ErrorCardProps) {
  const t = await getTranslations('auth.join.error');
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {message || t('fallbackMessage')}
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">{t('goToLogin')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
