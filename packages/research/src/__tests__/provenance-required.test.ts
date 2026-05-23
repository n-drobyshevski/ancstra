import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as schema from '@ancstra/db/schema';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createFact, type CreateFactInput } from '../facts/queries';

let sqlite: import('better-sqlite3').Database;
let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  sqlite = db.$client;

  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](`
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
      updated_at TEXT NOT NULL,
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
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
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
      status TEXT NOT NULL DEFAULT 'collected',
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
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      fact_date_sort INTEGER,
      research_item_id TEXT REFERENCES research_items(id),
      source_citation_id TEXT REFERENCES source_citations(id),
      factsheet_id TEXT,
      accepted INTEGER,
      confidence TEXT NOT NULL DEFAULT 'medium',
      contested INTEGER NOT NULL DEFAULT 0,
      provenance TEXT NOT NULL DEFAULT 'derived',
      extraction_method TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_research_facts_person ON research_facts(person_id);
    CREATE INDEX idx_research_facts_person_type ON research_facts(person_id, fact_type);
  `);

  const now = new Date().toISOString();

  db.insert(schema.users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(schema.persons)
    .values({
      id: 'p1',
      sex: 'M',
      isLiving: false,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(schema.researchItems)
    .values({
      id: 'ri1',
      title: 'Test Item',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Seed a source so we can create a source_citation referencing it.
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](`
    INSERT INTO sources (id, title, created_by, created_at, updated_at)
    VALUES ('src1', 'Test Source', 'test-user-1', '${now}', '${now}');
    INSERT INTO source_citations (id, source_id, created_at)
    VALUES ('sc1', 'src1', '${now}');
  `);
});

afterEach(() => {
  sqlite.close();
});

describe('createFact provenance validation (Bundle A F6)', () => {
  const base: CreateFactInput = {
    personId: 'p1',
    factType: 'name',
    factValue: 'John',
    provenance: 'derived',
    researchItemId: 'ri1',
  };

  it('rejects when provenance is missing', async () => {
    const { provenance: _omit, ...rest } = base;
    void _omit;
    await expect(
      createFact(db as any, rest as CreateFactInput),
    ).rejects.toThrow(/provenance/i);
  });

  it('rejects provenance=cited without sourceCitationId', async () => {
    await expect(
      createFact(db as any, { ...base, provenance: 'cited', sourceCitationId: undefined }),
    ).rejects.toThrow(/sourceCitationId/i);
  });

  it('accepts provenance=cited with sourceCitationId', async () => {
    const row = await createFact(db as any, {
      ...base,
      provenance: 'cited',
      sourceCitationId: 'sc1',
    });
    expect(row.provenance).toBe('cited');
  });

  it('accepts provenance=derived with researchItemId', async () => {
    const row = await createFact(db as any, { ...base, provenance: 'derived' });
    expect(row.provenance).toBe('derived');
  });

  it('rejects provenance=derived without researchItemId or sourceCitationId', async () => {
    await expect(
      createFact(db as any, {
        ...base,
        provenance: 'derived',
        researchItemId: undefined,
        sourceCitationId: undefined,
      }),
    ).rejects.toThrow(/researchItemId/i);
  });

  it('accepts provenance=user_inference without any source', async () => {
    const row = await createFact(db as any, {
      ...base,
      provenance: 'user_inference',
      researchItemId: undefined,
    });
    expect(row.provenance).toBe('user_inference');
  });
});
