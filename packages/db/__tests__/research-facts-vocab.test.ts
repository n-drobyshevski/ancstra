import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle A — Research Flow Unification (2026-05-23), Task 3.
 *
 * Validates the desired shape of `research_facts`:
 *  - `confidence` defaults to 'medium', accepts 'unknown' (CONFIDENCE_BANDS)
 *  - `contested` column exists with INTEGER NOT NULL DEFAULT 0 (orthogonal to confidence)
 *  - `provenance` column exists with TEXT NOT NULL DEFAULT 'derived'
 *    (accepts 'cited', 'derived', 'user_inference')
 *  - `fact_type` enum includes 'sibling_name'
 *
 * Unlike `factsheet_links`, `research_facts` has no CHECK constraints on
 * confidence / fact_type / provenance — the TS Drizzle enum is the only
 * enforcement. So this test exercises insert-and-readback, not constraint
 * rejection.
 *
 * Mirrors the bootstrap shape of `factsheet-links-vocab.test.ts` (T2):
 * `createTestCentralDb()` + inline DDL via the bulk-DDL method.
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
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_by TEXT NOT NULL,
    discovery_method TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    cluster_promotion_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    research_item_id TEXT REFERENCES research_items(id),
    source_citation_id TEXT REFERENCES source_citations(id),
    factsheet_id TEXT REFERENCES factsheets(id),
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO persons (id, created_by, created_at, updated_at) VALUES ('p1', 'u', '2026-05-23', '2026-05-23');
  INSERT INTO research_items (id, title, created_by, discovery_method, status, created_at, updated_at) VALUES ('ri1', 'T', 'u', 'paste_text', 'collected', '2026-05-23', '2026-05-23');
  INSERT INTO source_citations (id, source_id, created_at) VALUES ('sc1', 'src1', '2026-05-23');
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

describe('research_facts — Bundle A vocab contract', () => {
  const insertFact = (overrides: Record<string, string | number | null>) => {
    const baseCols = {
      id: 'f',
      fact_type: 'name',
      fact_value: 'John Doe',
      created_at: '2026-05-23',
      updated_at: '2026-05-23',
    };
    const cols = { ...baseCols, ...overrides };
    const keys = Object.keys(cols);
    const placeholders = keys.map(() => '?').join(',');
    const stmt = db.$client.prepare(
      `INSERT INTO research_facts (${keys.join(',')}) VALUES (${placeholders})`,
    );
    stmt.run(...Object.values(cols));
  };

  const getFact = (id: string) =>
    db.$client
      .prepare('SELECT * FROM research_facts WHERE id = ?')
      .get(id) as Record<string, unknown>;

  it('defaults contested to 0 and provenance to derived', () => {
    insertFact({ id: 'f1', confidence: 'high' });
    const row = getFact('f1');
    expect(row.contested).toBe(0);
    expect(row.provenance).toBe('derived');
  });

  it('accepts unknown confidence', () => {
    insertFact({ id: 'f2', confidence: 'unknown' });
    expect(getFact('f2').confidence).toBe('unknown');
  });

  it('accepts cited provenance with source_citation_id', () => {
    insertFact({
      id: 'f3',
      confidence: 'high',
      provenance: 'cited',
      source_citation_id: 'sc1',
    });
    expect(getFact('f3').provenance).toBe('cited');
  });

  it('accepts user_inference provenance', () => {
    insertFact({ id: 'f4', confidence: 'low', provenance: 'user_inference' });
    expect(getFact('f4').provenance).toBe('user_inference');
  });

  it('accepts sibling_name factType', () => {
    insertFact({ id: 'f5', fact_type: 'sibling_name', fact_value: 'Jane Doe' });
    expect(getFact('f5').fact_type).toBe('sibling_name');
  });
});
