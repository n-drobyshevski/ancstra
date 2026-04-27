import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { assemblePersonDetail } from '../queries';
import { sourceCitations } from '@ancstra/db';
import { eq, count } from 'drizzle-orm';
import { queryPersonsList, type PersonsListResult } from '../persons/query-persons-list';
import { queryTreeYearBounds, type TreeYearBounds } from '../persons/year-bounds';
import type { PersonsFilters } from '../persons/search-params';

export async function getCachedPersonDetail(dbFilename: string, personId: string) {
  'use cache';
  cacheLife('genealogy');
  cacheTag(`person-${personId}`, 'persons');
  const db = await getFamilyDb(dbFilename);
  return assemblePersonDetail(db, personId);
}

export async function getCachedCitationCount(dbFilename: string, personId: string) {
  'use cache';
  cacheLife('genealogy');
  cacheTag(`person-${personId}`, 'persons');
  const db = await getFamilyDb(dbFilename);
  const result = await db
    .select({ value: count() })
    .from(sourceCitations)
    .where(eq(sourceCitations.personId, personId))
    .get();
  return result?.value ?? 0;
}

export async function getCachedPersonsList(
  dbFilename: string,
  filters: PersonsFilters,
): Promise<PersonsListResult> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('persons-list', 'persons');
  const db = await getFamilyDb(dbFilename);
  return queryPersonsList(db, filters);
}

export async function getCachedTreeYearBounds(dbFilename: string): Promise<TreeYearBounds> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('persons-list', 'tree-bounds');
  const db = await getFamilyDb(dbFilename);
  return queryTreeYearBounds(db);
}
