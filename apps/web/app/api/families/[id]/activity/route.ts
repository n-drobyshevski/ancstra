import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, getActivityFeed, redactActivityForViewer } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';
import { users } from '@ancstra/db/central-schema';
import { persons } from '@ancstra/db/family-schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getFamilyDb } from '@/lib/db';
import {
  getActivityVisibility,
  filterEntriesByVisibility,
} from '@/lib/activity-visibility';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // discard — familyId comes from the auth context, never from the URL
  const ctx = await requireAuthContext(request);
  requirePermission(ctx.role, 'activity:view');

  const visibility = getActivityVisibility(ctx.role);

  const centralDb = createCentralDb();
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const action = url.searchParams.get('action') || undefined;
  const userId = url.searchParams.get('userId') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const since = url.searchParams.get('since') || undefined;
  const until = url.searchParams.get('until') || undefined;

  // Intersect any user-picked action with the role's allowlist so the SQL
  // filter never includes something the role shouldn't see.
  const allowedActions = [...visibility.allowedActions];
  const effectiveAction =
    action && visibility.allowedActions.has(action) ? action : undefined;
  // If the user picked an excluded action, fall back to the full allowlist
  // (returns role-visible rows rather than 403'ing the request).
  const effectiveActions = effectiveAction ? undefined : allowedActions;

  // Bump server fetch limit for non-owner roles so post-filter (defense in
  // depth) cannot produce a too-thin page. The DB allowlist already filters
  // most rows; this just guarantees enough rows survive any future bugs.
  const fetchLimit = ctx.role === 'owner' ? limit : limit * 2;

  const feed = await getActivityFeed(centralDb, {
    familyId: ctx.familyId,
    cursor,
    limit: fetchLimit,
    action: effectiveAction,
    actions: effectiveActions,
    userId,
    q,
    since,
    until,
  });

  // Defense-in-depth: even though `actions` already constrained the SQL,
  // re-apply the JS filter so a future code path bypassing `actions` cannot
  // leak data.
  feed.items = filterEntriesByVisibility(feed.items, visibility);

  // Trim back to the requested page size after filtering.
  if (feed.items.length > limit) {
    feed.items = feed.items.slice(0, limit);
  }

  if (visibility.redactLivingPersons) {
    const entityIds = feed.items
      .map((item) => item.entityId)
      .filter((id): id is string => Boolean(id));

    let livingPersonIds = new Set<string>();
    if (entityIds.length > 0) {
      const familyDb = await getFamilyDb(ctx.dbFilename);
      const livingRows = await familyDb
        .select({ id: persons.id })
        .from(persons)
        .where(and(inArray(persons.id, entityIds), eq(persons.isLiving, true)))
        .all();
      livingPersonIds = new Set(livingRows.map((r) => r.id));
    }

    feed.items = redactActivityForViewer(feed.items, livingPersonIds);
  }

  const uniqueUserIds = [...new Set(feed.items.map((item) => item.userId).filter(Boolean))] as string[];

  const userRows =
    uniqueUserIds.length > 0
      ? await centralDb.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, uniqueUserIds))
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

  return NextResponse.json({ ...feed, items: enrichedItems });
}
