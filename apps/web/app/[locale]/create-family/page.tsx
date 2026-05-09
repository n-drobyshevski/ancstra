'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createFamilyAction, type CreateFamilyState } from '@/server/api/routers/family/_actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function CreateFamilyPage() {
  const t = useTranslations('auth.createFamily');
  const [state, action, pending] = useActionState<CreateFamilyState, FormData>(
    createFamilyAction,
    undefined,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('tagline')}</p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t('namePlaceholder')}
                required
              />
              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('creating') : t('create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
