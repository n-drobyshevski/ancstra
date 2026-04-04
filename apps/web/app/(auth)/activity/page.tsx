import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { PagePadding } from '@/components/page-padding';
import { getCachedActivityFeed } from '@/lib/cache/activity';

export const metadata = { title: 'Activity' };

export default async function ActivityPage() {
  const ctx = await requireAuthContext();
  const feed = await getCachedActivityFeed(ctx.familyId);

  return (
    <PagePadding>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <ActivityFeed
          familyId={ctx.familyId}
          initialItems={feed.items}
          initialCursor={feed.nextCursor}
        />
      </div>
    </PagePadding>
  );
}
