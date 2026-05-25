/**
 * Bundle D integration test: cluster-promote -> state inspection -> cluster-unmerge
 * -> state inspection (round-trip).
 *
 * Exercises the full HTTP path for:
 *   POST /api/research/factsheets/{id}/promote    (body.cluster=true)
 *   POST /api/research/factsheets/{id}/unmerge-cluster
 *
 * Uses a real in-memory SQLite DB with PRAGMA foreign_keys = ON.
 * Three factsheets are linked via factsheet_links (f1 spouse f2,
 * f1 parent_child f3).
 */

// ---------------------------------------------------------------------------
// Mock layers BEFORE importing modules under test.
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
import { POST as unmergeClusterPOST } from '@/app/api/research/factsheets/[id]/unmerge-cluster/route';

// ---------------------------------------------------------------------------
// Full family-schema DDL with FK constraints + PRAGMA foreign_keys = ON.
// families.children rows reference persons via ON DELETE CASCADE so unmerge
// can delete persons cleanly even with FK enforcement on.
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
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
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
    family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
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
    from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
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
  sqlite.pragma('foreign_keys = ON');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

function seedThreeFactsheets(client: RawClient) {
  const ts = new Date().toISOString();
  for (const id of ['f1', 'f2', 'f3']) {
    client.prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'ready', 'u1', ?, ?)`,
    ).run(id, `Sheet ${id}`, ts, ts);

    client.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
       VALUES (?, 'name', ?, ?, 1, ?, ?)`,
    ).run(`rf-${id}`, `Person ${id}`, id, ts, ts);
  }

  // f1 spouse f2, f1 parent_child f3 (f1=parent, f3=child).
  client.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-spouse', 'f1', 'f2', 'spouse', ?)`,
  ).run(ts);
  client.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-parent', 'f1', 'f3', 'parent_child', ?)`,
  ).run(ts);
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

function makeUnmergeClusterRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/unmerge-cluster`,
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

describe('Integration: cluster-promote -> unmerge-cluster round-trip (Bundle D)', () => {
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

  it('cluster-promote promotes all 3 members then unmerge-cluster reverts everything', async () => {
    const client = sqlite as unknown as RawClient;
    seedThreeFactsheets(client);

    // Step 1: cluster-promote via POST /promote with body.cluster=true
    const promoteRes = await promotePOST(
      makePromoteRequest('f1', { cluster: true, reason: 'cluster promote' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(promoteRes.status).toBe(200);

    // Step 2: verify all 3 factsheets promoted, same cluster_promotion_id, distinct person IDs
    const fsRows = client.prepare(
      `SELECT id, status, cluster_promotion_id, promoted_person_id
       FROM factsheets
       WHERE id IN ('f1', 'f2', 'f3')
       ORDER BY id`,
    ).all() as Array<{
      id: string;
      status: string;
      cluster_promotion_id: string | null;
      promoted_person_id: string | null;
    }>;

    expect(fsRows).toHaveLength(3);
    for (const row of fsRows) {
      expect(row.status).toBe('promoted');
      expect(row.cluster_promotion_id).not.toBeNull();
      expect(row.promoted_person_id).not.toBeNull();
    }

    const clusterIds = fsRows.map(r => r.cluster_promotion_id);
    expect(clusterIds[0]).toBe(clusterIds[1]);
    expect(clusterIds[1]).toBe(clusterIds[2]);
    expect(clusterIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const personIds = fsRows.map(r => r.promoted_person_id!);
    expect(new Set(personIds).size).toBe(3);

    // families + children edges exist
    const famCount = (client.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number }).n;
    const childCount = (client.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number }).n;
    expect(famCount).toBeGreaterThanOrEqual(1);
    expect(childCount).toBeGreaterThanOrEqual(1);

    // Step 3: cluster-unmerge with reason
    const clusterPromotionId = clusterIds[0]!;

    const unmergeRes = await unmergeClusterPOST(
      makeUnmergeClusterRequest('f1', { reason: 'round-trip' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(unmergeRes.status).toBe(200);
    const unmergeBody = await unmergeRes.json();
    expect(unmergeBody.memberCount).toBe(3);
    expect(unmergeBody.clusterUnmergeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    const clusterUnmergeId: string = unmergeBody.clusterUnmergeId;

    // Step 4: verify full revert
    const personCount = (client.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number }).n;
    expect(Number(personCount)).toBe(0);

    const famCountAfter = (client.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number }).n;
    expect(Number(famCountAfter)).toBe(0);

    const childCountAfter = (client.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number }).n;
    expect(Number(childCountAfter)).toBe(0);

    const fsRowsAfter = client.prepare(
      `SELECT id, status, cluster_promotion_id, promoted_person_id
       FROM factsheets WHERE id IN ('f1', 'f2', 'f3') ORDER BY id`,
    ).all() as Array<{
      id: string;
      status: string;
      cluster_promotion_id: string | null;
      promoted_person_id: string | null;
    }>;

    for (const row of fsRowsAfter) {
      expect(['ready', 'draft']).toContain(row.status);
      expect(row.cluster_promotion_id).toBeNull();
      expect(row.promoted_person_id).toBeNull();
    }

    // Step 5: 3 audit events of type factsheet_unmerged, sharing clusterUnmergeId
    const auditRows = client.prepare(
      `SELECT factsheet_id, payload_json FROM research_thread_events
       WHERE event_type = 'factsheet_unmerged'
       ORDER BY factsheet_id`,
    ).all() as Array<{ factsheet_id: string; payload_json: string }>;

    expect(auditRows).toHaveLength(3);
    const auditFsIds = auditRows.map(r => r.factsheet_id).sort();
    expect(auditFsIds).toEqual(['f1', 'f2', 'f3']);

    for (const row of auditRows) {
      const payload = JSON.parse(row.payload_json);
      expect(payload.clusterUnmergeId).toBe(clusterUnmergeId);
      expect(payload.clusterPromotionId).toBe(clusterPromotionId);
    }
  });
});
