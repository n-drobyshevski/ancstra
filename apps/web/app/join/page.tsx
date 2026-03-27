import { connection } from 'next/server';
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
  if (!token) {
    return <ErrorCard message="No invitation token provided." />;
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

  const familyName = family?.name || 'a family tree';

  // If user is logged in, show the join button
  if (session?.user?.id) {
    return (
      <JoinCard
        familyName={familyName}
        role={invitation!.role}
        token={token}
        userId={session.user.id}
      />
    );
  }

  // Not logged in — show sign in/up options
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>You&apos;ve Been Invited</CardTitle>
          <p className="text-sm text-muted-foreground">
            Join <strong>{familyName}</strong> as{' '}
            <strong>{invitation!.role}</strong>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=/join?token=${token}`}>
              Sign In to Join
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/signup?callbackUrl=/join?token=${token}`}>
              Create Account
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
