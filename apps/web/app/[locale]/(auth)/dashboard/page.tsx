import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { PagePadding } from '@/components/page-padding';

import { DashboardCount } from '@/components/dashboard/dashboard-count';
import { DashboardBody } from '@/components/dashboard/dashboard-body';
import { MobileAddButton } from '@/components/dashboard/mobile-add-button';
import { InviteAcceptedToast } from '@/components/dashboard/invite-accepted-toast';
import { RoleGate } from '@/components/auth/role-gate';

import { DashboardCountSkeleton } from '@/components/skeletons/dashboard-count-skeleton';
import { DashboardBodySkeleton } from '@/components/skeletons/dashboard-body-skeleton';

// Static shell: no top-level awaits. Auth + data resolve inside Suspense'd
// children so the page HTML can be prerendered and shipped from the edge.
export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  return (
    <PagePadding>
      <InviteAcceptedToast />
      <div className="space-y-4 md:space-y-6">
        <WelcomeCard />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <Suspense fallback={<DashboardCountSkeleton />}>
              <DashboardCount />
            </Suspense>
          </div>
          <RoleGate permission="person:create">
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/persons/new">{t('addNewPerson')}</Link>
            </Button>
          </RoleGate>
        </div>

        <Suspense fallback={<DashboardBodySkeleton />}>
          <DashboardBody />
        </Suspense>
      </div>

      <MobileAddButton />
    </PagePadding>
  );
}
