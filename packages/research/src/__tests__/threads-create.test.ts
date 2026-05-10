import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';

const THREAD_DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT,
    seed_factsheet_id TEXT,
    seed_research_item_id TEXT,
    summary TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](THREAD_DDL);
});

describe('createThread', () => {
  it('inserts a thread with defaults and returns it', async () => {
    const thread = await createThread(db as any, {
      title: "Find John Smith's parents",
      createdBy: 'user-1',
    });
    expect(thread.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(thread.title).toBe("Find John Smith's parents");
    expect(thread.status).toBe('active');
    expect(thread.createdBy).toBe('user-1');
    expect(thread.createdAt).toBeTruthy();
    expect(thread.closedAt).toBeNull();
  });

  it('persists optional seed fields', async () => {
    const thread = await createThread(db as any, {
      title: 'From person',
      createdBy: 'user-1',
      seedPersonId: 'person-42',
      summary: 'kicked off from tree',
    });
    expect(thread.seedPersonId).toBe('person-42');
    expect(thread.summary).toBe('kicked off from tree');
  });
});
