import { cacheLife, cacheTag } from 'next/cache';
import { inArray, sql } from 'drizzle-orm';
import { factsheets } from '@ancstra/db';
import {
  getFactsheet,
  listFactsheetsWithCounts,
  listAllFactsheetLinks,
  type FactsheetWithCounts,
} from '@ancstra/research';
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

// ---------------------------------------------------------------------------
// Cached: full factsheets list with counts (the heaviest query — fans out
// fact / link / conflict aggregations). Powers the sidebar list. Replaces
// the client-side useAllFactsheets() waterfall.
// ---------------------------------------------------------------------------
export async function getCachedFactsheetsWithCounts(
  dbFilename: string,
): Promise<FactsheetWithCounts[]> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('factsheets-list', 'factsheets');

  const db = await getFamilyDb(dbFilename);
  return listFactsheetsWithCounts(db);
}

// ---------------------------------------------------------------------------
// Cached: full factsheet detail (factsheet + facts + links). Per-ID tag so
// edits to one factsheet don't dump every detail cache entry.
// ---------------------------------------------------------------------------
export async function getCachedFactsheetDetail(dbFilename: string, id: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag(`factsheet-${id}`, 'factsheets');

  const db = await getFamilyDb(dbFilename);
  return getFactsheet(db, id);
}

// ---------------------------------------------------------------------------
// Cached: all factsheet links (graph view payload).
// ---------------------------------------------------------------------------
export async function getCachedFactsheetLinks(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('factsheet-links', 'factsheets');

  const db = await getFamilyDb(dbFilename);
  return listAllFactsheetLinks(db);
}
