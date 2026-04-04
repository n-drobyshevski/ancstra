import { cacheLife, cacheTag } from 'next/cache';
import { createCentralDb } from '@ancstra/db';
import { users } from '@ancstra/db/central-schema';
import { getActivityFeed } from '@ancstra/auth';
import { inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Cached: activity feed (activity profile — 2min revalidate, private cache)
// ---------------------------------------------------------------------------
export async function getCachedActivityFeed(familyId: string, limit = 20) {
  'use cache: private';
  cacheLife('activity');
  cacheTag('activity', `activity-${familyId}`);

  const centralDb = createCentralDb();
  const feed = await getActivityFeed(centralDb, { familyId, limit });

  const uniqueUserIds = [...new Set(feed.items.map((item) => item.userId).filter(Boolean))] as string[];
  const userRows =
    uniqueUserIds.length > 0
      ? await centralDb
          .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, uniqueUserIds))
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));

  const enrichedItems = feed.items.map((item) => {
    const resolved = item.userId ? userMap.get(item.userId) : undefined;
    return {
      ...item,
      userName: resolved?.name ?? 'Unknown',
      userAvatarUrl: resolved?.avatarUrl ?? null,
    };
  });

  return { items: enrichedItems, nextCursor: feed.nextCursor };
}
