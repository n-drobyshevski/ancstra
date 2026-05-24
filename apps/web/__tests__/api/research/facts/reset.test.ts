import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/research/factsheets/restore.test.ts.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => { throw err; },
}));

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/facts/[id]/reset/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — factsheets + research_facts + research_thread_events.
// thread_id is nullable per Bundle B T1.
// ---------------------------------------------------------------------------

const BOOTSTRAP_DDL = `
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    promoted_person_id TEXT,
    promoted_at TEXT,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2026-05-24T00:00:00.000Z';

// Fact IDs
const RF_ACCEPTED = 'rf-accepted';   // accepted=1, factsheet_id='fs-draft'
const RF_REJECTED = 'rf-rejected';   // accepted=0, factsheet_id='fs-draft'
const RF_PROMOTED = 'rf-promoted';   // accepted=1, factsheet_id='fs-promoted'
const RF_UNRESOLVED = 'rf-unresolved'; // accepted=NULL, factsheet_id='fs-draft'

// Factsheet IDs
const FS_DRAFT = 'fs-draft';
const FS_PROMOTED = 'fs-promoted';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed factsheets
  sqlite.prepare(
    `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(FS_DRAFT, 'Draft Factsheet', 'draft', 'u1', NOW, NOW);

  sqlite.prepare(
    `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(FS_PROMOTED, 'Promoted Factsheet', 'promoted', 'u1', NOW, NOW);

  // Seed research_facts
  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_ACCEPTED, 'birth_date', '1900-01-01', FS_DRAFT, 1, NOW, NOW);

  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_REJECTED, 'birth_place', 'London', FS_DRAFT, 0, NOW, NOW);

  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_PROMOTED, 'death_date', '1970-06-15', FS_PROMOTED, 1, NOW, NOW);

  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, accepted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_UNRESOLVED, 'occupation', 'Farmer', FS_DRAFT, null, NOW, NOW);

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

function makeRequest(factId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/facts/${factId}/reset`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

type SqliteClient = { prepare: (s: string) => { get: (...a: unknown[]) => unknown } };

function getClient(db: TestDb): SqliteClient {
  return db.$client as unknown as SqliteClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  testDb = createTestDb();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/facts/:id/reset', () => {
  // -------------------------------------------------------------------------
  // Happy path: accepted=true → null emits fact_unaccepted
  // -------------------------------------------------------------------------

  it('resets accepted=true → null and emits fact_unaccepted', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_ACCEPTED });
    const res = await POST(makeRequest(RF_ACCEPTED, { reason: 'Wrong fact accepted' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation: accepted should now be NULL
    const row = getClient(testDb)
      .prepare('SELECT accepted FROM research_facts WHERE id = ?')
      .get(RF_ACCEPTED) as { accepted: number | null } | undefined;
    expect(row?.accepted).toBeNull();

    // Verify audit row
    const audit = getClient(testDb)
      .prepare('SELECT event_type, reason, actor_id, research_fact_id FROM research_thread_events WHERE research_fact_id = ?')
      .get(RF_ACCEPTED) as { event_type: string; reason: string; actor_id: string; research_fact_id: string } | undefined;
    expect(audit?.event_type).toBe('fact_unaccepted');
    expect(audit?.reason).toBe('Wrong fact accepted');
    expect(audit?.actor_id).toBe('u1');
    expect(audit?.research_fact_id).toBe(RF_ACCEPTED);
  });

  // -------------------------------------------------------------------------
  // Happy path: accepted=false → null emits fact_unrejected
  // -------------------------------------------------------------------------

  it('resets accepted=false → null and emits fact_unrejected', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_REJECTED });
    const res = await POST(makeRequest(RF_REJECTED, { reason: 'Wrongly rejected' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation: accepted should now be NULL
    const row = getClient(testDb)
      .prepare('SELECT accepted FROM research_facts WHERE id = ?')
      .get(RF_REJECTED) as { accepted: number | null } | undefined;
    expect(row?.accepted).toBeNull();

    // Verify audit row
    const audit = getClient(testDb)
      .prepare('SELECT event_type, reason, research_fact_id FROM research_thread_events WHERE research_fact_id = ?')
      .get(RF_REJECTED) as { event_type: string; reason: string; research_fact_id: string } | undefined;
    expect(audit?.event_type).toBe('fact_unrejected');
    expect(audit?.reason).toBe('Wrongly rejected');
  });

  // -------------------------------------------------------------------------
  // Guard: parent factsheet is promoted
  // -------------------------------------------------------------------------

  it('refuses reset when parent factsheet is promoted', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_PROMOTED });
    const res = await POST(makeRequest(RF_PROMOTED, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('parent-factsheet-promoted');
    expect(body.message).toContain('Unmerge the factsheet first');
  });

  // -------------------------------------------------------------------------
  // Guard: fact already unresolved (accepted IS NULL)
  // -------------------------------------------------------------------------

  it('refuses reset when fact is already unresolved (accepted IS NULL)', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_UNRESOLVED });
    const res = await POST(makeRequest(RF_UNRESOLVED, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already-unresolved');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_ACCEPTED });
    const res = await POST(makeRequest(RF_ACCEPTED, { reason: '' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Guard: not found
  // -------------------------------------------------------------------------

  it('returns 404 for nonexistent fact', async () => {
    authSuccess(testDb);
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'r' }) }),
      { params: Promise.resolve({ id: 'rf-does-not-exist' }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('revalidates tags on success', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_ACCEPTED });
    await POST(makeRequest(RF_ACCEPTED, { reason: 'Reset it' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('factsheets-list');
    expect(tags).toContain(`factsheet-${FS_DRAFT}`);
    expect(tags).toContain('factsheet-count');
    expect(tags).toContain('inbox-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
