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

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/families/[id]/dispute/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — families + research_thread_events.
// thread_id is nullable per Bundle B T1.
// ---------------------------------------------------------------------------

const BOOTSTRAP_DDL = `
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

const FAM_CONFIRMED = 'fam-confirmed';
const FAM_DISPUTED = 'fam-disputed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed families
  sqlite.prepare(
    `INSERT INTO families (id, validation_status, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(FAM_CONFIRMED, 'confirmed', NOW, NOW);

  sqlite.prepare(
    `INSERT INTO families (id, validation_status, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(FAM_DISPUTED, 'disputed', NOW, NOW);

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

function makeRequest(familyId: string, body: unknown) {
  return new Request(
    `http://localhost/api/families/${familyId}/dispute`,
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

describe('POST /api/families/:id/dispute', () => {
  // -------------------------------------------------------------------------
  // Happy path: flips confirmed → disputed and emits gedcom_disputed
  // -------------------------------------------------------------------------

  it('flips confirmed → disputed and emits gedcom_disputed', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FAM_CONFIRMED });
    const res = await POST(makeRequest(FAM_CONFIRMED, { reason: 'Wrong family unit' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation: validation_status should now be 'disputed'
    const row = getClient(testDb)
      .prepare('SELECT validation_status FROM families WHERE id = ?')
      .get(FAM_CONFIRMED) as { validation_status: string } | undefined;
    expect(row?.validation_status).toBe('disputed');

    // Verify audit row
    const audit = getClient(testDb)
      .prepare('SELECT event_type, reason, payload_json FROM research_thread_events LIMIT 1')
      .get() as { event_type: string; reason: string; payload_json: string } | undefined;
    expect(audit?.event_type).toBe('gedcom_disputed');
    expect(audit?.reason).toBe('Wrong family unit');
    expect(JSON.parse(audit?.payload_json ?? '{}')).toEqual({ target: 'families', rowId: FAM_CONFIRMED });
  });

  // -------------------------------------------------------------------------
  // Guard: refuses non-confirmed
  // -------------------------------------------------------------------------

  it('refuses non-confirmed', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FAM_DISPUTED });
    const res = await POST(makeRequest(FAM_DISPUTED, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('not-confirmed');
    expect(body.message).toContain('disputed');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FAM_CONFIRMED });
    const res = await POST(makeRequest(FAM_CONFIRMED, { reason: '' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Guard: not found
  // -------------------------------------------------------------------------

  it('returns 404 for nonexistent row', async () => {
    authSuccess(testDb);
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'r' }) }),
      { params: Promise.resolve({ id: 'fam-does-not-exist' }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('revalidates tags on success', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FAM_CONFIRMED });
    await POST(makeRequest(FAM_CONFIRMED, { reason: 'Wrong family unit' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('tree-data');
    expect(tags).toContain('persons');
    expect(tags).toContain('inbox-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
