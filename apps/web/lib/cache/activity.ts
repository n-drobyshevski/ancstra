import { cacheLife, cacheTag } from 'next/cache';
import { createCentralDb } from '@ancstra/db';
import { activityFeed, users } from '@ancstra/db/central-schema';
import { and, desc, eq, gte } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Cached: activity feed (activity profile — 2min revalidate, private cache)
// ---------------------------------------------------------------------------
export async function getCachedActivityFeed(familyId: string, limit = 20) {
  'use cache: private';
  cacheLife('activity');
  cacheTag('activity', `activity-${familyId}`);

  const centralDb = createCentralDb();

  // Single query: activity feed + user info via LEFT JOIN. Replaces the
  // previous two-round-trip pattern (feed query + follow-up users IN-list).
  const rows = await centralDb
    .select({
      id: activityFeed.id,
      familyId: activityFeed.familyId,
      userId: activityFeed.userId,
      action: activityFeed.action,
      entityType: activityFeed.entityType,
      entityId: activityFeed.entityId,
      summary: activityFeed.summary,
      metadata: activityFeed.metadata,
      createdAt: activityFeed.createdAt,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(activityFeed)
    .leftJoin(users, eq(users.id, activityFeed.userId))
    .where(eq(activityFeed.familyId, familyId))
    .orderBy(desc(activityFeed.createdAt), desc(activityFeed.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    familyId: row.familyId,
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : null,
    createdAt: row.createdAt,
    userName: row.userName ?? 'Unknown',
    userAvatarUrl: row.userAvatarUrl ?? null,
  }));

  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// Cached: activity counts (raw rows for the past 7 days + user-name map)
// ---------------------------------------------------------------------------
//
// Cache key intentionally only includes familyId. Role-aware aggregation
// happens at the call site (filterEntriesByVisibility on the rows below) so
// flipping the lens cookie does not produce a cache miss.
//
// Same `cacheTag` as `getCachedActivityFeed` so write-path
// `revalidateTag('activity-${familyId}')` calls invalidate both atomically.

export interface CachedActivityCountRow {
  action: string;
  userId: string;
  createdAt: string;
}

export interface CachedActivityCounts {
  /** Raw rows from the past 7 days, newest first. */
  recentEntries: CachedActivityCountRow[];
  /** ISO timestamp of the most recent entry across the whole family. */
  lastUpdate: string | null;
  /** userId -> display name map for the past-7-day contributors. */
  userNames: Record<string, string>;
}

export async function getCachedActivityCounts(
  familyId: string,
): Promise<CachedActivityCounts> {
  'use cache: private';
  cacheLife('activity');
  cacheTag('activity', `activity-${familyId}`);

  const centralDb = createCentralDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await centralDb
    .select({
      action: activityFeed.action,
      userId: activityFeed.userId,
      createdAt: activityFeed.createdAt,
      userName: users.name,
    })
    .from(activityFeed)
    .leftJoin(users, eq(users.id, activityFeed.userId))
    .where(
      and(
        eq(activityFeed.familyId, familyId),
        gte(activityFeed.createdAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(activityFeed.createdAt), desc(activityFeed.id))
    .all();

  const recentEntries: CachedActivityCountRow[] = rows.map((r) => ({
    action: r.action,
    userId: r.userId,
    createdAt: r.createdAt,
  }));

  const userNames: Record<string, string> = {};
  for (const r of rows) {
    if (r.userId && r.userName && !userNames[r.userId]) {
      userNames[r.userId] = r.userName;
    }
  }

  // Family-wide lastUpdate, regardless of the 7-day window — separate query
  // so that an inactive family still surfaces its most recent action.
  const lastRow = await centralDb
    .select({ createdAt: activityFeed.createdAt })
    .from(activityFeed)
    .where(eq(activityFeed.familyId, familyId))
    .orderBy(desc(activityFeed.createdAt), desc(activityFeed.id))
    .limit(1)
    .get();

  return {
    recentEntries,
    lastUpdate: lastRow?.createdAt ?? null,
    userNames,
  };
}
