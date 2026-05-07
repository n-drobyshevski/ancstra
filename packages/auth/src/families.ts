import { eq, and, sql } from 'drizzle-orm';
import {
  familyRegistry,
  familyMembers,
} from '@ancstra/db/central-schema';
import { isWebMode } from '@ancstra/db';
import type { CentralDatabase } from '@ancstra/db';
import type { Role } from './types';
import { bumpMembershipsVersion, bumpMembershipsVersionMany } from './memberships';

export interface FamilyWithRole {
  familyId: string;
  name: string;
  dbFilename: string;
  role: Role;
  joinedAt: string;
}

export interface Membership {
  id: string;
  familyId: string;
  userId: string;
  role: Role;
  isActive: number;
  joinedAt: string;
}

/**
 * Create a new family. Inserts a family_registry row and an owner membership row.
 * Note: actual SQLite file creation and migration is an integration concern.
 */
export async function createFamily(
  centralDb: CentralDatabase,
  opts: { name: string; ownerId: string },
): Promise<{ familyId: string; dbFilename: string }> {
  const familyId = crypto.randomUUID();
  const now = new Date().toISOString();

  let dbFilename: string;
  if (isWebMode(process.env.CENTRAL_DATABASE_URL)) {
    // Dynamic import to avoid loading Turso Platform API code in local mode
    const { createTursoDatabase, runFamilySchemaDDL } = await import('@ancstra/db/turso');
    const shortId = familyId.split('-')[0];
    const { url } = await createTursoDatabase(`ancstra-fam-${shortId}`);
    dbFilename = url;
    await runFamilySchemaDDL(dbFilename);
  } else {
    dbFilename = `family-${familyId}.sqlite`;
  }

  await centralDb.insert(familyRegistry).values({
    id: familyId,
    name: opts.name,
    ownerId: opts.ownerId,
    dbFilename,
    createdAt: now,
    updatedAt: now,
  }).run();

  await centralDb.insert(familyMembers).values({
    id: crypto.randomUUID(),
    familyId,
    userId: opts.ownerId,
    role: 'owner',
    joinedAt: now,
    isActive: 1,
  }).run();

  await bumpMembershipsVersion(centralDb, opts.ownerId);

  return { familyId, dbFilename };
}

/**
 * Get all families a user belongs to, along with their role in each.
 */
export async function getFamiliesForUser(
  centralDb: CentralDatabase,
  userId: string,
): Promise<FamilyWithRole[]> {
  const rows = await centralDb
    .select({
      familyId: familyRegistry.id,
      name: familyRegistry.name,
      dbFilename: familyRegistry.dbFilename,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt,
    })
    .from(familyMembers)
    .innerJoin(familyRegistry, eq(familyMembers.familyId, familyRegistry.id))
    .where(eq(familyMembers.userId, userId))
    .all();

  return rows as FamilyWithRole[];
}

/**
 * Get a specific membership row for a user in a family, or null if not a member.
 */
export async function getFamilyMembership(
  centralDb: CentralDatabase,
  userId: string,
  familyId: string,
): Promise<Membership | null> {
  const row = await centralDb
    .select({
      id: familyMembers.id,
      familyId: familyMembers.familyId,
      userId: familyMembers.userId,
      role: familyMembers.role,
      isActive: familyMembers.isActive,
      joinedAt: familyMembers.joinedAt,
    })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId),
      ),
    )
    .get();

  return (row as Membership) ?? null;
}

/**
 * Transfer family ownership from current owner to new owner (must be admin).
 * Wrapped in a transaction so demote/promote/version-bump/registry-update
 * either all commit or all roll back. The partial unique index
 * `uq_family_members_family_owner` is the concurrency guard for parallel
 * transfers — its violation is caught and surfaced as ConcurrentTransferError.
 *
 * Uses explicit BEGIN/COMMIT/ROLLBACK so the transaction works with both
 * better-sqlite3 (sync driver, used in tests) and libsql (async driver,
 * used in production). Drizzle's .transaction(async cb) only works with
 * libsql; better-sqlite3 rejects async callbacks.
 */
export async function transferOwnership(
  centralDb: CentralDatabase,
  opts: {
    familyId: string;
    currentOwnerId: string;
    newOwnerId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const newOwnerMembership = await getFamilyMembership(centralDb, opts.newOwnerId, opts.familyId);

  if (!newOwnerMembership) {
    return { success: false, error: 'Target user is not a member of this family' };
  }
  if (newOwnerMembership.role !== 'admin') {
    return { success: false, error: 'Target user must be an admin to receive ownership' };
  }

  await centralDb.run(sql`BEGIN`);
  try {
    await centralDb.update(familyMembers)
      .set({ role: 'admin' })
      .where(and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.currentOwnerId),
      ))
      .run();

    await centralDb.update(familyMembers)
      .set({ role: 'owner' })
      .where(and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.newOwnerId),
      ))
      .run();

    await bumpMembershipsVersionMany(centralDb, [opts.currentOwnerId, opts.newOwnerId]);

    await centralDb.update(familyRegistry)
      .set({ ownerId: opts.newOwnerId, updatedAt: new Date().toISOString() })
      .where(eq(familyRegistry.id, opts.familyId))
      .run();

    await centralDb.run(sql`COMMIT`);
  } catch (err) {
    await centralDb.run(sql`ROLLBACK`);
    throw err;
  }

  return { success: true };
}
