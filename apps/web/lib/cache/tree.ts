import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { getTreeData } from '../queries';

// ---------------------------------------------------------------------------
// Cached: full tree data (tree profile — 30min revalidate, remote cache)
// ---------------------------------------------------------------------------
export async function getCachedTreeData(dbFilename: string) {
  'use cache: remote';
  cacheLife('tree');
  cacheTag('tree-data', 'persons');

  const db = await getFamilyDb(dbFilename);
  return getTreeData(db);
}
