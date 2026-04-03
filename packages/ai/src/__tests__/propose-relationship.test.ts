import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { executeProposeRelationship } from '../tools/propose-relationship';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

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
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE proposed_relationships (
      id TEXT PRIMARY KEY, relationship_type TEXT NOT NULL,
      person1_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      person2_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL, source_detail TEXT,
      confidence REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      validated_by TEXT, validated_at TEXT, rejection_reason TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX idx_proposed_rels_status ON proposed_relationships(status);
    CREATE INDEX idx_proposed_rels_person1 ON proposed_relationships(person1_id);
    CREATE INDEX idx_proposed_rels_person2 ON proposed_relationships(person2_id);
  `);

  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@test.com', name: 'Test', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.persons)
    .values({ id: 'p-1', sex: 'M', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.persons)
    .values({ id: 'p-2', sex: 'F', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
});

afterEach(() => {
  sqlite.close();
});

describe('proposeRelationship', () => {
  it('creates a pending proposal', async () => {
    const result = await executeProposeRelationship(db as any, {
      person1Id: 'p-1',
      person2Id: 'p-2',
      relationshipType: 'parent_child',
      evidence: 'Census 1850 shows same household',
      confidence: 0.85,
    });
    expect(result.proposalId).toBeTruthy();
    expect(result.status).toBe('pending');
    expect(result.message).toContain('proposal created');
  });

  it('stores correct data in the database', async () => {
    await executeProposeRelationship(db as any, {
      person1Id: 'p-1',
      person2Id: 'p-2',
      relationshipType: 'partner',
      evidence: 'Marriage record found',
      confidence: 0.95,
      sourceRecordId: 'rec-123',
    });

    const rows = sqlite.prepare('SELECT * FROM proposed_relationships').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].relationship_type).toBe('partner');
    expect(rows[0].source_type).toBe('ai_suggestion');
    expect(rows[0].confidence).toBe(0.95);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].source_detail).toContain('rec-123');
  });

  it('detects duplicate proposals', async () => {
    await executeProposeRelationship(db as any, {
      person1Id: 'p-1',
      person2Id: 'p-2',
      relationshipType: 'parent_child',
      evidence: 'First evidence',
      confidence: 0.8,
    });

    const dup = await executeProposeRelationship(db as any, {
      person1Id: 'p-1',
      person2Id: 'p-2',
      relationshipType: 'parent_child',
      evidence: 'Second evidence',
      confidence: 0.9,
    });
    expect(dup.message).toContain('already exists');
    const rows = sqlite.prepare('SELECT * FROM proposed_relationships').all();
    expect(rows).toHaveLength(1);
  });

  it('returns error for nonexistent person', async () => {
    const result = await executeProposeRelationship(db as any, {
      person1Id: 'nonexistent',
      person2Id: 'p-2',
      relationshipType: 'sibling',
      evidence: 'Some evidence',
      confidence: 0.5,
    });
    expect(result.message).toContain('not found');
  });
});
