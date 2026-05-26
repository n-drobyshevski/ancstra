import { cacheLife, cacheTag } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { searchAttempts } from '@ancstra/db';
import { getFamilyDb } from '../db';

/**
 * Bundle E 2026-05-26 — cached count of search attempts for a person.
 * Drives the Research log tab badge. Mirrors getCachedInboxCount —
 * 'use cache' + cacheTag pattern so revalidateTag(...) in mutating routes
 * flushes the badge.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.4.
 */
export async function getCachedPersonSearchAttemptCount(
  dbFilename: string,
  personId: string,
): Promise<number> {
  'use cache';
  cacheLife('dashboard');
  cacheTag(`search-attempts:person:${personId}`);

  const db = await getFamilyDb(dbFilename);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(searchAttempts)
    .where(eq(searchAttempts.personId, personId))
    .all();
  return rows[0]?.count ?? 0;
}
