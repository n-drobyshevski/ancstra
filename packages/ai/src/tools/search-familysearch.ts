import { tool } from 'ai';
import { z } from 'zod';

/**
 * Create the searchFamilySearch tool.
 * Uses the FamilySearchProvider from @ancstra/research if available.
 */
export function createSearchFamilySearchTool(options?: {
  accessToken?: string;
}) {
  return tool({
    description: 'Search FamilySearch.org records for historical records matching a person',
    parameters: z.object({
      givenName: z.string().describe('Given name'),
      surname: z.string().describe('Surname'),
      birthDate: z.string().optional().describe('Birth date (year or full date)'),
      birthPlace: z.string().optional().describe('Birth place'),
      deathDate: z.string().optional().describe('Death date'),
      deathPlace: z.string().optional().describe('Death place'),
      recordType: z.enum(['census', 'vital', 'military', 'immigration', 'church', 'any'])
        .default('any').describe('Type of record to search for'),
    }),
    execute: async (params) => {
      if (!options?.accessToken) {
        return {
          error: true,
          message: 'FamilySearch is not connected. Please connect your FamilySearch account in Settings to search their records.',
          results: [],
        };
      }

      // TODO: Integrate with FamilySearchProvider once OAuth flow is wired up
      // const provider = new FamilySearchProvider(options.accessToken);
      // const results = await provider.search({
      //   givenName: params.givenName,
      //   surname: params.surname,
      //   ...
      // });

      return {
        error: false,
        message: 'FamilySearch integration pending — provider is available but search dispatch is not yet wired.',
        results: [],
      };
    },
  });
}
