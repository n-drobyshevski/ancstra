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
