import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import { QualityWidget } from '@/components/dashboard/quality-widget';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { WhatsNewMilestones } from '@/components/dashboard/whats-new-milestones';
import { QualityWidgetSkeleton } from '@/components/skeletons/quality-widget-skeleton';
import { RecentActivitySkeleton } from '@/components/skeletons/recent-activity-skeleton';

/**
 * @aside slot — Phase 4.
 *
 * Composition by effective role:
 *   - Owner / Admin / Editor → QualityWidget + RecentActivity (unchanged from
 *     prior phases).
 *   - Viewer → WhatsNewMilestones + RecentActivity. Quality is hidden for
 *     viewers because they can't act on it; the activity feed becomes the
 *     primary "what changed?" surface, supplemented by a weekly rollup of
 *     concrete data milestones.
 *
 * Suppressed by the layout when totalPersons===0; we still short-circuit
 * defensively in case the layout's gate ever loosens.
 */
export default async function AsideSlot() {
  if (!isDashboardV2Enabled()) return null;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { totalPersons } = await getCachedStatCards(ctx.dbFilename);
  if (totalPersons === 0) return null;

  if (ctx.role === 'viewer') {
    return (
      <>
        <WhatsNewMilestones dbFilename={ctx.dbFilename} />
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivity familyId={ctx.familyId} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<QualityWidgetSkeleton />}>
        <QualityWidget dbFilename={ctx.dbFilename} />
      </Suspense>
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivity familyId={ctx.familyId} />
      </Suspense>
    </>
  );
}
