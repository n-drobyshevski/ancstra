import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NARAProvider } from '../providers/nara/provider.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('NARAProvider', () => {
  let provider: NARAProvider;

  beforeEach(() => {
    provider = new NARAProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('nara');
    expect(provider.name).toBe('NARA Catalog');
    expect(provider.type).toBe('api');
  });

  it('returns mapped results from NARA API response', async () => {
    const naraResponse = {
      opaResponse: {
        results: {
          result: [
            {
              naId: '12345',
              description: {
                item: {
                  title: 'Census Record for Smith Family',
                  scopeAndContentNote: 'Records of the Smith family in 1940 census.',
                  digitalObjectArray: {
                    digitalObject: [
                      { objectUrl: 'https://catalog.archives.gov/media/12345.jpg' },
                    ],
                  },
                },
              },
            },
            {
              naId: '67890',
              description: {
                item: {
                  title: 'Immigration Record — Johnson',
                  scopeAndContentNote: 'Passenger manifest for Johnson.',
                },
              },
            },
          ],
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => naraResponse,
    });

    const results = await provider.search({ surname: 'Smith', limit: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://catalog.archives.gov/api/v1');
    expect(url).toContain('q=Smith');
    expect(url).toContain('resultTypes=item');
    expect(url).toContain('rows=10');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'nara',
      externalId: '12345',
      title: 'Census Record for Smith Family',
      snippet: 'Records of the Smith family in 1940 census.',
      url: 'https://catalog.archives.gov/id/12345',
    });
    expect(results[0].thumbnailUrl).toBe(
      'https://catalog.archives.gov/media/12345.jpg',
    );
    expect(results[1].thumbnailUrl).toBeUndefined();
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

  it('returns empty array on fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('health check returns healthy when API responds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ opaResponse: { results: { result: [] } } }),
    });

    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('health check returns down when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});
