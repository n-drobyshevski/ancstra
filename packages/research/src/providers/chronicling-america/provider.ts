import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';

const CA_API_BASE =
  'https://chroniclingamerica.loc.gov/search/pages/results/';

interface CaItem {
  id?: string;
  title?: string;
  date?: string;
  ocr_eng?: string;
  url?: string;
}

interface CaApiResponse {
  totalItems?: number;
  items?: CaItem[];
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
        andtext: searchText,
        format: 'json',
        page: '1',
      });

      if (query.dateRange?.start) {
        params.set('date1', String(query.dateRange.start));
      }
      if (query.dateRange?.end) {
        params.set('date2', String(query.dateRange.end));
      }
      if (query.location) {
        params.set('state', query.location);
      }

      await this.limiter.acquire();
      const res = await fetch(`${CA_API_BASE}?${params.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as CaApiResponse;
      const items = data.items ?? [];

      return items.map((item) => this.mapResult(item));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(
        `${CA_API_BASE}?andtext=test&format=json&page=1`,
      );
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

  private mapResult(item: CaItem): SearchResult {
    const snippet = item.ocr_eng
      ? item.ocr_eng.slice(0, 300)
      : '';

    return {
      providerId: this.id,
      externalId: item.id ?? '',
      title: item.title ?? 'Untitled Newspaper Page',
      snippet,
      url:
        item.url ??
        `https://chroniclingamerica.loc.gov${item.id ?? ''}`,
      recordType: 'newspaper',
    };
  }
}
