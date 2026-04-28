import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { queryPersonsForCsvExport } from '../../lib/persons/query-export';
import type { PersonsFilters } from '../../lib/persons/search-params';

const NOW = '2026-04-25T10:00:00.000Z';

function createTestDb(): any {
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
  return drizzle(sqlite, { schema }) as any;
}

let db: any;

const baseFilters: PersonsFilters = {
  q: '', sex: [], living: [], validation: [],
  bornFrom: null, bornTo: null, diedFrom: null, diedTo: null,
  place: '', placeScope: 'birth', citations: 'any',
  hasProposals: false, complGte: null,
  sort: 'edited', dir: 'desc', page: 1, size: 20, hide: [],
};

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
function fam(id: string, p1: string | null, p2: string | null, status: string = 'confirmed') {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${p1}, ${p2}, 'married', ${status}, ${NOW}, ${NOW})`);
}
function pr(id: string, p1: string, p2: string, status: string = 'pending') {
  db.run(sql`INSERT INTO proposed_relationships (id, relationship_type, person1_id, person2_id, source_type, status, created_at, updated_at) VALUES (${id}, 'parent_child', ${p1}, ${p2}, 'ai_suggestion', ${status}, ${NOW}, ${NOW})`);
}

beforeEach(() => { db = createTestDb(); });

describe('queryPersonsForCsvExport', () => {
  it('renormalizes completeness=100 for effective-living with 4 applicable dimensions', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Living', 'Full');
    ev('e-b', 'p1', 'birth', { dateOriginal: '1990', dateSort: 19900101, placeText: 'Berlin' });
    srcCit('c1', 'p1');

    const rows = await queryPersonsForCsvExport(db, baseFilters);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('p1');
    expect(rows[0].completeness).toBe(100); // 85 raw / 85 max
  });

  it('renormalizes effective-living with name only to score 24', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Lonely', 'Person');

    const rows = await queryPersonsForCsvExport(db, baseFilters);
    expect(rows[0].completeness).toBe(24); // round(20*100/85)
  });

  it('returns 100 for effective-deceased with all 5 dimensions hit', async () => {
    p('p1', { isLiving: 0 });
    n('p1', 'Dead', 'Full');
    ev('e-b', 'p1', 'birth', { dateSort: 19000101, placeText: 'Paris' });
    ev('e-d', 'p1', 'death', { dateSort: 19500101 });
    srcCit('c1', 'p1');

    const rows = await queryPersonsForCsvExport(db, baseFilters);
    expect(rows[0].completeness).toBe(100);
  });

  it('treats is_living=1 with death event as effective-deceased', async () => {
    p('p1', { isLiving: 1 });
    n('p1', 'Edge', 'Case');
    ev('e-b', 'p1', 'birth', { dateSort: 18000101, placeText: 'X' });
    ev('e-d', 'p1', 'death', { dateSort: 18800101 });
    srcCit('c1', 'p1');

    const rows = await queryPersonsForCsvExport(db, baseFilters);
    expect(rows[0].completeness).toBe(100);
  });

  it('honors complGte filter', async () => {
    // Living with name only -> 24
    p('p-low', { isLiving: 1 }); n('p-low', 'Low', 'Score');
    // Living with name+birth+place+source -> 100
    p('p-high', { isLiving: 1 }); n('p-high', 'High', 'Score');
    ev('e-b', 'p-high', 'birth', { dateSort: 19900101, placeText: 'Berlin' });
    srcCit('c-high', 'p-high');

    const rows = await queryPersonsForCsvExport(db, { ...baseFilters, complGte: 50 });
    expect(rows.map((r) => r.id)).toEqual(['p-high']);
  });

  it('excludes ids passed via excludeIds', async () => {
    p('p1'); n('p1', 'A', 'A');
    p('p2'); n('p2', 'B', 'B');
    p('p3'); n('p3', 'C', 'C');

    const rows = await queryPersonsForCsvExport(db, baseFilters, ['p2']);
    expect(rows.map((r) => r.id).sort()).toEqual(['p1', 'p3']);
  });

  it('orders rows by surname, given_name, id', async () => {
    p('p1'); n('p1', 'Bob', 'Brown');
    p('p2'); n('p2', 'Alice', 'Brown');
    p('p3'); n('p3', 'Carol', 'Adams');

    const rows = await queryPersonsForCsvExport(db, baseFilters);
    // Adams < Brown; within Brown, Alice < Bob.
    expect(rows.map((r) => r.id)).toEqual(['p3', 'p2', 'p1']);
  });
});
