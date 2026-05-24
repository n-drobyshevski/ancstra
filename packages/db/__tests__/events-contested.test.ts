import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle B — Research Flow Inbox + Reversibility (2026-05-24).
 *
 * Validates the desired shape of `events.contested`:
 *  - Defaults to 0 when not supplied.
 *  - Accepts 1 (flagged for review / GEDCOM dispute).
 *
 * Bootstrap DDL mirrors the family-schema shape for the tables needed.
 * The events table here reflects the target schema including the new
 * `contested INTEGER NOT NULL DEFAULT 0` column.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §5.3
 */

const BOOTSTRAP_SQL = `
CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  sex TEXT NOT NULL DEFAULT 'U',
  is_living INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  date_original TEXT,
  date_sort INTEGER,
  place_text TEXT,
  contested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO persons (id, created_by, created_at, updated_at) VALUES ('p1', 'u', '2026-05-24', '2026-05-24');
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

describe('events — Bundle B contested column', () => {
  it('defaults contested to 0', () => {
    db.$client.prepare(
      `INSERT INTO events (id, person_id, event_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e1', 'p1', 'birth', '2026-05-24', '2026-05-24');
    const row = db.$client.prepare('SELECT contested FROM events WHERE id = ?').get('e1') as { contested: number };
    expect(row.contested).toBe(0);
  });

  it('accepts contested = 1', () => {
    db.$client.prepare(
      `INSERT INTO events (id, person_id, event_type, contested, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('e2', 'p1', 'birth', 1, '2026-05-24', '2026-05-24');
    const row = db.$client.prepare('SELECT contested FROM events WHERE id = ?').get('e2') as { contested: number };
    expect(row.contested).toBe(1);
  });
});
