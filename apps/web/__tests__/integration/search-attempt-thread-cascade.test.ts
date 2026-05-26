/**
 * Bundle E integration test: search-attempt thread cascade.
 *
 * Exercises the FK rule:
 *   thread_id TEXT REFERENCES research_threads(id) ON DELETE SET NULL
 *
 * Scenario: create a thread, create a search attempt linked to it, then
 * delete the thread directly. The attempt must survive with thread_id = null.
 *
 * Uses a real in-memory SQLite DB with PRAGMA foreign_keys = ON.
 */

// ---------------------------------------------------------------------------
// Mock layers BEFORE importing modules under test.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => {
    if (err instanceof Error && err.name === 'ForbiddenError') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message.includes('Not authenticated')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  },
}));

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { withAuth } from '@/lib/auth/api-guard';
import { POST as createPOST, GET as listGET } from '@/app/api/persons/[id]/search-attempts/route';

// ---------------------------------------------------------------------------
// DDL
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
  CREATE TABLE search_attempts (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    thread_id TEXT REFERENCES research_threads(id) ON DELETE SET NULL,
    research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
    provider_kind TEXT NOT NULL,
    provider_label TEXT,
    query TEXT,
    searched_at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
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

const PERSON_ID = 'person-cascade-001';
// Must be a valid UUID — Zod 4 validates the variant bits (requires version 1-8).
const THREAD_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const USER_ID = 'u1';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

function makeRequest(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: search-attempt thread cascade (Bundle E)', () => {
  let sqlite: Database.Database;
  let db: any;

  beforeEach(() => {
    const created = createTestDb();
    sqlite = created.sqlite;
    db = created.db;
    vi.clearAllMocks();

    vi.mocked(withAuth).mockResolvedValue({
      familyDb: db,
      ctx: {
        userId: USER_ID,
        familyId: 'fam1',
        role: 'editor',
        actualRole: 'editor',
        dbFilename: 'test-cascade.db',
      },
      centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
    });
  });

  it('deleting a thread sets attempt.thread_id to NULL (attempt survives)', async () => {
    const client = sqlite as unknown as RawClient;
    const ts = new Date().toISOString();

    // Seed person.
    client.prepare(
      `INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at)
       VALUES (?, 'U', 1, 'private', ?, ?)`,
    ).run(PERSON_ID, ts, ts);

    // Seed a research thread.
    client.prepare(
      `INSERT INTO research_threads (id, title, status, created_by, created_at, updated_at)
       VALUES (?, 'Anna Petrova investigation', 'active', ?, ?, ?)`,
    ).run(THREAD_ID, USER_ID, ts, ts);

    // Create a search attempt linked to the thread via HTTP POST.
    const res = await createPOST(
      makeRequest('POST', `/api/persons/${PERSON_ID}/search-attempts`, {
        threadId: THREAD_ID,
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.threadId).toBe(THREAD_ID);

    // Confirm attempt has thread_id set in the DB.
    const beforeRow = client.prepare(
      `SELECT thread_id FROM search_attempts WHERE id = ?`,
    ).get(created.id) as { thread_id: string | null };
    expect(beforeRow.thread_id).toBe(THREAD_ID);

    // Delete the thread directly via SQL (simulates a future thread-delete API).
    // PRAGMA foreign_keys = ON means the FK rule ON DELETE SET NULL fires.
    client.prepare(`DELETE FROM research_threads WHERE id = ?`).run(THREAD_ID);

    // Verify thread is gone.
    const threadRow = client.prepare(
      `SELECT id FROM research_threads WHERE id = ?`,
    ).get(THREAD_ID);
    expect(threadRow).toBeUndefined();

    // The attempt should still exist with thread_id = null (FK SET NULL fired).
    const afterRow = client.prepare(
      `SELECT id, thread_id FROM search_attempts WHERE id = ?`,
    ).get(created.id) as { id: string; thread_id: string | null };
    expect(afterRow).toBeDefined();
    expect(afterRow.id).toBe(created.id);
    expect(afterRow.thread_id).toBeNull();

    // List via GET confirms the attempt is visible with threadId = null.
    const listRes = await listGET(
      makeRequest('GET', `/api/persons/${PERSON_ID}/search-attempts`),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(created.id);
    expect(body.items[0].threadId).toBeNull();
  });
});
