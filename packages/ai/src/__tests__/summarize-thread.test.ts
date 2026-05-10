import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread, addEvent } from '@ancstra/research';
import { createSummarizeThreadTool } from '../tools/research/summarize-thread';

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

describe('summarize_thread tool', () => {
  it('returns structured context + instruction for Claude', async () => {
    const t = await createThread(db as any, { title: 'Find John', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: 'starting' });

    const tool = createSummarizeThreadTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: t.id }, {} as any);

    expect(res.threadTitle).toBe('Find John');
    expect(res.status).toBe('active');
    expect(res.context.events).toHaveLength(1);
    expect(res.context.events[0].eventType).toBe('note_added');
    expect(res.context.events[0].reason).toBe('starting');
    expect(res.instruction).toContain('## Investigation');
    expect(res.instruction).toContain('## Key findings');
    expect(res.instruction).toContain('## Open questions');
    expect(res.instruction).toContain('## Suggested next steps');
  });

  it('returns error for unknown thread', async () => {
    const tool = createSummarizeThreadTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: 'missing' }, {} as any);
    expect(res.error).toContain('not found');
  });

  it('respects the 50-event limit (caps stale threads)', async () => {
    const t = await createThread(db as any, { title: 'Long', createdBy: 'u1' });
    for (let i = 0; i < 55; i++) {
      await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: `n${i}` });
    }
    const tool = createSummarizeThreadTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: t.id }, {} as any);
    expect(res.context.events.length).toBeLessThanOrEqual(50);
  });
});
