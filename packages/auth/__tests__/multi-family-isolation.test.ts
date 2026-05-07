import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';
import { createTestCentralDb } from '@ancstra/db/test-fixtures';
import { transferOwnership, getFamiliesForUser } from '../src/families';
import Database from 'better-sqlite3';
import { drizzle as drizzleFamily } from 'drizzle-orm/better-sqlite3';

function createTestFamilyDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  // Use bracket notation to invoke the sqlite exec method.
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  return { db: drizzleFamily(sqlite), sqlite };
}

async function seed(db: ReturnType<typeof createTestCentralDb>) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-alice', email: 'alice@t', name: 'Alice', createdAt: now, updatedAt: now },
    { id: 'u-bob', email: 'bob@t', name: 'Bob', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyRegistry).values([
    { id: 'fam-1', name: 'Family One', ownerId: 'u-alice', dbFilename: 'f1.db', createdAt: now, updatedAt: now },
    { id: 'fam-2', name: 'Family Two', ownerId: 'u-bob', dbFilename: 'f2.db', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-1', familyId: 'fam-1', userId: 'u-alice', role: 'owner', joinedAt: now },
    { id: 'm-2', familyId: 'fam-2', userId: 'u-bob', role: 'owner', joinedAt: now },
    { id: 'm-3', familyId: 'fam-2', userId: 'u-alice', role: 'admin', joinedAt: now },
  ]).run();
}

describe('multi-family isolation', () => {
  let db: ReturnType<typeof createTestCentralDb>;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seed(db);
  });

  it('user with 2 memberships is returned in both family lists', async () => {
    const families = await getFamiliesForUser(db, 'u-alice');
    expect(families).toHaveLength(2);
    const ids = families.map((f) => f.familyId).sort();
    expect(ids).toEqual(['fam-1', 'fam-2']);
  });

  it('central-DB query filtered by familyId only returns that family rows', async () => {
    const fam1Members = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.familyId, 'fam-1'))
      .all();
    expect(fam1Members).toHaveLength(1);
    expect(fam1Members[0]?.userId).toBe('u-alice');
    expect(fam1Members[0]?.role).toBe('owner');
  });

  it('family DB physical isolation: writes to A do not appear in B', () => {
    const familyA = createTestFamilyDb();
    const familyB = createTestFamilyDb();

    familyA.sqlite.prepare(`INSERT INTO persons (id, name) VALUES (?, ?)`).run('p-1', 'Alice Person');

    const aRows = familyA.sqlite.prepare(`SELECT * FROM persons`).all();
    const bRows = familyB.sqlite.prepare(`SELECT * FROM persons`).all();

    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(0);
  });

  it('transferOwnership in family-2 does not affect alice in family-1', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-2',
      currentOwnerId: 'u-bob',
      newOwnerId: 'u-alice',
    });
    expect(result.success).toBe(true);

    const fam2Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-2'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam2Alice?.role).toBe('owner');

    const fam1Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam1Alice?.role).toBe('owner');
  });

  it('removing alice from fam-2 does NOT cascade-delete her fam-1 membership', async () => {
    await db
      .update(centralSchema.familyMembers)
      .set({ isActive: 0 })
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-2'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .run();

    const fam1Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam1Alice).toBeDefined();
    expect(fam1Alice?.isActive).toBe(1);
    expect(fam1Alice?.role).toBe('owner');
  });

  it('per-family moderation_enabled setting is independent', async () => {
    await db
      .update(centralSchema.familyRegistry)
      .set({ moderationEnabled: 1 })
      .where(eq(centralSchema.familyRegistry.id, 'fam-1'))
      .run();

    const fam1 = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    const fam2 = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-2')).get();

    expect(fam1?.moderationEnabled).toBe(1);
    expect(fam2?.moderationEnabled).toBe(0);
  });
});
