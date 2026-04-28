import { cacheLife, cacheTag } from 'next/cache';
import { eq } from 'drizzle-orm';
import { treeLayouts } from '@ancstra/db';
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

// ---------------------------------------------------------------------------
// Cached: default tree layout (positions snapshot — short-lived, remote cache)
//
// Fetched server-side alongside getCachedTreeData so the canvas's first paint
// already has the user's saved positions. Without this preload the canvas
// renders a fresh dagre auto-layout, then snaps to the saved layout once the
// client-side fetch resolves — visible as nodes "moving for no reason".
// ---------------------------------------------------------------------------
export type DefaultTreeLayout = {
  id: string;
  name: string;
  layoutData: string;
};

export async function getCachedDefaultLayout(
  dbFilename: string,
): Promise<DefaultTreeLayout | null> {
  'use cache: remote';
  cacheLife('tree');
  cacheTag('tree-layouts');

  const db = await getFamilyDb(dbFilename);
  const [row] = await db
    .select({
      id: treeLayouts.id,
      name: treeLayouts.name,
      layoutData: treeLayouts.layoutData,
    })
    .from(treeLayouts)
    .where(eq(treeLayouts.isDefault, true))
    .limit(1);
  return row ?? null;
}
