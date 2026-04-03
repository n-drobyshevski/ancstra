import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { centralSchema } from '@ancstra/db';
import type { Database as LibsqlDatabase } from '@ancstra/db';
import { parseDateToSort } from '@ancstra/shared';
import { searchPersonsFts } from '../../lib/queries';

const { persons, personNames, events, personSummary } = schema;
const { users } = centralSchema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  // Create tables
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
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
      created_at TEXT NOT NULL,
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE person_summary (
      person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
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
      updated_at TEXT NOT NULL
    );

    -- FTS5 virtual table and sync triggers
    CREATE VIRTUAL TABLE persons_fts USING fts5(
      given_name, surname,
      content=person_names, content_rowid=rowid
    );
    CREATE TRIGGER persons_fts_ai AFTER INSERT ON person_names BEGIN
      INSERT INTO persons_fts(rowid, given_name, surname)
      VALUES (new.rowid, new.given_name, new.surname);
    END;
    CREATE TRIGGER persons_fts_ad AFTER DELETE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
      VALUES ('delete', old.rowid, old.given_name, old.surname);
    END;
    CREATE TRIGGER persons_fts_au AFTER UPDATE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
      VALUES ('delete', old.rowid, old.given_name, old.surname);
      INSERT INTO persons_fts(rowid, given_name, surname)
      VALUES (new.rowid, new.given_name, new.surname);
    END;
  `);

  // Seed a test user
  db.insert(users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .run();
});

afterEach(() => {
  sqlite.close();
});

// Helper that mirrors the POST route logic
function createPerson(data: {
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  notes?: string;
}) {
  const now = new Date().toISOString();
  const personId = crypto.randomUUID();

  db.insert(persons)
    .values({
      id: personId,
      sex: data.sex,
      isLiving: data.isLiving,
      notes: data.notes ?? null,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(personNames)
    .values({
      id: crypto.randomUUID(),
      personId,
      givenName: data.givenName,
      surname: data.surname,
      nameType: 'birth',
      isPrimary: true,
      createdAt: now,
    })
    .run();

  if (data.birthDate || data.birthPlace) {
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'birth',
        dateOriginal: data.birthDate ?? null,
        dateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
        placeText: data.birthPlace ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  if (data.deathDate || data.deathPlace) {
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'death',
        dateOriginal: data.deathDate ?? null,
        dateSort: data.deathDate ? parseDateToSort(data.deathDate) : null,
        placeText: data.deathPlace ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // Populate person_summary for search queries
  db.insert(personSummary)
    .values({
      personId,
      givenName: data.givenName,
      surname: data.surname,
      sex: data.sex,
      isLiving: data.isLiving,
      birthDate: data.birthDate ?? null,
      deathDate: data.deathDate ?? null,
      birthDateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
      deathDateSort: data.deathDate ? parseDateToSort(data.deathDate) : null,
      birthPlace: data.birthPlace ?? null,
      deathPlace: data.deathPlace ?? null,
      updatedAt: now,
    })
    .run();

  return personId;
}

describe('searchPersonsFts', () => {
  it('finds persons by surname prefix', async () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
    createPerson({ givenName: 'Bob', surname: 'Smith', sex: 'M', isLiving: true });
    createPerson({ givenName: 'Charlie', surname: 'Jones', sex: 'M', isLiving: true });

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'smith');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.surname === 'Smith')).toBe(true);
  });

  it('finds by given name prefix (jo matches John and Jonathan)', async () => {
    createPerson({ givenName: 'John', surname: 'Doe', sex: 'M', isLiving: false });
    createPerson({ givenName: 'Jonathan', surname: 'Adams', sex: 'M', isLiving: true });
    createPerson({ givenName: 'Alice', surname: 'Walker', sex: 'F', isLiving: true });

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'jo');
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.givenName).sort();
    expect(names).toEqual(['John', 'Jonathan']);
  });

  it('excludes soft-deleted persons', async () => {
    const id = createPerson({ givenName: 'Deleted', surname: 'Person', sex: 'U', isLiving: false });

    // Soft delete
    db.update(persons)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(persons.id, id))
      .run();

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'deleted');
    expect(results).toHaveLength(0);
  });

  it('returns empty for no match', async () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'zzzznotfound');
    expect(results).toHaveLength(0);
  });

  it('returns empty for empty/special-char-only query', async () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });

    expect(await searchPersonsFts(db as unknown as LibsqlDatabase, '')).toHaveLength(0);
    expect(await searchPersonsFts(db as unknown as LibsqlDatabase, '***')).toHaveLength(0);
    expect(await searchPersonsFts(db as unknown as LibsqlDatabase, '"\'()')).toHaveLength(0);
  });

  it('auto-syncs on insert (FTS trigger fires)', async () => {
    // Search before inserting - nothing found
    expect(await searchPersonsFts(db as unknown as LibsqlDatabase, 'newperson')).toHaveLength(0);

    // Insert after FTS setup
    createPerson({ givenName: 'NewPerson', surname: 'Test', sex: 'M', isLiving: true });

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'newperson');
    expect(results).toHaveLength(1);
    expect(results[0].givenName).toBe('NewPerson');
  });

  it('includes birth and death dates in results', async () => {
    createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
      birthDate: '15 Mar 1845',
      deathDate: '23 Nov 1923',
    });

    const results = await searchPersonsFts(db as unknown as LibsqlDatabase, 'john');
    expect(results).toHaveLength(1);
    expect(results[0].birthDate).toBe('15 Mar 1845');
    expect(results[0].deathDate).toBe('23 Nov 1923');
  });
});
