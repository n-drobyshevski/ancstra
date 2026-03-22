import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types.js';

const MOCK_RESULTS: SearchResult[] = [
  {
    providerId: 'mock',
    externalId: 'mock-census-1',
    title: '1940 U.S. Census — Smith Household',
    snippet:
      'John Smith, age 35, head of household. Springfield, IL. Occupation: Farmer.',
    url: 'https://example.com/census/1940/smith',
    recordType: 'census',
    relevanceScore: 0.95,
    extractedData: {
      name: 'John Smith',
      birthDate: '1905',
      location: 'Springfield, IL',
    },
  },
  {
    providerId: 'mock',
    externalId: 'mock-immigration-1',
    title: 'Ellis Island Passenger Record — Maria Smith',
    snippet:
      'Maria Smith, age 28, arrived 1923 from Naples, Italy. Ship: SS Roma.',
    url: 'https://example.com/immigration/ellis/smith',
    recordType: 'immigration',
    relevanceScore: 0.82,
    extractedData: {
      name: 'Maria Smith',
      location: 'Naples, Italy',
    },
  },
  {
    providerId: 'mock',
    externalId: 'mock-newspaper-1',
    title: 'Springfield Daily — Smith Wedding Announcement',
    snippet:
      'The marriage of John Smith and Mary Johnson was celebrated on June 15, 1930.',
    url: 'https://example.com/newspaper/springfield/1930/smith',
    recordType: 'newspaper',
    relevanceScore: 0.7,
  },
];

export class MockProvider implements SearchProvider {
  readonly id = 'mock';
  readonly name = 'Mock (Development)';
  readonly type: ProviderType = 'api';

  async search(query: SearchRequest): Promise<SearchResult[]> {
    const term = (query.surname ?? query.freeText ?? '').toLowerCase();
    if (!term) return MOCK_RESULTS;

    return MOCK_RESULTS.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        r.snippet.toLowerCase().includes(term),
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    return 'healthy';
  }
}
