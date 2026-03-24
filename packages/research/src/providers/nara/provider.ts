import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';

const NARA_API_BASE = 'https://catalog.archives.gov/api/v2/records/search';

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

interface NaraHit {
  _id: string;
  _source?: {
    description?: {
      item?: NaraItem;
    };
  };
}

interface NaraV2Response {
  body?: {
    hits?: {
      total?: number;
      hits?: NaraHit[];
    };
  };
}

export class NARAProvider implements SearchProvider {
  readonly id = 'nara';
  readonly name = 'NARA Catalog';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['NARA_API_KEY'];
  }

  async search(query: SearchRequest): Promise<SearchResult[]> {
    if (!this.apiKey) return [];

    try {
      const q = this.buildQueryString(query);
      if (!q) return [];

      const limit = query.limit ?? 20;
      const params = new URLSearchParams({
        q,
        limit: String(limit),
      });

      await this.limiter.acquire();
      const res = await fetch(`${NARA_API_BASE}?${params.toString()}`, {
        headers: { 'x-api-key': this.apiKey },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as NaraV2Response;
      const hits = data.body?.hits?.hits ?? [];

      return hits.map((hit) => this.mapResult(hit));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.apiKey) return 'down';

    try {
      await this.limiter.acquire();
      const res = await fetch(`${NARA_API_BASE}?q=test&limit=1`, {
        headers: { 'x-api-key': this.apiKey },
      });
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

  private mapResult(hit: NaraHit): SearchResult {
    const item = hit._source?.description?.item;
    const thumbnail =
      item?.digitalObjectArray?.digitalObject?.[0]?.objectUrl;

    return {
      providerId: this.id,
      externalId: String(hit._id),
      title: item?.title ?? 'Untitled Record',
      snippet: item?.scopeAndContentNote ?? '',
      url: `https://catalog.archives.gov/id/${hit._id}`,
      ...(thumbnail ? { thumbnailUrl: thumbnail } : {}),
    };
  }
}
