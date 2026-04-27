import { cacheLife, cacheTag } from 'next/cache';
import { createCentralDb } from '@ancstra/db';
import { activityFeed, users } from '@ancstra/db/central-schema';
import { desc, eq } from 'drizzle-orm';

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
