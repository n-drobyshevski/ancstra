import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NARAProvider } from '../providers/nara/provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('NARAProvider', () => {
  let provider: NARAProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NARA_API_KEY: 'test-key-123' };
    provider = new NARAProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('nara');
    expect(provider.name).toBe('NARA Catalog');
    expect(provider.type).toBe('api');
  });

  it('returns mapped results from NARA v2 API response', async () => {
    const naraV2Response = {
      body: {
        hits: {
          total: 2,
          hits: [
            {
              _id: '12345',
              _source: {
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
            },
            {
              _id: '67890',
              _source: {
                description: {
                  item: {
                    title: 'Immigration Record — Johnson',
                    scopeAndContentNote: 'Passenger manifest for Johnson.',
                  },
                },
              },
            },
          ],
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => naraV2Response,
    });

    const results = await provider.search({ surname: 'Smith', limit: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://catalog.archives.gov/api/v2/records/search');
    expect(url).toContain('q=Smith');
    expect(url).toContain('limit=10');

    // Verify x-api-key header
    const fetchOpts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchOpts.headers).toMatchObject({ 'x-api-key': 'test-key-123' });

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

  it('returns empty array when no API key configured', async () => {
    delete process.env['NARA_API_KEY'];
    const noKeyProvider = new NARAProvider();
    const results = await noKeyProvider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
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
      json: async () => ({ body: { hits: { total: 0, hits: [] } } }),
    });

    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('health check returns down when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });

  it('health check returns down when no API key', async () => {
    delete process.env['NARA_API_KEY'];
    const noKeyProvider = new NARAProvider();
    const status = await noKeyProvider.healthCheck();
    expect(status).toBe('down');
  });
});
