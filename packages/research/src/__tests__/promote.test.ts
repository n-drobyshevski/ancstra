import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db';
import { promoteToSource } from '../facts/promote.js';
import { createFact, getFactsByResearchItem } from '../facts/queries.js';

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
      event_id TEXT,
      family_id TEXT,
      person_name_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE search_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      base_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_check TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE research_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT,
      snippet TEXT,
      full_text TEXT,
      notes TEXT,
      archived_html_path TEXT,
      screenshot_path TEXT,
      archived_at TEXT,
      provider_id TEXT REFERENCES search_providers(id),
      provider_record_id TEXT,
      discovery_method TEXT NOT NULL,
      search_query TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      promoted_source_id TEXT REFERENCES sources(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE research_item_persons (
      research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (research_item_id, person_id)
    );
    CREATE TABLE research_facts (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      fact_date_sort INTEGER,
      research_item_id TEXT REFERENCES research_items(id),
      source_citation_id TEXT REFERENCES source_citations(id),
      confidence TEXT NOT NULL DEFAULT 'medium',
      extraction_method TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_research_facts_person ON research_facts(person_id);
    CREATE INDEX idx_research_facts_person_type ON research_facts(person_id, fact_type);
  `);

  // Seed test user
  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: now,
    })
    .run();

  // Seed test person
  db.insert(schema.persons)
    .values({
      id: 'person-1',
      sex: 'M',
      isLiving: false,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Seed a search provider
  db.insert(schema.searchProviders)
    .values({
      id: 'nara',
      name: 'National Archives',
      providerType: 'api',
      baseUrl: 'https://catalog.archives.gov',
      createdAt: now,
    })
    .run();

  // Seed a research item
  db.insert(schema.researchItems)
    .values({
      id: 'item-1',
      title: 'Census Record 1850',
      url: 'https://catalog.archives.gov/record/123',
      discoveryMethod: 'search',
      providerId: 'nara',
      status: 'draft',
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Seed facts linked to item-1
  createFact(db as any, {
    personId: 'person-1',
    factType: 'birth_date',
    factValue: '1850-03-15',
    researchItemId: 'item-1',
    confidence: 'high',
  });
  createFact(db as any, {
    personId: 'person-1',
    factType: 'residence',
    factValue: 'New York, NY',
    researchItemId: 'item-1',
  });
});

afterEach(() => {
  sqlite.close();
});

describe('promoteToSource', () => {
  it('successfully promotes: creates source, citation, updates facts, sets status', () => {
    const result = promoteToSource(db as any, {
      researchItemId: 'item-1',
      personId: 'person-1',
      userId: 'test-user-1',
      citationText: 'Census Record, 1850, New York County',
    });

    expect(result.sourceId).toBeDefined();
    expect(result.sourceCitationId).toBeDefined();
    expect(result.factsUpdated).toBe(2);

    // Verify source was created
    const [source] = db.select().from(schema.sources)
      .where(eq(schema.sources.id, result.sourceId)).all();
    expect(source).toBeDefined();
    expect(source.title).toBe('Census Record 1850');
    expect(source.repositoryUrl).toBe('https://catalog.archives.gov/record/123');
    expect(source.createdBy).toBe('test-user-1');

    // Verify citation was created
    const [citation] = db.select().from(schema.sourceCitations)
      .where(eq(schema.sourceCitations.id, result.sourceCitationId)).all();
    expect(citation).toBeDefined();
    expect(citation.sourceId).toBe(result.sourceId);
    expect(citation.personId).toBe('person-1');
    expect(citation.citationText).toBe('Census Record, 1850, New York County');

    // Verify research item status updated
    const [item] = db.select().from(schema.researchItems)
      .where(eq(schema.researchItems.id, 'item-1')).all();
    expect(item.status).toBe('promoted');
    expect(item.promotedSourceId).toBe(result.sourceId);
  });

  it('updates facts with source_citation_id after promotion', () => {
    const result = promoteToSource(db as any, {
      researchItemId: 'item-1',
      personId: 'person-1',
      userId: 'test-user-1',
    });

    const facts = getFactsByResearchItem(db as any, 'item-1');
    expect(facts).toHaveLength(2);
    for (const fact of facts) {
      expect(fact.sourceCitationId).toBe(result.sourceCitationId);
    }
  });

  it('rejects promotion of already-promoted item', () => {
    // First promotion succeeds
    promoteToSource(db as any, {
      researchItemId: 'item-1',
      personId: 'person-1',
      userId: 'test-user-1',
    });

    // Second promotion throws
    expect(() =>
      promoteToSource(db as any, {
        researchItemId: 'item-1',
        personId: 'person-1',
        userId: 'test-user-1',
      }),
    ).toThrow(/already promoted/i);
  });

  it('throws for nonexistent research item', () => {
    expect(() =>
      promoteToSource(db as any, {
        researchItemId: 'nonexistent',
        personId: 'person-1',
        userId: 'test-user-1',
      }),
    ).toThrow(/not found/i);
  });

  it('rolls back all changes on error', () => {
    // Create a situation that will fail mid-transaction:
    // Insert a research item without a valid person_id reference for the citation
    const now = new Date().toISOString();
    db.insert(schema.researchItems)
      .values({
        id: 'item-rollback',
        title: 'Rollback Test Item',
        discoveryMethod: 'search',
        status: 'draft',
        createdBy: 'test-user-1',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Enable foreign keys so the invalid person_id causes a constraint error
    sqlite.pragma('foreign_keys = ON');

    expect(() =>
      promoteToSource(db as any, {
        researchItemId: 'item-rollback',
        personId: 'nonexistent-person',
        userId: 'test-user-1',
      }),
    ).toThrow();

    // Verify no source was created (rolled back)
    const sources = db.select().from(schema.sources).all();
    const rollbackSources = sources.filter(s => s.title === 'Rollback Test Item');
    expect(rollbackSources).toHaveLength(0);

    // Verify research item status unchanged
    const [item] = db.select().from(schema.researchItems)
      .where(eq(schema.researchItems.id, 'item-rollback')).all();
    expect(item.status).toBe('draft');
    expect(item.promotedSourceId).toBeNull();
  });
});
