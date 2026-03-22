import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '@ancstra/db';
import { parseDateToSort } from '@ancstra/shared';

const { persons, personNames, events, users } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

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
  `);

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

function createPerson(data: {
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
}) {
  const now = new Date().toISOString();
  const personId = crypto.randomUUID();

  db.insert(persons)
    .values({
      id: personId,
      sex: data.sex,
      isLiving: data.isLiving,
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

  return personId;
}

describe('Event CRUD (integration)', () => {
  it('creates event with dateSort computed', () => {
    const personId = createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
    });
    const now = new Date().toISOString();

    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'residence',
        dateOriginal: '15 Mar 1880',
        dateSort: parseDateToSort('15 Mar 1880'),
        placeText: 'Chicago, IL',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [evt] = db
      .select()
      .from(events)
      .where(
        and(
          eq(events.personId, personId),
          eq(events.eventType, 'residence')
        )
      )
      .all();

    expect(evt.dateSort).toBe(18800315);
    expect(evt.placeText).toBe('Chicago, IL');
  });

  it('creates event with between modifier and dateEndSort', () => {
    const personId = createPerson({
      givenName: 'Mary',
      surname: 'Johnson',
      sex: 'F',
      isLiving: false,
    });
    const now = new Date().toISOString();

    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'residence',
        dateOriginal: '1880',
        dateSort: parseDateToSort('1880'),
        dateModifier: 'between',
        dateEndSort: parseDateToSort('1885'),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [evt] = db
      .select()
      .from(events)
      .where(
        and(
          eq(events.personId, personId),
          eq(events.eventType, 'residence')
        )
      )
      .all();

    expect(evt.dateSort).toBe(18800101);
    expect(evt.dateEndSort).toBe(18850101);
    expect(evt.dateModifier).toBe('between');
  });

  it('lists events sorted chronologically', () => {
    const personId = createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
    });
    const now = new Date().toISOString();

    // Insert events out of order
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'death',
        dateOriginal: '1923',
        dateSort: 19230101,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'birth',
        dateOriginal: '1845',
        dateSort: 18450101,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(events)
      .values({
        id: crypto.randomUUID(),
        personId,
        eventType: 'residence',
        dateOriginal: '1880',
        dateSort: 18800101,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const sorted = db
      .select()
      .from(events)
      .where(eq(events.personId, personId))
      .orderBy(sql`${events.dateSort} ASC`)
      .all();

    expect(sorted[0].eventType).toBe('birth');
    expect(sorted[1].eventType).toBe('residence');
    expect(sorted[2].eventType).toBe('death');
  });

  it('updates event and recomputes dateSort', () => {
    const personId = createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
    });
    const now = new Date().toISOString();
    const evtId = crypto.randomUUID();

    db.insert(events)
      .values({
        id: evtId,
        personId,
        eventType: 'residence',
        dateOriginal: '1880',
        dateSort: 18800101,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.update(events)
      .set({
        dateOriginal: '15 Jun 1882',
        dateSort: parseDateToSort('15 Jun 1882'),
        updatedAt: now,
      })
      .where(eq(events.id, evtId))
      .run();

    const [updated] = db
      .select()
      .from(events)
      .where(eq(events.id, evtId))
      .all();

    expect(updated.dateOriginal).toBe('15 Jun 1882');
    expect(updated.dateSort).toBe(18820615);
  });

  it('deletes event', () => {
    const personId = createPerson({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
    });
    const now = new Date().toISOString();
    const evtId = crypto.randomUUID();

    db.insert(events)
      .values({
        id: evtId,
        personId,
        eventType: 'residence',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.delete(events).where(eq(events.id, evtId)).run();

    const result = db
      .select()
      .from(events)
      .where(eq(events.id, evtId))
      .all();

    expect(result).toHaveLength(0);
  });
});
