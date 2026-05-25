/**
 * Bundle C integration test: clean second-promote PATCH round-trip.
 *
 * Exercises promote (first) -> refine fact -> re-promote (second) using a
 * real in-memory SQLite DB. Verifies that:
 *   - second promote returns 200 + mode='patched' + same personId
 *   - the birth event ID is preserved (PATCH, not create)
 *   - the updated place_text is 'Moscow' (new refined fact applied)
 *   - audit trail contains both factsheet_promoted and factsheet_patched events
 */

// ---------------------------------------------------------------------------
// Mock layers BEFORE importing the module under test.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => { throw err; },
}));

// Return a real thread ID so promoteSingleFactsheet writes factsheet_promoted
// to research_thread_events (it only writes when threadId is non-null).
vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => 'thread-1'),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { withAuth } from '@/lib/auth/api-guard';
import { POST as promotePOST } from '@/app/api/research/factsheets/[id]/promote/route';

// ---------------------------------------------------------------------------
// Full family-schema DDL matching unmerge-round-trip.test.ts.
// events includes source_factsheet_id (Bundle C column).
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

type RawClient = {
  prepare: (query: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // FK OFF so we do not need every FK chain populated in every test
  sqlite.pragma('foreign_keys = OFF');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

function makeRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/promote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: clean second-promote PATCH round-trip (Bundle C)', () => {
  let sqlite: Database.Database;
  let db: any;

  beforeEach(() => {
    const created = createTestDb();
    sqlite = created.sqlite;
    db = created.db;
    vi.clearAllMocks();

    vi.mocked(withAuth).mockResolvedValue({
      familyDb: db,
      ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
      centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
    });
  });

  it('promote -> refine facts -> re-promote PATCHes existing person preserving event IDs', async () => {
    const client = sqlite as unknown as RawClient;
    const now = new Date().toISOString();

    // Seed the research thread that getActiveThreadIdFromCookies returns ('thread-1').
    // promoteSingleFactsheet calls addEvent which requires the thread to exist.
    client.prepare(
      `INSERT INTO research_threads (id, title, status, created_by, created_at, updated_at)
       VALUES ('thread-1', 'Ivan Petrov research', 'active', 'u1', ?, ?)`,
    ).run(now, now);

    // Step 1: seed a ready factsheet with birth_date + birth_place facts
    client.prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES ('F1', 'Ivan Petrov', 'ready', 'u1', ?, ?)`,
    ).run(now, now);

    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf-date', 'birth_date', '1887', 'F1', 1, ?, ?)`,
    ).run(now, now);

    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf-place1', 'birth_place', 'St. Petersburg', 'F1', 1, ?, ?)`,
    ).run(now, now);

    // Step 2: first promote
    const res1 = await promotePOST(
      makeRequest('F1', { reason: 'first promote' }),
      { params: Promise.resolve({ id: 'F1' }) },
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.mode).toBe('first');
    const personId: string = body1.personId;
    expect(personId).toBeTruthy();

    // Step 3: capture original birth event ID
    const originalEvent = client.prepare(
      `SELECT id, place_text FROM events WHERE person_id = ? AND event_type = 'birth'`,
    ).get(personId) as { id: string; place_text: string };
    expect(originalEvent).toBeDefined();
    const originalEventId = originalEvent.id;
    expect(originalEvent.place_text).toBe('St. Petersburg');

    // Step 4: add a refined birth_place fact (Moscow instead of St. Petersburg).
    // Deactivate the previous birth_place fact so only the new one wins in diff.
    client.prepare(
      `UPDATE research_facts SET accepted = 0, updated_at = ? WHERE id = 'rf-place1'`,
    ).run(now);
    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf-place2', 'birth_place', 'Moscow', 'F1', 1, ?, ?)`,
    ).run(now, now);

    // Step 5: re-promote (should PATCH because factsheet.status = 'promoted')
    const res2 = await promotePOST(
      makeRequest('F1', { reason: 'patch with refined data' }),
      { params: Promise.resolve({ id: 'F1' }) },
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.mode).toBe('patched');
    expect(body2.personId).toBe(personId); // same person!

    // Step 6: verify event ID preserved and value updated
    const updatedEvent = client.prepare(
      `SELECT id, place_text FROM events WHERE person_id = ? AND event_type = 'birth'`,
    ).get(personId) as { id: string; place_text: string };
    expect(updatedEvent).toBeDefined();
    expect(updatedEvent.id).toBe(originalEventId); // ID preserved!
    expect(updatedEvent.place_text).toBe('Moscow'); // value updated

    // Step 7: verify audit trail contains both promoted and patched events.
    // factsheet_promoted is written by promoteSingleFactsheet via addEvent (threadId required).
    // factsheet_patched is written by logReverseEvent in the promote route.
    const auditRows = client.prepare(
      `SELECT event_type FROM research_thread_events WHERE factsheet_id = 'F1' ORDER BY occurred_at`,
    ).all() as Array<{ event_type: string }>;
    const auditTypes = auditRows.map((r) => r.event_type);
    expect(auditTypes).toContain('factsheet_promoted');
    expect(auditTypes).toContain('factsheet_patched');
  });
});