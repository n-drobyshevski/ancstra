import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';

const CA_API_BASE =
  'https://www.loc.gov/collections/chronicling-america/';

interface LocItem {
  id?: string;
  title?: string;
  date?: string;
  description?: string[];
  image_url?: string[];
  location?: string[];
}

interface LocApiResponse {
  results?: LocItem[];
}

export class ChroniclingAmericaProvider implements SearchProvider {
  readonly id = 'chronicling_america';
  readonly name = 'Chronicling America';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const searchText = this.buildSearchText(query);
      if (!searchText) return [];

      const params = new URLSearchParams({
        q: searchText,
        fo: 'json',
        c: String(query.limit ?? 20),
      });

      if (query.dateRange?.start && query.dateRange?.end) {
        params.set('dates', `${query.dateRange.start}-${query.dateRange.end}`);
      }
      if (query.location) {
        params.set('fa', `location:${query.location.toLowerCase()}`);
      }

      await this.limiter.acquire();
      const res = await fetch(`${CA_API_BASE}?${params.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as LocApiResponse;
      const items = data.results ?? [];

      return items.map((item) => this.mapResult(item));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(`${CA_API_BASE}?q=test&fo=json&c=1`);
      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private buildSearchText(query: SearchRequest): string {
    const parts: string[] = [];
    if (query.surname) parts.push(query.surname);
    if (query.givenName) parts.push(query.givenName);
    if (query.freeText) parts.push(query.freeText);
    return parts.join(' ').trim();
  }

  private mapResult(item: LocItem): SearchResult {
    const snippet = item.description?.[0]
      ? item.description[0].slice(0, 300)
      : '';

    return {
      providerId: this.id,
      externalId: item.id ?? '',
      title: item.title ?? 'Untitled Newspaper Page',
      snippet,
      url: item.id ?? 'https://www.loc.gov/collections/chronicling-america/',
      recordType: 'newspaper',
    };
  }
}
