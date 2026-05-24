import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/research/facts/dispute.test.ts.
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

import { POST } from '@/app/api/persons/[personId]/events/[eventId]/dispute/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — persons + events + research_thread_events.
// thread_id is nullable per Bundle B T1.
// ---------------------------------------------------------------------------

const BOOTSTRAP_DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    family_id TEXT,
    given_name TEXT,
    surname TEXT,
    birth_year INTEGER,
    death_year INTEGER,
    is_living INTEGER NOT NULL DEFAULT 0,
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    date_sort INTEGER,
    date_original TEXT,
    place TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
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

const PERSON_ID = 'p1';
const EV_FRESH = 'ev-fresh';
const EV_ALREADY = 'ev-already';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed person
  sqlite.prepare(
    `INSERT INTO persons (id, created_at, updated_at) VALUES (?, ?, ?)`
  ).run(PERSON_ID, NOW, NOW);

  // Seed events
  sqlite.prepare(
    `INSERT INTO events (id, person_id, event_type, contested, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(EV_FRESH, PERSON_ID, 'birth', 0, NOW, NOW);

  sqlite.prepare(
    `INSERT INTO events (id, person_id, event_type, contested, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(EV_ALREADY, PERSON_ID, 'death', 1, NOW, NOW);

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

function makeRequest(personId: string, eventId: string, body: unknown) {
  return new Request(
    `http://localhost/api/persons/${personId}/events/${eventId}/dispute`,
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

describe('POST /api/persons/:personId/events/:eventId/dispute', () => {
  // -------------------------------------------------------------------------
  // Happy path: flips contested 0 → 1 and emits gedcom_disputed with events target
  // -------------------------------------------------------------------------

  it('flips contested 0 → 1 and emits gedcom_disputed with events target', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ personId: PERSON_ID, eventId: EV_FRESH });
    const res = await POST(makeRequest(PERSON_ID, EV_FRESH, { reason: 'Wrong birth date' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation: contested should now be 1
    const row = getClient(testDb)
      .prepare('SELECT contested FROM events WHERE id = ?')
      .get(EV_FRESH) as { contested: number } | undefined;
    expect(row?.contested).toBe(1);

    // Verify audit row
    const audit = getClient(testDb)
      .prepare('SELECT event_type, person_id, payload_json FROM research_thread_events LIMIT 1')
      .get() as { event_type: string; person_id: string; payload_json: string } | undefined;
    expect(audit?.event_type).toBe('gedcom_disputed');
    expect(audit?.person_id).toBe(PERSON_ID);
    expect(JSON.parse(audit?.payload_json ?? '{}')).toEqual({ target: 'events', rowId: EV_FRESH });
  });

  // -------------------------------------------------------------------------
  // Guard: refuses already-contested
  // -------------------------------------------------------------------------

  it('refuses already-contested', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ personId: PERSON_ID, eventId: EV_ALREADY });
    const res = await POST(makeRequest(PERSON_ID, EV_ALREADY, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already-contested');
  });

  // -------------------------------------------------------------------------
  // Guard: mismatched personId/eventId pair
  // -------------------------------------------------------------------------

  it('refuses mismatched personId/eventId pair', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ personId: 'wrong-person', eventId: EV_FRESH });
    const res = await POST(makeRequest('wrong-person', EV_FRESH, { reason: 'Test' }), { params });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ personId: PERSON_ID, eventId: EV_FRESH });
    const res = await POST(makeRequest(PERSON_ID, EV_FRESH, { reason: '' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('revalidates tags on success', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ personId: PERSON_ID, eventId: EV_FRESH });
    await POST(makeRequest(PERSON_ID, EV_FRESH, { reason: 'Wrong birth date' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('persons');
    expect(tags).toContain(`person-${PERSON_ID}`);
    expect(tags).toContain('inbox-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
