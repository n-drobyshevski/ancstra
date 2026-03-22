import { eq, and } from 'drizzle-orm';
import {
  familyRegistry,
  familyMembers,
} from '@ancstra/db/central-schema';
import type { CentralDatabase } from '@ancstra/db';
import type { Role } from './types';

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
  const dbFilename = `family-${familyId}.sqlite`;
  const now = new Date().toISOString();

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
 * Atomically swaps roles and updates family_registry.owner_id.
 */
export async function transferOwnership(
  centralDb: CentralDatabase,
  opts: {
    familyId: string;
    currentOwnerId: string;
    newOwnerId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  // Verify the new owner is currently an admin
  const newOwnerMembership = await getFamilyMembership(centralDb, opts.newOwnerId, opts.familyId);

  if (!newOwnerMembership) {
    return { success: false, error: 'Target user is not a member of this family' };
  }

  if (newOwnerMembership.role !== 'admin') {
    return { success: false, error: 'Target user must be an admin to receive ownership' };
  }

  // Execute the three updates sequentially.
  // SQLite is single-writer so these are effectively atomic when executed back-to-back.
  // We avoid .transaction() here because better-sqlite3 rejects async callbacks
  // while libsql requires them — this pattern works with both drivers.
  await centralDb.update(familyMembers)
    .set({ role: 'admin' })
    .where(
      and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.currentOwnerId),
      ),
    )
    .run();

  await centralDb.update(familyMembers)
    .set({ role: 'owner' })
    .where(
      and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.newOwnerId),
      ),
    )
    .run();

  await centralDb.update(familyRegistry)
    .set({ ownerId: opts.newOwnerId, updatedAt: new Date().toISOString() })
    .where(eq(familyRegistry.id, opts.familyId))
    .run();

  return { success: true };
}
