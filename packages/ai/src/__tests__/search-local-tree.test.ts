import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as schema from '@ancstra/db/schema';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { executeSearchLocalTree } from '../tools/search-local-tree';

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();

  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT,
      created_by TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT,
      given_name TEXT NOT NULL, surname TEXT NOT NULL,
      suffix TEXT, nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE children (
      id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL,
      child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id)
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
      date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER, place_text TEXT, description TEXT,
      person_id TEXT, family_id TEXT,
      contested INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE VIRTUAL TABLE persons_fts USING fts5(
      given_name, surname, content=person_names, content_rowid=rowid
    );
  `);

  const now = new Date().toISOString();

  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@ancstra.app', name: 'Test', createdAt: now, updatedAt: now })
    .run();

  // Person 1: Johann Mueller (deceased)
  db.insert(schema.persons)
    .values({ id: 'p-1', sex: 'M', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'n-1', personId: 'p-1', givenName: 'Johann', surname: 'Mueller', isPrimary: true, createdAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'e-1', eventType: 'birth', dateOriginal: '15 Mar 1820', dateSort: 18200315, placeText: 'Berlin, Germany', personId: 'p-1', createdAt: now, updatedAt: now })
    .run();

  // Person 2: Maria Schmidt (deceased)
  db.insert(schema.persons)
    .values({ id: 'p-2', sex: 'F', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'n-2', personId: 'p-2', givenName: 'Maria', surname: 'Schmidt', isPrimary: true, createdAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'e-2', eventType: 'birth', dateOriginal: '1825', dateSort: 18250101, placeText: 'Vienna, Austria', personId: 'p-2', createdAt: now, updatedAt: now })
    .run();

  // Person 3: Living Person
  db.insert(schema.persons)
    .values({ id: 'p-3', sex: 'M', isLiving: true, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'n-3', personId: 'p-3', givenName: 'John', surname: 'Mueller', isPrimary: true, createdAt: now })
    .run();

  // Rebuild FTS index
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](`INSERT INTO persons_fts(persons_fts) VALUES('rebuild');`);
});

afterEach(() => {
  db.$client.close();
});

describe('searchLocalTree', () => {
  it('finds person by surname', async () => {
    const results = await executeSearchLocalTree(db as any, { surname: 'Mueller' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    const johann = results.find(r => r.name === 'Johann Mueller');
    expect(johann).toBeDefined();
    expect(johann!.birthPlace).toBe('Berlin, Germany');
  });

  it('finds person by given name', async () => {
    const results = await executeSearchLocalTree(db as any, { givenName: 'Maria' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Maria Schmidt');
  });

  it('returns empty for no match', async () => {
    const results = await executeSearchLocalTree(db as any, { surname: 'Nonexistent' });
    expect(results).toHaveLength(0);
  });

  it('uses free-text query', async () => {
    const results = await executeSearchLocalTree(db as any, { query: 'Schmidt' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('Maria Schmidt');
  });

  it('filters living persons with placeholder', async () => {
    const results = await executeSearchLocalTree(db as any, { surname: 'Mueller' });
    const living = results.find(r => r.id === 'p-3');
    expect(living).toBeDefined();
    expect(living!.name).toBe('Living Person');
    expect(living!.birthDate).toBeNull();
    expect(living!.birthPlace).toBeNull();
  });

  it('returns empty when no search params provided', async () => {
    const results = await executeSearchLocalTree(db as any, {});
    expect(results).toHaveLength(0);
  });
});
