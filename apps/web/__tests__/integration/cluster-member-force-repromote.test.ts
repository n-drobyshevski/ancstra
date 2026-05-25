/**
 * Bundle D integration test: cluster-member force-repromote (surgical swap).
 *
 * Exercises the full HTTP path for:
 *   POST /api/research/factsheets/{id}/promote    (body.cluster=true  — cluster setup)
 *   POST /api/research/factsheets/{id}/promote    (second call on member — 409 dirty)
 *   POST /api/research/factsheets/{id}/repromote-force  (cluster-member surgical swap)
 *
 * Also covers the "clean cluster member patch returns mode=patched with
 * pendingEdgeChanges when factsheet_links drifted" sub-case.
 *
 * Uses a real in-memory SQLite DB with PRAGMA foreign_keys = ON.
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
import { POST as forcePOST } from '@/app/api/research/factsheets/[id]/repromote-force/route';

// ---------------------------------------------------------------------------
// Full family-schema DDL with FK constraints + PRAGMA foreign_keys = ON.
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

function makeForceRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/repromote-force`,
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

describe('Integration: cluster-member force-repromote surgical swap (Bundle D)', () => {
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

  it('dirty cluster member -> /promote 409 clusterMember=true -> /repromote-force swaps person', async () => {
    const client = sqlite as unknown as RawClient;
    seedThreeFactsheets(client);

    // Step 1: cluster-promote (body.cluster=true)
    const promoteRes = await promotePOST(
      makePromoteRequest('f1', { cluster: true, reason: 'initial cluster promote' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(promoteRes.status).toBe(200);

    // Step 2: capture before-state for all 3 members
    const fsBefore = client.prepare(
      `SELECT id, promoted_person_id, cluster_promotion_id
       FROM factsheets WHERE id IN ('f1', 'f2', 'f3') ORDER BY id`,
    ).all() as Array<{
      id: string;
      promoted_person_id: string;
      cluster_promotion_id: string;
    }>;

    expect(fsBefore).toHaveLength(3);
    const f1Before = fsBefore.find(r => r.id === 'f1')!;
    const f2Before = fsBefore.find(r => r.id === 'f2')!;
    const f3Before = fsBefore.find(r => r.id === 'f3')!;

    const oldF1PersonId = f1Before.promoted_person_id;
    const clusterPromotionId = f1Before.cluster_promotion_id;
    expect(oldF1PersonId).toBeTruthy();
    expect(clusterPromotionId).toBeTruthy();

    // family rows referencing f1's person exist
    const famsBefore = client.prepare(
      `SELECT id, partner1_id, partner2_id FROM families
       WHERE partner1_id = ? OR partner2_id = ?`,
    ).all(oldF1PersonId, oldF1PersonId) as Array<{
      id: string;
      partner1_id: string | null;
      partner2_id: string | null;
    }>;
    expect(famsBefore.length).toBeGreaterThanOrEqual(1);

    // Step 3: dirty f1's person — insert a manual event AFTER promote
    const fsRow = client.prepare(
      `SELECT promoted_at FROM factsheets WHERE id = 'f1'`,
    ).get() as { promoted_at: string };
    const promotedAt = new Date(fsRow.promoted_at);
    const futureAt = new Date(promotedAt.getTime() + 5000).toISOString();

    client.prepare(
      `INSERT INTO events (id, event_type, person_id, source_factsheet_id, created_at, updated_at)
       VALUES ('evt-manual', 'note', ?, 'f1', ?, ?)`,
    ).run(oldF1PersonId, futureAt, futureAt);

    // Step 4: POST /promote on f1 -> expect 409 PersonDirty with clusterMember=true
    const res409 = await promotePOST(
      makePromoteRequest('f1', { reason: 'try re-promote dirty' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(res409.status).toBe(409);
    const body409 = await res409.json();
    expect(body409.error).toBe('PersonDirty');
    expect(body409.clusterMember).toBe(true);
    const diffHash: string = body409.diffHash;
    expect(diffHash).toMatch(/^[0-9a-f]{64}$/);

    // Step 5: POST /repromote-force with reason + diffHash
    const forceRes = await forcePOST(
      makeForceRequest('f1', { reason: 'discard manual edits', diffHash }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(forceRes.status).toBe(200);
    const forceBody = await forceRes.json();
    expect(forceBody.clusterMember).toBe(true);
    const newF1PersonId: string = forceBody.personId;
    const previousPersonId: string = forceBody.previousPersonId;
    expect(newF1PersonId).toBeTruthy();
    expect(previousPersonId).toBe(oldF1PersonId);
    expect(newF1PersonId).not.toBe(oldF1PersonId);

    // Step 6: verify f1.promoted_person_id is a NEW UUID
    const f1After = client.prepare(
      `SELECT promoted_person_id, cluster_promotion_id FROM factsheets WHERE id = 'f1'`,
    ).get() as { promoted_person_id: string; cluster_promotion_id: string };
    expect(f1After.promoted_person_id).toBe(newF1PersonId);

    // Step 7: cluster_promotion_id UNCHANGED (cluster identity stable)
    expect(f1After.cluster_promotion_id).toBe(clusterPromotionId);

    // Step 8: f2 and f3 promoted_person_id UNCHANGED
    const f2After = client.prepare(
      `SELECT promoted_person_id FROM factsheets WHERE id = 'f2'`,
    ).get() as { promoted_person_id: string };
    const f3After = client.prepare(
      `SELECT promoted_person_id FROM factsheets WHERE id = 'f3'`,
    ).get() as { promoted_person_id: string };
    expect(f2After.promoted_person_id).toBe(f2Before.promoted_person_id);
    expect(f3After.promoted_person_id).toBe(f3Before.promoted_person_id);

    // Step 9: family rows now reference the NEW person, not the old one
    const famsAfterOld = client.prepare(
      `SELECT COUNT(*) AS n FROM families
       WHERE partner1_id = ? OR partner2_id = ?`,
    ).get(oldF1PersonId, oldF1PersonId) as { n: number };
    expect(Number(famsAfterOld.n)).toBe(0);

    const famsAfterNew = client.prepare(
      `SELECT COUNT(*) AS n FROM families
       WHERE partner1_id = ? OR partner2_id = ?`,
    ).get(newF1PersonId, newF1PersonId) as { n: number };
    expect(Number(famsAfterNew.n)).toBeGreaterThanOrEqual(1);

    // Step 10: old f1 person row is gone
    const oldPersonRow = client.prepare(
      `SELECT id FROM persons WHERE id = ?`,
    ).get(oldF1PersonId);
    expect(oldPersonRow).toBeUndefined();

    // Step 11: audit event factsheet_force_repromoted with clusterMember=true + previousPersonId
    const auditRow = client.prepare(
      `SELECT event_type, payload_json FROM research_thread_events
       WHERE event_type = 'factsheet_force_repromoted' AND factsheet_id = 'f1'`,
    ).get() as { event_type: string; payload_json: string } | undefined;

    expect(auditRow).toBeDefined();
    const auditPayload = JSON.parse(auditRow!.payload_json);
    expect(auditPayload.clusterMember).toBe(true);
    expect(auditPayload.previousPersonId).toBe(oldF1PersonId);
  });

  it('clean cluster member -> /promote returns mode=patched with pendingEdgeChanges when links drifted', async () => {
    const client = sqlite as unknown as RawClient;
    seedThreeFactsheets(client);

    // Step 1: cluster-promote (establishes families/children edges for lnk-spouse + lnk-parent)
    const promoteRes = await promotePOST(
      makePromoteRequest('f1', { cluster: true, reason: 'initial promote' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(promoteRes.status).toBe(200);

    // Verify the spouse family was created during promote.
    const famCount = (client.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number }).n;
    expect(famCount).toBeGreaterThanOrEqual(1);

    // Step 2: delete the spouse factsheet_link AFTER promote (simulating link drift).
    // Now factsheet_links has NO spouse edge but families still does -> removed drift.
    client.prepare(`DELETE FROM factsheet_links WHERE id = 'lnk-spouse'`).run();

    // Step 3: POST /promote on f1 (person is NOT dirty — no manual events added).
    // computePendingEdgeChanges will compare:
    //   factsheet_links side: only parent_child (spouse was deleted)
    //   families/children side: both spouse + parent_child still exist
    // => pendingEdgeChanges.removed should contain the now-missing spouse edge.
    const patchRes = await promotePOST(
      makePromoteRequest('f1', { reason: 'update after link drift' }),
      { params: Promise.resolve({ id: 'f1' }) },
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.mode).toBe('patched');
    expect(patchBody.clusterMember).toBe(true);

    // pendingEdgeChanges must be present and removed must contain the dropped spouse edge.
    expect(patchBody.pendingEdgeChanges).toBeDefined();
    expect(Array.isArray(patchBody.pendingEdgeChanges.removed)).toBe(true);
    expect(patchBody.pendingEdgeChanges.removed.length).toBeGreaterThanOrEqual(1);

    const removedEdge = (patchBody.pendingEdgeChanges.removed as Array<{
      fromFactsheetId: string;
      toFactsheetId: string;
      relationshipType: string;
    }>).find(e => e.relationshipType === 'spouse');
    expect(removedEdge).toBeDefined();
    // The removed spouse edge involves f1 and f2.
    const removedEndpoints = [removedEdge!.fromFactsheetId, removedEdge!.toFactsheetId];
    expect(removedEndpoints).toContain('f1');
    expect(removedEndpoints).toContain('f2');
  });
});
