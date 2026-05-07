import { eq, and, sql } from 'drizzle-orm';
import {
  familyRegistry,
  familyMembers,
} from '@ancstra/db/central-schema';
import { isWebMode } from '@ancstra/db';
import type { CentralDatabase } from '@ancstra/db';
import type { Role } from './types';
import { ConcurrentTransferError } from './types';
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
    if (isOwnerUqViolation(err)) {
      throw new ConcurrentTransferError();
    }
    throw err;
  }

  return { success: true };
}

// ====================================================================
// Family settings update / delete (owner-only via permission gate)
// ====================================================================

export interface FamilySettingsPatch {
  name?: string;
  maxMembers?: number;
  monthlyAiBudgetUsd?: number;
  moderationEnabled?: boolean;
}

export interface FamilySettingsRow {
  id: string;
  name: string;
  ownerId: string;
  dbFilename: string;
  moderationEnabled: boolean;
  maxMembers: number;
  monthlyAiBudgetUsd: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Apply a settings patch to a family. Returns the resulting row plus the keys
 * that actually changed (used by callers for activity-feed summaries). No-op
 * patches return changed=[]; the caller decides whether to log.
 */
export async function updateFamilySettings(
  centralDb: CentralDatabase,
  familyId: string,
  patch: FamilySettingsPatch,
): Promise<{ row: FamilySettingsRow; changed: (keyof FamilySettingsPatch)[] }> {
  const before = await centralDb
    .select()
    .from(familyRegistry)
    .where(eq(familyRegistry.id, familyId))
    .get();

  if (!before) {
    throw new Error(`Family ${familyId} not found`);
  }

  const changed: (keyof FamilySettingsPatch)[] = [];
  const setClause: Record<string, unknown> = {};

  if (patch.name !== undefined && patch.name !== before.name) {
    setClause.name = patch.name;
    changed.push('name');
  }
  if (patch.maxMembers !== undefined && patch.maxMembers !== before.maxMembers) {
    setClause.maxMembers = patch.maxMembers;
    changed.push('maxMembers');
  }
  if (
    patch.monthlyAiBudgetUsd !== undefined &&
    patch.monthlyAiBudgetUsd !== before.monthlyAiBudgetUsd
  ) {
    setClause.monthlyAiBudgetUsd = patch.monthlyAiBudgetUsd;
    changed.push('monthlyAiBudgetUsd');
  }
  if (patch.moderationEnabled !== undefined) {
    const desired = patch.moderationEnabled ? 1 : 0;
    if (desired !== before.moderationEnabled) {
      setClause.moderationEnabled = desired;
      changed.push('moderationEnabled');
    }
  }

  if (changed.length === 0) {
    return {
      row: rowToFamilySettings(before),
      changed: [],
    };
  }

  setClause.updatedAt = new Date().toISOString();

  await centralDb
    .update(familyRegistry)
    .set(setClause)
    .where(eq(familyRegistry.id, familyId))
    .run();

  const after = await centralDb
    .select()
    .from(familyRegistry)
    .where(eq(familyRegistry.id, familyId))
    .get();

  return {
    row: rowToFamilySettings(after!),
    changed,
  };
}

/**
 * Delete a family. Cascades through FK to family_members, invitations, and
 * activity_feed (per onDelete: 'cascade' on those FKs). The per-family
 * SQLite file (or Turso DB) is NOT touched here — orphaning the storage is
 * acceptable for v1; cleanup is a separate operational concern.
 *
 * Caller must validate `confirmName` against the family's name BEFORE invoking
 * this; we re-check here as a defense-in-depth guard against client tampering.
 */
export async function deleteFamily(
  centralDb: CentralDatabase,
  familyId: string,
  confirmName: string,
): Promise<{ deleted: boolean; dbFilename: string }> {
  const row = await centralDb
    .select({
      id: familyRegistry.id,
      name: familyRegistry.name,
      ownerId: familyRegistry.ownerId,
      dbFilename: familyRegistry.dbFilename,
    })
    .from(familyRegistry)
    .where(eq(familyRegistry.id, familyId))
    .get();

  if (!row) {
    throw new Error(`Family ${familyId} not found`);
  }
  if (confirmName.trim() !== row.name) {
    throw new Error('Confirmation name does not match family name');
  }

  const memberRows = await centralDb
    .select({ userId: familyMembers.userId })
    .from(familyMembers)
    .where(eq(familyMembers.familyId, familyId))
    .all();

  await centralDb
    .delete(familyRegistry)
    .where(eq(familyRegistry.id, familyId))
    .run();

  // Bump every former member's JWT version so their next request re-derives
  // memberships and sees this family is gone.
  const memberIds = memberRows.map((m: { userId: string }) => m.userId);
  if (memberIds.length > 0) {
    await bumpMembershipsVersionMany(centralDb, memberIds);
  }

  return { deleted: true, dbFilename: row.dbFilename };
}

function rowToFamilySettings(row: typeof familyRegistry.$inferSelect): FamilySettingsRow {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    dbFilename: row.dbFilename,
    moderationEnabled: row.moderationEnabled === 1,
    maxMembers: row.maxMembers,
    monthlyAiBudgetUsd: row.monthlyAiBudgetUsd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Detect violation of the partial UQ index on family_members(family_id) WHERE role='owner'.
 *
 * SQLite's UNIQUE-constraint error message for this partial index is
 *   "UNIQUE constraint failed: family_members.family_id"
 * (it does NOT include the index name). The composite UQ on
 * (family_id, user_id) — see central-schema.ts — would instead emit
 *   "UNIQUE constraint failed: family_members.family_id, family_members.user_id"
 *
 * We distinguish the two by requiring `family_id` to appear AND `user_id`
 * to NOT appear. This is robust against either UQ being added inside a
 * future revision of `transferOwnership` (e.g. a proactive INSERT into
 * an ownership-history table would not match either pattern, so the raw
 * error would propagate as 500 — desirable, since it'd be a bug to flag).
 */
function isOwnerUqViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (!msg.includes('unique constraint')) return false;
  if (!msg.includes('family_members.family_id')) return false;
  if (msg.includes('family_members.user_id')) return false;
  return true;
}
