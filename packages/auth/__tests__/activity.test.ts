import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { logActivity, getActivityFeed, redactActivityForViewer, type ActivityEntry } from '../src/activity';

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS family_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    db_filename TEXT NOT NULL,
    moderation_enabled INTEGER NOT NULL DEFAULT 0,
    max_members INTEGER NOT NULL DEFAULT 50,
      monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_feed (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    summary TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_activity_feed_family_date ON activity_feed(family_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
`;

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_TABLES_SQL);

  const now = new Date().toISOString();
  sqlite.prepare(`INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('u1', 'a@b.com', 'Alice', now, now);
  sqlite.prepare(`INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run('u2', 'b@c.com', 'Bob', now, now);
  sqlite.prepare(`INSERT INTO family_registry (id, name, owner_id, db_filename, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('f1', 'Test Family', 'u1', 'test.db', now, now);

  return { db: drizzle(sqlite), sqlite };
}

function insertRawActivity(sqlite: Database.Database, id: string, opts: {
  familyId?: string; userId?: string; action?: string; summary?: string; createdAt: string;
  entityType?: string; entityId?: string;
}) {
  sqlite.prepare(`
    INSERT INTO activity_feed (id, family_id, user_id, action, summary, created_at, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.familyId ?? 'f1',
    opts.userId ?? 'u1',
    opts.action ?? 'person_added',
    opts.summary ?? `Activity ${id}`,
    opts.createdAt,
    opts.entityType ?? null,
    opts.entityId ?? null,
  );
}

describe('logActivity', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a row into activity_feed', () => {
    logActivity(db, {
      familyId: 'f1',
      userId: 'u1',
      action: 'person_added',
      entityType: 'person',
      entityId: 'p1',
      summary: 'Added John Doe',
      metadata: { source: 'manual' },
    });

    const result = getActivityFeed(db, { familyId: 'f1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].action).toBe('person_added');
    expect(result.items[0].summary).toBe('Added John Doe');
    expect(result.items[0].entityType).toBe('person');
    expect(result.items[0].entityId).toBe('p1');
    expect(result.items[0].metadata).toEqual({ source: 'manual' });
  });

  it('inserts with optional fields omitted', () => {
    logActivity(db, {
      familyId: 'f1',
      userId: 'u1',
      action: 'gedcom_imported',
      summary: 'Imported GEDCOM file',
    });

    const result = getActivityFeed(db, { familyId: 'f1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].entityType).toBeNull();
    expect(result.items[0].entityId).toBeNull();
    expect(result.items[0].metadata).toBeNull();
  });
});

describe('getActivityFeed', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ db, sqlite } = createTestDb());
  });

  it('returns items ordered by created_at desc', () => {
    insertRawActivity(sqlite, 'a1', { summary: 'First', createdAt: '2026-01-01T00:00:00Z' });
    insertRawActivity(sqlite, 'a2', { summary: 'Second', createdAt: '2026-01-02T00:00:00Z' });
    insertRawActivity(sqlite, 'a3', { summary: 'Third', createdAt: '2026-01-03T00:00:00Z' });

    const result = getActivityFeed(db, { familyId: 'f1' });
    expect(result.items.map((i) => i.summary)).toEqual(['Third', 'Second', 'First']);
  });

  it('respects limit and returns nextCursor', () => {
    for (let i = 0; i < 5; i++) {
      insertRawActivity(sqlite, `item${i}`, {
        summary: `Activity ${i}`,
        createdAt: `2026-01-0${i + 1}T00:00:00Z`,
      });
    }

    const page1 = getActivityFeed(db, { familyId: 'f1', limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.items[0].summary).toBe('Activity 4');
    expect(page1.items[1].summary).toBe('Activity 3');

    const page2 = getActivityFeed(db, { familyId: 'f1', limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).not.toBeNull();
    expect(page2.items[0].summary).toBe('Activity 2');
    expect(page2.items[1].summary).toBe('Activity 1');

    const page3 = getActivityFeed(db, { familyId: 'f1', limit: 2, cursor: page2.nextCursor! });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();
    expect(page3.items[0].summary).toBe('Activity 0');
  });

  it('filters by action', () => {
    insertRawActivity(sqlite, 'x1', { action: 'person_added', summary: 'Added', createdAt: '2026-01-01T00:00:00Z' });
    insertRawActivity(sqlite, 'x2', { action: 'media_uploaded', summary: 'Uploaded', createdAt: '2026-01-02T00:00:00Z' });
    insertRawActivity(sqlite, 'x3', { action: 'person_added', summary: 'Added again', createdAt: '2026-01-03T00:00:00Z' });

    const result = getActivityFeed(db, { familyId: 'f1', action: 'person_added' });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.action === 'person_added')).toBe(true);
  });

  it('filters by userId', () => {
    insertRawActivity(sqlite, 'y1', { userId: 'u1', summary: 'By Alice', createdAt: '2026-01-01T00:00:00Z' });
    insertRawActivity(sqlite, 'y2', { userId: 'u2', summary: 'By Bob', createdAt: '2026-01-02T00:00:00Z' });
    insertRawActivity(sqlite, 'y3', { userId: 'u1', summary: 'By Alice again', createdAt: '2026-01-03T00:00:00Z' });

    const result = getActivityFeed(db, { familyId: 'f1', userId: 'u2' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].summary).toBe('By Bob');
  });

  it('returns null nextCursor when no more pages', () => {
    insertRawActivity(sqlite, 'z1', { summary: 'Only one', createdAt: '2026-01-01T00:00:00Z' });

    const result = getActivityFeed(db, { familyId: 'f1', limit: 10 });
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
