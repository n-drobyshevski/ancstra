import { tool } from 'ai';
import { z } from 'zod';
import { listResearchItems } from '@ancstra/research';
import type { Database } from '@ancstra/db';

/**
 * Create the getResearchItems tool bound to a database instance.
 */
export function createGetResearchItemsTool(db: Database) {
  return tool({
    description: 'Retrieve research items (records, notes, scraped pages) from the research workspace, optionally filtered by person or status',
    parameters: z.object({
      personId: z.string().optional().describe('Filter by person ID'),
      status: z.enum(['draft', 'promoted', 'dismissed']).optional().describe('Filter by status'),
    }),
    execute: async ({ personId, status }) => {
      const items = await listResearchItems(db, {
        personId,
        status,
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
