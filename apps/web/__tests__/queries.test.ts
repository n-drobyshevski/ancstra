import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { getTreeData } from '../lib/queries';

const NOW = '2026-04-25T10:00:00.000Z';

function createTestDb(): { db: any; sqlite: Database.Database } {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE person_names (id TEXT PRIMARY KEY, person_id TEXT NOT NULL, name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL, suffix TEXT, nickname TEXT, is_primary INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE families (id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT, relationship_type TEXT NOT NULL DEFAULT 'unknown', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE children (id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL, child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological', relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact', date_end_sort INTEGER, place_text TEXT, description TEXT, person_id TEXT, family_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT, publisher TEXT, publication_date TEXT, repository_name TEXT, repository_url TEXT, source_type TEXT, notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE source_citations (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, citation_detail TEXT, citation_text TEXT, confidence TEXT NOT NULL DEFAULT 'medium', person_id TEXT, event_id TEXT, family_id TEXT, person_name_id TEXT, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE proposed_relationships (id TEXT PRIMARY KEY, relationship_type TEXT NOT NULL, person1_id TEXT NOT NULL, person2_id TEXT NOT NULL, source_type TEXT NOT NULL, source_detail TEXT, confidence REAL, status TEXT NOT NULL DEFAULT 'pending', validated_by TEXT, validated_at TEXT, rejection_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE person_summary (person_id TEXT PRIMARY KEY, given_name TEXT, surname TEXT, sex TEXT, is_living INTEGER, birth_date TEXT, death_date TEXT);
  `);
  return { db: drizzle(sqlite, { schema }) as any, sqlite };
}

let db: any;
let sqlite: Database.Database;

function p(id: string, opts: { sex?: string; isLiving?: number; updatedAt?: string } = {}) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, ${opts.sex ?? 'U'}, ${opts.isLiving ?? 1}, 'private', ${NOW}, ${opts.updatedAt ?? NOW})`);
}
function n(personId: string, given: string, surname: string) {
  db.run(sql`INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (${personId + '-n'}, ${personId}, ${given}, ${surname}, 1, ${NOW})`);
}
function ev(id: string, personId: string, type: string, opts: { dateSort?: number; placeText?: string; dateOriginal?: string } = {}) {
  db.run(sql`INSERT INTO events (id, event_type, date_original, date_sort, place_text, person_id, created_at, updated_at) VALUES (${id}, ${type}, ${opts.dateOriginal ?? null}, ${opts.dateSort ?? null}, ${opts.placeText ?? null}, ${personId}, ${NOW}, ${NOW})`);
}
function srcCit(citId: string, personId: string) {
  const sId = 's-' + citId;
  db.run(sql`INSERT INTO sources (id, title, created_at, updated_at) VALUES (${sId}, 'src', ${NOW}, ${NOW})`);
  db.run(sql`INSERT INTO source_citations (id, source_id, person_id, confidence, created_at) VALUES (${citId}, ${sId}, ${personId}, 'medium', ${NOW})`);
}
function summary(personId: string, opts: { givenName?: string; surname?: string; sex?: string; isLiving?: number; birthDate?: string | null; deathDate?: string | null } = {}) {
  db.run(sql`INSERT INTO person_summary (person_id, given_name, surname, sex, is_living, birth_date, death_date) VALUES (${personId}, ${opts.givenName ?? ''}, ${opts.surname ?? ''}, ${opts.sex ?? 'U'}, ${opts.isLiving ?? 1}, ${opts.birthDate ?? null}, ${opts.deathDate ?? null})`);
}

beforeEach(() => {
  const created = createTestDb();
  db = created.db;
  sqlite = created.sqlite;
});

describe('getTreeData', () => {
  it('returns empty arrays when no persons', async () => {
    const r = await getTreeData(db);
    expect(r.persons).toEqual([]);
    expect(r.families).toEqual([]);
    expect(r.childLinks).toEqual([]);
  });

  it('renormalizes completeness for effective-living persons (all 4 applicable hit = 100)', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Living', 'Person');
    ev('e-b', 'p1', 'birth', { dateOriginal: '1990', dateSort: 19900101, placeText: 'Berlin' });
    srcCit('c1', 'p1');
    summary('p1', { givenName: 'Living', surname: 'Person', isLiving: 1, birthDate: '1990' });

    const r = await getTreeData(db);
    expect(r.persons).toHaveLength(1);
    const person = r.persons[0];
    expect(person.id).toBe('p1');
    expect(person.completeness).toBe(100); // 85 raw / 85 max
    expect(person.hasName).toBe(true);
    expect(person.hasBirthEvent).toBe(true);
    expect(person.hasBirthPlace).toBe(true);
    expect(person.hasDeathEvent).toBe(false);
    expect(person.hasSource).toBe(true);
    expect(person.birthPlace).toBe('Berlin');
  });

  it('renormalizes effective-living with name only to score 24', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Lonely', 'Person');
    summary('p1', { givenName: 'Lonely', surname: 'Person', isLiving: 1 });

    const r = await getTreeData(db);
    expect(r.persons[0].completeness).toBe(24); // round(20*100/85)
  });

  it('returns 100 for effective-deceased with all 5 dimensions hit', async () => {
    p('p1', { isLiving: 0 });
    n('p1', 'Dead', 'Person');
    ev('e-b', 'p1', 'birth', { dateSort: 19000101, placeText: 'Paris' });
    ev('e-d', 'p1', 'death', { dateSort: 19500101 });
    srcCit('c1', 'p1');
    summary('p1', { givenName: 'Dead', surname: 'Person', isLiving: 0, birthDate: '1900', deathDate: '1950' });

    const r = await getTreeData(db);
    expect(r.persons[0].completeness).toBe(100);
    expect(r.persons[0].hasDeathEvent).toBe(true);
  });

  it('treats is_living=1 with death event as effective-deceased (no overflow)', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Edge', 'Case');
    ev('e-b', 'p1', 'birth', { dateSort: 18000101, placeText: 'X' });
    ev('e-d', 'p1', 'death', { dateSort: 18800101 });
    srcCit('c1', 'p1');
    summary('p1', { givenName: 'Edge', surname: 'Case', isLiving: 1, birthDate: '1800', deathDate: '1880' });

    const r = await getTreeData(db);
    // is_living=1 + death event => effective-deceased path => raw 100 (not 117 overflow)
    expect(r.persons[0].completeness).toBe(100);
  });

  it('surfaces birth_place from the earliest birth event', async () => {
    p('p1');
    n('p1', 'Place', 'Person');
    ev('e-b', 'p1', 'birth', { dateSort: 19500101, placeText: 'Lisbon' });
    summary('p1', { givenName: 'Place', surname: 'Person', isLiving: 1 });

    const r = await getTreeData(db);
    expect(r.persons[0].birthPlace).toBe('Lisbon');
  });

  it('excludes soft-deleted persons', async () => {
    p('p1');
    n('p1', 'Soft', 'Deleted');
    summary('p1', { givenName: 'Soft', surname: 'Deleted' });
    sqlite.prepare(`UPDATE persons SET deleted_at = '2025-06-01T00:00:00Z' WHERE id = 'p1'`).run();

    const r = await getTreeData(db);
    expect(r.persons).toEqual([]);
  });
});
