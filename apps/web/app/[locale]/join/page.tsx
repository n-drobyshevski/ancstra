import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { validateInviteToken } from '@ancstra/auth';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { JoinCard } from './join-card';
import { ErrorCard } from './error-card';

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await connection();
  const { token } = await searchParams;
  const t = await getTranslations('auth.join');
  if (!token) {
    return <ErrorCard message={t('noTokenError')} />;
  }

  const centralDb = createCentralDb();
  const session = await auth();
  const userEmail = session?.user?.email || undefined;

  // Validate the token
  const validation = await validateInviteToken(centralDb, token, userEmail);

  if (!validation.valid) {
    return <ErrorCard message={validation.reason} />;
  }

  const { invitation } = validation;

  // Get family name
  const family = await centralDb
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, invitation!.familyId))
    .get();

  const familyName = family?.name || t('fallbackFamilyName');

  // If user is logged in, show the join button
  if (session?.user?.id) {
    return (
      <JoinCard
        familyName={familyName}
        role={invitation!.role}
        token={token}
      />
    );
  }

  // Not logged in — show sign in/up options
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t('invitedTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.rich('invitedTagline', {
              family: familyName,
              role: invitation!.role,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=/join?token=${token}`}>
              {t('signInToJoin')}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/signup?callbackUrl=/join?token=${token}`}>
              {t('createAccountToJoin')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
