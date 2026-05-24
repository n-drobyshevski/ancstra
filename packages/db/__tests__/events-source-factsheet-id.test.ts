import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle C — Person Continuity + Confidence Rubric (2026-05-24).
 *
 * Validates the desired shape of `events.source_factsheet_id`:
 *  - Accepts NULL (GEDCOM-imported and manually-created events).
 *  - Accepts a valid factsheet id (FK satisfied).
 *  - Rejects a non-existent factsheet id (FK violation).
 *  - Sets to NULL when the referenced factsheet is deleted (ON DELETE SET NULL).
 *
 * Bootstrap DDL mirrors the family-schema + research-schema shape for the
 * tables needed. The events table here reflects the target schema including
 * the new `source_factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL`
 * column added in this task.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §4.1
 */

const BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE factsheets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  date_original TEXT,
  date_sort INTEGER,
  place_text TEXT,
  description TEXT,
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  family_id TEXT,
  contested INTEGER NOT NULL DEFAULT 0,
  source_factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

describe('events — Bundle C source_factsheet_id column', () => {
  it('accepts NULL source_factsheet_id (GEDCOM-style events)', () => {
    db.$client.prepare(
      `INSERT INTO persons (id, created_at, updated_at) VALUES (?, ?, ?)`,
    ).run('p1', '2026-05-24', '2026-05-24');
    db.$client.prepare(
      `INSERT INTO events (id, event_type, person_id, source_factsheet_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('e1', 'birth', 'p1', null, '2026-05-24', '2026-05-24');
    const row = db.$client.prepare('SELECT source_factsheet_id FROM events WHERE id = ?').get('e1') as { source_factsheet_id: string | null };
    expect(row.source_factsheet_id).toBeNull();
  });

  it('accepts a valid factsheet id', () => {
    db.$client.prepare(
      `INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('fs1', 'Test Factsheet', 'u1', '2026-05-24', '2026-05-24');
    db.$client.prepare(
      `INSERT INTO events (id, event_type, source_factsheet_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e2', 'birth', 'fs1', '2026-05-24', '2026-05-24');
    const row = db.$client.prepare('SELECT source_factsheet_id FROM events WHERE id = ?').get('e2') as { source_factsheet_id: string | null };
    expect(row.source_factsheet_id).toBe('fs1');
  });

  it('rejects FK violation on bad factsheet id', () => {
    expect(() => {
      db.$client.prepare(
        `INSERT INTO events (id, event_type, source_factsheet_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run('e3', 'birth', 'nonexistent-factsheet', '2026-05-24', '2026-05-24');
    }).toThrow(/FOREIGN KEY/i);
  });

  it('sets source_factsheet_id to NULL when factsheet is deleted (ON DELETE SET NULL)', () => {
    db.$client.prepare(
      `INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('fs2', 'Deletable Factsheet', 'u1', '2026-05-24', '2026-05-24');
    db.$client.prepare(
      `INSERT INTO events (id, event_type, source_factsheet_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e4', 'birth', 'fs2', '2026-05-24', '2026-05-24');
    // Verify it's set
    const before = db.$client.prepare('SELECT source_factsheet_id FROM events WHERE id = ?').get('e4') as { source_factsheet_id: string | null };
    expect(before.source_factsheet_id).toBe('fs2');
    // Delete the factsheet
    db.$client.prepare(`DELETE FROM factsheets WHERE id = ?`).run('fs2');
    // Verify ON DELETE SET NULL kicked in
    const after = db.$client.prepare('SELECT source_factsheet_id FROM events WHERE id = ?').get('e4') as { source_factsheet_id: string | null };
    expect(after.source_factsheet_id).toBeNull();
  });
});
