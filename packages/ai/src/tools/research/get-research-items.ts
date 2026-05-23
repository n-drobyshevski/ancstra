import { tool } from 'ai';
import { z } from 'zod/v3';
import { listResearchItems } from '@ancstra/research';
import type { Database, ResearchItemStatus } from '@ancstra/db';
import { RESEARCH_ITEM_STATUSES } from '@ancstra/db';

/**
 * Create the getResearchItems tool bound to a database instance.
 */
export function createGetResearchItemsTool(db: Database) {
  return tool({
    description: 'Retrieve research items (records, notes, scraped pages) from the research workspace, optionally filtered by person or status',
    inputSchema: z.object({
      personId: z.string().optional().describe('Filter by person ID'),
      status: z
        .enum(RESEARCH_ITEM_STATUSES as unknown as [string, ...string[]])
        .optional()
        .describe('Filter by status (collected/processed/extracted/discarded)'),
    }),
    execute: async ({ personId, status }) => {
      const items = await listResearchItems(db, {
        personId,
        status: status as ResearchItemStatus | undefined,
      });

      return {
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          status: item.status,
          discoveryMethod: item.discoveryMethod,
          createdAt: item.createdAt,
          personIds: item.personIds,
        })),
        totalCount: items.length,
      };
    },
  });
}
