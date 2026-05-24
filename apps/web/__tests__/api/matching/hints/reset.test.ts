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

import { POST } from '@/app/api/matching/hints/[id]/reset/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — persons + match_candidates + research_thread_events.
// thread_id is nullable per Bundle B T1.
// ---------------------------------------------------------------------------

const BOOTSTRAP_DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2026-05-23T00:00:00.000Z';
const P1 = 'p1';

// Hint IDs
const HINT_ACCEPTED = 'hint-accepted';
const HINT_REJECTED = 'hint-rejected';
const HINT_MAYBE    = 'hint-maybe';
const HINT_PENDING  = 'hint-pending';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed persons
  sqlite.prepare(
    `INSERT INTO persons (id, created_at, updated_at) VALUES (?, ?, ?)`
  ).run(P1, NOW, NOW);

  // Seed match_candidates
  const insertHint = sqlite.prepare(
    `INSERT INTO match_candidates
       (id, person_id, source_system, external_id, external_data, match_score, match_status, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertHint.run(HINT_ACCEPTED, P1, 'familysearch', 'ext-1', '{}', 0.9, 'accepted', NOW, NOW);
  insertHint.run(HINT_REJECTED, P1, 'familysearch', 'ext-2', '{}', 0.8, 'rejected', NOW, NOW);
  insertHint.run(HINT_MAYBE,    P1, 'familysearch', 'ext-3', '{}', 0.7, 'maybe',    NOW, NOW);
  insertHint.run(HINT_PENDING,  P1, 'familysearch', 'ext-4', '{}', 0.6, 'pending',  null, NOW);

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

function makeRequest(hintId: string, body: unknown) {
  return new Request(
    `http://localhost/api/matching/hints/${hintId}/reset`,
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

describe('POST /api/matching/hints/:id/reset', () => {
  // -------------------------------------------------------------------------
  // Happy path: accepted → pending
  // -------------------------------------------------------------------------

  it('resets accepted → pending and clears reviewed_at', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_ACCEPTED });
    const res = await POST(makeRequest(HINT_ACCEPTED, { reason: 'Wrong match accepted' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation
    const row = getClient(testDb)
      .prepare('SELECT match_status, reviewed_at FROM match_candidates WHERE id = ?')
      .get(HINT_ACCEPTED) as { match_status: string; reviewed_at: string | null } | undefined;
    expect(row?.match_status).toBe('pending');
    expect(row?.reviewed_at).toBeNull();

    // Verify audit row
    const audit = getClient(testDb)
      .prepare(
        'SELECT event_type, reason, actor_id, person_id FROM research_thread_events ORDER BY occurred_at DESC LIMIT 1'
      )
      .get() as { event_type: string; reason: string; actor_id: string; person_id: string } | undefined;
    expect(audit?.event_type).toBe('hint_reset');
    expect(audit?.reason).toBe('Wrong match accepted');
    expect(audit?.actor_id).toBe('u1');
    expect(audit?.person_id).toBe(P1);
  });

  // -------------------------------------------------------------------------
  // Happy path: rejected → pending
  // -------------------------------------------------------------------------

  it('resets rejected → pending', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_REJECTED });
    const res = await POST(makeRequest(HINT_REJECTED, { reason: 'Wrong match rejected' }), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    const row = getClient(testDb)
      .prepare('SELECT match_status, reviewed_at FROM match_candidates WHERE id = ?')
      .get(HINT_REJECTED) as { match_status: string; reviewed_at: string | null } | undefined;
    expect(row?.match_status).toBe('pending');
    expect(row?.reviewed_at).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Happy path: maybe → pending
  // -------------------------------------------------------------------------

  it('resets maybe → pending', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_MAYBE });
    const res = await POST(makeRequest(HINT_MAYBE, { reason: 'Reconsidering' }), { params });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    const row = getClient(testDb)
      .prepare('SELECT match_status, reviewed_at FROM match_candidates WHERE id = ?')
      .get(HINT_MAYBE) as { match_status: string; reviewed_at: string | null } | undefined;
    expect(row?.match_status).toBe('pending');
    expect(row?.reviewed_at).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Payload persistence: matchCandidateId stored in payload_json
  // -------------------------------------------------------------------------

  it('persists matchCandidateId in payload_json', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_ACCEPTED });
    await POST(makeRequest(HINT_ACCEPTED, { reason: 'Check payload' }), { params });

    const audit = getClient(testDb)
      .prepare('SELECT payload_json FROM research_thread_events ORDER BY occurred_at DESC LIMIT 1')
      .get() as { payload_json: string } | undefined;
    expect(audit?.payload_json).toBeDefined();
    const payload = JSON.parse(audit!.payload_json);
    expect(payload).toEqual({ matchCandidateId: HINT_ACCEPTED });
  });

  // -------------------------------------------------------------------------
  // Guard: already pending
  // -------------------------------------------------------------------------

  it('refuses reset when hint is already pending', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_PENDING });
    const res = await POST(makeRequest(HINT_PENDING, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already-pending');
  });

  // -------------------------------------------------------------------------
  // Guard: not found
  // -------------------------------------------------------------------------

  it('returns 404 for nonexistent hint', async () => {
    authSuccess(testDb);
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'r' }) }),
      { params: Promise.resolve({ id: 'hint-does-not-exist' }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_ACCEPTED });
    const res = await POST(makeRequest(HINT_ACCEPTED, { reason: '' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('revalidates tags on success', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: HINT_ACCEPTED });
    await POST(makeRequest(HINT_ACCEPTED, { reason: 'Reset it' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain(`hints-person-${P1}`);
    expect(tags).toContain('inbox-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
