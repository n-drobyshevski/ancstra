import { tool } from 'ai';
import { z } from 'zod/v3';

/**
 * Explain a historical record in context.
 * This is a pass-through tool — Claude interprets the content
 * using its knowledge. No DB access needed.
 */
export const explainRecordTool = tool({
  description: 'Explain a historical record in context — what it means, what to look for, and related records',
  inputSchema: z.object({
    recordType: z.string().describe('Type of record (census, will, ship manifest, etc.)'),
    recordContent: z.string().describe('Text or summary of the record'),
    year: z.number().optional().describe('Year of the record'),
    location: z.string().optional().describe('Location of the record'),
  }),
  execute: async ({ recordType, recordContent, year, location }) => {
    return {
      recordType,
      year: year ?? null,
      location: location ?? null,
      parsedContent: recordContent,
    };
  },
});
