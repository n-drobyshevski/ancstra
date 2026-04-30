import { eq, and } from 'drizzle-orm';
import { type CentralDatabase, centralSchema } from '@ancstra/db';

const { familyMembers } = centralSchema;

/**
 * Fire-and-forget helper: bumps `last_seen_at` on a family_members row.
 *
 * Returns `true` when a row was updated, `false` when no matching row exists
 * or a DB error occurred. Never throws — callers may use `void bumpLastSeenAt(…)`.
 */
export async function bumpLastSeenAt(
  centralDb: CentralDatabase,
  userId: string,
  familyId: string,
): Promise<boolean> {
  try {
    const result = await centralDb
      .update(familyMembers)
      .set({ lastSeenAt: new Date().toISOString() })
      .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId)))
      .run();

    // Handle both better-sqlite3 (result.changes) and libsql (result.rowsAffected) drivers
    const rowsChanged =
      (result as unknown as Record<string, number>).changes ?? result.rowsAffected ?? 0;
    return rowsChanged > 0;
  } catch (err) {
    console.warn('[last-seen-tracker] failed to update last_seen_at:', err);
    return false;
  }
}
