import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';
import type { WikiTreePerson, WikiTreeSearchResponse } from './types';

const WIKITREE_API = 'https://api.wikitree.com/api.php';

export class WikiTreeProvider implements SearchProvider {
  readonly id = 'wikitree';
  readonly name = 'WikiTree';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      if (!query.surname && !query.givenName && !query.freeText) return [];

      const formData = new URLSearchParams();
      formData.set('action', 'searchPerson');
      formData.set('appId', 'Ancstra');
      if (query.givenName) formData.set('FirstName', query.givenName);
      if (query.surname) formData.set('LastName', query.surname);
      if (query.birthYear)
        formData.set('BirthDate', String(query.birthYear));
      if (query.deathYear)
        formData.set('DeathDate', String(query.deathYear));
      if (query.limit) formData.set('limit', String(query.limit));

      await this.limiter.acquire();
      const res = await fetch(WIKITREE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as WikiTreeSearchResponse;
      const persons = this.extractPersons(data);

      // Filter out living persons
      const deceased = persons.filter((p) => p.IsLiving !== 1);

      return deceased.map((p) => this.mapResult(p));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const formData = new URLSearchParams();
      formData.set('action', 'searchPerson');
      formData.set('appId', 'Ancstra');
      formData.set('LastName', 'Smith');
      formData.set('limit', '1');

      const res = await fetch(WIKITREE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private extractPersons(data: WikiTreeSearchResponse): WikiTreePerson[] {
    // The API may return results under searchResults or as indexed entries
    if (Array.isArray(data.searchResults)) {
      return data.searchResults;
    }

    // Try to extract from numbered keys
    const persons: WikiTreePerson[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'status') continue;
      if (
        typeof value === 'object' &&
        value !== null &&
        'Id' in value &&
        'Name' in value
      ) {
        persons.push(value as WikiTreePerson);
      }
    }

    return persons;
  }

  private mapResult(person: WikiTreePerson): SearchResult {
    const nameParts = [person.FirstName, person.LastNameAtBirth].filter(
      Boolean,
    );
    const displayName =
      person.LongName || nameParts.join(' ') || person.Name;

    const snippetParts: string[] = [];
    if (person.BirthDate) snippetParts.push(`b. ${person.BirthDate}`);
    if (person.DeathDate) snippetParts.push(`d. ${person.DeathDate}`);
    if (person.BirthLocation) snippetParts.push(person.BirthLocation);

    return {
      providerId: this.id,
      externalId: String(person.Id),
      title: displayName,
      snippet: snippetParts.join(' | '),
      url: `https://www.wikitree.com/wiki/${person.Name}`,
      recordType: 'online',
      extractedData: {
        name: displayName,
        birthDate: person.BirthDate,
        deathDate: person.DeathDate,
        location: person.BirthLocation,
      },
    };
  }
}
