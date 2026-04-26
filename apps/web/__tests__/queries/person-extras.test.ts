import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { queryPersonExtras } from '../../lib/queries/person-extras';

const NOW = '2026-04-25T10:00:00.000Z';
const LATER = '2026-04-26T10:00:00.000Z';

// We mirror the cast pattern used in packages/db/src/__tests__/person-summary.test.ts
// so the production-typed Database parameter accepts the better-sqlite3 instance.
function createTestDb(): any {
  const sqlite = new Database(':memory:');
  const ddl = [
    "CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE person_names (id TEXT PRIMARY KEY, person_id TEXT NOT NULL, name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL, suffix TEXT, nickname TEXT, is_primary INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE families (id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT, relationship_type TEXT NOT NULL DEFAULT 'unknown', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE children (id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL, child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological', relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact', date_end_sort INTEGER, place_text TEXT, description TEXT, person_id TEXT, family_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT, publisher TEXT, publication_date TEXT, repository_name TEXT, repository_url TEXT, source_type TEXT, notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);",
    "CREATE TABLE source_citations (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, citation_detail TEXT, citation_text TEXT, confidence TEXT NOT NULL DEFAULT 'medium', person_id TEXT, event_id TEXT, family_id TEXT, person_name_id TEXT, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);",
  ].join('\n');
  sqlite.exec(ddl);
  return drizzle(sqlite, { schema }) as any;
}

let db: any;

beforeEach(() => {
  db = createTestDb();
});

function insertPerson(id: string, opts: { isLiving?: number; updatedAt?: string } = {}) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, 'U', ${opts.isLiving ?? 1}, 'private', ${NOW}, ${opts.updatedAt ?? NOW})`);
}
function insertName(personId: string, given: string, surname: string) {
  db.run(sql`INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (${personId + '-n'}, ${personId}, ${given}, ${surname}, 1, ${NOW})`);
}
function insertEvent(id: string, personId: string, eventType: string, opts: { dateSort?: number; placeText?: string; dateOriginal?: string } = {}) {
  db.run(sql`INSERT INTO events (id, event_type, date_original, date_sort, place_text, person_id, created_at, updated_at) VALUES (${id}, ${eventType}, ${opts.dateOriginal ?? null}, ${opts.dateSort ?? null}, ${opts.placeText ?? null}, ${personId}, ${NOW}, ${NOW})`);
}
function insertSource(id: string) {
  db.run(sql`INSERT INTO sources (id, title, created_at, updated_at) VALUES (${id}, ${'Source ' + id}, ${NOW}, ${NOW})`);
}
function insertCitation(id: string, sourceId: string, personId: string) {
  db.run(sql`INSERT INTO source_citations (id, source_id, person_id, confidence, created_at) VALUES (${id}, ${sourceId}, ${personId}, 'medium', ${NOW})`);
}
function insertFamily(id: string, partner1: string | null, partner2: string | null, status: string = 'confirmed') {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${partner1}, ${partner2}, 'married', ${status}, ${NOW}, ${NOW})`);
}
function insertChild(id: string, familyId: string, personId: string, status: string = 'confirmed') {
  db.run(sql`INSERT INTO children (id, family_id, person_id, validation_status, created_at) VALUES (${id}, ${familyId}, ${personId}, ${status}, ${NOW})`);
}

describe('queryPersonExtras', () => {
  it('returns empty map for empty input', async () => {
    const result = await queryPersonExtras(db, []);
    expect(result.size).toBe(0);
  });

  it('returns sourcesCount per person', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    insertSource('s1');
    insertSource('s2');
    insertCitation('c1', 's1', 'p1');
    insertCitation('c2', 's2', 'p1');
    insertCitation('c3', 's1', 'p1');

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.sourcesCount).toBe(3);
  });

  it('returns birth place from birth event', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    insertEvent('e1', 'p1', 'birth', { placeText: 'Chicago, IL', dateSort: 19030101 });

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.birthPlace).toBe('Chicago, IL');
  });

  it('returns updatedAt from persons row', async () => {
    insertPerson('p1', { updatedAt: LATER });
    insertName('p1', 'Alice', 'Smith');

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.updatedAt).toBe(LATER);
  });

  it('rolls validation up to "proposed" when any incoming family is proposed', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    insertPerson('p2');
    insertName('p2', 'Bob', 'Smith');
    insertFamily('f1', 'p1', 'p2', 'proposed');

    const result = await queryPersonExtras(db, ['p1', 'p2']);

    expect(result.get('p1')?.validation).toBe('proposed');
    expect(result.get('p2')?.validation).toBe('proposed');
  });

  it('rolls validation up to "proposed" when any incoming family is disputed', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    insertFamily('f1', 'p1', null, 'disputed');

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.validation).toBe('proposed');
  });

  it('rolls validation up to "proposed" when any incoming child link is proposed', async () => {
    insertPerson('p1');
    insertName('p1', 'Child', 'X');
    insertFamily('f1', null, null, 'confirmed');
    insertChild('c1', 'f1', 'p1', 'proposed');

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.validation).toBe('proposed');
  });

  it('returns "confirmed" when no incoming proposed/disputed links', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    insertFamily('f1', 'p1', null, 'confirmed');

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.validation).toBe('confirmed');
  });

  it('ignores soft-deleted families when rolling up validation', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');
    db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at, deleted_at) VALUES ('f1', 'p1', NULL, 'married', 'proposed', ${NOW}, ${NOW}, ${NOW})`);

    const result = await queryPersonExtras(db, ['p1']);

    expect(result.get('p1')?.validation).toBe('confirmed');
  });

  it('computes completeness using the documented 20/25/20/15/20 scoring', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');

    insertPerson('p2');
    insertName('p2', 'Bob', 'Jones');
    insertEvent('e2', 'p2', 'birth', { dateSort: 19000101 });

    insertPerson('p3');
    insertName('p3', 'Carol', 'Doe');
    insertEvent('e3', 'p3', 'birth', { placeText: 'Paris', dateSort: 19000101 });
    insertEvent('e4', 'p3', 'death', { dateSort: 19700101 });
    insertSource('s1');
    insertCitation('c1', 's1', 'p3');

    const result = await queryPersonExtras(db, ['p1', 'p2', 'p3']);

    expect(result.get('p1')?.completeness).toBe(20);
    expect(result.get('p2')?.completeness).toBe(45);
    expect(result.get('p3')?.completeness).toBe(100);
  });

  it('returns extras for all requested ids even if persons have no events/sources/links', async () => {
    insertPerson('p1');
    insertName('p1', 'Alice', 'Smith');

    const result = await queryPersonExtras(db, ['p1']);

    const extras = result.get('p1');
    expect(extras).toBeDefined();
    expect(extras?.sourcesCount).toBe(0);
    expect(extras?.completeness).toBe(20);
    expect(extras?.validation).toBe('confirmed');
    expect(extras?.birthPlace).toBeNull();
  });
});
