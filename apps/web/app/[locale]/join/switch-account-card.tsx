'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SwitchAccountCardProps {
  inviteEmail: string;
  userEmail: string;
  token: string;
}

/**
 * Rendered when an authenticated user clicks an email-locked invite that's
 * addressed to a different email. Offering an explicit "switch account"
 * button is friendlier than the generic "Email does not match invitation"
 * error, which leaves users wondering what to do next.
 *
 * "Switch account" signs out and returns to /join with the same token, so
 * the unauth branch picks up and shows the inline signup form (with the
 * invited email already pre-filled and locked).
 */
export function SwitchAccountCard({ inviteEmail, userEmail, token }: SwitchAccountCardProps) {
  const t = useTranslations('auth.join.switchAccount');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.rich('tagline', {
              inviteEmail,
              userEmail,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={() =>
              signOut({ callbackUrl: `/join?token=${encodeURIComponent(token)}` })
            }
          >
            {t('switch')}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">{t('cancel')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
