import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, isNull } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { findOrCreateFamilyByPartners } from '../lib/queries';

const { families } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });
  await db.run(sql`CREATE TABLE persons (
    id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    notes TEXT, created_by TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  )`);
  await db.run(sql`CREATE TABLE families (
    id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  )`);
});

afterEach(() => sqlite.close());

describe('findOrCreateFamilyByPartners', () => {
  describe('both partners set', () => {
    it('creates a new family when no pair exists', async () => {
      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: 'A', partner2Id: 'B', relationshipType: 'married',
      });

      expect(r.created).toBe(true);
      const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(r.familyId);
      expect(rows[0].partner1Id).toBe('A');
      expect(rows[0].partner2Id).toBe('B');
      expect(rows[0].relationshipType).toBe('married');
    });

    it('reuses existing pair (forward direction)', async () => {
      const now = new Date().toISOString();
      const existingId = crypto.randomUUID();
      db.insert(families).values({
        id: existingId, partner1Id: 'A', partner2Id: 'B',
        createdAt: now, updatedAt: now,
      }).run();

      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: 'A', partner2Id: 'B',
      });

      expect(r.familyId).toBe(existingId);
      expect(r.created).toBe(false);
    });

    it('reuses existing pair (reverse direction)', async () => {
      const now = new Date().toISOString();
      const existingId = crypto.randomUUID();
      db.insert(families).values({
        id: existingId, partner1Id: 'A', partner2Id: 'B',
        createdAt: now, updatedAt: now,
      }).run();

      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: 'B', partner2Id: 'A',
      });

      expect(r.familyId).toBe(existingId);
      expect(r.created).toBe(false);
    });
  });

  describe('single partner', () => {
    it('creates a new single-parent family when none exists for that partner', async () => {
      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: 'A', partner2Id: null,
      });

      expect(r.created).toBe(true);
      const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].partner1Id).toBe('A');
      expect(rows[0].partner2Id).toBeNull();
    });

    it('reuses existing single-parent family for the same partner', async () => {
      const now = new Date().toISOString();
      const existingId = crypto.randomUUID();
      db.insert(families).values({
        id: existingId, partner1Id: 'A', partner2Id: null,
        createdAt: now, updatedAt: now,
      }).run();

      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: 'A', partner2Id: null,
      });

      expect(r.familyId).toBe(existingId);
      expect(r.created).toBe(false);
    });

    it('reuses existing family even when the partner is partner2 there', async () => {
      const now = new Date().toISOString();
      const existingId = crypto.randomUUID();
      db.insert(families).values({
        id: existingId, partner1Id: 'X', partner2Id: 'A',
        createdAt: now, updatedAt: now,
      }).run();

      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: null, partner2Id: 'A',
      });

      expect(r.familyId).toBe(existingId);
      expect(r.created).toBe(false);
    });

    it('creates with the partner placed in the requested slot when no existing family', async () => {
      const r = await findOrCreateFamilyByPartners(db as any, {
        partner1Id: null, partner2Id: 'A',
      });

      expect(r.created).toBe(true);
      const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].partner1Id).toBeNull();
      expect(rows[0].partner2Id).toBe('A');
    });
  });

  it('ignores soft-deleted families when deduping', async () => {
    const now = new Date().toISOString();
    const oldId = crypto.randomUUID();
    db.insert(families).values({
      id: oldId, partner1Id: 'A', partner2Id: 'B',
      createdAt: now, updatedAt: now, deletedAt: now,
    }).run();

    const r = await findOrCreateFamilyByPartners(db as any, {
      partner1Id: 'A', partner2Id: 'B',
    });

    expect(r.created).toBe(true);
    expect(r.familyId).not.toBe(oldId);
  });
});
