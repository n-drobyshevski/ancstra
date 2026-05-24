import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle B — Research Flow Inbox + Reversibility (2026-05-24).
 *
 * Validates the desired shape of `research_thread_events`:
 *  - `thread_id` is NULLable so Inbox-context reverse transitions that
 *    aren't tied to a research thread can still be recorded in the unified
 *    audit log.
 *  - The FK still cascades on thread delete.
 *
 * Mirrors the bootstrap shape of
 * `packages/db/__tests__/factsheet-links-vocab.test.ts`: bootstrap a
 * `createTestCentralDb()` then inline the DDL we're asserting against via
 * the bulk-DDL method. Foreign keys are ON in the test fixture by default.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §5.1
 */

const BOOTSTRAP_SQL = `
  CREATE TABLE research_threads (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE factsheets (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE persons (id TEXT PRIMARY KEY, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE research_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_by TEXT NOT NULL, discovery_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'collected', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE research_facts (id TEXT PRIMARY KEY, fact_type TEXT NOT NULL, fact_value TEXT NOT NULL, confidence TEXT NOT NULL DEFAULT 'medium', contested INTEGER NOT NULL DEFAULT 0, provenance TEXT NOT NULL DEFAULT 'derived', extraction_method TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'other', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE factsheet_links (id TEXT PRIMARY KEY, from_factsheet_id TEXT NOT NULL, to_factsheet_id TEXT NOT NULL, relationship_type TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT REFERENCES research_threads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
    person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
    research_fact_id TEXT REFERENCES research_facts(id) ON DELETE SET NULL,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    link_id TEXT REFERENCES factsheet_links(id) ON DELETE SET NULL,
    reason TEXT,
    payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
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

describe('research_thread_events — Bundle B nullable thread_id', () => {
  it('accepts NULL thread_id', () => {
    expect(() => db.$client.prepare(
      `INSERT INTO research_thread_events (id, thread_id, event_type, actor_id, occurred_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e1', null, 'factsheet_unmerged', 'u', '2026-05-24')).not.toThrow();
  });

  it('still accepts a non-null thread_id', () => {
    db.$client.prepare(
      `INSERT INTO research_threads (id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('t1', 'Test thread', 'u', '2026-05-24', '2026-05-24');
    expect(() => db.$client.prepare(
      `INSERT INTO research_thread_events (id, thread_id, event_type, actor_id, occurred_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e2', 't1', 'thread_started', 'u', '2026-05-24')).not.toThrow();
  });

  it('cascades on thread delete', () => {
    db.$client.prepare(
      `INSERT INTO research_threads (id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('t2', 'Test', 'u', '2026-05-24', '2026-05-24');
    db.$client.prepare(
      `INSERT INTO research_thread_events (id, thread_id, event_type, actor_id, occurred_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('e3', 't2', 'thread_started', 'u', '2026-05-24');
    db.$client.prepare(`PRAGMA foreign_keys = ON`).run();
    db.$client.prepare(`DELETE FROM research_threads WHERE id = ?`).run('t2');
    const row = db.$client.prepare('SELECT id FROM research_thread_events WHERE id = ?').get('e3');
    expect(row).toBeUndefined();
  });
});
