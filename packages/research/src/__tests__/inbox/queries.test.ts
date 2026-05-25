import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { listInboxItems, countInboxItems } from '../../inbox/queries';

/**
 * Bundle B 2026-05-24 — Inbox aggregation tests.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §2
 *
 * Fixture is minimal: only the columns the inbox SQL touches plus their FKs.
 * The full family-schema is in packages/db/src/family-schema.ts.
 */
const DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    name_type TEXT NOT NULL DEFAULT 'birth',
    given_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
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
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    factsheet_id TEXT,
    source_citation_id TEXT,
    research_item_id TEXT,
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
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE match_candidates (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    source_system TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_data TEXT NOT NULL,
    match_score REAL NOT NULL,
    match_status TEXT NOT NULL DEFAULT 'pending',
    reviewed_at TEXT,
    created_at TEXT NOT NULL
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
`;

let db: TestCentralDb;

interface ClientForQuery {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
}

function client(): ClientForQuery {
  return db.$client as unknown as ClientForQuery;
}

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
  seed();
});

/**
 * Seed timestamps are spread across 2026-05-24T10:00:00Z to T10:00:30Z
 * so the merged-by-updatedAt ordering is deterministic.
 */
function seed() {
  const c = client();

  // ---- persons + names ----
  c.prepare(
    `INSERT INTO persons (id, created_by, created_at, updated_at)
     VALUES ('p1', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z'),
            ('p2', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z')`,
  ).run();
  c.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
     VALUES ('pn1', 'p1', 'John', 'Doe', 1, '2026-05-24T10:00:00Z'),
            ('pn2', 'p2', 'Jane', 'Smith', 1, '2026-05-24T10:00:00Z')`,
  ).run();

  // ---- thread t1 ----
  c.prepare(
    `INSERT INTO research_threads (id, title, created_by, created_at, updated_at)
     VALUES ('t1', 'Find John', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z')`,
  ).run();

  // ---- factsheet drafts: fs-d1 (draft, person, thread=t1), fs-d2 (draft, person, no thread), fs-r1 (ready, person) ----
  c.prepare(
    `INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, created_by, created_at, updated_at)
     VALUES ('fs-d1', 'Draft 1', 'person', 'draft', 't1', 'u1', '2026-05-24T10:00:01Z', '2026-05-24T10:00:10Z'),
            ('fs-d2', 'Draft 2', 'person', 'draft', NULL, 'u1', '2026-05-24T10:00:02Z', '2026-05-24T10:00:11Z'),
            ('fs-r1', 'Ready 1', 'person', 'ready', NULL, 'u1', '2026-05-24T10:00:03Z', '2026-05-24T10:00:12Z')`,
  ).run();

  // ---- AI proposal: fs-ai1 (draft, family_unit) + a research_fact for p1 ----
  c.prepare(
    `INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, created_by, created_at, updated_at)
     VALUES ('fs-ai1', 'AI proposal: John + parent', 'family_unit', 'draft', 't1', 'u1', '2026-05-24T10:00:04Z', '2026-05-24T10:00:13Z')`,
  ).run();
  c.prepare(
    `INSERT INTO research_facts (id, person_id, fact_type, fact_value, factsheet_id, accepted, confidence, created_at, updated_at)
     VALUES ('rf-ai1', 'p1', 'parent_name', 'p2', 'fs-ai1', NULL, 'medium', '2026-05-24T10:00:05Z', '2026-05-24T10:00:14Z')`,
  ).run();

  // ---- Conflicts: p1 birth_date — one accepted (1820), two unresolved (1822 and 1819) ----
  c.prepare(
    `INSERT INTO research_facts (id, person_id, fact_type, fact_value, accepted, confidence, created_at, updated_at)
     VALUES ('rf-bd-acc',  'p1', 'birth_date', '1820', 1,    'high',   '2026-05-24T10:00:06Z', '2026-05-24T10:00:15Z'),
            ('rf-bd-u1',   'p1', 'birth_date', '1822', NULL, 'medium', '2026-05-24T10:00:07Z', '2026-05-24T10:00:16Z'),
            ('rf-bd-u2',   'p1', 'birth_date', '1819', NULL, 'low',    '2026-05-24T10:00:08Z', '2026-05-24T10:00:17Z')`,
  ).run();

  // ---- match_candidates: 2 pending for p1, 1 accepted (filtered out) ----
  c.prepare(
    `INSERT INTO match_candidates (id, person_id, source_system, external_id, external_data, match_score, match_status, created_at)
     VALUES ('mc1', 'p1', 'findmypast',     'fm-123', '{"name":"John Doe (1820–1890)"}',          0.92, 'pending',  '2026-05-24T10:00:20Z'),
            ('mc2', 'p1', 'familysearch',   'fs-456', '{"label":"John Doe Sr."}',                  0.78, 'pending',  '2026-05-24T10:00:21Z'),
            ('mc3', 'p1', 'ancestry',       'an-789', '{"name":"John Doe Jr."}',                   0.65, 'accepted', '2026-05-24T10:00:22Z')`,
  ).run();
}

describe('inbox queries (Bundle B §2)', () => {
  it('returns all four types when no filter is provided', async () => {
    const items = await listInboxItems(db as never);
    const types = new Set(items.map(i => i.type));
    expect(types).toEqual(new Set(['factsheet_draft', 'ai_proposal', 'conflict', 'hint']));
  });

  it('orders by updatedAt DESC', async () => {
    const items = await listInboxItems(db as never);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].updatedAt >= items[i].updatedAt).toBe(true);
    }
  });

  it('filters by type (single value)', async () => {
    const items = await listInboxItems(db as never, { type: 'hint' });
    expect(items.every(i => i.type === 'hint')).toBe(true);
    expect(items.length).toBe(2);
  });

  it('filters by type (array)', async () => {
    const items = await listInboxItems(db as never, { type: ['hint', 'conflict'] });
    const types = new Set(items.map(i => i.type));
    expect(types.size).toBeGreaterThan(0);
    for (const t of types) expect(['hint', 'conflict']).toContain(t);
  });

  it('filters by threadId', async () => {
    const items = await listInboxItems(db as never, { threadId: 't1' });
    expect(items.every(i => i.threadId === 't1')).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('filters by threadId="untriaged" (null)', async () => {
    const items = await listInboxItems(db as never, { threadId: 'untriaged' });
    expect(items.every(i => i.threadId === null)).toBe(true);
  });

  it('filters by personId', async () => {
    const items = await listInboxItems(db as never, { personId: 'p1' });
    expect(items.every(i => i.personId === 'p1')).toBe(true);
  });

  it('respects limit + offset', async () => {
    const page1 = await listInboxItems(db as never, { limit: 2, offset: 0 });
    const page2 = await listInboxItems(db as never, { limit: 2, offset: 2 });
    expect(page1).toHaveLength(2);
    if (page1[0] && page2[0]) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  it('countInboxItems returns total + byType', async () => {
    const counts = await countInboxItems(db as never);
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.byType.factsheet_draft).toBeGreaterThanOrEqual(2);
    expect(counts.byType.ai_proposal).toBeGreaterThanOrEqual(1);
    expect(counts.byType.conflict).toBeGreaterThanOrEqual(1);
    expect(counts.byType.hint).toBeGreaterThanOrEqual(2);
    const sum = Object.values(counts.byType).reduce((a, b) => a + b, 0);
    expect(sum).toBe(counts.total);
  });

  it('countInboxItems always returns all four keys (even when zero)', async () => {
    client().prepare(`UPDATE factsheets SET status = 'promoted' WHERE entity_type = 'person'`).run();
    const counts = await countInboxItems(db as never);
    expect(Object.keys(counts.byType).sort()).toEqual(['ai_proposal', 'conflict', 'factsheet_draft', 'hint']);
    expect(counts.byType.factsheet_draft).toBe(0);
  });

  it('factsheet_draft items have clusterUnmergeId=null when no cluster-unmerge event', async () => {
    const items = await listInboxItems(db as never, { type: 'factsheet_draft' });
    for (const item of items) {
      if (item.type === 'factsheet_draft') {
        expect(item.clusterUnmergeId).toBeNull();
      }
    }
  });

  it('factsheet_draft item has clusterUnmergeId set when a factsheet_unmerged event with clusterUnmergeId exists', async () => {
    const cuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    client().prepare(
      `INSERT INTO research_thread_events (id, event_type, actor_id, factsheet_id, reason, payload_json, occurred_at)
       VALUES ('rte-1', 'factsheet_unmerged', 'u1', 'fs-r1', 'unmerge test',
               '${JSON.stringify({ clusterUnmergeId: cuid, clusterPromotionId: 'cp-1', clusterSize: 2 })}',
               '2026-05-24T11:00:00Z')`,
    ).run();

    const items = await listInboxItems(db as never, { type: 'factsheet_draft' });
    const r1 = items.find(i => i.entityId === 'fs-r1');
    expect(r1?.type).toBe('factsheet_draft');
    if (r1?.type === 'factsheet_draft') {
      expect(r1.clusterUnmergeId).toBe(cuid);
    }

    // Other factsheets without the event should still have null
    const d1 = items.find(i => i.entityId === 'fs-d1');
    if (d1?.type === 'factsheet_draft') {
      expect(d1.clusterUnmergeId).toBeNull();
    }
  });
});
