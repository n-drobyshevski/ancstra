import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ensureFamilySchema } from '../index';

/**
 * Regression test for the "deep legacy factsheet_links" crash.
 *
 * Setup: a family DB that predates Bundle A AND predates the earlier additive
 * ALTERs that added source_handle / target_handle / contested. ensureFamilySchema's
 * Bundle A recreate block does INSERT...SELECT against the old table, including
 * those columns. Without pre-ALTERing them in, the SELECT throws
 *   "no such column: contested"
 * which aborts ensureFamilySchema and leaves the DB in a half-migrated state
 * — every downstream query that depends on a Bundle-A-or-later column
 * (e.g. the dashboard quality-score query) eventually trips on the gap.
 *
 * The fix in `ensureFamilySchemaInner` pre-ALTERs the missing columns before
 * the rebuild block runs. This test pins that ordering.
 */
function createDeepLegacyFamilyFixture() {
  const sqlite = new Database(':memory:');

  // Pre-Bundle-A factsheets shape (no created_thread_id yet — the ALTER inside
  // ensureFamilySchema adds it).
  sqlite.prepare(`CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  // Deep-legacy factsheet_links: NO contested, NO source_handle, NO target_handle.
  // Matches the shape observed on dev DBs created before the Phase-1-research migrations.
  sqlite.prepare(`CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL
  )`).run();

  // Other tables ensureFamilySchema references (kept minimal — schema repair
  // doesn't care about row contents, just that the tables exist).
  sqlite.prepare(`CREATE TABLE persons (id TEXT PRIMARY KEY, deleted_at TEXT, created_at TEXT, sex TEXT, is_living INTEGER)`).run();
  sqlite.prepare(`CREATE TABLE families (id TEXT PRIMARY KEY, deleted_at TEXT)`).run();
  sqlite.prepare(`CREATE TABLE events (id TEXT PRIMARY KEY, person_id TEXT, event_type TEXT)`).run();
  sqlite.prepare(`CREATE TABLE person_names (id TEXT PRIMARY KEY, given_name TEXT, surname TEXT)`).run();
  sqlite.prepare(`CREATE TABLE research_items (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'collected')`).run();
  sqlite.prepare(`CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    research_item_id TEXT,
    source_citation_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium'
  )`).run();
  sqlite.prepare(`CREATE TABLE sources (id TEXT PRIMARY KEY)`).run();
  sqlite.prepare(`CREATE TABLE _ancstra_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
  sqlite.prepare(`INSERT INTO _ancstra_meta (key, value) VALUES ('person_summary_facets_version', '1')`).run();

  // Seed one row so the recreate's INSERT...SELECT has something to copy —
  // verifies the data path, not just the DDL path.
  sqlite.prepare(`INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES ('fs-a', 'A', 'u', '2026-05-24', '2026-05-24')`).run();
  sqlite.prepare(`INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES ('fs-b', 'B', 'u', '2026-05-24', '2026-05-24')`).run();
  sqlite.prepare(`INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, confidence, created_at) VALUES ('l1', 'fs-a', 'fs-b', 'spouse', 'medium', '2026-05-24')`).run();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: drizzle(sqlite) as any, sqlite };
}

describe('ensureFamilySchema — deep-legacy factsheet_links repair', () => {
  it('succeeds on a DB whose factsheet_links predates source_handle / target_handle / contested', async () => {
    const { db } = createDeepLegacyFamilyFixture();
    await expect(ensureFamilySchema(db)).resolves.toBeUndefined();
  });

  it('upgrades factsheet_links to the Bundle A shape and preserves existing rows', async () => {
    const { db, sqlite } = createDeepLegacyFamilyFixture();
    await ensureFamilySchema(db);

    const tableSql = sqlite
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='factsheet_links'`)
      .get() as { sql: string };
    expect(tableSql.sql.includes("'partner'")).toBe(true);
    expect(tableSql.sql.includes('contested')).toBe(true);
    expect(tableSql.sql.includes('source_handle')).toBe(true);
    expect(tableSql.sql.includes('target_handle')).toBe(true);

    const rows = sqlite
      .prepare(`SELECT id, relationship_type, contested FROM factsheet_links`)
      .all() as Array<{ id: string; relationship_type: string; contested: number }>;
    expect(rows).toEqual([{ id: 'l1', relationship_type: 'spouse', contested: 0 }]);
  });
});
