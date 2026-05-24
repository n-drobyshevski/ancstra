/**
 * Bundle B 2026-05-24 — shared bootstrap DDL for research_thread_events tests.
 * Covers the FK targets needed for the nullable thread_id and 6 new event types.
 *
 * Consumed by:
 *   - research-thread-events-nullable-thread.test.ts
 *   - research-thread-events-bundle-b-event-types.test.ts
 *   - (future Bundle B tests: T4, T5, T22, …)
 */
export const RESEARCH_THREAD_EVENTS_BOOTSTRAP_SQL = `
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
