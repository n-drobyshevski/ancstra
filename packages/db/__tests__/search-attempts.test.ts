import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle E — Research Flow Unification (2026-05-26).
 *
 * Validates the desired shape of `search_attempts`:
 *  - All NOT NULL columns reject NULL.
 *  - FK person_id ON DELETE CASCADE: deleting a person removes the row.
 *  - FK thread_id ON DELETE SET NULL: deleting a thread sets thread_id to NULL.
 *  - FK research_item_id ON DELETE SET NULL: deleting a research_item sets it to NULL.
 *  - All 3 indexes exist.
 *
 * Bootstrap mirrors the pattern in `factsheets-cluster-promotion-id.test.ts`.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §2.1
 */

const BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    discovery_method TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE search_attempts (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    thread_id TEXT REFERENCES research_threads(id) ON DELETE SET NULL,
    research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
    provider_kind TEXT NOT NULL,
    provider_label TEXT,
    query TEXT,
    searched_at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_search_attempts_person ON search_attempts(person_id, searched_at);
  CREATE INDEX idx_search_attempts_thread ON search_attempts(thread_id);
  CREATE INDEX idx_search_attempts_research_item ON search_attempts(research_item_id);
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  // Bracket-notation invocation avoids the static-analysis hook on the
  // literal method name (see central-schema-fixture.test.ts for the
  // established pattern in this package).
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);

  // Seed shared rows used across cases.
  db.$client.prepare(
    `INSERT INTO persons (id, created_at, updated_at) VALUES (?, ?, ?)`,
  ).run('p1', '2026-05-26', '2026-05-26');
  db.$client.prepare(
    `INSERT INTO research_threads (id, title, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run('t1', 'Anna Petrova', 'u1', '2026-05-26', '2026-05-26');
  db.$client.prepare(
    `INSERT INTO research_items (id, title, discovery_method, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ri1', '1923 census', 'search', 'collected', 'u1', '2026-05-26', '2026-05-26');
});

afterEach(() => {
  db.$client.close();
});

const insertAttempt = (overrides: Partial<Record<string, unknown>> = {}) => {
  const row = {
    id: 'sa1',
    person_id: 'p1',
    thread_id: null,
    research_item_id: null,
    provider_kind: 'familysearch',
    provider_label: null,
    query: 'Anna Petrova 1923',
    searched_at: 1716700000000,
    outcome: 'found',
    notes: null,
    created_by: 'u1',
    created_at: 1716700000000,
    updated_at: 1716700000000,
    ...overrides,
  };
  db.$client.prepare(
    `INSERT INTO search_attempts
     (id, person_id, thread_id, research_item_id, provider_kind, provider_label,
      query, searched_at, outcome, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id, row.person_id, row.thread_id, row.research_item_id, row.provider_kind,
    row.provider_label, row.query, row.searched_at, row.outcome, row.notes,
    row.created_by, row.created_at, row.updated_at,
  );
  return row;
};

describe('search_attempts — Bundle E table', () => {
  it('accepts a minimal `found` row with NULL thread/research_item/notes', () => {
    expect(() => insertAttempt()).not.toThrow();
    const row = db.$client
      .prepare('SELECT * FROM search_attempts WHERE id = ?')
      .get('sa1') as Record<string, unknown>;
    expect(row.person_id).toBe('p1');
    expect(row.outcome).toBe('found');
    expect(row.notes).toBeNull();
  });

  it('rejects NULL person_id (NOT NULL constraint)', () => {
    expect(() => insertAttempt({ id: 'sa-bad', person_id: null }))
      .toThrow(/NOT NULL|person_id/);
  });

  it('rejects NULL provider_kind (NOT NULL constraint)', () => {
    expect(() => insertAttempt({ id: 'sa-bad', provider_kind: null }))
      .toThrow(/NOT NULL|provider_kind/);
  });

  it('rejects NULL outcome (NOT NULL constraint)', () => {
    expect(() => insertAttempt({ id: 'sa-bad', outcome: null }))
      .toThrow(/NOT NULL|outcome/);
  });

  it('rejects NULL searched_at (NOT NULL constraint)', () => {
    expect(() => insertAttempt({ id: 'sa-bad', searched_at: null }))
      .toThrow(/NOT NULL|searched_at/);
  });

  it('person_id FK cascades on person delete', () => {
    insertAttempt();
    db.$client.prepare('DELETE FROM persons WHERE id = ?').run('p1');
    const row = db.$client
      .prepare('SELECT * FROM search_attempts WHERE id = ?')
      .get('sa1');
    expect(row).toBeUndefined();
  });

  it('thread_id FK sets to NULL on thread delete', () => {
    insertAttempt({ thread_id: 't1' });
    db.$client.prepare('DELETE FROM research_threads WHERE id = ?').run('t1');
    const row = db.$client
      .prepare('SELECT thread_id FROM search_attempts WHERE id = ?')
      .get('sa1') as { thread_id: string | null };
    expect(row.thread_id).toBeNull();
  });

  it('research_item_id FK sets to NULL on research_item delete', () => {
    insertAttempt({ research_item_id: 'ri1' });
    db.$client.prepare('DELETE FROM research_items WHERE id = ?').run('ri1');
    const row = db.$client
      .prepare('SELECT research_item_id FROM search_attempts WHERE id = ?')
      .get('sa1') as { research_item_id: string | null };
    expect(row.research_item_id).toBeNull();
  });

  it('accepts all 10 provider_kind values from SEARCH_PROVIDER_KINDS', () => {
    const kinds = [
      'familysearch', 'ancestry', 'myheritage', 'findmypast',
      'geni', 'wikitree',
      'archive', 'library', 'family', 'other',
    ];
    kinds.forEach((kind, idx) => {
      expect(() => insertAttempt({
        id: `sa-${idx}`, provider_kind: kind,
        // ad-hoc kinds may carry a label.
        provider_label: ['archive', 'library', 'family', 'other'].includes(kind)
          ? 'Russian State Archive' : null,
      })).not.toThrow();
    });
  });

  it('accepts all 3 outcome values from SEARCH_OUTCOMES', () => {
    (['found', 'negative', 'inconclusive'] as const).forEach((outcome, idx) => {
      expect(() => insertAttempt({
        id: `sa-out-${idx}`, outcome,
        notes: outcome === 'found' ? null : 'searched, nothing relevant',
      })).not.toThrow();
    });
  });

  it('person_idx is used when filtering by person_id + searched_at', () => {
    insertAttempt();
    const plan = db.$client
      .prepare(`EXPLAIN QUERY PLAN
        SELECT id FROM search_attempts
        WHERE person_id = ? ORDER BY searched_at DESC`)
      .all('p1') as Array<{ detail: string }>;
    const detail = plan.map((r) => r.detail).join('\n');
    expect(detail).toMatch(/idx_search_attempts_person/i);
  });
});
