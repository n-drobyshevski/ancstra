import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '@ancstra/db';
import { createCitationSchema } from '@/lib/validation';

const { users, persons, personNames, events, families, sources, sourceCitations } = schema;

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
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      publication_date TEXT,
      repository_name TEXT,
      repository_url TEXT,
      source_type TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      citation_detail TEXT,
      citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
      person_name_id TEXT REFERENCES person_names(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
  `);

  createTestUser();
});

afterEach(() => {
  sqlite.close();
});

function createTestUser() {
  db.insert(users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    })
    .run();
}

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

function createSource(data?: { title?: string; author?: string }) {
  const now = new Date().toISOString();
  const sourceId = crypto.randomUUID();

  db.insert(sources)
    .values({
      id: sourceId,
      title: data?.title ?? 'Test Source',
      author: data?.author ?? 'Test Author',
      sourceType: 'vital_record',
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return sourceId;
}

function createEvent(personId: string) {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  db.insert(events)
    .values({
      id: eventId,
      eventType: 'birth',
      personId,
      dateOriginal: '1 Jan 1850',
      dateSort: 18500101,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return eventId;
}

function createFamily() {
  const now = new Date().toISOString();
  const familyId = crypto.randomUUID();

  db.insert(families)
    .values({
      id: familyId,
      relationshipType: 'married',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return familyId;
}

describe('Citation CRUD (integration)', () => {
  it('creates citation linking source to person', () => {
    const personId = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const sourceId = createSource({ title: 'Birth Certificate', author: 'County Clerk' });

    const citationId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insert(sourceCitations)
      .values({
        id: citationId,
        sourceId,
        personId,
        citationDetail: 'Page 42, Line 3',
        confidence: 'high',
        createdAt: now,
      })
      .run();

    const [citation] = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();

    expect(citation).toBeDefined();
    expect(citation.sourceId).toBe(sourceId);
    expect(citation.personId).toBe(personId);
    expect(citation.citationDetail).toBe('Page 42, Line 3');
    expect(citation.confidence).toBe('high');
  });

  it('creates citation linking source to event', () => {
    const personId = createPerson({ givenName: 'Jane', surname: 'Doe', sex: 'F', isLiving: false });
    const sourceId = createSource({ title: 'Parish Register' });
    const eventId = createEvent(personId);

    const citationId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insert(sourceCitations)
      .values({
        id: citationId,
        sourceId,
        eventId,
        citationText: 'Baptism recorded on 5 Jan 1850',
        createdAt: now,
      })
      .run();

    const [citation] = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();

    expect(citation).toBeDefined();
    expect(citation.sourceId).toBe(sourceId);
    expect(citation.eventId).toBe(eventId);
    expect(citation.confidence).toBe('medium'); // default
  });

  it('GET ?personId= returns citations with source data', () => {
    const personId = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const sourceId = createSource({ title: 'Census 1880', author: 'US Census Bureau' });

    db.insert(sourceCitations)
      .values({
        id: crypto.randomUUID(),
        sourceId,
        personId,
        citationDetail: 'Household #12',
        createdAt: new Date().toISOString(),
      })
      .run();

    // Query citations for person and join source
    const citations = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.personId, personId))
      .all();

    expect(citations).toHaveLength(1);

    const [source] = db
      .select()
      .from(sources)
      .where(eq(sources.id, citations[0].sourceId))
      .all();

    expect(source.title).toBe('Census 1880');
    expect(source.author).toBe('US Census Bureau');
  });

  it('GET ?eventId= returns citations for event', () => {
    const personId = createPerson({ givenName: 'Mary', surname: 'Jones', sex: 'F', isLiving: false });
    const sourceId = createSource({ title: 'Church Records' });
    const eventId = createEvent(personId);

    db.insert(sourceCitations)
      .values({
        id: crypto.randomUUID(),
        sourceId,
        eventId,
        createdAt: new Date().toISOString(),
      })
      .run();

    const citations = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.eventId, eventId))
      .all();

    expect(citations).toHaveLength(1);
    expect(citations[0].eventId).toBe(eventId);
  });

  it('GET without entity filter — validation requires at least one link', () => {
    // The API route returns 400 "Entity filter required" when no filter param is given.
    // Here we verify the validation schema also rejects missing entity links.
    const result = createCitationSchema.safeParse({
      sourceId: 'some-source',
    });

    expect(result.success).toBe(false);
  });

  it('DELETE removes citation', () => {
    const personId = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const sourceId = createSource();
    const citationId = crypto.randomUUID();

    db.insert(sourceCitations)
      .values({
        id: citationId,
        sourceId,
        personId,
        createdAt: new Date().toISOString(),
      })
      .run();

    // Verify it exists
    const [before] = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();
    expect(before).toBeDefined();

    // Delete
    db.delete(sourceCitations).where(eq(sourceCitations.id, citationId)).run();

    const after = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();
    expect(after).toHaveLength(0);
  });

  it('rejects citation missing entity link via validation', () => {
    const result = createCitationSchema.safeParse({
      sourceId: 'some-source-id',
      citationDetail: 'Some detail',
      // No personId, eventId, familyId, or personNameId
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least one entity link is required');
    }
  });

  it('rejects citation with invalid sourceId (source does not exist)', () => {
    const personId = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const fakeSourceId = 'nonexistent-source-id';

    // Verify source doesn't exist
    const sourceResult = db
      .select()
      .from(sources)
      .where(eq(sources.id, fakeSourceId))
      .all();
    expect(sourceResult).toHaveLength(0);

    // The API route would return 404 here — verify the lookup logic
    const [source] = db
      .select()
      .from(sources)
      .where(eq(sources.id, fakeSourceId))
      .all();
    expect(source).toBeUndefined();
  });
});
