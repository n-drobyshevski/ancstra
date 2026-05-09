import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { acceptInvite, logActivity, type ActivityAction, validateInviteToken } from '@ancstra/auth';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { JoinCard } from './join-card';
import { ErrorCard } from './error-card';
import { JoinSignup } from './join-signup';
import { SwitchAccountCard } from './switch-account-card';
import { PublicLocaleSwitcher } from '@/components/auth/public-locale-switcher';

interface JoinPageProps {
  searchParams: Promise<{ token?: string; auto?: string }>;
}

async function JoinContent({ searchParams }: JoinPageProps) {
  // Opt the whole route into runtime: token validation + session lookup are
  // dynamic by definition, no point trying to prerender.
  await connection();
  const { token, auto } = await searchParams;
  const t = await getTranslations('auth.join');
  if (!token) {
    return <ErrorCard message={t('noTokenError')} />;
  }

  const centralDb = createCentralDb();
  const session = await auth();
  const userEmail = session?.user?.email || undefined;
  const userId = session?.user?.id;

  // Validate WITHOUT passing the user's email so we can distinguish "invite is
  // dead" (revoked / expired / accepted) from "invite is for a different
  // email" — the latter is recoverable via the switch-account flow, the
  // former isn't.
  const validation = await validateInviteToken(centralDb, token);
  if (!validation.valid) {
    return <ErrorCard message={validation.reason} />;
  }

  const invitation = validation.invitation!;

  const family = await centralDb
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, invitation.familyId))
    .get();

  const familyName = family?.name || t('fallbackFamilyName');

  // Authenticated paths.
  if (userId) {
    // Email-locked invite + signed-in user with a different email — surface
    // the switch-account card instead of a hard error so the user knows what
    // to do.
    if (invitation.email && userEmail && invitation.email !== userEmail) {
      return (
        <SwitchAccountCard
          inviteEmail={invitation.email}
          userEmail={userEmail}
          token={token}
        />
      );
    }

    // Auto-accept path: the inline-signup form and the OAuth round-trip both
    // append `?auto=1` so the user lands here already-authed and we can
    // close the loop without an extra "Click to accept" button.
    if (auto === '1') {
      await acceptInvite(centralDb, token, userId);
      await logActivity(centralDb, {
        familyId: invitation.familyId,
        userId,
        action: 'invite_accepted' as ActivityAction,
        summary: 'Joined the family',
      });
      redirect(`/dashboard?family=${invitation.familyId}&invite=accepted`);
    }

    return (
      <JoinCard
        familyName={familyName}
        role={invitation.role}
        token={token}
      />
    );
  }

  // Unauthenticated: inline signup. Email-locked invites pre-fill and lock
  // the email field so the user can't type a different one.
  return (
    <JoinSignup
      token={token}
      invitedEmail={invitation.email}
      familyName={familyName}
      role={invitation.role}
    />
  );
}

export default function JoinPage({ searchParams }: JoinPageProps) {
  return (
    <>
      <PublicLocaleSwitcher />
      <Suspense fallback={null}>
        <JoinContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
