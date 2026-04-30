import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { centralSchema, type CentralDatabase } from '@ancstra/db';
import { bumpLastSeenAt } from '@/lib/auth/last-seen-tracker';

const { familyMembers } = centralSchema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema: centralSchema });

  const ddl = [
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      memberships_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE family_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      db_filename TEXT NOT NULL,
      moderation_enabled INTEGER NOT NULL DEFAULT 0,
      max_members INTEGER NOT NULL DEFAULT 50,
      monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      invited_role TEXT,
      joined_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      UNIQUE(family_id, user_id)
    )`,
  ];
  for (const stmt of ddl) {
    sqlite.prepare(stmt).run();
  }

  const now = new Date().toISOString();
  sqlite.prepare(
    'INSERT INTO users (id, email, name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('u1', 'u1@example.com', 'User One', 0, now, now);

  sqlite.prepare(
    'INSERT INTO family_registry (id, name, owner_id, db_filename, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('f1', 'Family One', 'u1', 'f1.db', now, now);

  sqlite.prepare(
    'INSERT INTO family_members (id, family_id, user_id, role, joined_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL)',
  ).run('m1', 'f1', 'u1', 'owner', now);
});

afterEach(() => {
  if (sqlite.open) {
    sqlite.close();
  }
});

describe('bumpLastSeenAt', () => {
  it('updates last_seen_at for an existing family_members row and returns true', async () => {
    const result = await bumpLastSeenAt(db as unknown as CentralDatabase, 'u1', 'f1');

    expect(result).toBe(true);

    const row = db.select().from(familyMembers).get();
    expect(row).not.toBeNull();
    expect(row!.lastSeenAt).not.toBeNull();
    expect(row!.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns false when no matching (userId, familyId) row exists', async () => {
    const result = await bumpLastSeenAt(
      db as unknown as CentralDatabase,
      'non-existent-user',
      'non-existent-family',
    );

    expect(result).toBe(false);
  });

  it('returns false and calls console.warn with [last-seen-tracker] prefix when the DB throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Close the underlying SQLite connection so the next DB operation throws
    sqlite.close();

    const result = await bumpLastSeenAt(db as unknown as CentralDatabase, 'u1', 'f1');

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[last-seen-tracker]');

    warnSpy.mockRestore();
  });
});
