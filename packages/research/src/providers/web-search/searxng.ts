import type { WebSearchAdapter, WebSearchResult } from './types';

interface SearXNGResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearXNGResponse {
  results?: SearXNGResult[];
}

export class SearXNGAdapter implements WebSearchAdapter {
  readonly name = 'SearXNG';

  constructor(private readonly baseUrl: string) {}

  async search(query: string, limit = 20): Promise<WebSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      pageno: '1',
    });

    const res = await fetch(`${this.baseUrl}/search?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`SearXNG search failed: ${res.status}`);
    }

    const data = (await res.json()) as SearXNGResponse;
    const results = data.results ?? [];

    return results.slice(0, limit).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/search?q=test&format=json`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
