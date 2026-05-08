import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, isNull } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { softDeleteFamilyIfEmpty } from '../lib/queries';

const { families, children } = schema;

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
  await db.run(sql`CREATE TABLE children (
    id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL,
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(family_id, person_id)
  )`);
});

afterEach(() => sqlite.close());

function makeFamily(p1: string | null, p2: string | null): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(families).values({
    id, partner1Id: p1, partner2Id: p2,
    createdAt: now, updatedAt: now,
  }).run();
  return id;
}

function addChild(familyId: string, personId: string) {
  db.insert(children).values({
    id: crypto.randomUUID(), familyId, personId,
    createdAt: new Date().toISOString(),
  }).run();
}

function isDeleted(familyId: string): boolean {
  const [row] = db.select({ deletedAt: families.deletedAt })
    .from(families).where(eq(families.id, familyId)).all();
  return row?.deletedAt != null;
}

describe('softDeleteFamilyIfEmpty', () => {
  it('soft-deletes a single-parent family with no children', async () => {
    const fid = makeFamily('A', null);

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(true);
    expect(isDeleted(fid)).toBe(true);
  });

  it('soft-deletes a both-null family with no children', async () => {
    const fid = makeFamily(null, null);

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(true);
    expect(isDeleted(fid)).toBe(true);
  });

  it('keeps a two-partner family even when childless (legitimate marriage record)', async () => {
    const fid = makeFamily('A', 'B');

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(false);
    expect(isDeleted(fid)).toBe(false);
  });

  it('keeps a single-parent family that still has children', async () => {
    const fid = makeFamily('A', null);
    addChild(fid, 'kid1');

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(false);
    expect(isDeleted(fid)).toBe(false);
  });

  it('keeps a both-null family that still has children (sibling-only group)', async () => {
    const fid = makeFamily(null, null);
    addChild(fid, 'sib1');
    addChild(fid, 'sib2');

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(false);
    expect(isDeleted(fid)).toBe(false);
  });

  it('is a no-op on an already-soft-deleted family', async () => {
    const fid = makeFamily('A', null);
    const now = new Date().toISOString();
    db.update(families).set({ deletedAt: now }).where(eq(families.id, fid)).run();

    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(false);
    // still deleted (didn't change anything)
    expect(isDeleted(fid)).toBe(true);
  });

  it('is a no-op on a missing family id', async () => {
    const result = await softDeleteFamilyIfEmpty(db as any, 'does-not-exist');
    expect(result).toBe(false);
  });

  it('triggered after the last child is removed: simulates child-removal cleanup flow', async () => {
    const fid = makeFamily('A', null);
    addChild(fid, 'kid1');

    // Caller (route handler) deletes the only child link first…
    db.delete(children).where(eq(children.familyId, fid)).run();

    // …then asks the helper to clean up empties:
    const result = await softDeleteFamilyIfEmpty(db as any, fid);

    expect(result).toBe(true);
    const live = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(live).toHaveLength(0);
  });
});
