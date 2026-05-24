import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import {
  unmergeFactsheet,
  isPersonDirtySincePromote,
  isClusterPromoted,
} from '../../factsheets/unmerge';

// Comprehensive DDL — unmerge touches many tables. Matches production
// family-schema shape sufficient for unmerge's reads, deletes, and audit insert.
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
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    name_type TEXT NOT NULL DEFAULT 'birth',
    given_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    date_original TEXT,
    date_sort INTEGER,
    place_text TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'other',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    person_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL
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
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    factsheet_id TEXT,
    source_citation_id TEXT,
    research_item_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL,
    to_factsheet_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
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

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

/**
 * Seeds a promoted-state factsheet plus the downstream rows that promote()
 * would have created (person + name + birth event + source + citation +
 * one research_fact linked to the citation).
 *
 * All seeded rows use promotedAt for their created_at/updated_at so the
 * dirty-check sees them as "untouched since promotion".
 */
function seedPromoted(fsId: string, personId: string, promotedAt: string) {
  const client = db.$client as unknown as {
    prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
  };

  client.prepare(
    `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, created_by, created_at, updated_at)
     VALUES (?, ?, 'promoted', ?, ?, 'u', ?, ?)`,
  ).run(fsId, 'Test FS', personId, promotedAt, promotedAt, promotedAt);

  client.prepare(
    `INSERT INTO persons (id, created_by, created_at, updated_at) VALUES (?, 'u', ?, ?)`,
  ).run(personId, promotedAt, promotedAt);

  client.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
     VALUES (?, ?, 'John', 'Doe', 1, ?)`,
  ).run('pn-' + personId, personId, promotedAt);

  client.prepare(
    `INSERT INTO events (id, person_id, event_type, date_original, created_at, updated_at)
     VALUES (?, ?, 'birth', '1820', ?, ?)`,
  ).run('ev-' + personId, personId, promotedAt, promotedAt);

  client.prepare(
    `INSERT INTO sources (id, title, created_by, created_at, updated_at)
     VALUES (?, 'Src', 'u', ?, ?)`,
  ).run('src-' + personId, promotedAt, promotedAt);

  client.prepare(
    `INSERT INTO source_citations (id, source_id, person_id, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run('sc-' + personId, 'src-' + personId, personId, promotedAt);

  client.prepare(
    `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, source_citation_id, created_at, updated_at)
     VALUES (?, 'birth_date', '1820', ?, ?, ?, ?)`,
  ).run('rf-' + personId, fsId, 'sc-' + personId, promotedAt, promotedAt);
}

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

describe('unmergeFactsheet', () => {
  it('clean unmerge restores factsheet and deletes downstream rows', async () => {
    seedPromoted('fs1', 'p1', '2026-05-24T10:00:00.000Z');

    const result = await unmergeFactsheet(db as any, {
      factsheetId: 'fs1',
      reason: 'Wrong person',
      actorId: 'u1',
    });

    expect(result).toEqual({
      deleted: { persons: 1, events: 1, names: 1, sources: 1, citations: 1 },
    });

    const fs = client().prepare(
      'SELECT status, promoted_person_id, promoted_at FROM factsheets WHERE id = ?',
    ).get('fs1') as {
      status: string;
      promoted_person_id: string | null;
      promoted_at: string | null;
    };
    expect(fs.status).toBe('ready');
    expect(fs.promoted_person_id).toBeNull();
    expect(fs.promoted_at).toBeNull();

    const person = client().prepare('SELECT id FROM persons WHERE id = ?').get('p1');
    expect(person).toBeUndefined();

    const events = client().prepare(
      'SELECT COUNT(*) as n FROM events WHERE person_id = ?',
    ).get('p1') as { n: number };
    expect(events.n).toBe(0);

    const fact = client().prepare(
      'SELECT source_citation_id FROM research_facts WHERE id = ?',
    ).get('rf-p1') as { source_citation_id: string | null };
    expect(fact.source_citation_id).toBeNull();

    const auditEvents = client().prepare(
      `SELECT event_type, reason, factsheet_id FROM research_thread_events WHERE event_type = 'factsheet_unmerged'`,
    ).all() as Array<{ event_type: string; reason: string; factsheet_id: string }>;
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].reason).toBe('Wrong person');
    expect(auditEvents[0].factsheet_id).toBe('fs1');
  });

  it('refuses non-promoted factsheets', async () => {
    client().prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES ('fs2', 'Draft FS', 'draft', 'u', '2026-05-24', '2026-05-24')`,
    ).run();

    await expect(
      unmergeFactsheet(db as any, { factsheetId: 'fs2', reason: 'r', actorId: 'u1' }),
    ).rejects.toThrow(/not in promoted state|FactsheetNotPromoted/);
  });

  it('refuses dirty persons (event edited after promotion)', async () => {
    seedPromoted('fs3', 'p3', '2026-05-24T10:00:00.000Z');
    client().prepare(
      `UPDATE events SET updated_at = '2026-05-24T11:00:00.000Z' WHERE person_id = 'p3'`,
    ).run();

    await expect(
      unmergeFactsheet(db as any, { factsheetId: 'fs3', reason: 'r', actorId: 'u1' }),
    ).rejects.toThrow(/dirty|edited since promotion/i);
  });

  it('refuses cluster-promoted factsheets', async () => {
    seedPromoted('fs4', 'p4', '2026-05-24T10:00:00.000Z');
    seedPromoted('fs5', 'p5', '2026-05-24T10:00:02.000Z');
    client().prepare(
      `INSERT INTO families (id, partner1_id, partner2_id, validation_status, created_at, updated_at)
       VALUES ('fam1', 'p4', 'p5', 'confirmed', '2026-05-24T10:00:02.500Z', '2026-05-24T10:00:02.500Z')`,
    ).run();

    await expect(
      unmergeFactsheet(db as any, { factsheetId: 'fs4', reason: 'r', actorId: 'u1' }),
    ).rejects.toThrow(/cluster/i);
  });

  it('isPersonDirtySincePromote returns false when nothing edited', async () => {
    seedPromoted('fs6', 'p6', '2026-05-24T10:00:00.000Z');
    const dirty = await isPersonDirtySincePromote(
      db as any,
      'p6',
      '2026-05-24T10:00:00.000Z',
    );
    expect(dirty).toBe(false);
  });

  it('isPersonDirtySincePromote returns true when events updated after promotion', async () => {
    seedPromoted('fs7', 'p7', '2026-05-24T10:00:00.000Z');
    client().prepare(
      `UPDATE events SET updated_at = '2026-05-24T11:00:00.000Z' WHERE person_id = 'p7'`,
    ).run();
    const dirty = await isPersonDirtySincePromote(
      db as any,
      'p7',
      '2026-05-24T10:00:00.000Z',
    );
    expect(dirty).toBe(true);
  });

  it('isClusterPromoted detects ±5s window membership', async () => {
    seedPromoted('fs8', 'p8', '2026-05-24T10:00:00.000Z');
    seedPromoted('fs9', 'p9', '2026-05-24T10:00:03.000Z');
    client().prepare(
      `INSERT INTO families (id, partner1_id, partner2_id, validation_status, created_at, updated_at)
       VALUES ('fam2', 'p8', 'p9', 'confirmed', '2026-05-24T10:00:03.500Z', '2026-05-24T10:00:03.500Z')`,
    ).run();
    expect(await isClusterPromoted(db as any, 'fs8')).toBe(true);
    expect(await isClusterPromoted(db as any, 'fs9')).toBe(true);
  });

  it('persists thread_id when provided', async () => {
    client().prepare(
      `INSERT INTO research_threads (id, title, created_by, created_at, updated_at)
       VALUES ('t1', 'T', 'u', '2026-05-24', '2026-05-24')`,
    ).run();
    seedPromoted('fs10', 'p10', '2026-05-24T10:00:00.000Z');
    await unmergeFactsheet(db as any, {
      factsheetId: 'fs10',
      reason: 'r',
      actorId: 'u1',
      threadId: 't1',
    });
    const ev = client().prepare(
      `SELECT thread_id FROM research_thread_events WHERE event_type = 'factsheet_unmerged' AND factsheet_id = 'fs10'`,
    ).get() as { thread_id: string };
    expect(ev.thread_id).toBe('t1');
  });
});
