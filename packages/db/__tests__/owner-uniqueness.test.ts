import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as centralSchema from '../src/central-schema';
import { ensureCentralSchema } from '../src/index';

async function setupDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema: centralSchema });

  // Manually create the base central tables (no migration runner for central DB).
  // ensureCentralSchema then adds the memberships_version column + partial UQ index.
  await db.run(sql`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE family_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      db_filename TEXT NOT NULL,
      moderation_enabled INTEGER NOT NULL DEFAULT 0,
      max_members INTEGER NOT NULL DEFAULT 50,
      monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      invited_role TEXT,
      joined_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      UNIQUE(family_id, user_id)
    )
  `);

  // Apply the sub-spec A additions: memberships_version column + partial UQ index.
  // Cast to any: ensureCentralSchema accepts CentralDatabase (libsql drizzle),
  // but better-sqlite3 drizzle exposes the same .run() API used internally.
  await ensureCentralSchema(db as any);

  return db;
}

describe('family_members owner-uniqueness partial index', () => {
  it('rejects a second owner row for the same family', async () => {
    const db = await setupDb();
    const now = new Date().toISOString();

    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, createdAt: now, updatedAt: now },
    ]).run();

    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    await db.insert(centralSchema.familyMembers).values({
      id: 'm1', familyId: 'f1', userId: 'u1', role: 'owner',
      invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
    }).run();

    expect(() =>
      db.insert(centralSchema.familyMembers).values({
        id: 'm2', familyId: 'f1', userId: 'u2', role: 'owner',
        invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
      }).run()
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('allows multiple non-owner members in the same family', async () => {
    const db = await setupDb();
    const now = new Date().toISOString();

    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u3', email: 'c@x', name: 'C', emailVerified: 0, createdAt: now, updatedAt: now },
    ]).run();

    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    await db.insert(centralSchema.familyMembers).values([
      { id: 'm1', familyId: 'f1', userId: 'u1', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
      { id: 'm2', familyId: 'f1', userId: 'u2', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
      { id: 'm3', familyId: 'f1', userId: 'u3', role: 'editor', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
    ]).run();

    const rows = await db.select().from(centralSchema.familyMembers).all();
    expect(rows.length).toBe(3);
  });
});
