import { eq, and, desc, sql, like } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { ListThreadsFilters, ListPersonsTouchedOptions } from './types';

export async function listThreads(db: Database, filters: ListThreadsFilters = {}) {
  const conds = [];
  if (filters.status) conds.push(eq(researchThreads.status, filters.status));
  if (filters.createdBy) conds.push(eq(researchThreads.createdBy, filters.createdBy));
  if (filters.q && filters.q.trim().length > 0) {
    const needle = `%${filters.q.trim().toLowerCase()}%`;
    conds.push(like(sql`LOWER(${researchThreads.title})`, needle));
  }

  const where = conds.length ? and(...conds) : undefined;
  return db.select({
    id: researchThreads.id,
    title: researchThreads.title,
    status: researchThreads.status,
    seedPersonId: researchThreads.seedPersonId,
    seedFactsheetId: researchThreads.seedFactsheetId,
    seedResearchItemId: researchThreads.seedResearchItemId,
    summary: researchThreads.summary,
    createdBy: researchThreads.createdBy,
    createdAt: researchThreads.createdAt,
    updatedAt: researchThreads.updatedAt,
    closedAt: researchThreads.closedAt,
  })
    .from(researchThreads)
    .where(where as any)
    .orderBy(desc(researchThreads.updatedAt))
    .all();
}

/**
 * Single-query fetch: joins research_thread_events with LEFT JOIN + GROUP BY
 * so we get the row plus eventCount in one round trip (was: row + separate
 * SELECT COUNT). Drizzle's raw SQL keeps us close to the underlying plan.
 */
export async function getThread(db: Database, id: string) {
  const rows = await db.all<{
    id: string;
    title: string;
    status: 'active' | 'paused' | 'resolved' | 'abandoned';
    seed_person_id: string | null;
    seed_factsheet_id: string | null;
    seed_research_item_id: string | null;
    summary: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    event_count: number;
  }>(sql`
    SELECT t.id, t.title, t.status,
           t.seed_person_id, t.seed_factsheet_id, t.seed_research_item_id,
           t.summary, t.created_by, t.created_at, t.updated_at, t.closed_at,
           COALESCE(COUNT(e.id), 0) AS event_count
      FROM research_threads t
      LEFT JOIN research_thread_events e ON e.thread_id = t.id
     WHERE t.id = ${id}
     GROUP BY t.id
  `);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    seedPersonId: r.seed_person_id,
    seedFactsheetId: r.seed_factsheet_id,
    seedResearchItemId: r.seed_research_item_id,
    summary: r.summary,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    closedAt: r.closed_at,
    eventCount: Number(r.event_count ?? 0),
  };
}

/**
 * Persons "touched" by a thread — the union of:
 *   (a) persons promoted from factsheets that this thread *created*
 *       (factsheets.created_thread_id = thread.id AND promoted_person_id IS NOT NULL)
 *   (b) persons explicitly referenced by any of the thread's events
 *       (research_thread_events.person_id = p)
 *
 * Casts a wider net than strict creation lineage so the overlay reflects
 * the full reach of a thread. Accepts optional pagination so callers can
 * bound the result on threads with very wide reach.
 */
export async function getPersonsTouchedByThread(
  db: Database,
  threadId: string,
  opts: ListPersonsTouchedOptions = {},
): Promise<string[]> {
  const limit = opts.limit ?? 200;
  const after = opts.after;
  const rows = await db.all<{ id: string }>(sql`
    SELECT id FROM (
      SELECT DISTINCT promoted_person_id AS id
        FROM factsheets
       WHERE created_thread_id = ${threadId}
         AND promoted_person_id IS NOT NULL
      UNION
      SELECT DISTINCT person_id AS id
        FROM research_thread_events
       WHERE thread_id = ${threadId}
         AND person_id IS NOT NULL
    )
    ${after ? sql`WHERE id > ${after}` : sql``}
    ORDER BY id ASC
    LIMIT ${limit}
  `);
  return rows.map(r => r.id);
}

export interface ThreadTouchSummary {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
}

/**
 * All threads that have "touched" the given person — via either a
 * thread-created factsheet promoted to that person, or any event whose
 * `person_id` matches. `lastTouchedAt` prefers the most recent event
 * touching this person; falls back to the thread's `updated_at`.
 * Ordered by lastTouchedAt DESC.
 */
export async function getThreadsForPerson(db: Database, personId: string): Promise<ThreadTouchSummary[]> {
  return db.all<ThreadTouchSummary>(sql`
    WITH touch_threads AS (
      SELECT DISTINCT t.id AS id
        FROM research_threads t
        INNER JOIN factsheets f ON f.created_thread_id = t.id
       WHERE f.promoted_person_id = ${personId}
      UNION
      SELECT DISTINCT thread_id AS id
        FROM research_thread_events
       WHERE person_id = ${personId}
    )
    SELECT t.id AS id, t.title AS title, t.status AS status,
           COALESCE(
             (SELECT MAX(occurred_at) FROM research_thread_events e
                WHERE e.thread_id = t.id AND e.person_id = ${personId}),
             t.updated_at
           ) AS lastTouchedAt
      FROM research_threads t
     INNER JOIN touch_threads tt ON tt.id = t.id
     ORDER BY lastTouchedAt DESC
  `);
}
