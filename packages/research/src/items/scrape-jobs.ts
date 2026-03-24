import { eq, and, or, lt } from 'drizzle-orm';
import { scrapeJobs } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateScrapeJobInput {
  id: string;
  itemId: string;
  url: string;
  method: 'playwright' | 'fetch_fallback';
}

export async function createScrapeJob(db: Database, input: CreateScrapeJobInput) {
  const now = new Date().toISOString();
  await db.insert(scrapeJobs).values({
    id: input.id,
    itemId: input.itemId,
    url: input.url,
    status: 'pending',
    method: input.method,
    createdAt: now,
  }).run();
  return { id: input.id, status: 'pending' as const, createdAt: now };
}

export async function getScrapeJob(db: Database, id: string) {
  const rows = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, id)).all();
  return rows[0] ?? null;
}

export async function updateScrapeJob(
  db: Database,
  id: string,
  updates: Partial<{
    status: string;
    fullText: string;
    title: string;
    snippet: string;
    error: string;
    method: string;
    completedAt: string;
  }>
) {
  await db.update(scrapeJobs).set(updates).where(eq(scrapeJobs.id, id)).run();
}

export async function findActiveScrapeJob(db: Database, itemId: string) {
  const rows = await db
    .select()
    .from(scrapeJobs)
    .where(
      and(
        eq(scrapeJobs.itemId, itemId),
        or(eq(scrapeJobs.status, 'pending'), eq(scrapeJobs.status, 'processing'))
      )
    )
    .all();
  return rows[0] ?? null;
}

export async function deleteStaleJobs(db: Database, olderThanDays: number) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  await db
    .delete(scrapeJobs)
    .where(
      or(
        and(
          or(eq(scrapeJobs.status, 'completed'), eq(scrapeJobs.status, 'failed')),
          lt(scrapeJobs.completedAt, cutoff)
        ),
        and(eq(scrapeJobs.status, 'pending'), lt(scrapeJobs.createdAt, cutoff))
      )
    )
    .run();
}
