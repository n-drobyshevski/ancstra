import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { eq, and } from 'drizzle-orm';
import { transferOwnership } from '../src/families';
import * as memberships from '../src/memberships';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { ConcurrentTransferError } from '../src/types';

async function seed(db: TestCentralDb) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-owner', email: 'o@t', name: 'Owner', createdAt: now, updatedAt: now },
    { id: 'u-admin', email: 'a@t', name: 'Admin', createdAt: now, updatedAt: now },
    { id: 'u-editor', email: 'e@t', name: 'Editor', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyRegistry).values({
    id: 'fam-1', name: 'Test Family', ownerId: 'u-owner', dbFilename: 't.db',
    createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-1', familyId: 'fam-1', userId: 'u-owner', role: 'owner', joinedAt: now },
    { id: 'm-2', familyId: 'fam-1', userId: 'u-admin', role: 'admin', joinedAt: now },
    { id: 'm-3', familyId: 'fam-1', userId: 'u-editor', role: 'editor', joinedAt: now },
  ]).run();
}

describe('ConcurrentTransferError', () => {
  it('is an Error with name=ConcurrentTransferError', () => {
    const err = new ConcurrentTransferError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConcurrentTransferError);
    expect(err.name).toBe('ConcurrentTransferError');
    expect(err.message).toBe('test');
  });

  it('defaults message when none given', () => {
    const err = new ConcurrentTransferError();
    expect(err.message).toBe('Concurrent transfer detected. Please retry.');
  });
});

describe('transferOwnership atomicity', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seed(db);
    vi.restoreAllMocks();
  });

  it('happy path: swaps roles, bumps versions, updates registry', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-admin',
    });

    expect(result.success).toBe(true);

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-owner'),
      )).get();
    const admin = await db.select().from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-admin'),
      )).get();
    expect(owner?.role).toBe('admin');
    expect(admin?.role).toBe('owner');

    const fam = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    expect(fam?.ownerId).toBe('u-admin');

    const ownerUser = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-owner')).get();
    const adminUser = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-admin')).get();
    expect(ownerUser?.membershipsVersion).toBe(1);
    expect(adminUser?.membershipsVersion).toBe(1);
  });

  it('rejects when target is not admin (editor)', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-editor',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/admin/i);

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-owner')).get();
    expect(owner?.role).toBe('owner');
  });

  it('rejects when target is not a member', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-nobody',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a member/i);
  });

  it('rolls back on mid-transaction failure', async () => {
    vi.spyOn(memberships, 'bumpMembershipsVersionMany').mockRejectedValue(
      new Error('simulated failure'),
    );

    await expect(transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-admin',
    })).rejects.toThrow('simulated failure');

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-owner')).get();
    const admin = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-admin')).get();
    expect(owner?.role).toBe('owner');
    expect(admin?.role).toBe('admin');

    const fam = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    expect(fam?.ownerId).toBe('u-owner');
  });

  it('throws ConcurrentTransferError when UQ partial-index fires', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u-admin2', email: 'a2@t', name: 'Admin2', createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-4', familyId: 'fam-1', userId: 'u-admin2', role: 'admin', joinedAt: now,
    }).run();

    // Simulate a concurrent transfer winning: directly demote the original owner
    // and promote u-admin out-of-band, leaving the partial UQ index occupied.
    await db.update(centralSchema.familyMembers)
      .set({ role: 'admin' })
      .where(eq(centralSchema.familyMembers.userId, 'u-owner'))
      .run();
    await db.update(centralSchema.familyMembers)
      .set({ role: 'owner' })
      .where(eq(centralSchema.familyMembers.userId, 'u-admin'))
      .run();

    // Now attempt to transfer to u-admin2 — the promote step will violate
    // the partial UQ index because u-admin already holds owner.
    const { ConcurrentTransferError } = await import('../src/types');
    await expect(
      transferOwnership(db, {
        familyId: 'fam-1',
        currentOwnerId: 'u-owner',
        newOwnerId: 'u-admin2',
      })
    ).rejects.toBeInstanceOf(ConcurrentTransferError);
  });
});
