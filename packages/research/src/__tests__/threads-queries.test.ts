import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { addEvent } from '../threads/events';
import { listThreads, getThread } from '../threads/queries';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('listThreads', () => {
  it('returns all threads ordered by updatedAt desc', async () => {
    const a = await createThread(db as any, { title: 'A', createdBy: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    const b = await createThread(db as any, { title: 'B', createdBy: 'u1' });
    const list = await listThreads(db as any);
    expect(list.map(t => t.id)).toEqual([b.id, a.id]);
  });

  it('filters by status', async () => {
    await createThread(db as any, { title: 'A', createdBy: 'u1' });
    const list = await listThreads(db as any, { status: 'paused' });
    expect(list).toHaveLength(0);
  });

  it('filters by createdBy', async () => {
    await createThread(db as any, { title: 'A', createdBy: 'u1' });
    await createThread(db as any, { title: 'B', createdBy: 'u2' });
    const list = await listThreads(db as any, { createdBy: 'u2' });
    expect(list.map(t => t.title)).toEqual(['B']);
  });

  describe('q filter (case-insensitive title LIKE)', () => {
    it('returns matching titles regardless of case', async () => {
      await createThread(db as any, { title: 'Eleonora WWII trail', createdBy: 'u1' });
      await createThread(db as any, { title: 'Lindgren parish', createdBy: 'u1' });
      await createThread(db as any, { title: 'DNA Match — Drobyshevskij', createdBy: 'u1' });

      const lower = await listThreads(db as any, { q: 'eleonora' });
      const upper = await listThreads(db as any, { q: 'DNA' });
      const mid = await listThreads(db as any, { q: 'parish' });

      expect(lower.map(t => t.title)).toEqual(['Eleonora WWII trail']);
      expect(upper.map(t => t.title)).toEqual(['DNA Match — Drobyshevskij']);
      expect(mid.map(t => t.title)).toEqual(['Lindgren parish']);
    });

    it('returns empty when nothing matches', async () => {
      await createThread(db as any, { title: 'A', createdBy: 'u1' });
      const list = await listThreads(db as any, { q: 'zzz-no-match-zzz' });
      expect(list).toEqual([]);
    });

    it('treats empty/whitespace q as no filter', async () => {
      await createThread(db as any, { title: 'A', createdBy: 'u1' });
      await createThread(db as any, { title: 'B', createdBy: 'u1' });
      const empty = await listThreads(db as any, { q: '' });
      const blank = await listThreads(db as any, { q: '   ' });
      expect(empty).toHaveLength(2);
      expect(blank).toHaveLength(2);
    });
  });
});

describe('getThread', () => {
  it('returns thread with eventCount', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    const result = await getThread(db as any, t.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(t.id);
    expect(result!.eventCount).toBe(2);
  });

  it('returns null for unknown id', async () => {
    expect(await getThread(db as any, 'missing')).toBeNull();
  });
});
