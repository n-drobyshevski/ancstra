import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { centralSchema, type CentralDatabase } from '@ancstra/db';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { bumpLastSeenAt } from '@/lib/auth/last-seen-tracker';

const { familyMembers } = centralSchema;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();

  const now = new Date().toISOString();
  db.$client.prepare(
    'INSERT INTO users (id, email, name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('u1', 'u1@example.com', 'User One', 0, now, now);

  db.$client.prepare(
    'INSERT INTO family_registry (id, name, owner_id, db_filename, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('f1', 'Family One', 'u1', 'f1.db', now, now);

  db.$client.prepare(
    'INSERT INTO family_members (id, family_id, user_id, role, joined_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL)',
  ).run('m1', 'f1', 'u1', 'owner', now);
});

afterEach(() => {
  if (db.$client.open) {
    db.$client.close();
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
    db.$client.close();

    const result = await bumpLastSeenAt(db as unknown as CentralDatabase, 'u1', 'f1');

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[last-seen-tracker]');

    warnSpy.mockRestore();
  });
});
