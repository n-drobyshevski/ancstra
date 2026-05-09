import { Suspense } from 'react';
import type { Metadata } from 'next';
import { eq, and } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed, type ActivityFeedMember } from '@/components/activity/activity-feed';
import { ActivityPageHeader } from '@/components/activity/activity-page-header';
import { ActivityStatBand } from '@/components/activity/activity-stat-band';
import { PagePadding } from '@/components/page-padding';
import { getCachedActivityFeed } from '@/lib/cache/activity';
import { ActivityFeedSkeleton } from '@/components/skeletons/activity-feed-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { getCentralDb } from '@/lib/db-singleton';
import { centralSchema } from '@ancstra/db';
import {
  getActivityVisibility,
  filterEntriesByVisibility,
  type ActivityVisibility,
} from '@/lib/activity-visibility';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('activity.page');
  return { title: t('title') };
}

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

async function ActivityFeedServer({
  familyId,
  visibility,
}: {
  familyId: string;
  visibility: ActivityVisibility;
}) {
  const [feed, members] = await Promise.all([
    getCachedActivityFeed(familyId),
    getFamilyMembers(familyId),
  ]);
  // The cached loader is shared across roles; trim to the visible set before
  // sending to the client so the role-aware stat counts align with the feed.
  const visibleItems = filterEntriesByVisibility(feed.items, visibility);
  return (
    <ActivityFeed
      familyId={familyId}
      visibility={visibility}
      initialItems={visibleItems}
      initialCursor={feed.nextCursor}
      members={members}
    />
  );
}

function StatBandSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[68px] rounded-xl" />
      ))}
    </div>
  );
}

export default async function ActivityPage() {
  const ctx = await requireAuthContext();
  const visibility = getActivityVisibility(ctx.role);

  return (
    <PagePadding>
      <div className="space-y-6">
        <ActivityPageHeader role={ctx.role} />

        <Suspense fallback={<StatBandSkeleton />}>
          <ActivityStatBand familyId={ctx.familyId} visibility={visibility} />
        </Suspense>

        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedServer familyId={ctx.familyId} visibility={visibility} />
        </Suspense>
      </div>
    </PagePadding>
  );
}
