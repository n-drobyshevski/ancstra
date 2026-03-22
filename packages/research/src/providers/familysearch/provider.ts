import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';
import type { FSSearchResponse, FSPerson } from './types';

const FS_API_BASE = 'https://api.familysearch.org/platform/tree';

export class FamilySearchProvider implements SearchProvider {
  readonly id = 'familysearch';
  readonly name = 'FamilySearch';
  readonly type: ProviderType = 'api';

  private accessToken: string;
  private limiter = new RateLimiter(30);

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const qParts = this.buildQueryParts(query);
      if (qParts.length === 0) return [];

      const params = new URLSearchParams();
      params.set('q', qParts.join(' '));
      if (query.limit) {
        params.set('count', String(query.limit));
      }
      if (query.offset) {
        params.set('start', String(query.offset));
      }

      await this.limiter.acquire();
      const res = await fetch(`${FS_API_BASE}/search?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as FSSearchResponse;
      const entries = data.entries ?? [];

      return entries.flatMap((entry) => {
        const persons = entry.content.gedcomx.persons ?? [];
        return persons.map((person) => this.mapResult(person, entry.score));
      });
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(`${FS_API_BASE}/current-person`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) return 'healthy';
      if (res.status === 401) return 'degraded';
      return 'down';
    } catch {
      return 'down';
    }
  }

  private buildQueryParts(query: SearchRequest): string[] {
    const parts: string[] = [];
    if (query.givenName) parts.push(`q.givenName:${query.givenName}`);
    if (query.surname) parts.push(`q.surname:${query.surname}`);
    if (query.birthYear) parts.push(`q.birthLikeDate:${query.birthYear}`);
    if (query.birthPlace) parts.push(`q.birthLikePlace:${query.birthPlace}`);
    if (query.deathYear) parts.push(`q.deathLikeDate:${query.deathYear}`);
    return parts;
  }

  private mapResult(person: FSPerson, score?: number): SearchResult {
    const display = person.display;
    return {
      providerId: this.id,
      externalId: person.id,
      title: display.name,
      snippet: this.buildSnippet(display),
      url: `https://www.familysearch.org/tree/person/details/${person.id}`,
      relevanceScore: score,
      extractedData: {
        name: display.name,
        birthDate: display.birthDate,
        deathDate: display.deathDate,
        location: display.birthPlace,
      },
    };
  }

  private buildSnippet(display: FSPerson['display']): string {
    const parts: string[] = [];
    if (display.birthDate) parts.push(`b. ${display.birthDate}`);
    if (display.birthPlace) parts.push(display.birthPlace);
    if (display.deathDate) parts.push(`d. ${display.deathDate}`);
    if (display.deathPlace) parts.push(display.deathPlace);
    return parts.join(' — ') || display.name;
  }
}
