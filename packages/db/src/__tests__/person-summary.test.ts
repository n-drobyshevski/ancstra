import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../family-schema';
import { rebuildAllSummaries, refreshSummary, refreshRelatedSummaries } from '../person-summary';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE person_names (id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES persons(id), name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL, suffix TEXT, nickname TEXT, is_primary INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE families (id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT, relationship_type TEXT NOT NULL DEFAULT 'unknown', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE children (id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL, child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological', relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, UNIQUE(family_id, person_id));
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact', date_end_sort INTEGER, place_text TEXT, description TEXT, person_id TEXT, family_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE person_summary (person_id TEXT PRIMARY KEY, given_name TEXT NOT NULL DEFAULT '', surname TEXT NOT NULL DEFAULT '', sex TEXT NOT NULL, is_living INTEGER NOT NULL, birth_date TEXT, death_date TEXT, birth_date_sort INTEGER, death_date_sort INTEGER, birth_place TEXT, death_place TEXT, spouse_count INTEGER NOT NULL DEFAULT 0, child_count INTEGER NOT NULL DEFAULT 0, parent_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
  `);
  return drizzle(sqlite, { schema }) as any;
}

const NOW = '2026-01-01T00:00:00.000Z';

function insertPerson(db: any, id: string, opts: { sex?: string; isLiving?: number; deleted?: boolean } = {}) {
  const sex = opts.sex ?? 'U';
  const isLiving = opts.isLiving ?? 1;
  const deletedAt = opts.deleted ? NOW : null;
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at, deleted_at) VALUES (${id}, ${sex}, ${isLiving}, 'private', ${NOW}, ${NOW}, ${deletedAt})`);
}

function insertName(db: any, id: string, personId: string, givenName: string, surname: string, isPrimary: number = 1) {
  db.run(sql`INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (${id}, ${personId}, ${givenName}, ${surname}, ${isPrimary}, ${NOW})`);
}

function insertFamily(db: any, id: string, partner1Id: string | null, partner2Id: string | null) {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${partner1Id}, ${partner2Id}, 'married', 'confirmed', ${NOW}, ${NOW})`);
}

function insertChild(db: any, id: string, familyId: string, personId: string) {
  db.run(sql`INSERT INTO children (id, family_id, person_id, created_at) VALUES (${id}, ${familyId}, ${personId}, ${NOW})`);
}

function insertEvent(db: any, id: string, personId: string, eventType: string, opts: { dateOriginal?: string; dateSort?: number; placeText?: string } = {}) {
  db.run(sql`INSERT INTO events (id, event_type, date_original, date_sort, place_text, person_id, created_at, updated_at) VALUES (${id}, ${eventType}, ${opts.dateOriginal ?? null}, ${opts.dateSort ?? null}, ${opts.placeText ?? null}, ${personId}, ${NOW}, ${NOW})`);
}

function getSummary(db: any, personId: string) {
  const rows = db.all(sql`SELECT * FROM person_summary WHERE person_id = ${personId}`);
  return rows.length > 0 ? rows[0] : null;
}

function getAllSummaries(db: any) {
  return db.all(sql`SELECT * FROM person_summary ORDER BY person_id`);
}

describe('rebuildAllSummaries', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates summary rows for all non-deleted persons', async () => {
    insertPerson(db, 'p1', { sex: 'M' });
    insertPerson(db, 'p2', { sex: 'F' });
    insertPerson(db, 'p3', { deleted: true });
    insertName(db, 'n1', 'p1', 'John', 'Doe');
    insertName(db, 'n2', 'p2', 'Jane', 'Doe');

    await rebuildAllSummaries(db);

    const summaries = getAllSummaries(db);
    expect(summaries).toHaveLength(2);

    const p1 = getSummary(db, 'p1');
    expect(p1.given_name).toBe('John');
    expect(p1.surname).toBe('Doe');
    expect(p1.sex).toBe('M');

    const p2 = getSummary(db, 'p2');
    expect(p2.given_name).toBe('Jane');
    expect(p2.surname).toBe('Doe');
    expect(p2.sex).toBe('F');

    // Deleted person should NOT have a summary
    const p3 = getSummary(db, 'p3');
    expect(p3).toBeNull();
  });

  it('includes birth/death dates, date_sort, and places from events', async () => {
    insertPerson(db, 'p1', { sex: 'M', isLiving: 0 });
    insertName(db, 'n1', 'p1', 'John', 'Doe');
    insertEvent(db, 'e1', 'p1', 'birth', { dateOriginal: '15 Mar 1850', dateSort: 18500315, placeText: 'London, England' });
    insertEvent(db, 'e2', 'p1', 'death', { dateOriginal: '22 Dec 1920', dateSort: 19201222, placeText: 'New York, USA' });

    await rebuildAllSummaries(db);

    const s = getSummary(db, 'p1');
    expect(s.birth_date).toBe('15 Mar 1850');
    expect(s.birth_date_sort).toBe(18500315);
    expect(s.birth_place).toBe('London, England');
    expect(s.death_date).toBe('22 Dec 1920');
    expect(s.death_date_sort).toBe(19201222);
    expect(s.death_place).toBe('New York, USA');
  });

  it('handles person without primary name (given_name="", surname="")', async () => {
    insertPerson(db, 'p1');
    // No name inserted at all

    await rebuildAllSummaries(db);

    const s = getSummary(db, 'p1');
    expect(s).not.toBeNull();
    expect(s.given_name).toBe('');
    expect(s.surname).toBe('');
  });

  it('counts spouses, children, and parents correctly', async () => {
    // Dad + Mom married, have child1 and child2
    insertPerson(db, 'dad', { sex: 'M' });
    insertPerson(db, 'mom', { sex: 'F' });
    insertPerson(db, 'child1');
    insertPerson(db, 'child2');
    insertName(db, 'n1', 'dad', 'Dad', 'Smith');
    insertName(db, 'n2', 'mom', 'Mom', 'Smith');
    insertName(db, 'n3', 'child1', 'Kid1', 'Smith');
    insertName(db, 'n4', 'child2', 'Kid2', 'Smith');

    insertFamily(db, 'f1', 'dad', 'mom');
    insertChild(db, 'c1', 'f1', 'child1');
    insertChild(db, 'c2', 'f1', 'child2');

    await rebuildAllSummaries(db);

    const dadS = getSummary(db, 'dad');
    expect(dadS.spouse_count).toBe(1);
    expect(dadS.child_count).toBe(2);
    expect(dadS.parent_count).toBe(0);

    const momS = getSummary(db, 'mom');
    expect(momS.spouse_count).toBe(1);
    expect(momS.child_count).toBe(2);
    expect(momS.parent_count).toBe(0);

    const child1S = getSummary(db, 'child1');
    expect(child1S.spouse_count).toBe(0);
    expect(child1S.child_count).toBe(0);
    expect(child1S.parent_count).toBe(2);

    const child2S = getSummary(db, 'child2');
    expect(child2S.spouse_count).toBe(0);
    expect(child2S.child_count).toBe(0);
    expect(child2S.parent_count).toBe(2);
  });
});

describe('refreshSummary', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('updates a single person row after adding an event', async () => {
    insertPerson(db, 'p1', { sex: 'F' });
    insertName(db, 'n1', 'p1', 'Alice', 'Wonder');

    // Initial build - no events yet
    await rebuildAllSummaries(db);
    let s = getSummary(db, 'p1');
    expect(s.birth_date).toBeNull();

    // Add a birth event, then refresh just this person
    insertEvent(db, 'e1', 'p1', 'birth', { dateOriginal: '1 Jan 1900', dateSort: 19000101, placeText: 'Paris' });
    await refreshSummary(db, 'p1');

    s = getSummary(db, 'p1');
    expect(s.birth_date).toBe('1 Jan 1900');
    expect(s.birth_date_sort).toBe(19000101);
    expect(s.birth_place).toBe('Paris');
    expect(s.given_name).toBe('Alice');
    expect(s.surname).toBe('Wonder');
  });
});

describe('refreshRelatedSummaries', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('updates the target person plus immediate family members', async () => {
    // Setup: grandpa -> dad + mom -> child
    insertPerson(db, 'grandpa', { sex: 'M' });
    insertPerson(db, 'dad', { sex: 'M' });
    insertPerson(db, 'mom', { sex: 'F' });
    insertPerson(db, 'child', { sex: 'M' });
    insertName(db, 'n1', 'grandpa', 'Grandpa', 'Smith');
    insertName(db, 'n2', 'dad', 'Dad', 'Smith');
    insertName(db, 'n3', 'mom', 'Mom', 'Jones');
    insertName(db, 'n4', 'child', 'Kid', 'Smith');

    insertFamily(db, 'f0', 'grandpa', null);
    insertChild(db, 'c0', 'f0', 'dad');

    insertFamily(db, 'f1', 'dad', 'mom');
    insertChild(db, 'c1', 'f1', 'child');

    // Initial build
    await rebuildAllSummaries(db);

    // Verify initial state
    expect(getSummary(db, 'dad').spouse_count).toBe(1);
    expect(getSummary(db, 'dad').child_count).toBe(1);
    expect(getSummary(db, 'dad').parent_count).toBe(1);

    // Add another child to the family
    insertPerson(db, 'child2', { sex: 'F' });
    insertName(db, 'n5', 'child2', 'Kid2', 'Smith');
    insertChild(db, 'c2', 'f1', 'child2');

    // Refresh related summaries for 'dad' - should update dad, mom, child, child2
    // grandpa is dad's parent, so he also gets refreshed
    await refreshRelatedSummaries(db, 'dad');

    // Dad's child_count should now be 2
    expect(getSummary(db, 'dad').child_count).toBe(2);
    // Mom's child_count should also be 2 (she is dad's spouse, so she got refreshed)
    expect(getSummary(db, 'mom').child_count).toBe(2);
    // child2 should now have a summary (refreshed as dad's child)
    const child2S = getSummary(db, 'child2');
    expect(child2S).not.toBeNull();
    expect(child2S.given_name).toBe('Kid2');
    expect(child2S.parent_count).toBe(2);

    // Grandpa should also be refreshed (he is dad's parent)
    expect(getSummary(db, 'grandpa')).not.toBeNull();
  });
});
