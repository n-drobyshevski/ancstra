import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { rebuildAllSummaries, rebuildClosureTable } from '@ancstra/db';
import { queryTreeTableRows } from '../../lib/persons/query-tree-table-rows';
import type { TreeTableFilters } from '../../lib/tree/search-params';

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
    CREATE TABLE ancestor_paths (
      ancestor_id TEXT NOT NULL,
      descendant_id TEXT NOT NULL,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id)
    );
    CREATE TABLE person_summary (
      person_id TEXT PRIMARY KEY,
      given_name TEXT NOT NULL DEFAULT '',
      surname TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL,
      is_living INTEGER NOT NULL,
      birth_date TEXT, death_date TEXT,
      birth_date_sort INTEGER, death_date_sort INTEGER,
      birth_place TEXT, death_place TEXT,
      spouse_count INTEGER NOT NULL DEFAULT 0,
      child_count INTEGER NOT NULL DEFAULT 0,
      parent_count INTEGER NOT NULL DEFAULT 0,
      has_name INTEGER NOT NULL DEFAULT 0,
      has_birth_event INTEGER NOT NULL DEFAULT 0,
      has_birth_place INTEGER NOT NULL DEFAULT 0,
      has_death_event INTEGER NOT NULL DEFAULT 0,
      has_source INTEGER NOT NULL DEFAULT 0,
      sources_count INTEGER NOT NULL DEFAULT 0,
      completeness INTEGER NOT NULL DEFAULT 0,
      validation TEXT NOT NULL DEFAULT 'confirmed',
      updated_at_sort TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  return drizzle(sqlite, { schema }) as any;
}

let db: any;

const baseFilters: TreeTableFilters = {
  q: '',
  sex: [],
  living: [],
  sort: 'name',
  dir: 'asc',
  hide: [],
  page: 1,
  size: 100,
  topologyAnchor: '',
  topologyMode: 'all',
  validation: [],
  bornFrom: null,
  bornTo: null,
  diedFrom: null,
  diedTo: null,
  place: '',
  placeScope: 'birth',
  citations: 'any',
  hasProposals: false,
  complGte: null,
};

function p(id: string, opts: { sex?: string; isLiving?: number } = {}) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, ${opts.sex ?? 'U'}, ${opts.isLiving ?? 1}, 'private', ${NOW}, ${NOW})`);
}
function n(personId: string, given: string, surname: string) {
  db.run(sql`INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (${personId + '-n'}, ${personId}, ${given}, ${surname}, 1, ${NOW})`);
}
function evRow(id: string, personId: string, type: string, opts: { dateSort?: number; placeText?: string; dateOriginal?: string } = {}) {
  db.run(sql`INSERT INTO events (id, event_type, date_original, date_sort, place_text, person_id, created_at, updated_at) VALUES (${id}, ${type}, ${opts.dateOriginal ?? null}, ${opts.dateSort ?? null}, ${opts.placeText ?? null}, ${personId}, ${NOW}, ${NOW})`);
}
function fam(id: string, p1: string | null, p2: string | null, status: string = 'confirmed') {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${p1}, ${p2}, 'married', ${status}, ${NOW}, ${NOW})`);
}
function child(id: string, familyId: string, personId: string) {
  db.run(sql`INSERT INTO children (id, family_id, person_id, created_at) VALUES (${id}, ${familyId}, ${personId}, ${NOW})`);
}
function srcCit(citId: string, personId: string) {
  const sId = 's-' + citId;
  db.run(sql`INSERT INTO sources (id, title, created_at, updated_at) VALUES (${sId}, 'src', ${NOW}, ${NOW})`);
  db.run(sql`INSERT INTO source_citations (id, source_id, person_id, confidence, created_at) VALUES (${citId}, ${sId}, ${personId}, 'medium', ${NOW})`);
}
function pr(id: string, p1: string, p2: string, status: string = 'pending') {
  db.run(sql`INSERT INTO proposed_relationships (id, relationship_type, person1_id, person2_id, source_type, status, created_at, updated_at) VALUES (${id}, 'parent_child', ${p1}, ${p2}, 'ai_suggestion', ${status}, ${NOW}, ${NOW})`);
}

