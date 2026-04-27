import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { queryPersonsList } from '../../lib/persons/query-persons-list';
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

describe('queryPersonsList', () => {
  it('returns empty when no persons', async () => {
    const r = await queryPersonsList(db, baseFilters);
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('returns all persons with default filters, sorted by updated_at desc', async () => {
    p('p1', { updatedAt: '2026-01-01T00:00:00.000Z' }); n('p1', 'Alice', 'Aaron');
    p('p2', { updatedAt: '2026-04-01T00:00:00.000Z' }); n('p2', 'Bob', 'Brown');
    p('p3', { updatedAt: '2026-02-01T00:00:00.000Z' }); n('p3', 'Carol', 'Carter');
    const r = await queryPersonsList(db, baseFilters);
    expect(r.total).toBe(3);
    expect(r.items.map(it => it.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('filters by sex', async () => {
    p('p1', { sex: 'F' }); n('p1', 'A', 'A');
    p('p2', { sex: 'M' }); n('p2', 'B', 'B');
    const r = await queryPersonsList(db, { ...baseFilters, sex: ['F'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by living=alive', async () => {
    p('p1', { isLiving: 1 }); n('p1', 'A', 'A');
    p('p2', { isLiving: 0 }); n('p2', 'B', 'B');
    const r = await queryPersonsList(db, { ...baseFilters, living: ['alive'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by birth year range', async () => {
    p('p1'); n('p1', 'A', 'A'); ev('e1', 'p1', 'birth', { dateSort: 18900101 });
    p('p2'); n('p2', 'B', 'B'); ev('e2', 'p2', 'birth', { dateSort: 19200101 });
    p('p3'); n('p3', 'C', 'C'); ev('e3', 'p3', 'birth', { dateSort: 19500101 });
    const r = await queryPersonsList(db, { ...baseFilters, bornFrom: 1900, bornTo: 1949 });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p2');
  });

  it('filters by place birth-only scope', async () => {
    p('p1'); n('p1', 'A', 'A'); ev('e1', 'p1', 'birth', { placeText: 'Chicago', dateSort: 19000101 });
    p('p2'); n('p2', 'B', 'B'); ev('e2', 'p2', 'death', { placeText: 'Chicago', dateSort: 19500101 });
    const r = await queryPersonsList(db, { ...baseFilters, place: 'Chicago', placeScope: 'birth' });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by place any-event scope', async () => {
    p('p1'); n('p1', 'A', 'A'); ev('e1', 'p1', 'birth', { placeText: 'Chicago', dateSort: 19000101 });
    p('p2'); n('p2', 'B', 'B'); ev('e2', 'p2', 'death', { placeText: 'Chicago', dateSort: 19500101 });
    const r = await queryPersonsList(db, { ...baseFilters, place: 'Chicago', placeScope: 'any' });
    expect(r.total).toBe(2);
  });

  it('filters by citations gte1', async () => {
    p('p1'); n('p1', 'A', 'A'); srcCit('c1', 'p1');
    p('p2'); n('p2', 'B', 'B');
    const r = await queryPersonsList(db, { ...baseFilters, citations: 'gte1' });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by hasProposals=true', async () => {
    p('p1'); n('p1', 'A', 'A');
    p('p2'); n('p2', 'B', 'B');
    pr('pr1', 'p1', 'p2', 'pending');
    p('p3'); n('p3', 'C', 'C');
    const r = await queryPersonsList(db, { ...baseFilters, hasProposals: true });
    expect(r.total).toBe(2);
    expect(new Set(r.items.map(it => it.id))).toEqual(new Set(['p1', 'p2']));
  });

  it('filters by validation=proposed', async () => {
    p('p1'); n('p1', 'A', 'A'); fam('f1', 'p1', null, 'proposed');
    p('p2'); n('p2', 'B', 'B');
    const r = await queryPersonsList(db, { ...baseFilters, validation: ['proposed'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 25; i++) {
      const id = `p${String(i).padStart(2, '0')}`;
      p(id, { updatedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` });
      n(id, 'X', 'Y');
    }
    const page1 = await queryPersonsList(db, { ...baseFilters, page: 1, size: 20 });
    const page2 = await queryPersonsList(db, { ...baseFilters, page: 2, size: 20 });
    expect(page1.total).toBe(25);
    expect(page1.items).toHaveLength(20);
    expect(page2.items).toHaveLength(5);
  });

  it('sorts by name asc', async () => {
    p('p1'); n('p1', 'Alice', 'Zulu');
    p('p2'); n('p2', 'Bob', 'Aaron');
    p('p3'); n('p3', 'Carol', 'Mason');
    const r = await queryPersonsList(db, { ...baseFilters, sort: 'name', dir: 'asc' });
    expect(r.items.map(it => it.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('sorts by completeness desc', async () => {
    p('p1'); n('p1', 'A', 'A');
    p('p2'); n('p2', 'B', 'B'); ev('e2', 'p2', 'birth', { dateSort: 19000101 });
    p('p3'); n('p3', 'C', 'C');
    ev('e3', 'p3', 'birth', { dateSort: 19000101, placeText: 'Paris' });
    ev('e4', 'p3', 'death', { dateSort: 19500101 });
    srcCit('c3', 'p3');
    const r = await queryPersonsList(db, { ...baseFilters, sort: 'compl', dir: 'desc' });
    expect(r.items.map(it => it.id)).toEqual(['p3', 'p2', 'p1']);
  });

  it('sorts by born asc with NULLS LAST', async () => {
    p('p1'); n('p1', 'A', 'A'); // no birth event → born_sort = NULL
    p('p2'); n('p2', 'B', 'B'); ev('e2', 'p2', 'birth', { dateSort: 19000101 });
    p('p3'); n('p3', 'C', 'C'); ev('e3', 'p3', 'birth', { dateSort: 18500101 });
    const r = await queryPersonsList(db, { ...baseFilters, sort: 'born', dir: 'asc' });
    expect(r.items.map(it => it.id)).toEqual(['p3', 'p2', 'p1']);
  });

  it('returns derived fields on each item', async () => {
    p('p1'); n('p1', 'Alice', 'Smith');
    ev('e1', 'p1', 'birth', { dateSort: 19030101, placeText: 'Chicago, IL', dateOriginal: '3 Jan 1903' });
    srcCit('c1', 'p1');
    const r = await queryPersonsList(db, baseFilters);
    expect(r.items).toHaveLength(1);
    const item = r.items[0];
    expect(item.id).toBe('p1');
    expect(item.givenName).toBe('Alice');
    expect(item.completeness).toBe(100);
    expect(item.birthDate).toBe('3 Jan 1903');
    expect(item.birthPlace).toBe('Chicago, IL');
    expect(item.sourcesCount).toBe(1);
    expect(item.validation).toBe('confirmed');
  });

  it('computes completeness with all five components', async () => {
    p('p1'); n('p1', 'A', 'B');
    ev('e1', 'p1', 'birth', { placeText: 'X', dateSort: 19000101 });
    ev('e2', 'p1', 'death', { dateSort: 19500101 });
    srcCit('c1', 'p1');
    const r = await queryPersonsList(db, baseFilters);
    expect(r.items[0].completeness).toBe(100);
  });

  it('rolls validation up to proposed when any incoming family is proposed', async () => {
    p('p1'); n('p1', 'A', 'A'); fam('f1', 'p1', null, 'proposed');
    const r = await queryPersonsList(db, baseFilters);
    expect(r.items[0].validation).toBe('proposed');
  });

  it('intersects with FTS when q is non-empty', async () => {
    p('p1'); n('p1', 'Alice', 'Smith');
    p('p2'); n('p2', 'Bob', 'Brown');
    const r = await queryPersonsList(db, { ...baseFilters, q: 'Alice' });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('returns empty when FTS finds no match', async () => {
    p('p1'); n('p1', 'Alice', 'Smith');
    const r = await queryPersonsList(db, { ...baseFilters, q: 'Zxqvnm' });
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('exposes flag fields used by the completeness breakdown', async () => {
    // Person with name + birth event (no place) + source citation, no death.
    p('p-flags', { isLiving: 1 });
    n('p-flags', 'Ada', 'Lovelace');
    ev('e-bf', 'p-flags', 'birth', { dateOriginal: '1815-12-10', dateSort: 18151210 });
    srcCit('c-flags', 'p-flags');

    const result = await queryPersonsList(db, baseFilters);
    const row = result.items.find((i) => i.id === 'p-flags');
    expect(row).toBeDefined();
    expect(row!.hasName).toBe(true);
    expect(row!.hasBirthEvent).toBe(true);
    expect(row!.hasBirthPlace).toBe(false);
    expect(row!.hasDeathEvent).toBe(false);
    expect(row!.hasSource).toBe(true);
    // raw 65, effective-living renormalized: round(65*100/85) = 76
    expect(row!.completeness).toBe(76);
  });

  it('renormalizes completeness for effective-living persons', async () => {
    // All four applicable dimensions hit; living, no death event.
    p('p-living-full', { isLiving: 1 });
    n('p-living-full', 'Living', 'Person');
    ev('e-lf', 'p-living-full', 'birth', { dateOriginal: '1990', dateSort: 19900101, placeText: 'Berlin' });
    srcCit('c-lf', 'p-living-full');

    // is_living=1 AND has_death_event=1 → effective-deceased; full score
    p('p-deceased-with-death', { isLiving: 1 });
    n('p-deceased-with-death', 'Edge', 'Case');
    ev('e-edb', 'p-deceased-with-death', 'birth', { dateSort: 18000101, placeText: 'X' });
    ev('e-edd', 'p-deceased-with-death', 'death', { dateSort: 18800101 });
    srcCit('c-ed', 'p-deceased-with-death');

    const result = await queryPersonsList(db, baseFilters);
    const living = result.items.find((i) => i.id === 'p-living-full')!;
    const deceased = result.items.find((i) => i.id === 'p-deceased-with-death')!;
    expect(living.completeness).toBe(100); // 85 raw / 85 max
    expect(deceased.completeness).toBe(100); // 100 raw / 100 max
  });
});
