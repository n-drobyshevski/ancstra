import { Suspense } from 'react';
import type { Metadata } from 'next';
import { eq, and } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
import type { Locale } from '@/i18n/routing';
import {
  getActivityVisibility,
  filterEntriesByVisibility,
} from '@/lib/activity-visibility';

interface ActivityPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: ActivityPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'activity.page' });
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

// Each section reads auth context independently. NextAuth's `auth()` and
// `headers()` are React-cached per request, so the duplication is effectively
// free — and it keeps the page sync so cacheComponents can stream the layout
// without waiting on cookies/headers (Next.js 16 blocking-route diagnostic).
//
// Each Suspense'd async section calls `setRequestLocale` itself: under
// cacheComponents the layout's setRequestLocale call doesn't propagate
// through Suspense boundaries to deferred async children.
async function ActivityHeaderSection({ params }: ActivityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  return <ActivityPageHeader role={ctx.role} />;
}

async function ActivityStatBandSection({ params }: ActivityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  const visibility = getActivityVisibility(ctx.role);
  return (
    <ActivityStatBand
      familyId={ctx.familyId}
      visibility={visibility}
      locale={locale}
    />
  );
}

async function ActivityFeedSection({ params }: ActivityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  const visibility = getActivityVisibility(ctx.role);
  const [feed, members] = await Promise.all([
    getCachedActivityFeed(ctx.familyId),
    getFamilyMembers(ctx.familyId),
  ]);
  // The cached loader is shared across roles; trim to the visible set before
  // sending to the client so the role-aware stat counts align with the feed.
  const visibleItems = filterEntriesByVisibility(feed.items, visibility);
  return (
    <ActivityFeed
      familyId={ctx.familyId}
      visibility={visibility}
      initialItems={visibleItems}
      initialCursor={feed.nextCursor}
      members={members}
    />
  );
}

function HeaderSkeleton() {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
    </header>
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

export default function ActivityPage({ params }: ActivityPageProps) {
  return (
    <PagePadding>
      <div className="space-y-6">
        <Suspense fallback={<HeaderSkeleton />}>
          <ActivityHeaderSection params={params} />
        </Suspense>

        <Suspense fallback={<StatBandSkeleton />}>
          <ActivityStatBandSection params={params} />
        </Suspense>

        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedSection params={params} />
        </Suspense>
      </div>
    </PagePadding>
  );
}
