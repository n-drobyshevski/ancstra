/**
 * Bundle B integration test: promote -> unmerge -> re-promote round-trip.
 *
 * Exercises multiple Bundle B pieces together across a single in-memory DB:
 * promoteSingleFactsheet (T6 writer) then unmergeFactsheet (T6), then promotes
 * again to verify a clean second creation.
 *
 * person_summary is bootstrapped because promoteSingleFactsheet calls
 * refreshSummary(db, personId) after COMMIT (promote.ts:250).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { promoteSingleFactsheet, unmergeFactsheet } from '@ancstra/research';

// ---------------------------------------------------------------------------
// Full family-schema DDL for promote + unmerge + refreshSummary.
// Column set mirrors packages/db/src/family-schema.ts + research-schema.ts.
// ---------------------------------------------------------------------------
const DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    name_type TEXT NOT NULL DEFAULT 'birth',
    prefix TEXT,
    given_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    suffix TEXT,
    nickname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE families (
    id TEXT PRIMARY KEY,
    partner1_id TEXT,
    partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    date_original TEXT,
    date_sort INTEGER,
    date_modifier TEXT DEFAULT 'exact',
    date_end_sort INTEGER,
    place_text TEXT,
    description TEXT,
    person_id TEXT,
    family_id TEXT,
    source_factsheet_id TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    publication_date TEXT,
    repository_name TEXT,
    repository_url TEXT,
    source_type TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    citation_detail TEXT,
    citation_text TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    person_id TEXT,
    event_id TEXT,
    family_id TEXT,
    person_name_id TEXT,
    created_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT,
    snippet TEXT,
    full_text TEXT,
    notes TEXT,
    archived_html_path TEXT,
    screenshot_path TEXT,
    archived_at TEXT,
    provider_id TEXT,
    provider_record_id TEXT,
    discovery_method TEXT NOT NULL,
    search_query TEXT,
    status TEXT NOT NULL DEFAULT 'collected',
    promoted_source_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    promoted_person_id TEXT,
    promoted_at TEXT,
    cluster_promotion_id TEXT,
    created_thread_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL,
    to_factsheet_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    source_handle TEXT,
    target_handle TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    research_item_id TEXT,
    source_citation_id TEXT,
    factsheet_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT,
    seed_factsheet_id TEXT,
    seed_research_item_id TEXT,
    summary TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT,
    person_id TEXT,
    research_item_id TEXT,
    research_fact_id TEXT,
    source_id TEXT,
    link_id TEXT,
    reason TEXT,
    payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
  CREATE TABLE person_summary (
    person_id TEXT PRIMARY KEY,
    given_name TEXT NOT NULL DEFAULT '',
    surname TEXT NOT NULL DEFAULT '',
    sex TEXT NOT NULL,
    is_living INTEGER NOT NULL,
    birth_date TEXT,
    death_date TEXT,
    birth_date_sort INTEGER,
    death_date_sort INTEGER,
    birth_place TEXT,
    death_place TEXT,
    spouse_count INTEGER NOT NULL DEFAULT 0,
    child_count INTEGER NOT NULL DEFAULT 0,
    parent_count INTEGER NOT NULL DEFAULT 0,
    has_name INTEGER NOT NULL DEFAULT 0,
    has_birth_event INTEGER NOT NULL DEFAULT 0,
    has_birth_place INTEGER NOT NULL DEFAULT 0,
    has_death_event INTEGER NOT NULL DEFAULT 0,
    has_source INTEGER NOT NULL DEFAULT 0,
    sources_count INTEGER NOT NULL DEFAULT 0,
    completeness INTEGER NOT NULL DEFAULT 0,
    validation TEXT NOT NULL DEFAULT 'confirmed',
    updated_at_sort TEXT,
    updated_at TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // FK OFF so we don't need every FK chain populated
  sqlite.pragma('foreign_keys = OFF');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

type RawClient = {
  prepare: (query: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('unmerge round-trip (Bundle B integration)', () => {
  let sqlite: Database.Database;
  let db: any;

  beforeEach(() => {
    const created = createTestDb();
    sqlite = created.sqlite;
    db = created.db;
  });

  it('promote -> unmerge -> re-promote yields a fresh person id', async () => {
    const now = new Date().toISOString();
    const client = sqlite as unknown as RawClient;

    // Seed factsheet with accepted facts (no conflicts, status='ready')
    client.prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES ('fs1', 'John Doe', 'ready', 'u', ?, ?)`,
    ).run(now, now);
    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf1', 'name', 'John Doe', 'fs1', 1, ?, ?)`,
    ).run(now, now);
    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf2', 'birth_date', '1820', 'fs1', 1, ?, ?)`,
    ).run(now, now);

    // --- STEP 1: PROMOTE ---
    const promote1 = await promoteSingleFactsheet(db, {
      factsheetId: 'fs1',
      mode: 'create',
      userId: 'u1',
    });
    expect(promote1.personId).toBeTruthy();
    expect(promote1.mode).toBe('created');

    const personAfterPromote = client.prepare(
      `SELECT id FROM persons WHERE id = ?`,
    ).get(promote1.personId);
    expect(personAfterPromote).toBeDefined();

    const fsAfterPromote = client.prepare(
      `SELECT status, promoted_person_id FROM factsheets WHERE id = 'fs1'`,
    ).get() as { status: string; promoted_person_id: string };
    expect(fsAfterPromote.status).toBe('promoted');
    expect(fsAfterPromote.promoted_person_id).toBe(promote1.personId);

    // --- STEP 2: UNMERGE ---
    const unmerge1 = await unmergeFactsheet(db, {
      factsheetId: 'fs1',
      reason: 'duplicate entry',
      actorId: 'u1',
    });
    expect(unmerge1.deleted.persons).toBe(1);

    const personAfterUnmerge = client.prepare(
      `SELECT id FROM persons WHERE id = ?`,
    ).get(promote1.personId);
    expect(personAfterUnmerge).toBeUndefined();

    const fsAfterUnmerge = client.prepare(
      `SELECT status, promoted_person_id, promoted_at FROM factsheets WHERE id = 'fs1'`,
    ).get() as { status: string; promoted_person_id: string | null; promoted_at: string | null };
    expect(fsAfterUnmerge.status).toBe('ready');
    expect(fsAfterUnmerge.promoted_person_id).toBeNull();
    expect(fsAfterUnmerge.promoted_at).toBeNull();

    // Audit event written
    const unmergeEvent = client.prepare(
      `SELECT event_type, reason, factsheet_id FROM research_thread_events
       WHERE event_type = 'factsheet_unmerged' AND factsheet_id = 'fs1'`,
    ).get() as { event_type: string; reason: string; factsheet_id: string };
    expect(unmergeEvent).toBeDefined();
    expect(unmergeEvent.reason).toBe('duplicate entry');
    expect(unmergeEvent.factsheet_id).toBe('fs1');

    // --- STEP 3: RE-PROMOTE ---
    // Factsheet is back to 'ready' so isFactsheetPromotable passes again.
    const promote2 = await promoteSingleFactsheet(db, {
      factsheetId: 'fs1',
      mode: 'create',
      userId: 'u1',
    });
    expect(promote2.personId).toBeTruthy();
    // Must be a different UUID — unmerge deleted the old person
    expect(promote2.personId).not.toBe(promote1.personId);

    const personAfterRePromote = client.prepare(
      `SELECT id FROM persons WHERE id = ?`,
    ).get(promote2.personId);
    expect(personAfterRePromote).toBeDefined();

    const fsAfterRePromote = client.prepare(
      `SELECT status, promoted_person_id FROM factsheets WHERE id = 'fs1'`,
    ).get() as { status: string; promoted_person_id: string };
    expect(fsAfterRePromote.status).toBe('promoted');
    expect(fsAfterRePromote.promoted_person_id).toBe(promote2.personId);

    // Exactly one unmerge audit event (not duplicated by re-promote)
    const totalUnmergeEvents = client.prepare(
      `SELECT COUNT(*) as n FROM research_thread_events
       WHERE event_type = 'factsheet_unmerged' AND factsheet_id = 'fs1'`,
    ).get() as { n: number };
    expect(totalUnmergeEvents.n).toBe(1);
  });

  it('unmerge reverts research_facts source_citation_id to null', async () => {
    const now = new Date().toISOString();
    const client = sqlite as unknown as RawClient;

    // Seed a fully-promoted state manually (matching what promote() would create)
    client.prepare(
      `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, created_by, created_at, updated_at)
       VALUES ('fs2', 'Jane Smith', 'promoted', 'p2', ?, 'u', ?, ?)`,
    ).run(now, now, now);
    client.prepare(
      `INSERT INTO persons (id, created_by, created_at, updated_at)
       VALUES ('p2', 'u', ?, ?)`,
    ).run(now, now);
    client.prepare(
      `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
       VALUES ('pn2', 'p2', 'Jane', 'Smith', 1, ?)`,
    ).run(now);
    client.prepare(
      `INSERT INTO sources (id, title, created_by, created_at, updated_at)
       VALUES ('src2', 'Census 1860', 'u', ?, ?)`,
    ).run(now, now);
    client.prepare(
      `INSERT INTO source_citations (id, source_id, person_id, created_at)
       VALUES ('sc2', 'src2', 'p2', ?)`,
    ).run(now);
    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, source_citation_id, accepted, created_at, updated_at)
       VALUES ('rf3', 'birth_date', '1842', 'fs2', 'sc2', 1, ?, ?)`,
    ).run(now, now);

    await unmergeFactsheet(db, { factsheetId: 'fs2', reason: 'wrong person', actorId: 'u1' });

    // Source citation was nulled out on the fact
    const fact = client.prepare(
      `SELECT source_citation_id FROM research_facts WHERE id = 'rf3'`,
    ).get() as { source_citation_id: string | null };
    expect(fact.source_citation_id).toBeNull();

    // Person row deleted
    expect(client.prepare(`SELECT id FROM persons WHERE id = 'p2'`).get()).toBeUndefined();
  });
});
