/**
 * Bundle E integration test: search-attempt full roundtrip.
 *
 * Exercises the full HTTP path for:
 *   POST  /api/persons/[id]/search-attempts     (create)
 *   GET   /api/persons/[id]/search-attempts     (list)
 *   PATCH /api/search-attempts/[id]             (edit)
 *   DELETE /api/search-attempts/[id]            (delete)
 *
 * Also asserts:
 *   - 401 on unauthenticated POST
 *   - providerLabel round-trip for `archive` kind
 *   - searchedAt numeric round-trip (ms-epoch)
 *   - tab badge count tracks (0 -> 1 -> 0) via direct DB count query
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
import { PATCH as updatePATCH, DELETE as deleteDELETE } from '@/app/api/search-attempts/[id]/route';

// ---------------------------------------------------------------------------
// DDL — tables needed by search-attempt routes with FK constraints.
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

const PERSON_ID = 'person-e2e-001';
const USER_ID = 'u1';
const DB_FILENAME = 'test-roundtrip.db';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

function seedPerson(client: RawClient) {
  const ts = new Date().toISOString();
  client.prepare(
    `INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at)
     VALUES (?, 'U', 1, 'private', ?, ?)`,
  ).run(PERSON_ID, ts, ts);
}

function makeRequest(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function countAttempts(client: RawClient): number {
  const row = client.prepare(
    `SELECT COUNT(*) AS n FROM search_attempts WHERE person_id = ?`,
  ).get(PERSON_ID) as { n: number };
  return Number(row.n);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: search-attempt roundtrip (Bundle E)', () => {
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
        dbFilename: DB_FILENAME,
      },
      centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
    });

    seedPerson(sqlite as unknown as RawClient);
  });

  it('401 on unauthenticated POST (no auth)', async () => {
    vi.mocked(withAuth).mockRejectedValue(new Error('Not authenticated'));
    const res = await createPOST(
      makeRequest('POST', `/api/persons/${PERSON_ID}/search-attempts`, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('create -> list -> edit -> list -> delete -> list with tab count tracking', async () => {
    const client = sqlite as unknown as RawClient;

    // (1) Initial state: empty list, count = 0.
    let res = await listGET(
      makeRequest('GET', `/api/persons/${PERSON_ID}/search-attempts`),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).items).toEqual([]);
    expect(countAttempts(client)).toBe(0);

    // (2) Create an `archive` attempt with providerLabel (archive round-trip).
    const SEARCHED_AT_ISO = '2026-05-26T10:00:00Z';
    const SEARCHED_AT_MS = new Date(SEARCHED_AT_ISO).getTime();

    res = await createPOST(
      makeRequest('POST', `/api/persons/${PERSON_ID}/search-attempts`, {
        providerKind: 'archive',
        providerLabel: 'Russian State Historical Archive',
        searchedAt: SEARCHED_AT_ISO,
        outcome: 'found',
        query: 'Anna Petrova 1923',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/);

    // providerLabel round-trip: must survive to response.
    expect(created.providerKind).toBe('archive');
    expect(created.providerLabel).toBe('Russian State Historical Archive');

    // searchedAt numeric round-trip: must be ms-epoch number.
    expect(typeof created.searchedAt).toBe('number');
    expect(created.searchedAt).toBe(SEARCHED_AT_MS);

    // (3) List shows 1, count = 1.
    res = await listGET(
      makeRequest('GET', `/api/persons/${PERSON_ID}/search-attempts`),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    const body3 = await res.json();
    expect(body3.items).toHaveLength(1);
    expect(body3.items[0].id).toBe(created.id);
    expect(body3.items[0].providerLabel).toBe('Russian State Historical Archive');
    expect(typeof body3.items[0].searchedAt).toBe('number');
    expect(body3.items[0].searchedAt).toBe(SEARCHED_AT_MS);
    expect(countAttempts(client)).toBe(1);

    // (4) Edit outcome=negative + notes (notes-required path).
    res = await updatePATCH(
      makeRequest('PATCH', `/api/search-attempts/${created.id}`, {
        outcome: 'negative',
        notes: 'On further review, no record found.',
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const patched = await res.json();
    expect(patched.outcome).toBe('negative');
    expect(patched.notes).toMatch(/no record found/);

    // (5) List reflects the edit.
    res = await listGET(
      makeRequest('GET', `/api/persons/${PERSON_ID}/search-attempts`),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    const body5 = await res.json();
    expect(body5.items[0].outcome).toBe('negative');
    expect(body5.items[0].notes).toMatch(/no record found/);
    // Count unchanged (still 1 attempt total).
    expect(countAttempts(client)).toBe(1);

    // (6) Delete.
    res = await deleteDELETE(
      makeRequest('DELETE', `/api/search-attempts/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(204);

    // (7) List is empty, count = 0.
    res = await listGET(
      makeRequest('GET', `/api/persons/${PERSON_ID}/search-attempts`),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect((await res.json()).items).toEqual([]);
    expect(countAttempts(client)).toBe(0);
  });
});
