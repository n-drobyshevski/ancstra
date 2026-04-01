import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { PagePadding } from '@/components/page-padding';

export default async function ActivityPage() {
  const ctx = await requireAuthContext();

  return (
    <PagePadding>
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <ActivityFeed familyId={ctx.familyId} />
    </div>
    </PagePadding>
  );
}
