import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as centralSchema from '@ancstra/db/central-schema';
import {
  createFamily,
  getFamiliesForUser,
  getFamilyMembership,
  transferOwnership,
} from '../src/families';

function createTestCentralDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE family_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      db_filename TEXT NOT NULL,
      moderation_enabled INTEGER NOT NULL DEFAULT 0,
      max_members INTEGER NOT NULL DEFAULT 50,
      monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
      invited_role TEXT,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      UNIQUE(family_id, user_id)
    );
  `);

  return { db: drizzle(sqlite, { schema: centralSchema }), sqlite };
}

async function seedUser(db: ReturnType<typeof createTestCentralDb>['db'], id: string, name: string) {
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
  let db: ReturnType<typeof createTestCentralDb>['db'];
  let sqlite: Database.Database;

  beforeEach(async () => {
    const ctx = createTestCentralDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
    await seedUser(db, 'user-1', 'Alice');
  });

  it('creates a family_registry row and owner membership', async () => {
    const result = await createFamily(db, { name: 'Smith Family', ownerId: 'user-1' });

    expect(result.familyId).toBeDefined();
    expect(result.dbFilename).toMatch(/\.sqlite$/);

    // Verify the registry row
    const registry = sqlite.prepare('SELECT * FROM family_registry WHERE id = ?').get(result.familyId) as any;
    expect(registry).toBeDefined();
    expect(registry.name).toBe('Smith Family');
    expect(registry.owner_id).toBe('user-1');
    expect(registry.db_filename).toBe(result.dbFilename);

    // Verify the membership row
    const membership = sqlite.prepare(
      'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
    ).get(result.familyId, 'user-1') as any;
    expect(membership).toBeDefined();
    expect(membership.role).toBe('owner');
    expect(membership.is_active).toBe(1);
  });

  it('generates a unique db_filename for each family', async () => {
    const r1 = await createFamily(db, { name: 'Family A', ownerId: 'user-1' });
    const r2 = await createFamily(db, { name: 'Family B', ownerId: 'user-1' });
    expect(r1.dbFilename).not.toBe(r2.dbFilename);
  });
});

describe('getFamiliesForUser', () => {
  let db: ReturnType<typeof createTestCentralDb>['db'];

  beforeEach(async () => {
    const ctx = createTestCentralDb();
    db = ctx.db;
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
  let db: ReturnType<typeof createTestCentralDb>['db'];

  beforeEach(async () => {
    const ctx = createTestCentralDb();
    db = ctx.db;
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
  let db: ReturnType<typeof createTestCentralDb>['db'];
  let sqlite: Database.Database;

  beforeEach(async () => {
    const ctx = createTestCentralDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
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
    const registry = sqlite.prepare('SELECT owner_id FROM family_registry WHERE id = ?').get(f.familyId) as any;
    expect(registry.owner_id).toBe('user-2');
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
