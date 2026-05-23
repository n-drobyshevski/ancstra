import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { ensureFamilySchema } from '../index';

// ensureFamilySchema is supposed to repair older dev family DBs that predate
// migration 0009 (which introduced research_threads + research_thread_events).
// These tests pin that runtime-repair behavior so the "Start research thread"
// flow doesn't 500 on existing local DBs.
function createMinimalFamilyFixture() {
  const sqlite = new Database(':memory:');
  // ensureFamilySchema's CREATE INDEX / FTS-trigger statements reference these tables.
  sqlite.prepare(`CREATE TABLE persons (id TEXT PRIMARY KEY, deleted_at TEXT, created_at TEXT, sex TEXT, is_living INTEGER)`).run();
  sqlite.prepare(`CREATE TABLE families (id TEXT PRIMARY KEY, deleted_at TEXT)`).run();
  sqlite.prepare(`CREATE TABLE events (id TEXT PRIMARY KEY, person_id TEXT, event_type TEXT)`).run();
  sqlite.prepare(`CREATE TABLE person_names (id TEXT PRIMARY KEY, given_name TEXT, surname TEXT)`).run();
  // FK targets referenced by research_threads / research_thread_events. better-sqlite3
  // enables PRAGMA foreign_keys by default, so these must exist (even though the
  // smoke-test insert leaves the FK columns NULL).
  sqlite.prepare(`CREATE TABLE research_items (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'collected')`).run();
  // research_facts seeded with the columns ensureFamilySchema's Bundle A
  // backfill UPDATEs reference (confidence/contested/provenance + the FK
  // columns the CASE expression branches on). Columns added by ALTER inside
  // ensureFamilySchema (factsheet_id, accepted, contested, provenance) are
  // intentionally omitted here so we exercise the ALTER path — contested +
  // provenance are added before the UPDATE so this is safe.
  sqlite.prepare(`CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    research_item_id TEXT,
    source_citation_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium'
  )`).run();
  sqlite.prepare(`CREATE TABLE sources (id TEXT PRIMARY KEY)`).run();
  // Pre-seed meta so ensureFamilySchema skips rebuildAllSummaries (which needs full schema).
  sqlite.prepare(`CREATE TABLE _ancstra_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  sqlite.prepare(`INSERT INTO _ancstra_meta (key, value) VALUES ('person_summary_facets_version', '1')`).run();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Drizzle handle for repair tests
  return drizzle(sqlite) as any;
}

function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return row !== undefined;
}

describe('ensureFamilySchema — research threads back-fill', () => {
  it('creates research_threads + research_thread_events on a DB that predates migration 0009', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw better-sqlite3 handle for assertions
    const db = createMinimalFamilyFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- access underlying better-sqlite3 client
    const sqlite = (db as any).session.client as Database.Database;
    expect(tableExists(sqlite, 'research_threads')).toBe(false);
    expect(tableExists(sqlite, 'research_thread_events')).toBe(false);

    await ensureFamilySchema(db);

    expect(tableExists(sqlite, 'research_threads')).toBe(true);
    expect(tableExists(sqlite, 'research_thread_events')).toBe(true);
  });

  it('research_threads accepts inserts after ensureFamilySchema (smoke test for POST /api/research/threads)', async () => {
    const db = createMinimalFamilyFixture();
    await ensureFamilySchema(db);
    await db.run(sql`
      INSERT INTO research_threads (id, title, status, created_by, created_at, updated_at)
      VALUES ('t1', 'Test', 'active', 'u1', '2026-05-11', '2026-05-11')
    `);
    const rows = (await db.all(sql`SELECT id FROM research_threads`)) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual(['t1']);
  });
});
