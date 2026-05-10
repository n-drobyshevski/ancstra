import { tool } from 'ai';
import { z } from 'zod/v3';
import { getThread, getThreadTimeline } from '@ancstra/research';
import type { Database } from '@ancstra/db';

const INSTRUCTION = `Based on the thread context above, propose exactly 3 ranked next steps. Format as JSON:

{
  "options": [
    {
      "title": "Short title (<= 60 chars)",
      "rationale": "1-2 sentences explaining why this is the next move",
      "suggestedTool": "searchFamilySearch" | "searchNARA" | "searchNewspapers" | "extractFacts" | "proposeRelationship" | null,
      "suggestedArgs": {} | null
    }
  ]
}

Rank by likelihood of producing useful evidence. Be specific: name actual record types, providers, queries.`;

/**
 * Build the suggest_next_step tool bound to a family DB.
 *
 * Input: { threadId }. Returns recent thread context + an instruction telling
 * Claude to emit exactly 3 ranked options with rationale and (optional) tool
 * + args for one-click execution by the chat UI.
 */
export function createSuggestNextStepTool(db: Database) {
  return tool({
    description: 'Suggest the next 3 research moves for a thread, ranked by likelihood of producing useful evidence.',
    inputSchema: z.object({
      threadId: z.string().describe('The research thread to suggest next steps for'),
    }),
    execute: async ({ threadId }) => {
      const thread = await getThread(db, threadId);
      if (!thread) {
        return { error: `Thread ${threadId} not found` };
      }
      const events = await getThreadTimeline(db, threadId, { limit: 30 });
      return {
        threadId,
        threadTitle: thread.title,
        status: thread.status,
        seedPersonId: thread.seedPersonId ?? null,
        seedFactsheetId: thread.seedFactsheetId ?? null,
        eventCount: events.length,
        recentEvents: events.slice(-15).map(e => ({
          eventType: e.eventType,
          reason: e.reason,
          occurredAt: e.occurredAt,
        })),
        instruction: INSTRUCTION,
      };
    },
  });
}
