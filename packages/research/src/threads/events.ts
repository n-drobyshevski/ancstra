import { and, eq, asc, desc, or, sql } from 'drizzle-orm';
import { researchThreads, researchThreadEvents } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { AddEventInput, ThreadTimelineCursor, ThreadTimelinePage } from './types';

export async function addEvent(db: Database, input: AddEventInput) {
  // Application-level FK check (SQLite FK enforcement is opt-in)
  const exists = await db.select({ id: researchThreads.id })
    .from(researchThreads)
    .where(eq(researchThreads.id, input.threadId))
    .all();
  if (exists.length === 0) {
    throw new Error(`Thread ${input.threadId} not found`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Use explicit BEGIN/COMMIT/ROLLBACK — db.transaction(async tx) breaks on better-sqlite3
  await db.run(sql`BEGIN`);
  try {
    await db.insert(researchThreadEvents).values({
      id,
      threadId: input.threadId,
      eventType: input.eventType,
      actorId: input.actorId,
      factsheetId: input.factsheetId ?? null,
      personId: input.personId ?? null,
      researchItemId: input.researchItemId ?? null,
      researchFactId: input.researchFactId ?? null,
      sourceId: input.sourceId ?? null,
      linkId: input.linkId ?? null,
      reason: input.reason ?? null,
      payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
      occurredAt: now,
    }).run();

    // Bump thread updatedAt so listings sort fresh threads up
    await db.update(researchThreads)
      .set({ updatedAt: now })
      .where(eq(researchThreads.id, input.threadId))
      .run();

    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  const rows = await db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.id, id))
    .all();
  return rows[0];
}

export async function getThreadTimeline(db: Database, threadId: string, opts?: {
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;
  return db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.threadId, threadId))
    .orderBy(asc(researchThreadEvents.occurredAt))
    .limit(limit)
    .offset(offset)
    .all();
}

/**
 * Cursor-based page over thread events, ordered NEWEST-FIRST.
 *
 * Chosen for the UI use case ("Recent timeline", chat/feed style):
 * the first page surfaces the latest activity, and "Load more"
 * walks back through history.
 *
 * Cursor is a tuple `(occurredAt, id)` for stability when multiple
 * events share a timestamp. The cursor identifies the LAST row of
 * the previous page; the next page returns rows strictly older.
 *
 * Backed by `idx_thread_events_thread (threadId, occurredAt)` so it
 * stays O(log n + page) at any scale.
 *
 * For AI tools that need chronological order for summarization, keep
 * using `getThreadTimeline` (ASC, offset-based) which preserves the
 * older API contract.
 */
export async function getThreadTimelinePage(
  db: Database,
  threadId: string,
  opts: { limit?: number; cursor?: ThreadTimelineCursor } = {},
): Promise<ThreadTimelinePage<Awaited<ReturnType<typeof getThreadTimeline>>[number]>> {
  const limit = opts.limit ?? 50;
  const cursor = opts.cursor;

  // DESC scan; cursor advances BACKWARD in time (older than cursor):
  //   (occurredAt < cursor.occurredAt)
  //   OR (occurredAt == cursor.occurredAt AND id < cursor.id)
  // Fetch limit+1 to detect another page without a second roundtrip.
  const baseFilter = eq(researchThreadEvents.threadId, threadId);
  const where = cursor
    ? and(
        baseFilter,
        or(
          sql`${researchThreadEvents.occurredAt} < ${cursor.occurredAt}`,
          and(
            eq(researchThreadEvents.occurredAt, cursor.occurredAt),
            sql`${researchThreadEvents.id} < ${cursor.id}`,
          ),
        ),
      )
    : baseFilter;

  const rows = await db.select().from(researchThreadEvents)
    .where(where as any)
    .orderBy(desc(researchThreadEvents.occurredAt), desc(researchThreadEvents.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const last = events[events.length - 1];
  const nextCursor: ThreadTimelineCursor | null = hasMore && last
    ? { occurredAt: last.occurredAt, id: last.id }
    : null;
  return { events, nextCursor };
}
