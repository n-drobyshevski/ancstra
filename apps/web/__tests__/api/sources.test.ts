import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@ancstra/db';
import { createSourceSchema, updateSourceSchema } from '../../lib/validation';

const { sources, sourceCitations, users } = schema;

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
      person_id TEXT,
      event_id TEXT,
      family_id TEXT,
      person_name_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Enable foreign keys for CASCADE support
  sqlite.pragma('foreign_keys = ON');

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

// Helper: create a source (mirrors POST route logic)
function createSource(data: {
  title: string;
  sourceType?: string;
  author?: string;
  notes?: string;
}) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(sources)
    .values({
      id,
      title: data.title,
      author: data.author ?? null,
      publisher: null,
      publicationDate: null,
      repositoryName: null,
      repositoryUrl: null,
      sourceType: data.sourceType ?? null,
      notes: data.notes ?? null,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

// Helper: create a citation linked to a source
function createCitation(sourceId: string) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(sourceCitations)
    .values({
      id,
      sourceId,
      citationDetail: 'Page 42',
      citationText: 'Birth record entry',
      confidence: 'high',
      personId: null,
      eventId: null,
      familyId: null,
      personNameId: null,
      createdAt: now,
    })
    .run();

  return id;
}

describe('Source CRUD (integration)', () => {
  it('creates a source with title and type', () => {
    const parsed = createSourceSchema.safeParse({
      title: '1850 Census Records',
      sourceType: 'census',
    });
    expect(parsed.success).toBe(true);

    const id = createSource({
      title: '1850 Census Records',
      sourceType: 'census',
    });

    const [source] = db
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .all();

    expect(source).toBeDefined();
    expect(source.title).toBe('1850 Census Records');
    expect(source.sourceType).toBe('census');
    expect(source.createdBy).toBe('test-user-1');
  });

  it('lists sources with citation count', () => {
    const sourceId = createSource({
      title: 'Parish Register',
      sourceType: 'church',
    });
    createCitation(sourceId);
    createCitation(sourceId);

    // Also create a source with no citations
    createSource({ title: 'Empty Source' });

    // Fetch all sources
    const rows = db.select().from(sources).all();
    expect(rows).toHaveLength(2);

    // Count citations per source (mirrors GET route logic)
    const sourceIds = rows.map((r) => r.id);
    const citationCounts = db
      .select({
        sourceId: sourceCitations.sourceId,
        count: sql<number>`count(*)`,
      })
      .from(sourceCitations)
      .where(
        sql`${sourceCitations.sourceId} IN (${sql.join(
          sourceIds.map((sid) => sql`${sid}`),
          sql`, `
        )})`
      )
      .groupBy(sourceCitations.sourceId)
      .all();

    const countMap = new Map(citationCounts.map((c) => [c.sourceId, c.count]));
    const items = rows.map((r) => ({
      ...r,
      citationCount: countMap.get(r.id) ?? 0,
    }));

    const parishSource = items.find((i) => i.title === 'Parish Register');
    expect(parishSource?.citationCount).toBe(2);

    const emptySource = items.find((i) => i.title === 'Empty Source');
    expect(emptySource?.citationCount).toBe(0);
  });

  it('filters sources by title with ?q= search', () => {
    createSource({ title: '1850 Census Records', sourceType: 'census' });
    createSource({ title: 'Parish Register', sourceType: 'church' });
    createSource({ title: '1860 Census Schedules', sourceType: 'census' });

    const censusRows = db
      .select()
      .from(sources)
      .where(sql`${sources.title} LIKE ${'%Census%'}`)
      .all();

    expect(censusRows).toHaveLength(2);
    expect(censusRows.every((r) => r.title.includes('Census'))).toBe(true);
  });

  it('updates a source title', () => {
    const id = createSource({
      title: 'Old Title',
      sourceType: 'book',
    });

    const parsed = updateSourceSchema.safeParse({ title: 'New Title' });
    expect(parsed.success).toBe(true);

    const now = new Date().toISOString();
    db.update(sources)
      .set({ title: 'New Title', updatedAt: now })
      .where(eq(sources.id, id))
      .run();

    const [updated] = db
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .all();

    expect(updated.title).toBe('New Title');
    expect(updated.sourceType).toBe('book'); // unchanged
  });

  it('deletes a source and cascades to citations', () => {
    const sourceId = createSource({
      title: 'To Delete',
      sourceType: 'other',
    });
    const citationId = createCitation(sourceId);

    // Verify citation exists
    const [citation] = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();
    expect(citation).toBeDefined();

    // Delete source
    db.delete(sources)
      .where(eq(sources.id, sourceId))
      .run();

    // Source gone
    const sourceResult = db
      .select()
      .from(sources)
      .where(eq(sources.id, sourceId))
      .all();
    expect(sourceResult).toHaveLength(0);

    // Citation cascaded
    const citationResult = db
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, citationId))
      .all();
    expect(citationResult).toHaveLength(0);
  });

  it('rejects create with empty title', () => {
    const result = createSourceSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects update with no fields', () => {
    const result = updateSourceSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
