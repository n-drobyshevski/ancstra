import { eq, and, or, lt, desc, gte, lte, like, inArray } from 'drizzle-orm';
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
// Accept any Drizzle DB instance (works with both better-sqlite3 and libsql drivers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logActivity(
  centralDb: any,
  entry: {
    familyId: string;
    userId: string;
    action: ActivityAction;
    entityType?: string;
    entityId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await centralDb
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActivityFeed(
  centralDb: any,
  opts: {
    familyId: string;
    cursor?: string;
    limit?: number;
    /** Single-action filter (e.g. user selected one category). */
    action?: string;
    /** Allowlist filter (e.g. role-allowed actions). Intersected with `action`. */
    actions?: readonly string[];
    userId?: string;
    /** Case-insensitive substring search on `summary`. */
    q?: string;
    /** ISO timestamp; only entries with createdAt >= since. */
    since?: string;
    /** ISO timestamp; only entries with createdAt <= until. */
    until?: string;
  }
): Promise<{ items: ActivityEntry[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(activityFeed.familyId, opts.familyId)];

  if (opts.action) {
    conditions.push(eq(activityFeed.action, opts.action));
  }
  if (opts.actions && opts.actions.length > 0) {
    conditions.push(inArray(activityFeed.action, [...opts.actions]));
  }
  if (opts.userId) {
    conditions.push(eq(activityFeed.userId, opts.userId));
  }
  if (opts.q && opts.q.trim().length > 0) {
    // SQLite LIKE is ASCII-case-insensitive by default; escape wildcards in
    // the user's query so a literal `%` or `_` doesn't expand the match.
    const escaped = opts.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    conditions.push(like(activityFeed.summary, `%${escaped}%`));
  }
  if (opts.since) {
    conditions.push(gte(activityFeed.createdAt, opts.since));
  }
  if (opts.until) {
    conditions.push(lte(activityFeed.createdAt, opts.until));
  }

  if (opts.cursor) {
    const cursorRow = await centralDb
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

  const rows = await centralDb
    .select()
    .from(activityFeed)
    .where(and(...conditions))
    .orderBy(desc(activityFeed.createdAt), desc(activityFeed.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: ActivityEntry[] = rows.slice(0, limit).map((row: any) => ({
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
 *
 * Caller contract: run this AFTER any role-based visibility filter
 * (e.g. `filterEntriesByVisibility`) so redaction only targets entries the
 * viewer is allowed to see in the first place.
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
