import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, type ActiveThreadContext } from '../prompts/research-assistant';
import type { TreeContext } from '../context/tree-context';

const minimalTree: TreeContext = {
  summary: '',
  keyPersons: [],
  gaps: [],
  recentActivity: [],
};

describe('buildSystemPrompt active-thread block', () => {
  it('omits the block when no thread context provided', () => {
    const prompt = buildSystemPrompt(minimalTree);
    expect(prompt).not.toContain('<active_thread');
    expect(prompt).not.toContain('Active Research Thread');
  });

  it('omits the block when null thread context', () => {
    const prompt = buildSystemPrompt(minimalTree, null);
    expect(prompt).not.toContain('<active_thread');
  });

  it('renders the block with title, status, summary, and events', () => {
    const ctx: ActiveThreadContext = {
      id: 'tid',
      title: "Find John's parents",
      status: 'active',
      summary: 'Working through marriage cert',
      recentEvents: [
        { eventType: 'thread_started', reason: null, occurredAt: '2026-05-10T00:00:00Z' },
        { eventType: 'note_added', reason: 'starting investigation', occurredAt: '2026-05-10T00:01:00Z' },
      ],
    };
    const prompt = buildSystemPrompt(minimalTree, ctx);
    expect(prompt).toContain("Find John's parents");
    expect(prompt).toContain('status="active"');
    expect(prompt).toContain('Summary: Working through marriage cert');
    expect(prompt).toContain('thread_started');
    expect(prompt).toContain('note_added: starting investigation');
  });

  it('renders an "(no events yet)" placeholder when events array is empty', () => {
    const ctx: ActiveThreadContext = {
      id: 'tid', title: 'T', status: 'active', summary: null, recentEvents: [],
    };
    const prompt = buildSystemPrompt(minimalTree, ctx);
    expect(prompt).toContain('<active_thread');
    expect(prompt).toContain('(no events yet)');
  });
});
