import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedStatCards } from '@/lib/cache/dashboard';

import { StatCards } from '@/components/dashboard/stat-cards';
import { RecentPersons } from '@/components/dashboard/recent-persons';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { QualityWidget } from '@/components/dashboard/quality-widget';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { EmptyDashboard } from '@/components/dashboard/empty-dashboard';
import { MobileAddButton } from '@/components/dashboard/mobile-add-button';

import { StatCardsSkeleton } from '@/components/skeletons/stat-cards-skeleton';
import { RecentPersonsSkeleton } from '@/components/skeletons/recent-persons-skeleton';
import { QualityWidgetSkeleton } from '@/components/skeletons/quality-widget-skeleton';
import { RecentActivitySkeleton } from '@/components/skeletons/recent-activity-skeleton';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const canReview = hasPermission(authContext.role, 'contributions:review');

  const { totalPersons } = await getCachedStatCards(authContext.dbFilename);

  return (
    <PagePadding>
      <div className="space-y-4 md:space-y-6">
        <WelcomeCard />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Welcome to Ancstra</h1>
            <p className="text-sm text-muted-foreground">
              {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in your
              tree.
            </p>
          </div>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>

        {totalPersons === 0 ? (
          <EmptyDashboard />
        ) : (
          <>
            <Suspense fallback={<StatCardsSkeleton />}>
              <StatCards dbFilename={authContext.dbFilename} />
            </Suspense>

            <QuickActions />

            <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
              <Suspense fallback={<RecentPersonsSkeleton />}>
                <RecentPersons dbFilename={authContext.dbFilename} />
              </Suspense>

              <div className="space-y-4 md:space-y-6">
                <Suspense fallback={<QualityWidgetSkeleton />}>
                  <QualityWidget dbFilename={authContext.dbFilename} />
                </Suspense>

                <Suspense fallback={<RecentActivitySkeleton />}>
                  <RecentActivity familyId={authContext.familyId} />
                </Suspense>
              </div>
            </div>

            {canReview && (
              <ContributionQueue familyId={authContext.familyId} />
            )}
          </>
        )}
      </div>

      <MobileAddButton />
    </PagePadding>
  );
}
