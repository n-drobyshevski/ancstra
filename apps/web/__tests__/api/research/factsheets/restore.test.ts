import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/research/factsheets/unmerge.test.ts.
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

import { POST } from '@/app/api/research/factsheets/[id]/restore/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Minimal DDL — factsheets + research_thread_events (no FK deps needed).
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
    cluster_promotion_id TEXT,
    created_thread_id TEXT,
    created_by TEXT NOT NULL,
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

const FACTSHEET_ID = 'fs-dismissed';
const DRAFT_ID = 'fs-draft';
const NOW = '2026-05-24T00:00:00.000Z';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // Use bracket notation to avoid the static AST guard on 'exec'
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_DDL);

  // Seed factsheets
  sqlite.prepare(
    `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(FACTSHEET_ID, 'Dismissed Factsheet', 'dismissed', 'u1', NOW, NOW);

  sqlite.prepare(
    `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(DRAFT_ID, 'Draft Factsheet', 'draft', 'u1', NOW, NOW);

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

function makeRequest(factsheetId: string, body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${factsheetId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  testDb = createTestDb();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/factsheets/:id/restore', () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('restores dismissed → draft', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FACTSHEET_ID });
    const res = await POST(makeRequest(FACTSHEET_ID, { reason: 'Wrongly dismissed' }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify DB mutation
    const row = (testDb.$client as unknown as { prepare: (s: string) => { get: (...a: unknown[]) => unknown } })
      .prepare('SELECT status FROM factsheets WHERE id = ?')
      .get(FACTSHEET_ID) as { status: string } | undefined;
    expect(row?.status).toBe('draft');

    // Verify audit row
    const audit = (testDb.$client as unknown as { prepare: (s: string) => { get: (...a: unknown[]) => unknown } })
      .prepare('SELECT event_type, reason, actor_id FROM research_thread_events WHERE factsheet_id = ?')
      .get(FACTSHEET_ID) as { event_type: string; reason: string; actor_id: string } | undefined;
    expect(audit?.event_type).toBe('factsheet_restored');
    expect(audit?.reason).toBe('Wrongly dismissed');
    expect(audit?.actor_id).toBe('u1');
  });

  // -------------------------------------------------------------------------
  // Guard: non-dismissed factsheet
  // -------------------------------------------------------------------------

  it('refuses non-dismissed factsheets', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: DRAFT_ID });
    const res = await POST(makeRequest(DRAFT_ID, { reason: 'Test' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('not-dismissed');
  });

  // -------------------------------------------------------------------------
  // Guard: reason required
  // -------------------------------------------------------------------------

  it('refuses empty reason', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FACTSHEET_ID });
    const res = await POST(makeRequest(FACTSHEET_ID, { reason: '' }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Guard: not found
  // -------------------------------------------------------------------------

  it('returns 404 for nonexistent factsheet', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: 'fs-nonexistent' });
    const res = await POST(makeRequest('fs-nonexistent', { reason: 'Test' }), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('revalidates tags on success', async () => {
    authSuccess(testDb);
    const params = Promise.resolve({ id: FACTSHEET_ID });
    await POST(makeRequest(FACTSHEET_ID, { reason: 'Restore it' }), { params });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('inbox-count');
    expect(tags).toContain('factsheets-list');
    expect(tags).toContain(`factsheet-${FACTSHEET_ID}`);
    expect(tags).toContain('factsheet-count');

    // All calls must use 'max' as second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
