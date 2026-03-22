import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FamilySearchProvider } from '../providers/familysearch/provider.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FamilySearchProvider', () => {
  let provider: FamilySearchProvider;

  beforeEach(() => {
    provider = new FamilySearchProvider('test-access-token');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('familysearch');
    expect(provider.name).toBe('FamilySearch');
    expect(provider.type).toBe('api');
  });

  it('searches and maps results correctly', async () => {
    const fsResponse = {
      entries: [
        {
          content: {
            gedcomx: {
              persons: [
                {
                  id: 'KWCJ-RN4',
                  display: {
                    name: 'John Smith',
                    birthDate: '1 January 1850',
                    birthPlace: 'London, England',
                    deathDate: '15 March 1920',
                    deathPlace: 'New York, USA',
                    gender: 'Male',
                  },
                },
              ],
            },
          },
          score: 0.95,
        },
        {
          content: {
            gedcomx: {
              persons: [
                {
                  id: 'KWCJ-RN5',
                  display: {
                    name: 'Jane Smith',
                    birthDate: '5 May 1855',
                    birthPlace: 'Bristol, England',
                  },
                },
              ],
            },
          },
          score: 0.7,
        },
      ],
      results: 2,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fsResponse,
    });

    const results = await provider.search({
      givenName: 'John',
      surname: 'Smith',
      birthYear: 1850,
      birthPlace: 'London',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://api.familysearch.org/platform/tree/search');
    expect(url).toContain('q.givenName%3AJohn');
    expect(url).toContain('q.surname%3ASmith');
    expect(url).toContain('q.birthLikeDate%3A1850');
    expect(url).toContain('q.birthLikePlace%3ALondon');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'familysearch',
      externalId: 'KWCJ-RN4',
      title: 'John Smith',
      url: 'https://www.familysearch.org/tree/person/details/KWCJ-RN4',
      relevanceScore: 0.95,
      extractedData: {
        name: 'John Smith',
        birthDate: '1 January 1850',
        deathDate: '15 March 1920',
        location: 'London, England',
      },
    });

    expect(results[1]).toMatchObject({
      providerId: 'familysearch',
      externalId: 'KWCJ-RN5',
      title: 'Jane Smith',
    });
  });

  it('sends auth header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [], results: 0 }),
    });

    await provider.search({ surname: 'Smith' });

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer test-access-token',
      }),
    );
  });

  it('handles empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: 0 }),
    });

    const results = await provider.search({ surname: 'Zzzzzznotfound' });
    expect(results).toEqual([]);
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('allows updating access token', async () => {
    provider.setAccessToken('new-token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [], results: 0 }),
    });

    await provider.search({ surname: 'Smith' });

    const options = mockFetch.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer new-token',
      }),
    );
  });

  it('health check returns healthy when API responds 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'KWCJ-ABC' }),
    });

    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('health check returns degraded on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const status = await provider.healthCheck();
    expect(status).toBe('degraded');
  });

  it('health check returns down on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});
