import { tool } from 'ai';
import { z } from 'zod/v3';
import { getThread, getThreadTimeline } from '@ancstra/research';
import type { Database } from '@ancstra/db';

export interface SummarizeThreadResult {
  threadId: string;
  threadTitle: string;
  status: string;
  eventCount: number;
  /** Compact, structured payload Claude formats into markdown. */
  context: {
    title: string;
    status: string;
    summary: string | null;
    events: Array<{ eventType: string; reason: string | null; occurredAt: string }>;
  };
  /** Instruction Claude follows when emitting the markdown narrative. */
  instruction: string;
}

const INSTRUCTION = `Write a structured markdown narrative of this research thread. Use exactly these sections:

## Investigation
1-3 sentences: what's being investigated, who/what is the seed, what's the current state.

## Key findings
Bulleted list of confirmed/likely facts established by the thread (cite the event type or factsheet that established each, e.g., "[factsheet_promoted]" or "[mention_followed]").

## Open questions
Bulleted list of unresolved questions or gaps the thread has surfaced.

## Suggested next steps
2-4 bulleted next moves with brief rationale.

Keep total length under 300 words. Use the user's voice: matter-of-fact, citing evidence.`;

/**
 * Build the summarize_thread tool bound to a family DB.
 *
 * Input: { threadId }. Returns a structured payload + instruction telling
 * Claude to format the thread's history as a 4-section markdown narrative.
 * Returns { error } when the thread is not found.
 */
export function createSummarizeThreadTool(db: Database) {
  return tool({
    description: 'Generate a structured markdown summary of a research thread (Investigation, Key findings, Open questions, Suggested next steps).',
    inputSchema: z.object({
      threadId: z.string().describe('The research thread to summarize'),
    }),
    execute: async ({ threadId }) => {
      const thread = await getThread(db, threadId);
      if (!thread) {
        return { error: `Thread ${threadId} not found` };
      }
      const events = await getThreadTimeline(db, threadId, { limit: 50 });
      const result: SummarizeThreadResult = {
        threadId,
        threadTitle: thread.title,
        status: thread.status,
        eventCount: thread.eventCount ?? events.length,
        context: {
          title: thread.title,
          status: thread.status,
          summary: thread.summary,
          events: events.map(e => ({
            eventType: e.eventType,
            reason: e.reason,
            occurredAt: e.occurredAt,
          })),
        },
        instruction: INSTRUCTION,
      };
      return result;
    },
  });
}
