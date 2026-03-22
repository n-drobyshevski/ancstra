import type { WebSearchAdapter, WebSearchResult } from './types';

const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1/web/search';

interface BraveSearchResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

export class BraveSearchAdapter implements WebSearchAdapter {
  readonly name = 'Brave Search';

  constructor(private readonly apiKey: string) {}

  async search(query: string, limit = 20): Promise<WebSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(limit),
    });

    const res = await fetch(`${BRAVE_API_BASE}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Brave Search failed: ${res.status}`);
    }

    const data = (await res.json()) as BraveSearchResponse;
    const results = data.web?.results ?? [];

    return results.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${BRAVE_API_BASE}?q=test&count=1`, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
