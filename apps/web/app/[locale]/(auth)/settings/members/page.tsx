import { Suspense } from 'react';
import { requireAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@ancstra/auth';
import { redirect } from 'next/navigation';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { MemberList } from '@/components/members/member-list';
import { InviteDialog } from '@/components/members/invite-dialog';
import { PendingInvites } from '@/components/members/pending-invites';
import { MembersListSkeleton } from '@/components/skeletons/members-list-skeleton';

interface MembersPageProps {
  params: Promise<{ locale: Locale }>;
}

async function MembersContent({ params }: MembersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  if (!hasPermission(ctx.role, 'members:manage')) {
    redirect('/dashboard');
  }
  const t = await getTranslations('settings.members.page');

  const centralDb = createCentralDb();
  const family = await centralDb
    .select({ name: centralSchema.familyRegistry.name })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();
  const familyName = family?.name ?? t('fallbackFamilyName');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('heading')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('tagline')}
          </p>
        </div>
        <InviteDialog familyId={ctx.familyId} currentRole={ctx.role} />
      </div>
      <MemberList
        familyId={ctx.familyId}
        familyName={familyName}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
      />
      <PendingInvites familyId={ctx.familyId} />
    </div>
  );
}

export default function MembersPage({ params }: MembersPageProps) {
  return (
    <Suspense fallback={<MembersListSkeleton />}>
      <MembersContent params={params} />
    </Suspense>
  );
}
