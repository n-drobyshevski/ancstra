import { cacheLife, cacheTag } from 'next/cache';
import { countInboxItems } from '@ancstra/research';
import { getFamilyDb } from '../db';

// ---------------------------------------------------------------------------
// Cached: total count of pending inbox items for sidebar badge.
// Mirrors getCachedFactsheetCount — same 'use cache' + cacheTag pattern so
// revalidateTag('inbox-count') in forward-action endpoints flushes the badge.
// ---------------------------------------------------------------------------
export async function getCachedInboxCount(dbFilename: string): Promise<number> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('inbox-count');

  const db = await getFamilyDb(dbFilename);
  const counts = await countInboxItems(db);
  return counts.total;
}
