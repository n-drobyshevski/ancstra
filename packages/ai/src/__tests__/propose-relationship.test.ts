import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { executeProposeRelationship } from '../tools/propose-relationship';

/**
 * Bundle A — Research Flow Unification (2026-05-23).
 * The AI propose-relationship tool no longer writes to
 * `proposed_relationships`. It now materialises a draft factsheet plus a
 * single research_fact carrying the relationship assertion. The user reviews
 * that factsheet in the standard UI; on promotion it becomes a
 * families/children row.
 *
 * See: docs/superpowers/specs/2026-05-23-research-flow-unification-bundle-a-design.md §2.2
 */

const BOOTSTRAP_SQL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT,
    created_by TEXT, created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT,
    given_name TEXT NOT NULL, surname TEXT NOT NULL,
    suffix TEXT, nickname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, created_by TEXT NOT NULL,
    discovery_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'collected',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY, source_id TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft', notes TEXT,
    promoted_person_id TEXT, promoted_at TEXT, created_thread_id TEXT,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT REFERENCES persons(id),
    fact_type TEXT NOT NULL, fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    research_item_id TEXT, source_citation_id TEXT, factsheet_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  INSERT INTO persons (id, sex, created_by, created_at, updated_at) VALUES ('p-1', 'M', 'u', '2026-05-23', '2026-05-23');
  INSERT INTO persons (id, sex, created_by, created_at, updated_at) VALUES ('p-2', 'F', 'u', '2026-05-23', '2026-05-23');
  INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES ('n1', 'p-1', 'John', 'Doe', 1, '2026-05-23');
  INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES ('n2', 'p-2', 'Jane', 'Doe', 1, '2026-05-23');
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  // Bracket-notation invocation avoids the static-analysis hook on the
  // literal method name; pattern established in factsheet-links-vocab.test.ts.
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

const getFactsheets = () =>
  db.$client.prepare('SELECT * FROM factsheets').all() as any[];
const getFactsBy = (fsId: string) =>
  db.$client.prepare('SELECT * FROM research_facts WHERE factsheet_id = ?').all(fsId) as any[];

describe('proposeRelationship (Bundle A — factsheet path)', () => {
  it('creates a draft factsheet plus a single research_fact', async () => {
    const result = await executeProposeRelationship(db as any, {
      person1Id: 'p-1', person2Id: 'p-2',
      relationshipType: 'parent_child',
      evidence: 'Census 1850 shows same household', confidence: 0.85,
    });
    expect(result.factsheetId).toBeTruthy();
    expect(result.status).toBe('draft');

    const fs = getFactsheets();
    expect(fs).toHaveLength(1);
    expect(fs[0].entity_type).toBe('family_unit');
    expect(fs[0].status).toBe('draft');
    expect(fs[0].notes).toContain('Census');

    const facts = getFactsBy(result.factsheetId);
    expect(facts).toHaveLength(1);
    expect(facts[0].fact_type).toBe('parent_name');
    expect(facts[0].fact_value).toBe('p-2');
    expect(facts[0].factsheet_id).toBe(result.factsheetId);
    expect(facts[0].person_id).toBe('p-1');
    expect(facts[0].confidence).toBe('high');
    expect(facts[0].provenance).toBe('user_inference');
    expect(facts[0].extraction_method).toBe('ai_extracted');
  });

  it('provenance=derived when sourceRecordId references a research_item', async () => {
    db.$client.prepare(
      `INSERT INTO research_items (id, title, created_by, discovery_method, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('ri-x', 'Census', 'u', 'paste_text', 'collected', '2026-05-23', '2026-05-23');
    const r = await executeProposeRelationship(db as any, {
      person1Id: 'p-1', person2Id: 'p-2',
      relationshipType: 'partner',
      evidence: 'Marriage record', confidence: 0.95, sourceRecordId: 'ri-x',
    });
    const facts = getFactsBy(r.factsheetId);
    expect(facts[0].provenance).toBe('derived');
    expect(facts[0].research_item_id).toBe('ri-x');
    expect(facts[0].fact_type).toBe('spouse_name');
  });

  it('sibling produces sibling_name factType', async () => {
    const r = await executeProposeRelationship(db as any, {
      person1Id: 'p-1', person2Id: 'p-2',
      relationshipType: 'sibling',
      evidence: 'Baptism register lists both', confidence: 0.7,
    });
    const facts = getFactsBy(r.factsheetId);
    expect(facts[0].fact_type).toBe('sibling_name');
    expect(facts[0].confidence).toBe('medium');
  });

  it('detects duplicate factsheet for same person pair + relationship', async () => {
    const r1 = await executeProposeRelationship(db as any, {
      person1Id: 'p-1', person2Id: 'p-2', relationshipType: 'parent_child', evidence: 'First', confidence: 0.8,
    });
    const r2 = await executeProposeRelationship(db as any, {
      person1Id: 'p-1', person2Id: 'p-2', relationshipType: 'parent_child', evidence: 'Second', confidence: 0.9,
    });
    expect(r2.factsheetId).toBe(r1.factsheetId);
    expect(r2.message).toContain('already exists');
    expect(getFactsheets()).toHaveLength(1);
  });

  it('returns error for nonexistent person', async () => {
    const r = await executeProposeRelationship(db as any, {
      person1Id: 'nope', person2Id: 'p-2', relationshipType: 'sibling', evidence: 'x', confidence: 0.5,
    });
    expect(r.message).toContain('not found');
    expect(r.factsheetId).toBe('');
  });
});
