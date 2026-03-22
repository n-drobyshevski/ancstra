import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import type { WebSearchAdapter } from './types';
import { SearXNGAdapter } from './searxng';
import { BraveSearchAdapter } from './brave';

export class WebSearchProvider implements SearchProvider {
  readonly id = 'web_search';
  readonly name = 'Web Search';
  readonly type: ProviderType = 'web_search';

  constructor(private readonly adapter: WebSearchAdapter) {}

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const searchQuery = this.buildGenealogyQuery(query);
      if (!searchQuery) return [];

      const limit = query.limit ?? 20;
      const rawResults = await this.adapter.search(searchQuery, limit);

      const mapped = rawResults.map((r) => this.mapResult(r));
      return this.deduplicateByUrl(mapped);
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const healthy = await this.adapter.healthCheck();
      return healthy ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  /**
   * Build a genealogy-focused search query string.
   */
  buildGenealogyQuery(query: SearchRequest): string {
    const parts: string[] = [];

    // Build the name portion in quotes for exact matching
    const nameParts = [query.givenName, query.surname].filter(Boolean);
    if (nameParts.length > 0) {
      parts.push(`"${nameParts.join(' ')}"`);
    }

    parts.push('genealogy');

    if (query.birthYear) parts.push(String(query.birthYear));
    if (query.deathYear) parts.push(String(query.deathYear));
    if (query.location) parts.push(query.location);
    if (query.birthPlace) parts.push(query.birthPlace);
    if (query.freeText) parts.push(query.freeText);

    return parts.join(' ').trim();
  }

  private mapResult(result: {
    title: string;
    url: string;
    snippet: string;
  }): SearchResult {
    return {
      providerId: this.id,
      externalId: result.url,
      title: result.title,
      snippet: result.snippet,
      url: result.url,
      recordType: 'online',
    };
  }

  private deduplicateByUrl(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }
}

/**
 * Factory: create a WebSearchProvider based on available environment variables.
 * Checks SEARXNG_URL first, then BRAVE_API_KEY.
 * Returns null if neither is configured.
 */
export function createWebSearchProvider(): WebSearchProvider | null {
  const searxngUrl = process.env['SEARXNG_URL'];
  if (searxngUrl) {
    return new WebSearchProvider(new SearXNGAdapter(searxngUrl));
  }

  const braveApiKey = process.env['BRAVE_API_KEY'];
  if (braveApiKey) {
    return new WebSearchProvider(new BraveSearchAdapter(braveApiKey));
  }

  return null;
}
