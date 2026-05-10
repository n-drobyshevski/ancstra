import { eq, and, desc, sql } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { ListThreadsFilters } from './types';

export async function listThreads(db: Database, filters: ListThreadsFilters = {}) {
  const conds = [];
  if (filters.status) conds.push(eq(researchThreads.status, filters.status));
  if (filters.createdBy) conds.push(eq(researchThreads.createdBy, filters.createdBy));

  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(researchThreads)
    .where(where as any)
    .orderBy(desc(researchThreads.updatedAt))
    .all();
}

export async function getThread(db: Database, id: string) {
  const rows = await db.select().from(researchThreads)
    .where(eq(researchThreads.id, id))
    .all();
  if (rows.length === 0) return null;

  const countRows = await db.all<{ c: number }>(sql`
    SELECT COUNT(*) as c FROM research_thread_events WHERE thread_id = ${id}
  `);
  return { ...rows[0], eventCount: countRows[0]?.c ?? 0 };
}

/**
 * Persons "touched" by a thread — the union of:
 *   (a) persons promoted from factsheets that this thread *created*
 *       (factsheets.created_thread_id = thread.id AND promoted_person_id IS NOT NULL)
 *   (b) persons explicitly referenced by any of the thread's events
 *       (research_thread_events.person_id = p)
 *
 * Casts a wider net than strict creation lineage so the overlay reflects
 * the full reach of a thread.
 */
export async function getPersonsTouchedByThread(db: Database, threadId: string): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT promoted_person_id AS id
      FROM factsheets
     WHERE created_thread_id = ${threadId}
       AND promoted_person_id IS NOT NULL
    UNION
    SELECT DISTINCT person_id AS id
      FROM research_thread_events
     WHERE thread_id = ${threadId}
       AND person_id IS NOT NULL
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
