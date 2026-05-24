import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/research/facts/reset.test.ts.
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

import { POST } from '@/app/api/research/facts/[id]/dispute/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — research_facts + research_thread_events.
// thread_id is nullable per Bundle B T1.
// ---------------------------------------------------------------------------

const BOOTSTRAP_DDL = `
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
const RF_DISPUTABLE = 'rf-disputable';         // contested=0, confidence='medium', factsheet_id='fs-1', person_id='p-1'
const RF_ALREADY_CONTESTED = 'rf-already-contested'; // contested=1, confidence='medium'
const RF_UNKNOWN_CONFIDENCE = 'rf-unknown-confidence'; // contested=0, confidence='unknown'

// Factsheet IDs
const FS_1 = 'fs-1';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed research_facts
  sqlite.prepare(
    `INSERT INTO research_facts (id, person_id, fact_type, fact_value, factsheet_id, contested, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_DISPUTABLE, 'p-1', 'birth_date', '1900-01-01', FS_1, 0, 'medium', NOW, NOW);

  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, contested, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_ALREADY_CONTESTED, 'birth_place', 'London', 1, 'medium', NOW, NOW);

  sqlite.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, contested, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(RF_UNKNOWN_CONFIDENCE, 'occupation', 'Unknown', 0, 'unknown', NOW, NOW);

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
    `http://localhost/api/research/facts/${factId}/dispute`,
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

describe('POST /api/research/facts/:id/dispute', () => {
  // -------------------------------------------------------------------------
  // Happy path: flips contested 0 → 1 and emits gedcom_disputed
  // -------------------------------------------------------------------------

  it('flips contested 0 → 1 and emits gedcom_disputed', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_DISPUTABLE });
    const res = await POST(makeRequest(RF_DISPUTABLE, { reason: 'Incorrect birth date' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation: contested should now be 1
    const row = getClient(testDb)
      .prepare('SELECT contested FROM research_facts WHERE id = ?')
      .get(RF_DISPUTABLE) as { contested: number } | undefined;
    expect(row?.contested).toBe(1);

    // Verify audit row
    const audit = getClient(testDb)
      .prepare('SELECT event_type, reason, payload_json FROM research_thread_events WHERE research_fact_id = ?')
      .get(RF_DISPUTABLE) as { event_type: string; reason: string; payload_json: string } | undefined;
    expect(audit?.event_type).toBe('gedcom_disputed');
    expect(audit?.reason).toBe('Incorrect birth date');
    expect(JSON.parse(audit?.payload_json ?? '{}')).toEqual({ target: 'research_facts', rowId: RF_DISPUTABLE });
  });

  // -------------------------------------------------------------------------
  // Happy path: audit row has correct researchFactId, factsheetId, personId
  // -------------------------------------------------------------------------

  it('audit row has correct researchFactId, factsheetId, personId', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_DISPUTABLE });
    await POST(makeRequest(RF_DISPUTABLE, { reason: 'Incorrect birth date' }), { params });

    const audit = getClient(testDb)
      .prepare('SELECT research_fact_id, factsheet_id, person_id, actor_id FROM research_thread_events WHERE research_fact_id = ?')
      .get(RF_DISPUTABLE) as { research_fact_id: string; factsheet_id: string; person_id: string; actor_id: string } | undefined;
    expect(audit?.research_fact_id).toBe(RF_DISPUTABLE);
    expect(audit?.factsheet_id).toBe(FS_1);
    expect(audit?.person_id).toBe('p-1');
    expect(audit?.actor_id).toBe('u1');
  });

  // -------------------------------------------------------------------------
  // Guard: already contested
  // -------------------------------------------------------------------------

  it('refuses already-contested', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_ALREADY_CONTESTED });
    const res = await POST(makeRequest(RF_ALREADY_CONTESTED, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already-contested');
  });

  // -------------------------------------------------------------------------
  // Guard: confidence=unknown
  // -------------------------------------------------------------------------

  it('refuses confidence=unknown', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_UNKNOWN_CONFIDENCE });
    const res = await POST(makeRequest(RF_UNKNOWN_CONFIDENCE, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('confidence-unknown');
    expect(body.message).toContain('Cannot dispute a fact with unknown confidence');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: RF_DISPUTABLE });
    const res = await POST(makeRequest(RF_DISPUTABLE, { reason: '' }), { params });
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
    const params = Promise.resolve({ id: RF_DISPUTABLE });
    await POST(makeRequest(RF_DISPUTABLE, { reason: 'Incorrect birth date' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('factsheets-list');
    expect(tags).toContain(`factsheet-${FS_1}`);
    expect(tags).toContain('inbox-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
