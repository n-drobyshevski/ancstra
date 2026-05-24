import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { softDetachFactsheet } from '../../factsheets/detach';
import { FactsheetNotPromotedError, ClusterPromotedError } from '../../factsheets/unmerge';
import { ReasonRequiredError } from '../../audit/reason';

// Comprehensive DDL — mirrors unmerge.test.ts shape but with source_factsheet_id
// on events (Bundle C requirement). Includes families for cluster-guard test.
const DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
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
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    date_original TEXT,
    date_sort INTEGER,
    place_text TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    source_factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
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
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
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

const PROMOTED_AT = '2026-05-24T10:00:00.000Z';

let db: TestCentralDb;

interface ClientForQuery {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
}

function client(): ClientForQuery {
  return db.$client as unknown as ClientForQuery;
}

function seedPromoted(fsId: string, personId: string, promotedAt: string) {
  client()
    .prepare(
      `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, created_by, created_at, updated_at)
       VALUES (?, ?, 'promoted', ?, ?, 'u', ?, ?)`,
    )
    .run(fsId, 'Test FS', personId, promotedAt, promotedAt, promotedAt);

  client()
    .prepare(`INSERT INTO persons (id, created_by, created_at, updated_at) VALUES (?, 'u', ?, ?)`)
    .run(personId, promotedAt, promotedAt);

  client()
    .prepare(
      `INSERT INTO events
         (id, person_id, event_type, date_original, source_factsheet_id, created_at, updated_at)
       VALUES (?, ?, 'birth', '1820', ?, ?, ?)`,
    )
    .run('ev-' + personId, personId, fsId, promotedAt, promotedAt);
}

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
  // Seed F1 promoted to P1 with event E1 (source_factsheet_id='F1')
  seedPromoted('F1', 'P1', PROMOTED_AT);
});

describe('softDetachFactsheet', () => {
  it('happy path — clears promoted link, sets status=ready', async () => {
    await softDetachFactsheet(db as any, {
      factsheetId: 'F1',
      reason: 'breaking link',
      actorId: 'u',
    });

    const fs = client()
      .prepare(
        `SELECT status, promoted_person_id, promoted_at FROM factsheets WHERE id = 'F1'`,
      )
      .get() as { status: string; promoted_person_id: string | null; promoted_at: string | null };

    expect(fs.status).toBe('ready');
    expect(fs.promoted_person_id).toBeNull();
    expect(fs.promoted_at).toBeNull();
  });

  it('person P1 and event E1 are untouched after detach', async () => {
    await softDetachFactsheet(db as any, {
      factsheetId: 'F1',
      reason: 'breaking link',
      actorId: 'u',
    });

    const personCount = client()
      .prepare(`SELECT COUNT(*) as n FROM persons WHERE id = 'P1'`)
      .get() as { n: number };
    expect(personCount.n).toBe(1);

    const eventCount = client()
      .prepare(`SELECT COUNT(*) as n FROM events WHERE id = 'ev-P1'`)
      .get() as { n: number };
    expect(eventCount.n).toBe(1);
  });

  it('writes a factsheet_detached audit event with correct fields', async () => {
    await softDetachFactsheet(db as any, {
      factsheetId: 'F1',
      reason: 'breaking link',
      actorId: 'u',
    });

    const ev = client()
      .prepare(
        `SELECT event_type, reason, person_id, payload_json
         FROM research_thread_events WHERE factsheet_id = 'F1'`,
      )
      .get() as {
      event_type: string;
      reason: string;
      person_id: string;
      payload_json: string;
    };

    expect(ev.event_type).toBe('factsheet_detached');
    expect(ev.reason).toBe('breaking link');
    expect(ev.person_id).toBe('P1');
    expect(JSON.parse(ev.payload_json)).toEqual({ previousPersonId: 'P1' });
  });

  it('throws FactsheetNotPromotedError on non-promoted factsheet', async () => {
    client()
      .prepare(
        `UPDATE factsheets
         SET status = 'draft', promoted_person_id = NULL, promoted_at = NULL
         WHERE id = 'F1'`,
      )
      .run();

    await expect(
      softDetachFactsheet(db as any, { factsheetId: 'F1', reason: 'r', actorId: 'u' }),
    ).rejects.toThrow(FactsheetNotPromotedError);
  });

  it('throws ClusterPromotedError when factsheet belongs to a cluster', async () => {
    // Insert a second promoted person P2, then link P1+P2 in families
    // with created_at within ±5s of PROMOTED_AT — triggers cluster guard.
    seedPromoted('F2', 'P2', '2026-05-24T10:00:02.000Z');
    client()
      .prepare(
        `INSERT INTO families (id, partner1_id, partner2_id, validation_status, created_at, updated_at)
         VALUES ('fam1', 'P1', 'P2', 'confirmed', '2026-05-24T10:00:01.000Z', '2026-05-24T10:00:01.000Z')`,
      )
      .run();

    await expect(
      softDetachFactsheet(db as any, { factsheetId: 'F1', reason: 'r', actorId: 'u' }),
    ).rejects.toThrow(ClusterPromotedError);
  });

  it('throws ReasonRequiredError (matching /reason is required/) on whitespace-only reason', async () => {
    await expect(
      softDetachFactsheet(db as any, { factsheetId: 'F1', reason: '   ', actorId: 'u' }),
    ).rejects.toThrow(/reason is required/);
  });
});
