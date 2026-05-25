import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => { throw err; },
}));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/inbox/count/route';
import { withAuth } from '@/lib/auth/api-guard';

// ---------------------------------------------------------------------------
// Minimal DDL — same 4-source seed pattern as list.test.ts.
// ---------------------------------------------------------------------------

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
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](DDL);

  const c = sqlite as unknown as {
    prepare: (s: string) => { run: (...args: unknown[]) => unknown };
  };

  // persons + names
  c.prepare(
    `INSERT INTO persons (id, created_by, created_at, updated_at)
     VALUES ('p1', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z'),
            ('p2', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z')`,
  ).run();
  c.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
     VALUES ('pn1', 'p1', 'John', 'Doe',   1, '2026-05-24T10:00:00Z'),
            ('pn2', 'p2', 'Jane', 'Smith', 1, '2026-05-24T10:00:00Z')`,
  ).run();

  // thread t1
  c.prepare(
    `INSERT INTO research_threads (id, title, created_by, created_at, updated_at)
     VALUES ('t1', 'Find John', 'u1', '2026-05-24T10:00:00Z', '2026-05-24T10:00:00Z')`,
  ).run();

  // factsheet drafts (type=factsheet_draft source)
  c.prepare(
    `INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, created_by, created_at, updated_at)
     VALUES ('fs-d1', 'Draft 1', 'person', 'draft', 't1', 'u1', '2026-05-24T10:00:01Z', '2026-05-24T10:00:10Z'),
            ('fs-d2', 'Draft 2', 'person', 'draft', NULL, 'u1', '2026-05-24T10:00:02Z', '2026-05-24T10:00:11Z'),
            ('fs-r1', 'Ready 1', 'person', 'ready', NULL, 'u1', '2026-05-24T10:00:03Z', '2026-05-24T10:00:12Z')`,
  ).run();

  // AI proposal (type=ai_proposal source)
  c.prepare(
    `INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, created_by, created_at, updated_at)
     VALUES ('fs-ai1', 'AI proposal: John + parent', 'family_unit', 'draft', 't1', 'u1', '2026-05-24T10:00:04Z', '2026-05-24T10:00:13Z')`,
  ).run();
  c.prepare(
    `INSERT INTO research_facts (id, person_id, fact_type, fact_value, factsheet_id, accepted, confidence, created_at, updated_at)
     VALUES ('rf-ai1', 'p1', 'parent_name', 'p2', 'fs-ai1', NULL, 'medium', '2026-05-24T10:00:05Z', '2026-05-24T10:00:14Z')`,
  ).run();

  // Conflicts (type=conflict source) — one accepted + two unresolved birth_date facts for p1
  c.prepare(
    `INSERT INTO research_facts (id, person_id, fact_type, fact_value, accepted, confidence, created_at, updated_at)
     VALUES ('rf-bd-acc', 'p1', 'birth_date', '1820', 1,    'high',   '2026-05-24T10:00:06Z', '2026-05-24T10:00:15Z'),
            ('rf-bd-u1',  'p1', 'birth_date', '1822', NULL, 'medium', '2026-05-24T10:00:07Z', '2026-05-24T10:00:16Z'),
            ('rf-bd-u2',  'p1', 'birth_date', '1819', NULL, 'low',    '2026-05-24T10:00:08Z', '2026-05-24T10:00:17Z')`,
  ).run();

  // Hints (type=hint source) — 2 pending, 1 accepted (filtered out)
  c.prepare(
    `INSERT INTO match_candidates (id, person_id, source_system, external_id, external_data, match_score, match_status, created_at)
     VALUES ('mc1', 'p1', 'findmypast',   'fm-123', '{"name":"John Doe (1820-1890)"}', 0.92, 'pending',  '2026-05-24T10:00:20Z'),
            ('mc2', 'p1', 'familysearch', 'fs-456', '{"label":"John Doe Sr."}',         0.78, 'pending',  '2026-05-24T10:00:21Z'),
            ('mc3', 'p1', 'ancestry',     'an-789', '{"name":"John Doe Jr."}',           0.65, 'accepted', '2026-05-24T10:00:22Z')`,
  ).run();

  return drizzle(sqlite, { schema });
}

type TestDb = ReturnType<typeof createTestDb>;

let testDb: TestDb;

function authSuccess(db: TestDb) {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb: db as unknown as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>,
    ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
}

function makeRequest(params?: string) {
  return new Request(`http://localhost/api/inbox/count${params ? `?${params}` : ''}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  testDb = createTestDb();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/inbox/count', () => {
  it('returns counts only with all 4 byType keys', async () => {
    authSuccess(testDb);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { counts: { total: number; byType: Record<string, number> }; items?: unknown };

    // items field must be absent — count endpoint returns { counts } only
    expect(body.items).toBeUndefined();

    // counts shape: all 4 keys present
    expect(Object.keys(body.counts.byType).sort()).toEqual(
      ['ai_proposal', 'conflict', 'factsheet_draft', 'hint'],
    );

    // total equals sum of byType
    const sum = Object.values(body.counts.byType).reduce((a, b) => a + b, 0);
    expect(sum).toBe(body.counts.total);

    // All four types have at least some items in our seed
    expect(body.counts.byType.factsheet_draft).toBeGreaterThanOrEqual(1);
    expect(body.counts.byType.ai_proposal).toBeGreaterThanOrEqual(1);
    expect(body.counts.byType.conflict).toBeGreaterThanOrEqual(1);
    expect(body.counts.byType.hint).toBeGreaterThanOrEqual(1);
  });
});
