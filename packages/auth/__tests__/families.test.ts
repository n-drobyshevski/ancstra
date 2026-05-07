import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import {
  createFamily,
  getFamiliesForUser,
  getFamilyMembership,
  transferOwnership,
} from '../src/families';

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

describe('createFamily', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'user-1', 'Alice');
  });

  it('creates a family_registry row and owner membership', async () => {
    const result = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });

    expect(result.familyId).toBeDefined();
    expect(result.dbFilename).toMatch(/\.sqlite$/);

    // Verify the registry row
    const registry = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, result.familyId)).get();
    expect(registry).toBeDefined();
    expect(registry!.name).toBe('Smith Family');
    expect(registry!.ownerId).toBe('user-1');
    expect(registry!.dbFilename).toBe(result.dbFilename);

    // Verify the membership row
    const membership = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.familyId, result.familyId)).get();
    expect(membership).toBeDefined();
    expect(membership!.role).toBe('owner');
    expect(membership!.isActive).toBe(1);
  });

  it('generates a unique db_filename for each family', async () => {
    const r1 = await createFamily(db, { name: 'Family A', ownerId: 'user-1' });
    const r2 = await createFamily(db, { name: 'Family B', ownerId: 'user-1' });
    expect(r1.dbFilename).not.toBe(r2.dbFilename);
  });
});

describe('getFamiliesForUser', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'user-1', 'Alice');
    await seedUser(db, 'user-2', 'Bob');
  });

  it('returns all families the user belongs to with their roles', async () => {
    const f1 = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });
    const f2 = await createFamily(db, { name: 'Jones Family', ownerId: 'user-2' });

    // Add user-1 as editor in Jones family
    const now = new Date().toISOString();
    db.insert(centralSchema.familyMembers).values({
      id: 'mem-extra',
      familyId: f2.familyId,
      userId: 'user-1',
      role: 'editor',
      joinedAt: now,
    }).run();

    const families = await getFamiliesForUser(db, 'user-1');
    expect(families).toHaveLength(2);

    const smithEntry = families.find((f) => f.familyId === f1.familyId);
    expect(smithEntry).toBeDefined();
    expect(smithEntry!.role).toBe('owner');
    expect(smithEntry!.name).toBe('Smith Family');

    const jonesEntry = families.find((f) => f.familyId === f2.familyId);
    expect(jonesEntry).toBeDefined();
    expect(jonesEntry!.role).toBe('editor');
  });

  it('returns empty array for a user with no families', async () => {
    const families = await getFamiliesForUser(db, 'user-1');
    expect(families).toEqual([]);
  });
});

describe('getFamilyMembership', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'user-1', 'Alice');
    await seedUser(db, 'user-2', 'Bob');
  });

  it('returns the membership row when the user is a member', async () => {
    const f = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });
    const membership = await getFamilyMembership(db, 'user-1', f.familyId);

    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('owner');
    expect(membership!.userId).toBe('user-1');
    expect(membership!.familyId).toBe(f.familyId);
  });

  it('returns null when the user is not a member', async () => {
    const f = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });
    const membership = await getFamilyMembership(db, 'user-2', f.familyId);
    expect(membership).toBeNull();
  });
});

describe('transferOwnership', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'user-1', 'Alice');
    await seedUser(db, 'user-2', 'Bob');
    await seedUser(db, 'user-3', 'Charlie');
  });

  it('swaps owner/admin roles and updates family_registry.owner_id', async () => {
    const f = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });

    // Add user-2 as admin
    const now = new Date().toISOString();
    db.insert(centralSchema.familyMembers).values({
      id: 'mem-admin',
      familyId: f.familyId,
      userId: 'user-2',
      role: 'admin',
      joinedAt: now,
    }).run();

    const result = await transferOwnership(db, {
      familyId: f.familyId,
      currentOwnerId: 'user-1',
      newOwnerId: 'user-2',
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Former owner is now admin
    const formerOwner = await getFamilyMembership(db, 'user-1', f.familyId);
    expect(formerOwner!.role).toBe('admin');

    // New owner is now owner
    const newOwner = await getFamilyMembership(db, 'user-2', f.familyId);
    expect(newOwner!.role).toBe('owner');

    // Registry updated
    const registry = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, f.familyId)).get();
    expect(registry!.ownerId).toBe('user-2');
  });

  it('fails if the target user is not an admin', async () => {
    const f = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });

    // Add user-3 as editor (not admin)
    const now = new Date().toISOString();
    db.insert(centralSchema.familyMembers).values({
      id: 'mem-editor',
      familyId: f.familyId,
      userId: 'user-3',
      role: 'editor',
      joinedAt: now,
    }).run();

    const result = await transferOwnership(db, {
      familyId: f.familyId,
      currentOwnerId: 'user-1',
      newOwnerId: 'user-3',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Roles unchanged
    const owner = await getFamilyMembership(db, 'user-1', f.familyId);
    expect(owner!.role).toBe('owner');
  });

  it('fails if the target user is not a member at all', async () => {
    const f = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });

    const result = await transferOwnership(db, {
      familyId: f.familyId,
      currentOwnerId: 'user-1',
      newOwnerId: 'user-2',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
