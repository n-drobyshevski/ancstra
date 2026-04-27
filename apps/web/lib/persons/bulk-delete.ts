import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

export interface BulkDeleteResult {
  affected: number;
}

/**
 * Soft-delete the listed persons in a single statement.
 *
 * Sets `deleted_at` to now() for any matching, currently-non-deleted person.
 * Already-deleted and non-existent IDs are skipped silently.
 *
 * The caller (the route handler) is responsible for cache invalidation and
 * activity logging. This function only touches the persons table.
 */
export async function bulkDeletePersons(
  db: Database,
  ids: readonly string[],
): Promise<BulkDeleteResult> {
  if (ids.length === 0) return { affected: 0 };

  const now = new Date().toISOString();
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);

  const result = await db.run(sql`
    UPDATE persons
    SET deleted_at = ${now}, updated_at = ${now}
    WHERE id IN (${idList})
      AND deleted_at IS NULL
  `);

  // Handle both better-sqlite3 (changes) and libsql (rowsAffected) drivers
  const affected =
    (result as unknown as Record<string, number>).changes ??
    result.rowsAffected ??
    0;

  return { affected };
}
