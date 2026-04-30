import { eq, sql } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import type { CentralDatabase } from '@ancstra/db';

/**
 * Bump users.memberships_version for one user.
 * Used to signal JWT staleness after a familyMembers mutation.
 * The proxy compares JWT.membershipsVersion vs DB on every request.
 */
export async function bumpMembershipsVersion(
  centralDb: CentralDatabase,
  userId: string,
): Promise<void> {
  await centralDb
    .update(centralSchema.users)
    .set({ membershipsVersion: sql`${centralSchema.users.membershipsVersion} + 1` })
    .where(eq(centralSchema.users.id, userId))
    .run();
}

/**
 * Bump memberships_version for multiple users (e.g. transferOwnership affects both).
 */
export async function bumpMembershipsVersionMany(
  centralDb: CentralDatabase,
  userIds: ReadonlyArray<string>,
): Promise<void> {
  for (const id of userIds) await bumpMembershipsVersion(centralDb, id);
}
