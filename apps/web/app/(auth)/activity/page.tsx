import { Suspense } from 'react';
import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { PagePadding } from '@/components/page-padding';
import { getCachedActivityFeed } from '@/lib/cache/activity';
import { ActivityFeedSkeleton } from '@/components/skeletons/activity-feed-skeleton';

export const metadata = { title: 'Activity' };

async function ActivityFeedServer({ familyId }: { familyId: string }) {
  const feed = await getCachedActivityFeed(familyId);
  return (
    <ActivityFeed
      familyId={familyId}
      initialItems={feed.items}
      initialCursor={feed.nextCursor}
    />
  );
}

export default async function ActivityPage() {
  const ctx = await requireAuthContext();

  return (
    <PagePadding>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedServer familyId={ctx.familyId} />
        </Suspense>
      </div>
    </PagePadding>
  );
}
