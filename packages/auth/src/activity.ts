import { eq, and, or, lt, desc } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { activityFeed } from '@ancstra/db/central-schema';
import { type ActivityAction } from './types';

export interface ActivityEntry {
  id: string;
  familyId: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Insert an activity feed entry.
 */
export function logActivity(
  centralDb: BetterSQLite3Database,
  entry: {
    familyId: string;
    userId: string;
    action: ActivityAction;
    entityType?: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  centralDb
    .insert(activityFeed)
    .values({
      id,
      familyId: entry.familyId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      createdAt: now,
    })
    .run();
}

/**
 * Cursor-paginated activity feed query with optional filters.
 * Uses composite cursor (created_at, id) for stable ordering.
 */
export function getActivityFeed(
  centralDb: BetterSQLite3Database,
  opts: {
    familyId: string;
    cursor?: string;
    limit?: number;
    action?: string;
    userId?: string;
  }
): { items: ActivityEntry[]; nextCursor: string | null } {
  const limit = opts.limit ?? 50;

  const conditions: ReturnType<typeof eq>[] = [eq(activityFeed.familyId, opts.familyId)];

  if (opts.action) {
    conditions.push(eq(activityFeed.action, opts.action));
  }
  if (opts.userId) {
    conditions.push(eq(activityFeed.userId, opts.userId));
  }

  if (opts.cursor) {
    const cursorRow = centralDb
      .select({
        createdAt: activityFeed.createdAt,
        id: activityFeed.id,
      })
      .from(activityFeed)
      .where(eq(activityFeed.id, opts.cursor))
      .get();

    if (cursorRow) {
      conditions.push(
        or(
          lt(activityFeed.createdAt, cursorRow.createdAt),
          and(
            eq(activityFeed.createdAt, cursorRow.createdAt),
            lt(activityFeed.id, cursorRow.id)
          )
        )!
      );
    }
  }

  const rows = centralDb
    .select()
    .from(activityFeed)
    .where(and(...conditions))
    .orderBy(desc(activityFeed.createdAt), desc(activityFeed.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items: ActivityEntry[] = rows.slice(0, limit).map((row) => ({
    id: row.id,
    familyId: row.familyId,
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
  }));

  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor };
}

/**
 * Redact activity entries for viewer role: replace summary with generic text
 * for entries whose entityId refers to a living person.
 */
export function redactActivityForViewer(
  entries: ActivityEntry[],
  livingPersonIds: Set<string>
): ActivityEntry[] {
  return entries.map((entry) => {
    if (entry.entityId && livingPersonIds.has(entry.entityId)) {
      return {
        ...entry,
        summary: 'A family member had activity recorded',
      };
    }
    return entry;
  });
}
