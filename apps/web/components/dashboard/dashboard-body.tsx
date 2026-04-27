import { Suspense } from 'react';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { StatCards } from '@/components/dashboard/stat-cards';
import { RecentPersons } from '@/components/dashboard/recent-persons';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { QualityWidget } from '@/components/dashboard/quality-widget';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { EmptyDashboard } from '@/components/dashboard/empty-dashboard';
import { ContributionQueue } from '@/components/moderation/contribution-queue';

import { StatCardsSkeleton } from '@/components/skeletons/stat-cards-skeleton';
import { RecentPersonsSkeleton } from '@/components/skeletons/recent-persons-skeleton';
import { QualityWidgetSkeleton } from '@/components/skeletons/quality-widget-skeleton';
import { RecentActivitySkeleton } from '@/components/skeletons/recent-activity-skeleton';

export async function DashboardBody() {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  const canReview = hasPermission(authContext.role, 'contributions:review');
  const { totalPersons } = await getCachedStatCards(authContext.dbFilename);

  if (totalPersons === 0) {
    return <EmptyDashboard />;
  }

  return (
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

      {canReview && <ContributionQueue familyId={authContext.familyId} />}
    </>
  );
}
