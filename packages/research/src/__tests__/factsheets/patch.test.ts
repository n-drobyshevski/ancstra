import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import {
  computePatchDiff,
  applyPatchDiff,
  LegacyPromotionNotPatchableError,
  type PatchDiff,
} from '../../factsheets/patch';

// Bootstrap covers persons, factsheets, research_facts, research_items, events
// (with source_factsheet_id + description + date_sort), sources, source_citations.
// Mirrors unmerge.test.ts shape but extended for Bundle C's patch flow.
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
    description TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    source_factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    repository_url TEXT,
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
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'collected',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
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
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
  seedBaseline();
});

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

/**
 * Seeds factsheet F1 promoted to person P1 with one tracked birth event E1.
 * The event uses source_factsheet_id='F1' so the legacy guard is satisfied.
 */
function seedBaseline() {
  const ts = '2026-05-24T10:00:00.000Z';
  client()
    .prepare(
      `INSERT INTO persons (id, created_by, created_at, updated_at)
       VALUES ('P1', 'u', ?, ?)`,
    )
    .run(ts, ts);
  client()
    .prepare(
      `INSERT INTO factsheets
         (id, title, status, promoted_person_id, promoted_at, created_by, created_at, updated_at)
       VALUES ('F1', 'Test FS', 'promoted', 'P1', ?, 'u', ?, ?)`,
    )
    .run(ts, ts, ts);
  client()
    .prepare(
      `INSERT INTO events
         (id, person_id, event_type, date_original, date_sort, place_text, source_factsheet_id, created_at, updated_at)
       VALUES ('E1', 'P1', 'birth', '12 March 1887', 18870312, 'St. Petersburg', 'F1', ?, ?)`,
    )
    .run(ts, ts);
}

/** Helper: insert an accepted research_fact onto F1. */
function addFact(opts: {
  id: string;
  factType: string;
  factValue: string;
  factDateSort?: number | null;
  accepted?: number | null;
  researchItemId?: string | null;
  sourceCitationId?: string | null;
}) {
  const ts = '2026-05-24T10:05:00.000Z';
  client()
    .prepare(
      `INSERT INTO research_facts
         (id, fact_type, fact_value, fact_date_sort, factsheet_id, accepted,
          research_item_id, source_citation_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'F1', ?, ?, ?, ?, ?)`,
    )
    .run(
      opts.id,
      opts.factType,
      opts.factValue,
      opts.factDateSort ?? null,
      opts.accepted === undefined ? 1 : opts.accepted,
      opts.researchItemId ?? null,
      opts.sourceCitationId ?? null,
      ts,
      ts,
    );
}

describe('computePatchDiff', () => {
  it('classifies a birth_place change as a modified event', async () => {
    addFact({
      id: 'rf-bd',
      factType: 'birth_date',
      factValue: '12 March 1887',
      factDateSort: 18870312,
    });
    addFact({ id: 'rf-bp', factType: 'birth_place', factValue: 'Moscow' });

    const diff = await computePatchDiff(db as any, 'F1');

    expect(diff.events.added).toHaveLength(0);
    expect(diff.events.modified).toHaveLength(1);
    expect(diff.events.modified[0].eventId).toBe('E1');
    expect(diff.events.modified[0].eventType).toBe('birth');
    const placeDelta = diff.events.modified[0].deltas.find((d) => d.field === 'placeText');
    expect(placeDelta).toBeDefined();
    expect(placeDelta!.before).toBe('St. Petersburg');
    expect(placeDelta!.after).toBe('Moscow');
  });

  it('classifies a new event_type as added', async () => {
    addFact({
      id: 'rf-dd',
      factType: 'death_date',
      factValue: '5 January 1950',
      factDateSort: 19500105,
    });

    const diff = await computePatchDiff(db as any, 'F1');

    expect(diff.events.added).toHaveLength(1);
    expect(diff.events.added[0].eventType).toBe('death');
    expect(diff.events.added[0].dateOriginal).toBe('5 January 1950');
    expect(diff.events.added[0].dateSort).toBe(19500105);
  });

  it('classifies identical facts as unchanged', async () => {
    addFact({
      id: 'rf-bd',
      factType: 'birth_date',
      factValue: '12 March 1887',
      factDateSort: 18870312,
    });
    addFact({
      id: 'rf-bp',
      factType: 'birth_place',
      factValue: 'St. Petersburg',
    });

    const diff = await computePatchDiff(db as any, 'F1');

    expect(diff.events.modified).toHaveLength(0);
    expect(diff.events.added).toHaveLength(0);
    expect(diff.events.unchanged).toContain('E1');
  });

  it('skips rejected (accepted=0) facts', async () => {
    addFact({
      id: 'rf-dd-rejected',
      factType: 'death_date',
      factValue: '5 January 1950',
      factDateSort: 19500105,
      accepted: 0,
    });

    const diff = await computePatchDiff(db as any, 'F1');

    expect(diff.events.added).toHaveLength(0);
    expect(diff.events.modified).toHaveLength(0);
  });

  it('throws LegacyPromotionNotPatchableError when person events have NULL source_factsheet_id', async () => {
    client()
      .prepare(`UPDATE events SET source_factsheet_id = NULL WHERE id = 'E1'`)
      .run();

    await expect(computePatchDiff(db as any, 'F1')).rejects.toBeInstanceOf(
      LegacyPromotionNotPatchableError,
    );
  });
});

