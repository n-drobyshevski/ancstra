import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { rebuildAllSummaries } from '@ancstra/db';
import { exportPersonsToGedcom } from '../../lib/persons/export-gedcom';
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
    CREATE TABLE person_summary (
      person_id TEXT PRIMARY KEY,
      given_name TEXT NOT NULL DEFAULT '', surname TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL, is_living INTEGER NOT NULL,
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

const baseFilters: PersonsFilters = {
  q: '', sex: [], living: [], validation: [],
  bornFrom: null, bornTo: null, diedFrom: null, diedTo: null,
  place: '', placeScope: 'birth', citations: 'any',
  hasProposals: false, complGte: null,
  sort: 'edited', dir: 'desc', page: 1, size: 20, hide: [],
};

function p(id: string, opts: { isLiving?: number; sex?: string } = {}) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, ${opts.sex ?? 'U'}, ${opts.isLiving ?? 1}, 'private', ${NOW}, ${NOW})`);
}
function n(personId: string, given: string, surname: string) {
  db.run(sql`INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (${personId + '-n'}, ${personId}, ${given}, ${surname}, 1, ${NOW})`);
}
function ev(id: string, personId: string, type: string, opts: { dateOriginal?: string; placeText?: string } = {}) {
  db.run(sql`INSERT INTO events (id, event_type, date_original, place_text, person_id, created_at, updated_at) VALUES (${id}, ${type}, ${opts.dateOriginal ?? null}, ${opts.placeText ?? null}, ${personId}, ${NOW}, ${NOW})`);
}
function fam(id: string, p1: string | null, p2: string | null) {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${p1}, ${p2}, 'married', 'confirmed', ${NOW}, ${NOW})`);
}
function child(id: string, familyId: string, personId: string) {
  db.run(sql`INSERT INTO children (id, family_id, person_id, validation_status, created_at) VALUES (${id}, ${familyId}, ${personId}, 'confirmed', ${NOW})`);
}

// exportPersonsToGedcom relies on queryPersonsForCsvExport which reads from
// person_summary — populate facet columns before each export.
async function gedcomExport(filters: PersonsFilters, excludeIds: readonly string[] = [], explicitIds?: readonly string[]) {
  await rebuildAllSummaries(db);
  return exportPersonsToGedcom(db, filters, excludeIds, explicitIds);
}

beforeEach(() => { db = createTestDb(); });

describe('exportPersonsToGedcom', () => {
  it('produces a minimal valid GEDCOM 5.5.1 file when no persons match', async () => {
    const result = await gedcomExport(baseFilters, [], undefined);
    expect(result).toContain('0 HEAD');
    expect(result).toContain('1 SOUR Ancstra');
    expect(result).toContain('2 VERS 5.5.1');
  });

  it('emits INDI for a single matched person', async () => {
    p('p1', { isLiving: 0 }); n('p1', 'Alice', 'Smith');
    ev('e1', 'p1', 'birth', { dateOriginal: '1903', placeText: 'Chicago' });
    const result = await gedcomExport(baseFilters, [], undefined);
    expect(result).toMatch(/0 @I1@ INDI/);
    expect(result).toContain('1 NAME Alice /Smith/');
    expect(result).toContain('1 BIRT');
    expect(result).toContain('2 DATE 1903');
    expect(result).toContain('2 PLAC Chicago');
  });

  it('expands one hop of neighbors (parents) for matched persons', async () => {
    p('p1', { isLiving: 0 }); n('p1', 'Father', 'X');
    p('p2', { isLiving: 0 }); n('p2', 'Mother', 'X');
    p('p3', { isLiving: 0 }); n('p3', 'Child', 'X');
    fam('f1', 'p1', 'p2');
    child('c1', 'f1', 'p3');

    const result = await gedcomExport({ ...baseFilters, q: 'Child' }, [], undefined);
    expect(result).toContain('1 NAME Father /X/');
    expect(result).toContain('1 NAME Mother /X/');
    expect(result).toContain('1 NAME Child /X/');
    expect(result).toContain('@F1@ FAM');
  });

  it('redacts living persons (mode=shareable)', async () => {
    p('p1', { isLiving: 1 }); n('p1', 'Alice', 'Smith');
    ev('e1', 'p1', 'birth', { dateOriginal: '1995', placeText: 'Chicago' });
    const result = await gedcomExport(baseFilters, [], undefined);
    expect(result).toContain('1 NAME Living //');
    expect(result).not.toContain('1 NAME Alice /Smith/');
    expect(result).not.toContain('Chicago');
  });
});
