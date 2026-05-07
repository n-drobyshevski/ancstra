import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { logActivity, getActivityFeed, redactActivityForViewer, type ActivityEntry } from '../src/activity';

async function insertRawActivity(db: TestCentralDb, id: string, opts: {
  familyId?: string; userId?: string; action?: string; summary?: string; createdAt: string;
  entityType?: string; entityId?: string;
}) {
  await db.insert(centralSchema.activityFeed).values({
    id,
    familyId: opts.familyId ?? 'f1',
    userId: opts.userId ?? 'u1',
    action: opts.action ?? 'person_added',
    summary: opts.summary ?? `Activity ${id}`,
    createdAt: opts.createdAt,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
  }).run();
}

describe('logActivity', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@b.com', name: 'Alice', createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@c.com', name: 'Bob', createdAt: now, updatedAt: now },
    ]).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test Family', ownerId: 'u1', dbFilename: 'test.db', createdAt: now, updatedAt: now,
    }).run();
  });

  it('inserts a row into activity_feed', async () => {
    await logActivity(db, {
      familyId: 'f1',
      userId: 'u1',
      action: 'person_added',
      entityType: 'person',
      entityId: 'p1',
      summary: 'Added John Doe',
      metadata: { source: 'manual' },
    });

    const result = await getActivityFeed(db, { familyId: 'f1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].action).toBe('person_added');
    expect(result.items[0].summary).toBe('Added John Doe');
    expect(result.items[0].entityType).toBe('person');
    expect(result.items[0].entityId).toBe('p1');
    expect(result.items[0].metadata).toEqual({ source: 'manual' });
  });

  it('inserts with optional fields omitted', async () => {
    await logActivity(db, {
      familyId: 'f1',
      userId: 'u1',
      action: 'gedcom_imported',
      summary: 'Imported GEDCOM file',
    });

    const result = await getActivityFeed(db, { familyId: 'f1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].entityType).toBeNull();
    expect(result.items[0].entityId).toBeNull();
    expect(result.items[0].metadata).toBeNull();
  });
});

describe('getActivityFeed', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@b.com', name: 'Alice', createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@c.com', name: 'Bob', createdAt: now, updatedAt: now },
    ]).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test Family', ownerId: 'u1', dbFilename: 'test.db', createdAt: now, updatedAt: now,
    }).run();
  });

  it('returns items ordered by created_at desc', async () => {
    await insertRawActivity(db, 'a1', { summary: 'First', createdAt: '2026-01-01T00:00:00Z' });
    await insertRawActivity(db, 'a2', { summary: 'Second', createdAt: '2026-01-02T00:00:00Z' });
    await insertRawActivity(db, 'a3', { summary: 'Third', createdAt: '2026-01-03T00:00:00Z' });

    const result = await getActivityFeed(db, { familyId: 'f1' });
    expect(result.items.map((i) => i.summary)).toEqual(['Third', 'Second', 'First']);
  });

  it('respects limit and returns nextCursor', async () => {
    for (let i = 0; i < 5; i++) {
      await insertRawActivity(db, `item${i}`, {
        summary: `Activity ${i}`,
        createdAt: `2026-01-0${i + 1}T00:00:00Z`,
      });
    }

    const page1 = await getActivityFeed(db, { familyId: 'f1', limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.items[0].summary).toBe('Activity 4');
    expect(page1.items[1].summary).toBe('Activity 3');

    const page2 = await getActivityFeed(db, { familyId: 'f1', limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).not.toBeNull();
    expect(page2.items[0].summary).toBe('Activity 2');
    expect(page2.items[1].summary).toBe('Activity 1');

    const page3 = await getActivityFeed(db, { familyId: 'f1', limit: 2, cursor: page2.nextCursor! });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();
    expect(page3.items[0].summary).toBe('Activity 0');
  });

  it('filters by action', async () => {
    await insertRawActivity(db, 'x1', { action: 'person_added', summary: 'Added', createdAt: '2026-01-01T00:00:00Z' });
    await insertRawActivity(db, 'x2', { action: 'media_uploaded', summary: 'Uploaded', createdAt: '2026-01-02T00:00:00Z' });
    await insertRawActivity(db, 'x3', { action: 'person_added', summary: 'Added again', createdAt: '2026-01-03T00:00:00Z' });

    const result = await getActivityFeed(db, { familyId: 'f1', action: 'person_added' });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.action === 'person_added')).toBe(true);
  });

  it('filters by userId', async () => {
    await insertRawActivity(db, 'y1', { userId: 'u1', summary: 'By Alice', createdAt: '2026-01-01T00:00:00Z' });
    await insertRawActivity(db, 'y2', { userId: 'u2', summary: 'By Bob', createdAt: '2026-01-02T00:00:00Z' });
    await insertRawActivity(db, 'y3', { userId: 'u1', summary: 'By Alice again', createdAt: '2026-01-03T00:00:00Z' });

    const result = await getActivityFeed(db, { familyId: 'f1', userId: 'u2' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].summary).toBe('By Bob');
  });

  it('returns null nextCursor when no more pages', async () => {
    await insertRawActivity(db, 'z1', { summary: 'Only one', createdAt: '2026-01-01T00:00:00Z' });

    const result = await getActivityFeed(db, { familyId: 'f1', limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

describe('redactActivityForViewer', () => {
  const entries: ActivityEntry[] = [
    {
      id: 'a1', familyId: 'f1', userId: 'u1', action: 'person_added',
      entityType: 'person', entityId: 'living-1',
      summary: 'Added John Doe to the tree',
      metadata: null, createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'a2', familyId: 'f1', userId: 'u1', action: 'person_added',
      entityType: 'person', entityId: 'deceased-1',
      summary: 'Added Jane Doe to the tree',
      metadata: null, createdAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'a3', familyId: 'f1', userId: 'u1', action: 'gedcom_imported',
      entityType: null, entityId: null,
      summary: 'Imported GEDCOM file',
      metadata: null, createdAt: '2026-01-03T00:00:00Z',
    },
  ];

  const livingPersonIds = new Set(['living-1']);

  it('replaces summary for living person entries', () => {
    const result = redactActivityForViewer(entries, livingPersonIds);
    expect(result[0].summary).toBe('A family member had activity recorded');
  });

  it('does not modify entries for deceased persons', () => {
    const result = redactActivityForViewer(entries, livingPersonIds);
    expect(result[1].summary).toBe('Added Jane Doe to the tree');
  });

  it('does not modify entries without entityId', () => {
    const result = redactActivityForViewer(entries, livingPersonIds);
    expect(result[2].summary).toBe('Imported GEDCOM file');
  });

  it('does not mutate the original entries', () => {
    const original = entries[0].summary;
    redactActivityForViewer(entries, livingPersonIds);
    expect(entries[0].summary).toBe(original);
  });
});
