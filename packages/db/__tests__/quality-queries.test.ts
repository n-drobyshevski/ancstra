import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/family-schema';
import { getQualitySummary, getPriorities } from '../src/quality-queries';

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name_type TEXT NOT NULL DEFAULT 'birth',
      prefix TEXT,
      given_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      suffix TEXT,
      nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      date_original TEXT,
      date_sort INTEGER,
      date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER,
      place_text TEXT,
      description TEXT,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      family_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      citation_detail TEXT,
      citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      event_id TEXT,
      family_id TEXT,
      person_name_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );
  `);
}

/**
 * Seed 3 persons:
 * - person-complete: name + birth (with place) + death + source (is_living=0)
 * - person-partial:  name + birth (no place), no death, no source (is_living=1)
 * - person-minimal:  name only, no events, no source (is_living=1)
 */
function seedData(db: Database.Database) {
  // --- Complete person (deceased) ---
  db.prepare(
    `INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('person-complete', 'M', 0, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');
  db.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)`,
  ).run('name-complete', 'person-complete', 'John', 'Smith', 1);
  db.prepare(
    `INSERT INTO events (id, event_type, date_original, place_text, person_id) VALUES (?, ?, ?, ?, ?)`,
  ).run('evt-birth-1', 'birth', '1 Jan 1920', 'New York, NY', 'person-complete');
  db.prepare(
    `INSERT INTO events (id, event_type, date_original, person_id) VALUES (?, ?, ?, ?)`,
  ).run('evt-death-1', 'death', '15 Mar 2000', 'person-complete');
  db.prepare(
    `INSERT INTO sources (id, title) VALUES (?, ?)`,
  ).run('src-1', 'Birth Certificate');
  db.prepare(
    `INSERT INTO source_citations (id, source_id, person_id) VALUES (?, ?, ?)`,
  ).run('cite-1', 'src-1', 'person-complete');

  // --- Partial person (living, name + birth only, no place) ---
  db.prepare(
    `INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('person-partial', 'F', 1, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');
  db.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)`,
  ).run('name-partial', 'person-partial', 'Jane', 'Doe', 1);
  db.prepare(
    `INSERT INTO events (id, event_type, date_original, person_id) VALUES (?, ?, ?, ?)`,
  ).run('evt-birth-2', 'birth', '5 Jun 1990', 'person-partial');

  // --- Minimal person (living, name only) ---
  db.prepare(
    `INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('person-minimal', 'U', 1, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');
  db.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)`,
  ).run('name-minimal', 'person-minimal', 'Unknown', 'Person', 1);
}

describe('quality-queries', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    createSchema(sqlite);
    seedData(sqlite);
    db = drizzle(sqlite, { schema }) as any;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('getQualitySummary', () => {
    it('returns correct totalPersons count', async () => {
      const summary = await getQualitySummary(db as any);
      expect(summary.totalPersons).toBe(3);
    });

    it('returns correct name metric (all 3 have names)', async () => {
      const summary = await getQualitySummary(db as any);
      const nameMetric = summary.metrics.find((m) => m.label === 'Has Name');
      expect(nameMetric).toBeDefined();
      expect(nameMetric!.count).toBe(3);
      expect(nameMetric!.value).toBe(100); // 3/3 = 100%
    });

    it('returns correct birth date metric (2 of 3 have birth)', async () => {
      const summary = await getQualitySummary(db as any);
      const birthMetric = summary.metrics.find((m) => m.label === 'Has Birth Date');
      expect(birthMetric).toBeDefined();
      expect(birthMetric!.count).toBe(2);
      expect(birthMetric!.value).toBe(67); // round(2/3 * 100) = 67
    });

    it('returns correct birth place metric (1 of 3 has birth place)', async () => {
      const summary = await getQualitySummary(db as any);
      const placeMetric = summary.metrics.find((m) => m.label === 'Has Birth Place');
      expect(placeMetric).toBeDefined();
      expect(placeMetric!.count).toBe(1);
      expect(placeMetric!.value).toBe(33); // round(1/3 * 100) = 33
    });

    it('returns correct death metric relative to non-living persons', async () => {
      const summary = await getQualitySummary(db as any);
      const deathMetric = summary.metrics.find((m) => m.label === 'Has Death Date');
      expect(deathMetric).toBeDefined();
      // Only 1 non-living person (person-complete), who has a death event
      expect(deathMetric!.total).toBe(1);
      expect(deathMetric!.count).toBe(1);
      expect(deathMetric!.value).toBe(100); // 1/1 = 100%
    });

    it('returns correct source metric (1 of 3 has source)', async () => {
      const summary = await getQualitySummary(db as any);
      const sourceMetric = summary.metrics.find((m) => m.label === 'Has Source');
      expect(sourceMetric).toBeDefined();
      expect(sourceMetric!.count).toBe(1);
      expect(sourceMetric!.value).toBe(33); // round(1/3 * 100) = 33
    });

    it('computes an overall score as average of metric percentages', async () => {
      const summary = await getQualitySummary(db as any);
      // name=100, birth=67, birthPlace=33, death=100, source=33
      // average = round((100 + 67 + 33 + 100 + 33) / 5) = round(66.6) = 67
      expect(summary.overallScore).toBe(67);
    });

    it('excludes soft-deleted persons', async () => {
      sqlite.prepare(
        `UPDATE persons SET deleted_at = '2025-06-01T00:00:00Z' WHERE id = 'person-minimal'`,
      ).run();
      const summary = await getQualitySummary(db as any);
      expect(summary.totalPersons).toBe(2);
    });

    it('returns empty metrics for empty database', async () => {
      const emptySqlite = new Database(':memory:');
      createSchema(emptySqlite);
      const emptyDb = drizzle(emptySqlite, { schema }) as any;
      const summary = await getQualitySummary(emptyDb);
      expect(summary.totalPersons).toBe(0);
      expect(summary.overallScore).toBe(0);
      expect(summary.metrics).toEqual([]);
      emptySqlite.close();
    });
  });

  describe('getPriorities', () => {
    it('returns persons sorted by lowest score first', async () => {
      const result = await getPriorities(db as any, 1, 20);
      expect(result.persons).toHaveLength(3);
      // person-minimal: living, name only → round(20*100/85) = 24
      // person-partial: living, name+birth → round(45*100/85) = 53
      // person-complete: deceased, all five → 100
      expect(result.persons[0]!.id).toBe('person-minimal');
      expect(result.persons[0]!.score).toBe(24);
      expect(result.persons[1]!.id).toBe('person-partial');
      expect(result.persons[1]!.score).toBe(53);
      expect(result.persons[2]!.id).toBe('person-complete');
      expect(result.persons[2]!.score).toBe(100);
    });

    it('includes correct missing fields', async () => {
      const result = await getPriorities(db as any, 1, 20);
      // person-minimal: living, missing birthDate, birthPlace, source.
      // deathDate is N/A for living persons under the renormalized model.
      const minimal = result.persons.find((p) => p.id === 'person-minimal')!;
      expect(minimal.missingFields).toContain('birthDate');
      expect(minimal.missingFields).toContain('birthPlace');
      expect(minimal.missingFields).not.toContain('deathDate');
      expect(minimal.missingFields).toContain('source');
      expect(minimal.missingFields).not.toContain('name');

      // person-complete: deceased, all 5 dimensions filled — no missing fields
      const complete = result.persons.find((p) => p.id === 'person-complete')!;
      expect(complete.missingFields).toEqual([]);
    });

    it('flags missing deathDate only for deceased persons without a death event', async () => {
      // Seed a deceased person with name + birth + place + source but no death event.
      // The seed runs INSIDE this test so we don't perturb the global seedData fixtures.
      sqlite.prepare(
        `INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      ).run('person-deceased-no-death', 'M', 0, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');
      sqlite.prepare(
        `INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)`,
      ).run('name-d-nd', 'person-deceased-no-death', 'Henry', 'Doe', 1);
      sqlite.prepare(
        `INSERT INTO events (id, event_type, date_original, place_text, person_id) VALUES (?, ?, ?, ?, ?)`,
      ).run('evt-d-nd-birth', 'birth', '1 Jan 1900', 'Boston', 'person-deceased-no-death');
      sqlite.prepare(
        `INSERT INTO sources (id, title) VALUES (?, ?)`,
      ).run('src-d-nd', 'Census');
      sqlite.prepare(
        `INSERT INTO source_citations (id, source_id, person_id) VALUES (?, ?, ?)`,
      ).run('cite-d-nd', 'src-d-nd', 'person-deceased-no-death');

      const result = await getPriorities(db as any, 1, 20);
      const dnd = result.persons.find((p) => p.id === 'person-deceased-no-death')!;
      expect(dnd).toBeDefined();
      // Deceased + has 4 of 5 dimensions (no death event) → raw 5-term sum, no renormalization → 85.
      expect(dnd.score).toBe(85);
      // Death IS missing for this person because they're deceased and lack a death event.
      expect(dnd.missingFields).toContain('deathDate');
      // Other applicable dimensions are present.
      expect(dnd.missingFields).not.toContain('name');
      expect(dnd.missingFields).not.toContain('birthDate');
      expect(dnd.missingFields).not.toContain('birthPlace');
      expect(dnd.missingFields).not.toContain('source');
    });

    it('returns correct givenName and surname', async () => {
      const result = await getPriorities(db as any, 1, 20);
      const complete = result.persons.find((p) => p.id === 'person-complete')!;
      expect(complete.givenName).toBe('John');
      expect(complete.surname).toBe('Smith');
    });

    it('returns correct total count', async () => {
      const result = await getPriorities(db as any, 1, 20);
      expect(result.total).toBe(3);
    });

    it('paginates correctly - page 1 with pageSize 2', async () => {
      const result = await getPriorities(db as any, 1, 2);
      expect(result.persons).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(3);
      // First two by lowest score
      expect(result.persons[0]!.id).toBe('person-minimal');
      expect(result.persons[1]!.id).toBe('person-partial');
    });

    it('paginates correctly - page 2 with pageSize 2', async () => {
      const result = await getPriorities(db as any, 2, 2);
      expect(result.persons).toHaveLength(1);
      expect(result.page).toBe(2);
      expect(result.persons[0]!.id).toBe('person-complete');
    });

    it('returns empty page when beyond range', async () => {
      const result = await getPriorities(db as any, 5, 20);
      expect(result.persons).toHaveLength(0);
      expect(result.total).toBe(3);
    });

    it('excludes soft-deleted persons', async () => {
      sqlite.prepare(
        `UPDATE persons SET deleted_at = '2025-06-01T00:00:00Z' WHERE id = 'person-minimal'`,
      ).run();
      const result = await getPriorities(db as any, 1, 20);
      expect(result.persons).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.persons.find((p) => p.id === 'person-minimal')).toBeUndefined();
    });
  });
});
