import { cacheLife, cacheTag } from 'next/cache';
import { inArray, sql } from 'drizzle-orm';
import { factsheets } from '@ancstra/db';
import { getFamilyDb } from '../db';

// ---------------------------------------------------------------------------
// Cached: count of "open" factsheets for sidebar badge.
// Replaces the previous useFactsheetCount() client-side fetch which pulled
// every factsheet just to derive a number.
// ---------------------------------------------------------------------------
export async function getCachedFactsheetCount(dbFilename: string): Promise<number> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('factsheets', 'factsheet-count');

  const db = await getFamilyDb(dbFilename);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(factsheets)
    .where(inArray(factsheets.status, ['draft', 'ready']))
    .all();

  return rows[0]?.count ?? 0;
}
