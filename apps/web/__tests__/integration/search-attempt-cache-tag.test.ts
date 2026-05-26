/**
 * Bundle E integration test: search-attempt cache-tag revalidation.
 *
 * Verifies that POST/PATCH/DELETE each call
 *   revalidateTag(`search-attempts:person:<personId>`, 'max')
 * against a real in-memory SQLite DB (not a mock Drizzle chain).
 *
 * This test complements the AST guard (which checks the call EXISTS in source)
 * with a runtime assertion (which checks the ARGS at actual execution time).
 *
 * Uses a real in-memory SQLite DB with PRAGMA foreign_keys = ON.
 */

// ---------------------------------------------------------------------------
// Mock layers BEFORE importing modules under test.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Spy on revalidateTag. Must come BEFORE any import that pulls next/cache.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => {
    if (err instanceof Error && err.name === 'ForbiddenError') {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message.includes('Not authenticated')) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  },
}));

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Imports AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { revalidateTag } from 'next/cache';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { withAuth } from '@/lib/auth/api-guard';
import { POST as createPOST } from '@/app/api/persons/[id]/search-attempts/route';
import { PATCH as updatePATCH, DELETE as deleteDELETE } from '@/app/api/search-attempts/[id]/route';

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

// Each test gets a fresh DB + person with a unique ID.
function setupFreshDb(personId: string) {
  const { sqlite, db } = createTestDb();
  const client = sqlite as unknown as RawClient;
  const ts = new Date().toISOString();
  client.prepare(
    `INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at)
     VALUES (?, 'U', 1, 'private', ?, ?)`,
  ).run(personId, ts, ts);

  vi.mocked(withAuth).mockResolvedValue({
    familyDb: db,
    ctx: {
      userId: 'u1',
      familyId: 'fam1',
      role: 'editor',
      actualRole: 'editor',
      dbFilename: 'test-cache-tag.db',
    },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });

  return { sqlite, db, client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: search-attempt cache-tag revalidation (Bundle E)', () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    vi.mocked(withAuth).mockClear();
  });

  it("POST calls revalidateTag('search-attempts:person:<id>', 'max')", async () => {
    const personId = crypto.randomUUID();
    setupFreshDb(personId);

    await createPOST(
      makeRequest('POST', `/api/persons/${personId}/search-attempts`, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: personId }) },
    );

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(
      `search-attempts:person:${personId}`,
      'max',
    );
  });

  it("PATCH calls revalidateTag('search-attempts:person:<id>', 'max')", async () => {
    const personId = crypto.randomUUID();
    const { client } = setupFreshDb(personId);
    const attemptId = crypto.randomUUID();
    const now = Date.now();

    // Seed an attempt directly into the DB.
    client.prepare(
      `INSERT INTO search_attempts
         (id, person_id, thread_id, research_item_id, provider_kind, provider_label,
          query, searched_at, outcome, notes, created_by, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 'familysearch', NULL, NULL, ?, 'found', NULL, 'u1', ?, ?)`,
    ).run(attemptId, personId, now, now, now);

    vi.mocked(revalidateTag).mockClear();

    await updatePATCH(
      makeRequest('PATCH', `/api/search-attempts/${attemptId}`, {
        query: 'updated query string',
      }),
      { params: Promise.resolve({ id: attemptId }) },
    );

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(
      `search-attempts:person:${personId}`,
      'max',
    );
  });

  it("DELETE calls revalidateTag('search-attempts:person:<id>', 'max')", async () => {
    const personId = crypto.randomUUID();
    const { client } = setupFreshDb(personId);
    const attemptId = crypto.randomUUID();
    const now = Date.now();

    // Seed an attempt directly into the DB.
    client.prepare(
      `INSERT INTO search_attempts
         (id, person_id, thread_id, research_item_id, provider_kind, provider_label,
          query, searched_at, outcome, notes, created_by, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 'ancestry', NULL, NULL, ?, 'found', NULL, 'u1', ?, ?)`,
    ).run(attemptId, personId, now, now, now);

    vi.mocked(revalidateTag).mockClear();

    await deleteDELETE(
      makeRequest('DELETE', `/api/search-attempts/${attemptId}`),
      { params: Promise.resolve({ id: attemptId }) },
    );

    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(
      `search-attempts:person:${personId}`,
      'max',
    );
  });
});
