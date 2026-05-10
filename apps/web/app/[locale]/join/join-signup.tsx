'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import {
  signUpAndAcceptAction,
  type SignUpAndAcceptState,
} from '@/server/api/routers/auth/_actions';

interface JoinSignupProps {
  token: string;
  /** Email locked into the invite, if any. When set, the signup form
   *  pre-fills and read-only-locks the email input so a user can't bypass
   *  the email constraint client-side. */
  invitedEmail: string | null;
  familyName: string;
  role: string;
}

/**
 * Inline signup form rendered on /join when the visitor is not authenticated.
 * On submit, calls `signUpAndAcceptAction` which combines the signup +
 * invite-accept handshake into one server roundtrip — no detour through
 * /signup, no extra "Click to accept" step. After success the action
 * redirects to /dashboard?family=…&invite=accepted.
 *
 * The "Sign in instead" tab is for users who already have an account but
 * landed on /join while logged out. OAuth buttons set their own callbackUrl
 * so the OAuth round-trip lands back here with `?auto=1`, which the parent
 * /join page interprets as a request to auto-accept.
 */
export function JoinSignup({ token, invitedEmail, familyName, role }: JoinSignupProps) {
  const t = useTranslations('auth.join.signup');
  const router = useRouter();

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState(invitedEmail ?? '');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupState, setSignupState] = useState<SignUpAndAcceptState>(undefined);
  const [signupPending, startSignupTransition] = useTransition();

  const [signinEmail, setSigninEmail] = useState(invitedEmail ?? '');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinError, setSigninError] = useState<string | null>(null);
  const [signinPending, setSigninPending] = useState(false);

  const oauthCallback = `/join?token=${encodeURIComponent(token)}&auto=1`;

  function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupState(undefined);
    startSignupTransition(async () => {
      // The action redirects on success; if we get a return value back it's
      // an error state to render in the form.
      const next = await signUpAndAcceptAction({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        token,
      });
      if (next) setSignupState(next);
    });
  }

  async function handleSigninSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSigninError(null);
    setSigninPending(true);
    const result = await signIn('credentials', {
      email: signinEmail,
      password: signinPassword,
      redirect: false,
    });
    if (result?.error) {
      setSigninError(t('invalidCredentials'));
      setSigninPending(false);
      return;
    }
    // Round-trip back to /join where the auto-accept path picks up the now-
    // authenticated session and finishes the join.
    router.push(`/join?token=${encodeURIComponent(token)}&auto=1`);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
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
          <Tabs defaultValue="signup">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">{t('tabSignup')}</TabsTrigger>
              <TabsTrigger value="signin">{t('tabSignin')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="pt-4">
              <form onSubmit={handleSignupSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('nameLabel')}</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    enterKeyHint="next"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                  {signupState?.errors?.name && (
                    <p role="alert" aria-live="polite" className="text-sm text-destructive">
                      {signupState.errors.name[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('emailLabel')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    enterKeyHint="next"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    readOnly={Boolean(invitedEmail)}
                    required
                  />
                  {invitedEmail && (
                    <p className="text-xs text-muted-foreground">{t('emailLocked')}</p>
                  )}
                  {signupState?.errors?.email && (
                    <p role="alert" aria-live="polite" className="text-sm text-destructive">
                      {signupState.errors.email[0]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('passwordLabel')}</Label>
                  <PasswordInput
                    id="signup-password"
                    minLength={8}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    toggleAriaLabel={{ show: t('passwordShow'), hide: t('passwordHide') }}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  {signupState?.errors?.password && (
                    <p role="alert" aria-live="polite" className="text-sm text-destructive">
                      {signupState.errors.password[0]}
                    </p>
                  )}
                </div>
                {signupState?.message && (
                  <p role="alert" aria-live="polite" className="text-sm text-destructive">
                    {signupState.message}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={signupPending}>
                  {signupPending ? t('joining') : t('createAndJoin')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signin" className="pt-4">
              <form onSubmit={handleSigninSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t('emailLabel')}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    enterKeyHint="next"
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t('passwordLabel')}</Label>
                  <PasswordInput
                    id="signin-password"
                    autoComplete="current-password"
                    enterKeyHint="go"
                    toggleAriaLabel={{ show: t('passwordShow'), hide: t('passwordHide') }}
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    required
                  />
                </div>
                {signinError && (
                  <p role="alert" aria-live="polite" className="text-sm text-destructive">
                    {signinError}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={signinPending}>
                  {signinPending ? t('signingIn') : t('signInAndJoin')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <OAuthButtons callbackUrl={oauthCallback} />
        </CardContent>
      </Card>
    </div>
  );
}
