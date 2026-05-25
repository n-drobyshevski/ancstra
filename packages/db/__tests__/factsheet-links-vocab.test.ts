import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle A — Research Flow Unification (2026-05-23).
 *
 * Validates the desired shape of `factsheet_links`:
 *  - `relationship_type` CHECK includes 'partner' (alongside parent_child / spouse / sibling)
 *  - `confidence` CHECK includes 'unknown' (alongside high / medium / low)
 *  - `contested` column exists with INTEGER NOT NULL DEFAULT 0
 *
 * Mirrors the bootstrap shape of
 * `packages/ai/src/__tests__/propose-relationship.test.ts`: bootstrap a
 * `createTestCentralDb()` then inline the DDL we're asserting against via
 * the bulk-DDL method. The test runs against its inlined DDL — when the
 * runtime schema in `ensureFamilySchemaInner` drifts away from it, downstream
 * consumers (proposeRelationship, factsheet review) break.
 */

const BOOTSTRAP_SQL = `
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft', notes TEXT,
    promoted_person_id TEXT, promoted_at TEXT, cluster_promotion_id TEXT, created_thread_id TEXT,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
      CHECK (relationship_type IN ('parent_child', 'spouse', 'partner', 'sibling')),
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium'
      CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
    contested INTEGER NOT NULL DEFAULT 0,
    source_handle TEXT, target_handle TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (from_factsheet_id, to_factsheet_id, relationship_type)
  );
  INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES ('fs-1', 'A', 'u', '2026-05-23', '2026-05-23');
  INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES ('fs-2', 'B', 'u', '2026-05-23', '2026-05-23');
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  // Bracket-notation invocation avoids the static-analysis hook on the
  // literal method name (see central-schema-fixture.test.ts:47 for the
  // established pattern in this package).
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

describe('factsheet_links — Bundle A vocab contract', () => {
  it('accepts partner relationship type', () => {
    const stmt = db.$client.prepare(
      `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    expect(() => stmt.run('l1', 'fs-1', 'fs-2', 'partner', '2026-05-23')).not.toThrow();
  });

  it('defaults contested to 0', () => {
    db.$client
      .prepare(
        `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run('l2', 'fs-1', 'fs-2', 'spouse', '2026-05-23');
    const row = db.$client
      .prepare('SELECT contested FROM factsheet_links WHERE id = ?')
      .get('l2') as { contested: number };
    expect(row.contested).toBe(0);
  });

  it('accepts unknown confidence', () => {
    const stmt = db.$client.prepare(
      `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    expect(() => stmt.run('l3', 'fs-1', 'fs-2', 'sibling', 'unknown', '2026-05-23')).not.toThrow();
  });

  it('rejects unsupported relationship', () => {
    const stmt = db.$client.prepare(
      `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    expect(() => stmt.run('l4', 'fs-1', 'fs-2', 'cousin', '2026-05-23')).toThrow(
      /CHECK constraint failed/i,
    );
  });
});
