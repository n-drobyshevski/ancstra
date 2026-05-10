'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { acceptInviteAction } from '@/server/api/routers/auth/_actions';

interface JoinCardProps {
  familyName: string;
  role: string;
  token: string;
}

export function JoinCard({ familyName, role, token }: JoinCardProps) {
  const t = useTranslations('auth.join.card');
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      await acceptInviteAction({ token });
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.rich('tagline', {
              family: familyName,
              role,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleAccept}>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t('joining') : t('accept')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