async function list(filters: TreeTableFilters) {
  await rebuildAllSummaries(db);
  await rebuildClosureTable(db);
  return queryTreeTableRows(db, filters);
}

beforeEach(() => { db = createTestDb(); });

describe('queryTreeTableRows', () => {
  it('returns empty when no persons', async () => {
    const r = await list(baseFilters);
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.relationships).toEqual({ parents: {}, spouses: {} });
  });

  it('returns rows sorted by name asc by default', async () => {
    p('p1'); n('p1', 'Alice', 'Zulu');
    p('p2'); n('p2', 'Bob', 'Aaron');
    p('p3'); n('p3', 'Carol', 'Mason');
    const r = await list(baseFilters);
    expect(r.total).toBe(3);
    expect(r.items.map((it) => it.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('filters by sex', async () => {
    p('p1', { sex: 'F' }); n('p1', 'A', 'A');
    p('p2', { sex: 'M' }); n('p2', 'B', 'B');
    const r = await list({ ...baseFilters, sex: ['F'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by living=living', async () => {
    p('p1', { isLiving: 1 }); n('p1', 'A', 'A');
    p('p2', { isLiving: 0 }); n('p2', 'B', 'B');
    const r = await list({ ...baseFilters, living: ['living'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('filters by living=deceased', async () => {
    p('p1', { isLiving: 1 }); n('p1', 'A', 'A');
    p('p2', { isLiving: 0 }); n('p2', 'B', 'B');
    const r = await list({ ...baseFilters, living: ['deceased'] });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p2');
  });

  it('intersects with FTS when q is non-empty', async () => {
    p('p1'); n('p1', 'Alice', 'Smith');
    p('p2'); n('p2', 'Bob', 'Brown');
    const r = await list({ ...baseFilters, q: 'Alice' });
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('returns empty when FTS finds no match', async () => {
    p('p1'); n('p1', 'Alice', 'Smith');
    const r = await list({ ...baseFilters, q: 'Zxqvnm' });
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('paginates with stable order across pages', async () => {
    for (let i = 0; i < 25; i++) {
      const id = `p${String(i).padStart(2, '0')}`;
      p(id);
      n(id, 'X', `Surname-${id}`);
    }
    const page1 = await list({ ...baseFilters, page: 1, size: 100 });
    expect(page1.total).toBe(25);
    expect(page1.items).toHaveLength(25);
    // Past-the-end pages return no rows; total is undefined since count() OVER ()
    // can only be read from a returned row. The infinite-scroll caller knows
    // hasMore from page1's total and won't request beyond that.
    const page2 = await list({ ...baseFilters, page: 2, size: 100 });
    expect(page2.items).toHaveLength(0);
  });

  it('paginates correctly with the smallest allowed page size', async () => {
    for (let i = 0; i < 125; i++) {
      const id = `p${String(i).padStart(3, '0')}`;
      p(id);
      n(id, 'X', `Surname-${id}`);
    }
    const page1 = await list({ ...baseFilters, page: 1, size: 50 });
    const page2 = await list({ ...baseFilters, page: 2, size: 50 });
    const page3 = await list({ ...baseFilters, page: 3, size: 50 });
    expect(page1.items).toHaveLength(50);
    expect(page2.items).toHaveLength(50);
    expect(page3.items).toHaveLength(25);
    const ids = new Set([
      ...page1.items.map((i) => i.id),
      ...page2.items.map((i) => i.id),
      ...page3.items.map((i) => i.id),
    ]);
    expect(ids.size).toBe(125);
  });

  it('sorts by lifespan asc with NULLS LAST', async () => {
    p('p1'); n('p1', 'A', 'A');
    p('p2'); n('p2', 'B', 'B'); evRow('e2', 'p2', 'birth', { dateSort: 19000101 });
    p('p3'); n('p3', 'C', 'C'); evRow('e3', 'p3', 'birth', { dateSort: 18500101 });
    const r = await list({ ...baseFilters, sort: 'lifespan', dir: 'asc' });
    expect(r.items.map((it) => it.id)).toEqual(['p3', 'p2', 'p1']);
  });

  it('sorts by children desc using denormalized child_count', async () => {
    p('dad'); n('dad', 'Dad', 'X');
    p('mom'); n('mom', 'Mom', 'X');
    p('c1'); n('c1', 'C1', 'X');
    p('c2'); n('c2', 'C2', 'X');
    fam('f1', 'dad', null);
    child('cl1', 'f1', 'c1');
    child('cl2', 'f1', 'c2');
    const r = await list({ ...baseFilters, sort: 'children', dir: 'desc' });
    expect(r.items[0].id).toBe('dad');
    expect(r.items[0].childCount).toBe(2);
  });

  it('populates childCount on every row', async () => {
    p('parent'); n('parent', 'Parent', 'X');
    p('kid'); n('kid', 'Kid', 'X');
    fam('f1', 'parent', null);
    child('cl1', 'f1', 'kid');
    const r = await list(baseFilters);
    const parent = r.items.find((i) => i.id === 'parent')!;
    const kid = r.items.find((i) => i.id === 'kid')!;
    expect(parent.childCount).toBe(1);
    expect(kid.childCount).toBe(0);
  });

  it('returns parent names for the visible page', async () => {
    p('dad'); n('dad', 'John', 'Doe');
    p('mom'); n('mom', 'Jane', 'Doe');
    p('kid'); n('kid', 'Junior', 'Doe');
    fam('f1', 'dad', 'mom');
    child('cl1', 'f1', 'kid');
    const r = await list(baseFilters);
    expect(r.relationships.parents['kid']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dad', name: 'John Doe' }),
        expect.objectContaining({ id: 'mom', name: 'Jane Doe' }),
      ]),
    );
    expect(r.relationships.parents['kid']).toHaveLength(2);
    expect(r.relationships.parents['dad']).toBeUndefined();
  });

  it('returns spouse names for the visible page', async () => {
    p('dad'); n('dad', 'John', 'Doe');
    p('mom'); n('mom', 'Jane', 'Doe');
    fam('f1', 'dad', 'mom');
    const r = await list(baseFilters);
    expect(r.relationships.spouses['dad']).toEqual([
      expect.objectContaining({ id: 'mom', name: 'Jane Doe' }),
    ]);
    expect(r.relationships.spouses['mom']).toEqual([
      expect.objectContaining({ id: 'dad', name: 'John Doe' }),
    ]);
  });

  it('excludes soft-deleted persons', async () => {
    p('p1'); n('p1', 'A', 'A');
    p('p2'); n('p2', 'B', 'B');
    db.run(sql`UPDATE persons SET deleted_at = ${NOW} WHERE id = 'p2'`);
    const r = await list(baseFilters);
    expect(r.total).toBe(1);
    expect(r.items[0].id).toBe('p1');
  });

  it('excludes deleted families when computing relationships', async () => {
    p('dad'); n('dad', 'John', 'Doe');
    p('mom'); n('mom', 'Jane', 'Doe');
    fam('f1', 'dad', 'mom');
    db.run(sql`UPDATE families SET deleted_at = ${NOW} WHERE id = 'f1'`);
    const r = await list(baseFilters);
    expect(r.relationships.spouses['dad']).toBeUndefined();
  });

  describe('topology pushdown', () => {
    // Build a 3-generation lineage: grandparent → parent → kid (+ a sibling
    // and an unrelated outsider to verify exclusion).
    function seedThreeGenerations() {
      p('gp'); n('gp', 'GP', 'Doe');
      p('par'); n('par', 'Par', 'Doe');
      p('kid'); n('kid', 'Kid', 'Doe');
      p('sib'); n('sib', 'Sib', 'Doe');
      p('outsider'); n('outsider', 'Out', 'Sider');
      // gp is parent in family f1 with no spouse; par is the child
      fam('f1', 'gp', null);
      child('cl1', 'f1', 'par');
      // par is parent in family f2; kid + sib are children
      fam('f2', 'par', null);
      child('cl2', 'f2', 'kid');
      child('cl3', 'f2', 'sib');
    }

    it('ancestors mode restricts to anchor + ancestors', async () => {
      seedThreeGenerations();
      const r = await list({
        ...baseFilters,
        topologyAnchor: 'kid',
        topologyMode: 'ancestors',
      });
      const ids = new Set(r.items.map((it) => it.id));
      expect(ids).toEqual(new Set(['kid', 'par', 'gp']));
      expect(r.total).toBe(3);
    });

    it('descendants mode restricts to anchor + descendants', async () => {
      seedThreeGenerations();
      const r = await list({
        ...baseFilters,
        topologyAnchor: 'gp',
        topologyMode: 'descendants',
      });
      const ids = new Set(r.items.map((it) => it.id));
      expect(ids).toEqual(new Set(['gp', 'par', 'kid', 'sib']));
    });

    it('topology mode all is a no-op even when anchor is set', async () => {
      seedThreeGenerations();
      const r = await list({
        ...baseFilters,
        topologyAnchor: 'kid',
        topologyMode: 'all',
      });
      expect(r.total).toBe(5);
    });

    it('topology with FTS intersects both filters', async () => {
      seedThreeGenerations();
      // Search for 'Sib' — only 'sib' matches FTS, but 'sib' is not an
      // ancestor of 'kid', so the intersection is empty.
      const r = await list({
        ...baseFilters,
        q: 'Sib',
        topologyAnchor: 'kid',
        topologyMode: 'ancestors',
      });
      expect(r.total).toBe(0);
    });

    it('returns empty when topology anchor has no lineage in the requested direction', async () => {
      seedThreeGenerations();
      // gp has no ancestors.
      const r = await list({
        ...baseFilters,
        topologyAnchor: 'gp',
        topologyMode: 'ancestors',
      });
      expect(r.items.map((it) => it.id)).toEqual(['gp']);
    });
  });

  describe('persons-parity filters', () => {
    it('filters by birth year range', async () => {
      p('p1'); n('p1', 'A', 'A'); evRow('e1', 'p1', 'birth', { dateSort: 18900101 });
      p('p2'); n('p2', 'B', 'B'); evRow('e2', 'p2', 'birth', { dateSort: 19200101 });
      p('p3'); n('p3', 'C', 'C'); evRow('e3', 'p3', 'birth', { dateSort: 19500101 });
      const r = await list({ ...baseFilters, bornFrom: 1900, bornTo: 1949 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p2');
    });

    it('filters by death year range', async () => {
      p('p1'); n('p1', 'A', 'A'); evRow('e1', 'p1', 'death', { dateSort: 18900101 });
      p('p2'); n('p2', 'B', 'B'); evRow('e2', 'p2', 'death', { dateSort: 19500101 });
      const r = await list({ ...baseFilters, diedFrom: 1900, diedTo: 1999 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p2');
    });

    it('filters by place birth-only scope', async () => {
      p('p1'); n('p1', 'A', 'A'); evRow('e1', 'p1', 'birth', { placeText: 'Chicago', dateSort: 19000101 });
      p('p2'); n('p2', 'B', 'B'); evRow('e2', 'p2', 'death', { placeText: 'Chicago', dateSort: 19500101 });
      const r = await list({ ...baseFilters, place: 'Chicago', placeScope: 'birth' });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p1');
    });

    it('filters by place any-event scope', async () => {
      p('p1'); n('p1', 'A', 'A'); evRow('e1', 'p1', 'birth', { placeText: 'Chicago', dateSort: 19000101 });
      p('p2'); n('p2', 'B', 'B'); evRow('e2', 'p2', 'death', { placeText: 'Chicago', dateSort: 19500101 });
      const r = await list({ ...baseFilters, place: 'Chicago', placeScope: 'any' });
      expect(r.total).toBe(2);
    });

    it('filters by citations gte1', async () => {
      p('p1'); n('p1', 'A', 'A'); srcCit('c1', 'p1');
      p('p2'); n('p2', 'B', 'B');
      const r = await list({ ...baseFilters, citations: 'gte1' });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p1');
    });

    it('filters by citations gte3', async () => {
      p('p1'); n('p1', 'A', 'A');
      srcCit('c1a', 'p1'); srcCit('c1b', 'p1'); srcCit('c1c', 'p1');
      p('p2'); n('p2', 'B', 'B'); srcCit('c2', 'p2');
      const r = await list({ ...baseFilters, citations: 'gte3' });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p1');
    });

    it('filters by citations none', async () => {
      p('p1'); n('p1', 'A', 'A'); srcCit('c1', 'p1');
      p('p2'); n('p2', 'B', 'B');
      const r = await list({ ...baseFilters, citations: 'none' });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p2');
    });

    it('filters by hasProposals', async () => {
      p('p1'); n('p1', 'A', 'A');
      p('p2'); n('p2', 'B', 'B');
      pr('pr1', 'p1', 'p2', 'pending');
      p('p3'); n('p3', 'C', 'C');
      const r = await list({ ...baseFilters, hasProposals: true });
      expect(r.total).toBe(2);
      expect(new Set(r.items.map((it) => it.id))).toEqual(new Set(['p1', 'p2']));
    });

    it('filters by validation=proposed', async () => {
      p('p1'); n('p1', 'A', 'A'); fam('f1', 'p1', null, 'proposed');
      p('p2'); n('p2', 'B', 'B');
      const r = await list({ ...baseFilters, validation: ['proposed'] });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p1');
    });

    it('filters by complGte', async () => {
      // p1: name only → low completeness
      p('p1'); n('p1', 'A', 'A');
      // p2: name + birth + birth place + death + source → 100
      p('p2'); n('p2', 'B', 'B');
      evRow('e2b', 'p2', 'birth', { dateSort: 19000101, placeText: 'X' });
      evRow('e2d', 'p2', 'death', { dateSort: 19500101 });
      srcCit('c2', 'p2');
      const r = await list({ ...baseFilters, complGte: 80 });
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('p2');
    });
  });

  describe('relationship join elision', () => {
    it('skips parent + spouse lookups when both columns are hidden', async () => {
      p('dad'); n('dad', 'John', 'Doe');
      p('mom'); n('mom', 'Jane', 'Doe');
      p('kid'); n('kid', 'Junior', 'Doe');
      fam('f1', 'dad', 'mom');
      child('cl1', 'f1', 'kid');
      const r = await list({
        ...baseFilters,
        hide: ['parents', 'spouses'],
      });
      expect(r.items).toHaveLength(3);
      // Rows still hydrate — only the relationship maps are empty.
      expect(r.relationships).toEqual({ parents: {}, spouses: {} });
    });

    it('still returns relationships when only parents is hidden', async () => {
      p('dad'); n('dad', 'John', 'Doe');
      p('mom'); n('mom', 'Jane', 'Doe');
      fam('f1', 'dad', 'mom');
      const r = await list({
        ...baseFilters,
        hide: ['parents'],
      });
      // Spouses still surface even though parents are hidden.
      expect(r.relationships.spouses['dad']).toBeDefined();
      expect(r.relationships.spouses['mom']).toBeDefined();
    });
  });
});
