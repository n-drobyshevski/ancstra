import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle B — Research Flow Inbox + Reversibility (2026-05-24).
 *
 * Validates that the runtime `research_thread_events` table accepts the six
 * new STR-3 reverse-transition event_type values. There is no DB-level CHECK
 * on event_type (TS enum is the source of truth — see vocab-consistency.test.ts
 * for the Bundle A pattern) — these inserts succeed at the DB layer regardless,
 * so the test merely guards that the bootstrap shape doesn't grow an
 * accidental CHECK and reject them.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §5.2
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
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

const BUNDLE_B_TYPES = [
  'factsheet_unmerged',
  'factsheet_restored',
  'fact_unaccepted',
  'fact_unrejected',
  'hint_reset',
  'gedcom_disputed',
];

describe('research_thread_events — Bundle B reverse-transition event types', () => {
  it.each(BUNDLE_B_TYPES)('accepts %s', (eventType) => {
    expect(() => db.$client.prepare(
      `INSERT INTO research_thread_events (id, event_type, actor_id, occurred_at) VALUES (?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), eventType, 'u', '2026-05-24')).not.toThrow();
  });
});
