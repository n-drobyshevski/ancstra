import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import * as schema from '@ancstra/db';
import { parseDateToSort } from '@ancstra/shared';
import { createPersonSchema } from '../../lib/validation';
import { searchPersonsFts } from '../../lib/queries';

const { persons, personNames, events, users } = schema;

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
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
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
      deleted_at TEXT
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
      created_at TEXT NOT NULL
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
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(given_name, surname, content=person_names, content_rowid=rowid);
    CREATE TRIGGER IF NOT EXISTS persons_fts_ai AFTER INSERT ON person_names BEGIN
      INSERT INTO persons_fts(rowid, given_name, surname) VALUES (new.rowid, new.given_name, new.surname);
    END;
    CREATE TRIGGER IF NOT EXISTS persons_fts_ad AFTER DELETE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname) VALUES ('delete', old.rowid, old.given_name, old.surname);
    END;
    CREATE TRIGGER IF NOT EXISTS persons_fts_au AFTER UPDATE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname) VALUES ('delete', old.rowid, old.given_name, old.surname);
      INSERT INTO persons_fts(rowid, given_name, surname) VALUES (new.rowid, new.given_name, new.surname);
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

  return personId;
}

describe('Person CRUD (integration)', () => {
  it('creates a person with name and events in a transaction', () => {
    const id = createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
      birthDate: '15 Mar 1845',
      birthPlace: 'Springfield, IL',
      deathDate: '23 Nov 1923',
      deathPlace: 'Chicago, IL',
    });

    const [person] = db.select().from(persons).where(eq(persons.id, id)).all();
    expect(person).toBeDefined();
    expect(person.sex).toBe('M');
    expect(person.isLiving).toBe(false);

    const [name] = db
      .select()
      .from(personNames)
      .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
      .all();
    expect(name.givenName).toBe('John');
    expect(name.surname).toBe('Smith');

    const personEvents = db
      .select()
      .from(events)
      .where(eq(events.personId, id))
      .all();
    expect(personEvents).toHaveLength(2);

    const birth = personEvents.find((e) => e.eventType === 'birth');
    expect(birth?.dateOriginal).toBe('15 Mar 1845');
    expect(birth?.dateSort).toBe(18450315);
    expect(birth?.placeText).toBe('Springfield, IL');

    const death = personEvents.find((e) => e.eventType === 'death');
    expect(death?.dateOriginal).toBe('23 Nov 1923');
    expect(death?.dateSort).toBe(19231123);
  });

  it('validates input and rejects missing givenName', () => {
    const result = createPersonSchema.safeParse({
      givenName: '',
      surname: 'Smith',
      sex: 'M',
      isLiving: true,
    });
    expect(result.success).toBe(false);
  });

  it('retrieves a person by ID with assembled data', () => {
    const id = createPerson({
      givenName: 'Mary',
      surname: 'Johnson',
      sex: 'F',
      isLiving: false,
      birthDate: '1850',
      birthPlace: 'Springfield, IL',
    });

    const [person] = db
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .all();
    expect(person).toBeDefined();

    const [primaryName] = db
      .select()
      .from(personNames)
      .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
      .all();
    expect(primaryName.givenName).toBe('Mary');

    const personEvents = db
      .select()
      .from(events)
      .where(
        and(
          eq(events.personId, id),
          inArray(events.eventType, ['birth', 'death'])
        )
      )
      .all();
    const birth = personEvents.find((e) => e.eventType === 'birth');
    expect(birth?.dateOriginal).toBe('1850');
    expect(birth?.dateSort).toBe(18500101);
  });

  it('returns nothing for nonexistent person', () => {
    const result = db
      .select()
      .from(persons)
      .where(and(eq(persons.id, 'nonexistent'), isNull(persons.deletedAt)))
      .all();
    expect(result).toHaveLength(0);
  });

  it('returns paginated list of persons', () => {
    createPerson({ givenName: 'Person', surname: 'One', sex: 'M', isLiving: true });
    createPerson({ givenName: 'Person', surname: 'Two', sex: 'F', isLiving: true });
    createPerson({ givenName: 'Person', surname: 'Three', sex: 'U', isLiving: false });

    const allPersons = db
      .select()
      .from(persons)
      .where(isNull(persons.deletedAt))
      .all();
    expect(allPersons).toHaveLength(3);

    // Paginated query (page 1, size 2)
    const page1 = db
      .select()
      .from(persons)
      .where(isNull(persons.deletedAt))
      .limit(2)
      .offset(0)
      .all();
    expect(page1).toHaveLength(2);

    const page2 = db
      .select()
      .from(persons)
      .where(isNull(persons.deletedAt))
      .limit(2)
      .offset(2)
      .all();
    expect(page2).toHaveLength(1);
  });

  it('updates person name via direct DB update', () => {
    const id = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: true });
    db.update(personNames)
      .set({ givenName: 'Jonathan' })
      .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
      .run();
    const [name] = db
      .select()
      .from(personNames)
      .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
      .all();
    expect(name.givenName).toBe('Jonathan');
  });

  it('upserts birth event on update', () => {
    const id = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: true });
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId: id,
        eventType: 'birth',
        dateOriginal: '1850',
        dateSort: 18500101,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
    db.update(events)
      .set({ dateOriginal: '15 Mar 1850', dateSort: 18500315 })
      .where(and(eq(events.personId, id), eq(events.eventType, 'birth')))
      .run();
    const [birth] = db
      .select()
      .from(events)
      .where(and(eq(events.personId, id), eq(events.eventType, 'birth')))
      .all();
    expect(birth.dateOriginal).toBe('15 Mar 1850');
    expect(birth.dateSort).toBe(18500315);
  });

  it('soft-deletes a person', () => {
    const id = createPerson({ givenName: 'ToDelete', surname: 'Person', sex: 'U', isLiving: false });
    db.update(persons)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(persons.id, id))
      .run();
    const result = db
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .all();
    expect(result).toHaveLength(0);
  });

  it('filters persons by surname with FTS5 search', () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
    createPerson({ givenName: 'Bob', surname: 'Jones', sex: 'M', isLiving: true });
    createPerson({ givenName: 'Charlie', surname: 'Smith', sex: 'M', isLiving: true });

    const smithRows = searchPersonsFts(db, 'Smith', 100);
    expect(smithRows).toHaveLength(2);
    expect(smithRows.every((r) => r.surname === 'Smith')).toBe(true);
  });

  it('filters persons by given name with FTS5 search', () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
    createPerson({ givenName: 'Bob', surname: 'Jones', sex: 'M', isLiving: true });

    const aliceRows = searchPersonsFts(db, 'Alice', 100);
    expect(aliceRows).toHaveLength(1);
    expect(aliceRows[0].givenName).toBe('Alice');
  });

  it('FTS5 supports prefix matching', () => {
    createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
    createPerson({ givenName: 'Bob', surname: 'Smithson', sex: 'M', isLiving: true });

    // "Smi" should match both Smith and Smithson via prefix
    const prefixRows = searchPersonsFts(db, 'Smi', 100);
    expect(prefixRows).toHaveLength(2);
  });

  it('soft-deleted persons are excluded from queries', () => {
    const id = createPerson({
      givenName: 'Deleted',
      surname: 'Person',
      sex: 'U',
      isLiving: false,
    });

    // Soft delete
    db.update(persons)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(persons.id, id))
      .run();

    const result = db
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .all();
    expect(result).toHaveLength(0);
  });
});