describe('applyPatchDiff', () => {
  it('inserts added events with source_factsheet_id set', async () => {
    const diff: PatchDiff = {
      factsheetId: 'F1',
      personId: 'P1',
      events: {
        added: [
          {
            eventType: 'death',
            dateOriginal: '5 January 1950',
            dateSort: 19500105,
            placeText: 'Paris',
            description: null,
          },
        ],
        modified: [],
        unchanged: ['E1'],
      },
      citations: { added: [], unchanged: [] },
    };

    await db.run(sql`BEGIN`);
    const counts = await applyPatchDiff(db as any, diff, { actorId: 'u' });
    await db.run(sql`COMMIT`);

    expect(counts.eventsAdded).toBe(1);

    const rows = client()
      .prepare(
        `SELECT event_type, source_factsheet_id, date_original, place_text
         FROM events WHERE person_id = 'P1' AND event_type = 'death'`,
      )
      .all() as Array<{
      event_type: string;
      source_factsheet_id: string | null;
      date_original: string | null;
      place_text: string | null;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].source_factsheet_id).toBe('F1');
    expect(rows[0].date_original).toBe('5 January 1950');
    expect(rows[0].place_text).toBe('Paris');
  });

  it('preserves event IDs on modified events', async () => {
    const diff: PatchDiff = {
      factsheetId: 'F1',
      personId: 'P1',
      events: {
        added: [],
        modified: [
          {
            eventId: 'E1',
            eventType: 'birth',
            deltas: [
              {
                field: 'placeText',
                before: 'St. Petersburg',
                after: 'Moscow',
              },
            ],
          },
        ],
        unchanged: [],
      },
      citations: { added: [], unchanged: [] },
    };

    await db.run(sql`BEGIN`);
    const counts = await applyPatchDiff(db as any, diff, { actorId: 'u' });
    await db.run(sql`COMMIT`);

    expect(counts.eventsModified).toBe(1);

    const row = client()
      .prepare(`SELECT id, place_text FROM events WHERE id = 'E1'`)
      .get() as { id: string; place_text: string };
    expect(row.id).toBe('E1');
    expect(row.place_text).toBe('Moscow');
  });

  it('updates factsheet.promoted_at on success', async () => {
    const before = (
      client().prepare(`SELECT promoted_at FROM factsheets WHERE id = 'F1'`).get() as {
        promoted_at: string;
      }
    ).promoted_at;

    // Ensure clock moves past 'before'.
    await new Promise((r) => setTimeout(r, 10));
    const now = new Date().toISOString();
    expect(now).not.toBe(before);

    const emptyDiff: PatchDiff = {
      factsheetId: 'F1',
      personId: 'P1',
      events: { added: [], modified: [], unchanged: [] },
      citations: { added: [], unchanged: [] },
    };

    await db.run(sql`BEGIN`);
    await applyPatchDiff(db as any, emptyDiff, { actorId: 'u', now });
    await db.run(sql`COMMIT`);

    const after = (
      client().prepare(`SELECT promoted_at FROM factsheets WHERE id = 'F1'`).get() as {
        promoted_at: string;
      }
    ).promoted_at;
    expect(after).not.toBe(before);
    expect(after).toBe(now);
  });
});
