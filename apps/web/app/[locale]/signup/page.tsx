'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signUpAction as signUp, type SignUpState } from '@/server/api/routers/account/_actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PublicLocaleSwitcher } from '@/components/auth/public-locale-switcher';
import { safeCallbackPath } from '@/lib/auth/safe-callback-url';

function SignUpForm() {
  const t = useTranslations('auth.signup');
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get('callbackUrl')) ?? undefined;
  const [state, action, pending] = useActionState<SignUpState, FormData>(
    signUp,
    undefined
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <PublicLocaleSwitcher />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('tagline')}</p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            {callbackUrl && (
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                enterKeyHint="next"
                placeholder={t('namePlaceholder')}
                required
              />
              {state?.errors?.name && (
                <p role="alert" aria-live="polite" className="text-sm text-destructive">
                  {state.errors.name[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                placeholder={t('emailPlaceholder')}
                required
              />
              {state?.errors?.email && (
                <p role="alert" aria-live="polite" className="text-sm text-destructive">
                  {state.errors.email[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('passwordLabel')}</Label>
              <PasswordInput
                id="password"
                name="password"
                minLength={8}
                autoComplete="new-password"
                enterKeyHint="go"
                toggleAriaLabel={{ show: t('passwordShow'), hide: t('passwordHide') }}
                required
              />
              {state?.errors?.password && (
                <p role="alert" aria-live="polite" className="text-sm text-destructive">
                  {state.errors.password[0]}
                </p>
              )}
            </div>
            {state?.message && (
              <p role="alert" aria-live="polite" className="text-sm text-destructive">
                {state.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('creatingAccount') : t('createAccount')}
            </Button>
            <OAuthButtons callbackUrl={callbackUrl} />
            <p className="text-center text-sm text-muted-foreground">
              {t('haveAccountPrompt')}{' '}
              <Link
                href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login'}
                className="text-primary underline"
              >
                {t('signIn')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
