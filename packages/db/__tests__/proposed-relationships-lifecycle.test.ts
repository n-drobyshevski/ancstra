import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import * as schema from '../src/family-schema';
import { proposedRelationships } from '../src/ai-schema';

/**
 * Test fixture for the proposed_relationships table lifecycle. We build the
 * minimal schema (persons + proposed_relationships) by hand rather than
 * running the drizzle-kit migrations so the test is self-contained.
 *
 * DDL mirrors `packages/db/migrations/0004_stiff_night_nurse.sql` (base
 * table) and `packages/db/migrations/0010_abnormal_tomas.sql` (status
 * CHECK constraint).
 */
function createTestFamilyDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.prepare(`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  sqlite.prepare(`
    CREATE TABLE proposed_relationships (
      id TEXT PRIMARY KEY NOT NULL,
      relationship_type TEXT NOT NULL,
      person1_id TEXT NOT NULL,
      person2_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_detail TEXT,
      confidence REAL,
      status TEXT DEFAULT 'pending' NOT NULL,
      validated_by TEXT,
      validated_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (person1_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (person2_id) REFERENCES persons(id) ON DELETE CASCADE,
      CONSTRAINT proposed_relationships_status_check
        CHECK (status IN ('pending', 'validated', 'rejected', 'needs_info'))
    )
  `).run();

  return drizzle(sqlite, { schema: { ...schema, proposedRelationships } });
}

type TestDb = ReturnType<typeof createTestFamilyDb>;

const NOW = '2026-01-01T00:00:00.000Z';

function seedPersons(db: TestDb) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p1', 'M', 1, 'private', ${NOW}, ${NOW})`);
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p2', 'F', 1, 'private', ${NOW}, ${NOW})`);
}

function insertProposal(
  db: TestDb,
  overrides: Partial<typeof proposedRelationships.$inferInsert> = {},
) {
  const row = {
    id: 'pr-1',
    relationshipType: 'parent_child' as const,
    person1Id: 'p1',
    person2Id: 'p2',
    sourceType: 'ai_suggestion' as const,
    sourceDetail: null,
    confidence: 0.85,
    validatedBy: null,
    validatedAt: null,
    rejectionReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
  return db.insert(proposedRelationships).values(row).run();
}

describe('proposed_relationships — schema contract', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestFamilyDb();
    seedPersons(db);
  });

  it("defaults status to 'pending' when omitted from insert", () => {
    insertProposal(db);
    const [row] = db.select().from(proposedRelationships).where(eq(proposedRelationships.id, 'pr-1')).all();
    expect(row.status).toBe('pending');
    expect(row.validatedBy).toBeNull();
    expect(row.validatedAt).toBeNull();
  });

  it.each(['pending', 'validated', 'rejected', 'needs_info'] as const)(
    "accepts insert with status='%s' (all 4 enum values declared in ai-schema.ts)",
    (status) => {
      insertProposal(db, { id: `pr-${status}`, status });
      const [row] = db
        .select()
        .from(proposedRelationships)
        .where(eq(proposedRelationships.id, `pr-${status}`))
        .all();
      expect(row.status).toBe(status);
    },
  );

  it.each(['bogus', 'PENDING', '', 'pending_review'])(
    "CHECK constraint rejects unknown status value %j (added in migration 0010)",
    (badStatus) => {
      let caught: unknown = null;
      try {
        insertProposal(db, { id: `pr-${badStatus || 'empty'}`, status: badStatus as never });
      } catch (err) {
        caught = err;
      }
      expect(caught, `expected CHECK constraint failure for status='${badStatus}'`).toBeInstanceOf(Error);
      // Drizzle wraps the underlying better-sqlite3 error; the CHECK message
      // surfaces on .cause (same pattern as gedcom/import-trust.test.ts).
      const cause = (caught as Error & { cause?: unknown }).cause;
      expect(String(cause ?? caught)).toMatch(/CHECK constraint failed/i);
    },
  );

  it('FK cascades delete proposed_relationships rows when a referenced person is deleted', () => {
    insertProposal(db);
    db.run(sql`DELETE FROM persons WHERE id = 'p1'`);
    const rows = db.select().from(proposedRelationships).where(eq(proposedRelationships.id, 'pr-1')).all();
    expect(rows).toHaveLength(0);
  });
});

describe('proposed_relationships — lifecycle transitions', () => {
  let db: TestDb;
  beforeEach(() => {
    db = createTestFamilyDb();
    seedPersons(db);
    insertProposal(db); // status='pending' by default
  });

  it('pending → validated sets validatedBy + validatedAt', () => {
    const validatedAt = '2026-02-01T12:00:00.000Z';
    db.update(proposedRelationships)
      .set({ status: 'validated', validatedBy: 'u-reviewer', validatedAt, updatedAt: validatedAt })
      .where(eq(proposedRelationships.id, 'pr-1'))
      .run();

    const [row] = db.select().from(proposedRelationships).where(eq(proposedRelationships.id, 'pr-1')).all();
    expect(row.status).toBe('validated');
    expect(row.validatedBy).toBe('u-reviewer');
    expect(row.validatedAt).toBe(validatedAt);
    expect(row.rejectionReason).toBeNull();
  });

  it('pending → rejected sets rejectionReason (and does not require validatedBy)', () => {
    const rejectedAt = '2026-02-01T12:00:00.000Z';
    db.update(proposedRelationships)
      .set({ status: 'rejected', rejectionReason: 'conflicts with documented fact', updatedAt: rejectedAt })
      .where(eq(proposedRelationships.id, 'pr-1'))
      .run();

    const [row] = db.select().from(proposedRelationships).where(eq(proposedRelationships.id, 'pr-1')).all();
    expect(row.status).toBe('rejected');
    expect(row.rejectionReason).toBe('conflicts with documented fact');
    expect(row.validatedBy).toBeNull();
    expect(row.validatedAt).toBeNull();
  });

  it('a row that was validated retains its validatedBy/validatedAt after being re-fetched', () => {
    const validatedAt = '2026-02-01T12:00:00.000Z';
    db.update(proposedRelationships)
      .set({ status: 'validated', validatedBy: 'u-reviewer', validatedAt, updatedAt: validatedAt })
      .where(eq(proposedRelationships.id, 'pr-1'))
      .run();
    const [row] = db.select().from(proposedRelationships).where(eq(proposedRelationships.id, 'pr-1')).all();
    expect(row).toMatchObject({
      status: 'validated',
      validatedBy: 'u-reviewer',
      validatedAt,
    });
  });
});
