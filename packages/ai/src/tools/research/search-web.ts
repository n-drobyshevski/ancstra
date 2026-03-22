import { tool } from 'ai';
import { z } from 'zod';
import type { ProviderRegistry, SearchResult } from '@ancstra/research';

interface WebSearchToolResult {
  results: Array<{
    providerId: string;
    title: string;
    url: string;
    snippet: string;
    relevanceScore?: number;
  }>;
  totalResults: number;
}

/**
 * Execute a federated web search across registered providers.
 */
export async function executeSearchWeb(
  registry: ProviderRegistry,
  params: {
    query: string;
    providers?: string[];
    maxResults?: number;
  }
): Promise<WebSearchToolResult> {
  const { query, providers, maxResults = 10 } = params;

  // If specific providers requested, temporarily filter
  let results: SearchResult[];

  if (providers && providers.length > 0) {
    // Search only specified providers
    const settled = await Promise.allSettled(
      providers.map(async (providerId) => {
        const provider = registry.get(providerId);
        if (!provider || !registry.isEnabled(providerId)) return [];
        return provider.search({ freeText: query, limit: maxResults });
      })
    );
    results = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      }
    }
  } else {
    results = await registry.searchAll({ freeText: query, limit: maxResults });
  }

  const mapped = results.slice(0, maxResults).map(r => ({
    providerId: r.providerId,
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    relevanceScore: r.relevanceScore,
  }));

  return {
    results: mapped,
    totalResults: mapped.length,
  };
}

/**
 * Create the searchWeb tool bound to a ProviderRegistry instance.
 */
export function createSearchWebTool(registry: ProviderRegistry) {
  return tool({
    description: 'Search the web across multiple genealogy record providers for historical records and information',
    parameters: z.object({
      query: z.string().describe('Search query text'),
      providers: z.array(z.string()).optional().describe('Specific provider IDs to search (e.g., ["nara", "chronicling_america"])'),
      maxResults: z.number().default(10).describe('Maximum number of results to return'),
    }),
    execute: async (params) => executeSearchWeb(registry, params),
  });
}
