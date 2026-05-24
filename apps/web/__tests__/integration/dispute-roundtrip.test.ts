/**
 * Bundle B integration test: GEDCOM dispute round-trip.
 *
 * Exercises the shared disputeFamilyRow helper (T12) end-to-end against a
 * real in-memory SQLite DB: confirmed row -> disputed + audit event.
 * Also verifies the "already-disputed" guard returns 400.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db/schema';

// Mock next/cache before importing disputeFamilyRow (which calls revalidateTag).
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { disputeFamilyRow } from '../../lib/research/dispute-family-row';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// DDL — minimal tables required by disputeFamilyRow:
//   - families / children (the disputable targets)
//   - research_thread_events (written by logReverseEvent inside handler)
// ---------------------------------------------------------------------------
const DDL = `
  CREATE TABLE families (
    id TEXT PRIMARY KEY,
    partner1_id TEXT,
    partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    child_order INTEGER,
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
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

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = OFF');
  (sqlite as unknown as { exec: (s: string) => void }).exec(DDL);
  return { sqlite, db: drizzle(sqlite, { schema }) as any };
}

type RawClient = {
  prepare: (query: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GEDCOM dispute round-trip (Bundle B integration)', () => {
  let sqlite: Database.Database;
  let db: any;

  beforeEach(() => {
    const created = createTestDb();
    sqlite = created.sqlite;
    db = created.db;
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // families target
  // -------------------------------------------------------------------------

  it('confirmed family -> validation_status=disputed + audit event + 200', async () => {
    const client = sqlite as unknown as RawClient;
    client.prepare(
      `INSERT INTO families (id, validation_status, created_at, updated_at)
       VALUES ('fam1', 'confirmed', '2026-05-24', '2026-05-24')`,
    ).run();

    const result = await disputeFamilyRow(db, {
      target: 'families',
      rowId: 'fam1',
      reason: 'census disagrees',
      actorId: 'u1',
    });

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toEqual({ success: true });

    const row = client.prepare(
      `SELECT validation_status FROM families WHERE id = 'fam1'`,
    ).get() as { validation_status: string };
    expect(row.validation_status).toBe('disputed');

    const ev = client.prepare(
      `SELECT event_type, payload_json, reason FROM research_thread_events
       WHERE event_type = 'gedcom_disputed'`,
    ).get() as { event_type: string; payload_json: string; reason: string };
    expect(ev).toBeDefined();
    expect(JSON.parse(ev.payload_json)).toEqual({ target: 'families', rowId: 'fam1' });
    expect(ev.reason).toBe('census disagrees');
  });

  it('calls revalidateTag with expected tags after family dispute', async () => {
    const client = sqlite as unknown as RawClient;
    client.prepare(
      `INSERT INTO families (id, validation_status, created_at, updated_at)
       VALUES ('fam2', 'confirmed', '2026-05-24', '2026-05-24')`,
    ).run();

    await disputeFamilyRow(db, {
      target: 'families',
      rowId: 'fam2',
      reason: 'wrong',
      actorId: 'u1',
    });

    const tags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag);
    expect(tags).toContain('tree-data');
    expect(tags).toContain('persons');
    expect(tags).toContain('inbox-count');
    // All calls must include the 'max' second argument
    for (const [, second] of vi.mocked(revalidateTag).mock.calls) {
      expect(second).toBe('max');
    }
  });

  it('returns 400 error=not-confirmed when family is already disputed', async () => {
    const client = sqlite as unknown as RawClient;
    client.prepare(
      `INSERT INTO families (id, validation_status, created_at, updated_at)
       VALUES ('fam3', 'disputed', '2026-05-24', '2026-05-24')`,
    ).run();

    const result = await disputeFamilyRow(db, {
      target: 'families',
      rowId: 'fam3',
      reason: 'r',
      actorId: 'u1',
    });

    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error).toBe('not-confirmed');
  });

  it('returns 404 when family row does not exist', async () => {
    const result = await disputeFamilyRow(db, {
      target: 'families',
      rowId: 'no-such-fam',
      reason: 'test',
      actorId: 'u1',
    });
    expect(result.status).toBe(404);
    const body = await result.json();
    expect(body.error).toBe('not-found');
  });

  // -------------------------------------------------------------------------
  // children target
  // -------------------------------------------------------------------------

  it('confirmed child link -> validation_status=disputed + audit event + 200', async () => {
    const client = sqlite as unknown as RawClient;
    client.prepare(
      `INSERT INTO children (id, family_id, person_id, validation_status, created_at)
       VALUES ('ch1', 'f1', 'p1', 'confirmed', '2026-05-24')`,
    ).run();

    const result = await disputeFamilyRow(db, {
      target: 'children',
      rowId: 'ch1',
      reason: 'wrong father listed',
      actorId: 'u2',
    });

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toEqual({ success: true });

    const row = client.prepare(
      `SELECT validation_status FROM children WHERE id = 'ch1'`,
    ).get() as { validation_status: string };
    expect(row.validation_status).toBe('disputed');

    const ev = client.prepare(
      `SELECT payload_json, reason FROM research_thread_events
       WHERE event_type = 'gedcom_disputed'`,
    ).get() as { payload_json: string; reason: string };
    expect(ev).toBeDefined();
    expect(JSON.parse(ev.payload_json)).toEqual({ target: 'children', rowId: 'ch1' });
    expect(ev.reason).toBe('wrong father listed');
  });

  it('returns 400 error=not-confirmed for already-disputed children row', async () => {
    const client = sqlite as unknown as RawClient;
    client.prepare(
      `INSERT INTO children (id, family_id, person_id, validation_status, created_at)
       VALUES ('ch2', 'f1', 'p2', 'disputed', '2026-05-24')`,
    ).run();

    const result = await disputeFamilyRow(db, {
      target: 'children',
      rowId: 'ch2',
      reason: 'r',
      actorId: 'u1',
    });

    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error).toBe('not-confirmed');
  });
});
