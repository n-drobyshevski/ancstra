import { Suspense } from 'react';
import { eq, and } from 'drizzle-orm';
import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed, type ActivityFeedMember } from '@/components/activity/activity-feed';
import { PagePadding } from '@/components/page-padding';
import { getCachedActivityFeed } from '@/lib/cache/activity';
import { ActivityFeedSkeleton } from '@/components/skeletons/activity-feed-skeleton';
import { getCentralDb } from '@/lib/db-singleton';
import { centralSchema } from '@ancstra/db';

export const metadata = { title: 'Activity' };

async function getFamilyMembers(familyId: string): Promise<ActivityFeedMember[]> {
  const db = await getCentralDb();
  const rows = await db
    .select({
      userId: centralSchema.familyMembers.userId,
      name: centralSchema.users.name,
      email: centralSchema.users.email,
    })
    .from(centralSchema.familyMembers)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyMembers.userId),
    )
    .where(
      and(
        eq(centralSchema.familyMembers.familyId, familyId),
        eq(centralSchema.familyMembers.isActive, 1),
      ),
    )
    .all();
  return rows.map((r) => ({ userId: r.userId, name: r.name, email: r.email }));
}

async function ActivityFeedServer({ familyId }: { familyId: string }) {
  const [feed, members] = await Promise.all([
    getCachedActivityFeed(familyId),
    getFamilyMembers(familyId),
  ]);
  return (
    <ActivityFeed
      familyId={familyId}
      initialItems={feed.items}
      initialCursor={feed.nextCursor}
      members={members}
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
