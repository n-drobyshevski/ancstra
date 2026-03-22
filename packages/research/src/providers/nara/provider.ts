import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

const NARA_API_BASE = 'https://catalog.archives.gov/api/v1';

interface NaraDigitalObject {
  objectUrl?: string;
}

interface NaraItem {
  title?: string;
  scopeAndContentNote?: string;
  digitalObjectArray?: {
    digitalObject?: NaraDigitalObject[];
  };
}

interface NaraResultEntry {
  naId: string;
  description?: {
    item?: NaraItem;
  };
}

interface NaraApiResponse {
  opaResponse?: {
    results?: {
      result?: NaraResultEntry[];
    };
  };
}

export class NARAProvider implements SearchProvider {
  readonly id = 'nara';
  readonly name = 'NARA Catalog';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const q = this.buildQueryString(query);
      if (!q) return [];

      const rows = query.limit ?? 20;
      const params = new URLSearchParams({
        q,
        resultTypes: 'item',
        rows: String(rows),
      });

      await this.limiter.acquire();
      const res = await fetch(`${NARA_API_BASE}?${params.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as NaraApiResponse;
      const entries = data.opaResponse?.results?.result ?? [];

      return entries.map((entry) => this.mapResult(entry));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(
        `${NARA_API_BASE}?q=test&resultTypes=item&rows=1`,
      );
      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private buildQueryString(query: SearchRequest): string {
    const parts: string[] = [];
    if (query.surname) parts.push(query.surname);
    if (query.givenName) parts.push(query.givenName);
    if (query.freeText) parts.push(query.freeText);
    return parts.join(' ').trim();
  }

  private mapResult(entry: NaraResultEntry): SearchResult {
    const item = entry.description?.item;
    const thumbnail =
      item?.digitalObjectArray?.digitalObject?.[0]?.objectUrl;

    return {
      providerId: this.id,
      externalId: String(entry.naId),
      title: item?.title ?? 'Untitled Record',
      snippet: item?.scopeAndContentNote ?? '',
      url: `https://catalog.archives.gov/id/${entry.naId}`,
      ...(thumbnail ? { thumbnailUrl: thumbnail } : {}),
    };
  }
}
