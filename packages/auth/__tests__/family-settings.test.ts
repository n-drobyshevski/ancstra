import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { updateFamilySettings, deleteFamily, createFamily } from '../src/families';

async function seedUser(db: TestCentralDb, id: string, name: string) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id,
    email: `${name.toLowerCase()}@test.com`,
    name,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe('updateFamilySettings', () => {
  let db: TestCentralDb;
  let familyId: string;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'owner-1', 'Owner');
    const result = await createFamily(db, { name: 'Smith Family', ownerId: 'owner-1' });
    familyId = result.familyId;
  });

  it('persists name change and reports changed keys', async () => {
    const { row, changed } = await updateFamilySettings(db, familyId, {
      name: 'Smith-Jones Family',
    });
    expect(changed).toEqual(['name']);
    expect(row.name).toBe('Smith-Jones Family');

    const persisted = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, familyId)).get();
    expect(persisted!.name).toBe('Smith-Jones Family');
  });

  it('persists numeric and boolean fields together', async () => {
    const { changed, row } = await updateFamilySettings(db, familyId, {
      maxMembers: 100,
      monthlyAiBudgetUsd: 25.5,
      moderationEnabled: true,
    });
    expect(changed.sort()).toEqual(['maxMembers', 'moderationEnabled', 'monthlyAiBudgetUsd']);
    expect(row.maxMembers).toBe(100);
    expect(row.monthlyAiBudgetUsd).toBe(25.5);
    expect(row.moderationEnabled).toBe(true);
  });

  it('returns empty changed[] for a no-op patch', async () => {
    const { changed } = await updateFamilySettings(db, familyId, {
      name: 'Smith Family', // unchanged
      maxMembers: 50,
    });
    expect(changed).toEqual([]);
  });

  it('only includes keys that actually differ from current values', async () => {
    await updateFamilySettings(db, familyId, { maxMembers: 75 });

    const { changed } = await updateFamilySettings(db, familyId, {
      name: 'Smith Family',     // unchanged
      maxMembers: 75,           // unchanged
      moderationEnabled: true,  // changed
    });
    expect(changed).toEqual(['moderationEnabled']);
  });

  it('updates the updatedAt timestamp on a real change', async () => {
    const before = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, familyId)).get();

    // Wait a tick to ensure the timestamp differs.
    await new Promise((r) => setTimeout(r, 5));

    await updateFamilySettings(db, familyId, { name: 'New Name' });

    const after = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, familyId)).get();
    expect(after!.updatedAt).not.toBe(before!.updatedAt);
  });

  it('throws on unknown family id', async () => {
    await expect(
      updateFamilySettings(db, 'does-not-exist', { name: 'X' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('deleteFamily', () => {
  let db: TestCentralDb;
  let familyId: string;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'owner-1', 'Owner');
    await seedUser(db, 'member-1', 'Member');
    const result = await createFamily(db, { name: 'Doomed Family', ownerId: 'owner-1' });
    familyId = result.familyId;

    // Add a non-owner member to verify cascade and version-bump for both.
    const now = new Date().toISOString();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-extra',
      familyId,
      userId: 'member-1',
      role: 'editor',
      joinedAt: now,
      isActive: 1,
    }).run();
  });

  it('deletes the family with matching confirmation', async () => {
    const result = await deleteFamily(db, familyId, 'Doomed Family');
    expect(result.deleted).toBe(true);
    expect(result.dbFilename).toMatch(/\.sqlite$/);

    const after = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, familyId)).get();
    expect(after).toBeUndefined();
  });

  it('cascades the delete to family_members', async () => {
    await deleteFamily(db, familyId, 'Doomed Family');
    const remaining = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.familyId, familyId)).all();
    expect(remaining).toHaveLength(0);
  });

  it('bumps memberships_version for all former members', async () => {
    const ownerBefore = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'owner-1')).get();
    const memberBefore = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'member-1')).get();

    await deleteFamily(db, familyId, 'Doomed Family');

    const ownerAfter = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'owner-1')).get();
    const memberAfter = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'member-1')).get();

    expect(ownerAfter!.membershipsVersion).toBeGreaterThan(ownerBefore!.membershipsVersion);
    expect(memberAfter!.membershipsVersion).toBeGreaterThan(memberBefore!.membershipsVersion);
  });

  it('rejects mismatched confirmation', async () => {
    await expect(deleteFamily(db, familyId, 'Wrong Name')).rejects.toThrow(
      /confirmation/i,
    );

    // Family still exists.
    const stillThere = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, familyId)).get();
    expect(stillThere).toBeDefined();
  });

  it('trims whitespace before confirmation comparison', async () => {
    const result = await deleteFamily(db, familyId, '  Doomed Family  ');
    expect(result.deleted).toBe(true);
  });

  it('throws on unknown family id', async () => {
    await expect(deleteFamily(db, 'does-not-exist', 'X')).rejects.toThrow(/not found/);
  });
});
