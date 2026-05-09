import { Suspense } from 'react';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import { RecentPersons } from '@/components/dashboard/recent-persons';
import { EmptyDashboard } from '@/components/dashboard/empty-dashboard';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { RecentPersonsSkeleton } from '@/components/skeletons/recent-persons-skeleton';

/**
 * @primary slot — Phase 2.
 *
 * Composition:
 *   - Empty tree (any role) → EmptyDashboard, full-width via the layout.
 *   - Admin (with `contributions:review`) → ContributionQueue *first* (their
 *     primary triage surface), then RecentPersons for orientation.
 *   - Other roles → RecentPersons.
 *
 * The contribution queue self-suppresses when there are no items, so admins
 * with an empty queue still see the people list — never an empty primary col.
 *
 * `id="contribution-queue"` matches the anchor used by ModerationHero's
 * "Review" CTA so clicking it scrolls down to the queue.
 */
export default async function PrimarySlot() {
  if (!isDashboardV2Enabled()) return null;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { totalPersons } = await getCachedStatCards(ctx.dbFilename);

  if (totalPersons === 0) {
    return <EmptyDashboard />;
  }

  const showQueueHere = ctx.role === 'admin' && hasPermission(ctx.role, 'contributions:review');

  return (
    <>
      {showQueueHere && (
        <div id="contribution-queue" className="scroll-mt-4">
          <ContributionQueue familyId={ctx.familyId} />
        </div>
      )}
      <Suspense fallback={<RecentPersonsSkeleton />}>
        <RecentPersons dbFilename={ctx.dbFilename} />
      </Suspense>
    </>
  );
}
