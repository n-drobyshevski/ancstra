import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed } from '@/components/activity/activity-feed';

export default async function ActivityPage() {
  const ctx = await requireAuthContext();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <ActivityFeed familyId={ctx.familyId} />
    </div>
  );
}
