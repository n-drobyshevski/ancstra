/**
 * Bundle C integration test: dirty second-promote -> detach round-trip.
 *
 * Exercises promote (first) -> manual edit -> re-promote (409) -> detach using
 * a real in-memory SQLite DB. Verifies that:
 *   - re-promote on a dirty person returns 409 PersonDirty
 *   - detach clears promoted_person_id and sets factsheet.status='ready'
 *   - person still exists with the manual edit intact
 */

// ---------------------------------------------------------------------------
// Mock layers BEFORE importing the module under test.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => { throw err; },
}));

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
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
import { POST as detachPOST } from '@/app/api/research/factsheets/[id]/detach/route';

// ---------------------------------------------------------------------------
// Full family-schema DDL (same as promote-second-clean.test.ts).
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
  sqlite.pragma('foreign_keys = OFF');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

function makePromoteRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/promote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

function makeDetachRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/detach`,
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

describe('Integration: dirty second-promote -> detach round-trip (Bundle C)', () => {
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

  it('promote -> manual edit -> re-promote 409 -> detach preserves person + factsheet=ready', async () => {
    const client = sqlite as unknown as RawClient;
    const now = new Date().toISOString();

    // Step 1: seed a ready factsheet with a birth_date fact
    client.prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES ('F1', 'Ivan Petrov', 'ready', 'u1', ?, ?)`,
    ).run(now, now);

    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf-date', 'birth_date', '1887', 'F1', 1, ?, ?)`,
    ).run(now, now);

    // Step 2: first promote
    const res1 = await promotePOST(
      makePromoteRequest('F1', { reason: 'first promote' }),
      { params: Promise.resolve({ id: 'F1' }) },
    );
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.mode).toBe('first');
    const personId: string = body1.personId;
    expect(personId).toBeTruthy();

    // Step 3: capture what promoted_at was set to
    const fsRow = client.prepare(
      `SELECT promoted_at FROM factsheets WHERE id = 'F1'`,
    ).get() as { promoted_at: string };
    expect(fsRow.promoted_at).toBeTruthy();

    // Step 4: simulate a manual edit — update events.updated_at to 5 seconds in the future
    // relative to promoted_at so isPersonDirtySincePromote fires.
    const promotedAt = new Date(fsRow.promoted_at);
    const futureAt = new Date(promotedAt.getTime() + 5000).toISOString();
    client.prepare(
      `UPDATE events SET place_text = 'Manually edited', updated_at = ? WHERE person_id = ?`,
    ).run(futureAt, personId);

    // Step 5: add a refined birth_place fact
    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES ('rf-place', 'birth_place', 'Moscow', 'F1', 1, ?, ?)`,
    ).run(now, now);

    // Step 6: re-promote -> expect 409 PersonDirty
    const res2 = await promotePOST(
      makePromoteRequest('F1', { reason: 'try patch' }),
      { params: Promise.resolve({ id: 'F1' }) },
    );
    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.error).toBe('PersonDirty');
    expect(body2.personId).toBe(personId);

    // Step 7: detach (keep manual edits)
    const res3 = await detachPOST(
      makeDetachRequest('F1', { reason: 'keep my edits' }),
      { params: Promise.resolve({ id: 'F1' }) },
    );
    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.previousPersonId).toBe(personId);

    // Step 8: verify factsheet.status = 'ready' and promoted_person_id cleared
    const fsAfter = client.prepare(
      `SELECT status, promoted_person_id FROM factsheets WHERE id = 'F1'`,
    ).get() as { status: string; promoted_person_id: string | null };
    expect(fsAfter.status).toBe('ready');
    expect(fsAfter.promoted_person_id).toBeNull();

    // Step 9: verify person still exists with manual edit preserved
    const personCount = (client.prepare(
      `SELECT COUNT(*) AS n FROM persons WHERE id = ?`,
    ).get(personId) as { n: number }).n;
    expect(Number(personCount)).toBe(1);

    const ev = client.prepare(
      `SELECT place_text FROM events WHERE person_id = ?`,
    ).get(personId) as { place_text: string } | undefined;
    expect(ev).toBeDefined();
    expect(ev!.place_text).toBe('Manually edited');
  });
});