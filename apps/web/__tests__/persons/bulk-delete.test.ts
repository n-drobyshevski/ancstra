import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { bulkDeletePersons } from '../../lib/persons/bulk-delete';

const NOW = '2026-04-25T10:00:00.000Z';

function createTestDb(): any {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
  `);
  return drizzle(sqlite, { schema }) as any;
}

let db: any;

function p(id: string) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, 'U', 1, 'private', ${NOW}, ${NOW})`);
}

beforeEach(() => { db = createTestDb(); });

describe('bulkDeletePersons', () => {
  it('returns 0 affected when ids is empty', async () => {
    const r = await bulkDeletePersons(db, []);
    expect(r.affected).toBe(0);
  });

  it('soft-deletes the listed persons (sets deleted_at)', async () => {
    p('p1'); p('p2'); p('p3');
    const r = await bulkDeletePersons(db, ['p1', 'p3']);
    expect(r.affected).toBe(2);
    const rows = db.all(sql`SELECT id, deleted_at FROM persons ORDER BY id`);
    expect(rows.find((row: any) => row.id === 'p1').deleted_at).not.toBeNull();
    expect(rows.find((row: any) => row.id === 'p2').deleted_at).toBeNull();
    expect(rows.find((row: any) => row.id === 'p3').deleted_at).not.toBeNull();
  });

  it('does not double-delete already-deleted persons', async () => {
    p('p1');
    db.run(sql`UPDATE persons SET deleted_at = ${NOW} WHERE id = 'p1'`);
    const r = await bulkDeletePersons(db, ['p1']);
    expect(r.affected).toBe(0);
  });

  it('skips ids that do not exist', async () => {
    p('p1');
    const r = await bulkDeletePersons(db, ['p1', 'nonexistent']);
    expect(r.affected).toBe(1);
  });
});