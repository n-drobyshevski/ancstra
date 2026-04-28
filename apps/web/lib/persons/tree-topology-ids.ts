import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import type { TreeTopologyMode } from '../tree/search-params';

/**
 * Resolve the set of person IDs allowed by the active topology filter, using
 * the precomputed `ancestor_paths` closure table — no recursive CTE needed.
 *
 * - `mode='ancestors'` returns the anchor + all ancestors.
 * - `mode='descendants'` returns the anchor + all descendants.
 * - Returns `null` when topology is inactive ('all' or anchor missing) so the
 *   caller can skip the intersection step.
 */
export async function getTopologyIds(
  db: Database,
  anchor: string,
  mode: TreeTopologyMode,
): Promise<readonly string[] | null> {
  if (mode === 'all' || !anchor) return null;

  if (mode === 'ancestors') {
    const rows = await db.all<{ ancestor_id: string }>(sql`
      SELECT ancestor_id FROM ancestor_paths
      WHERE descendant_id = ${anchor}
    `);
    return rows.map((r) => r.ancestor_id);
  }

  // descendants
  const rows = await db.all<{ descendant_id: string }>(sql`
    SELECT descendant_id FROM ancestor_paths
    WHERE ancestor_id = ${anchor}
  `);
  return rows.map((r) => r.descendant_id);
}
