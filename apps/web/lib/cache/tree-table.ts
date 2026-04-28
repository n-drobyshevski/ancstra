import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { queryTreeTableRows, type TreeTableResult } from '../persons/query-tree-table-rows';
import type { TreeTableFilters } from '../tree/search-params';

// Per-filter cached page of tree-table rows. Tagged with `persons` so the
// existing revalidateTag('persons') in mutation paths invalidates this
// without further wiring. Uses the tree-table cacheLife profile
// (60s stale / 10min revalidate / 2h expire) — high-cardinality filter-
// driven cache, so we want a tight stale window and a moderate background
// revalidate ceiling.
export async function getCachedTreeTableRows(
  dbFilename: string,
  filters: TreeTableFilters,
): Promise<TreeTableResult> {
  'use cache';
  cacheLife('tree-table');
  cacheTag('tree-table-rows', 'persons');
  const db = await getFamilyDb(dbFilename);
  return queryTreeTableRows(db, filters);
}
