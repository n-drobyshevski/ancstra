import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChroniclingAmericaProvider } from '../providers/chronicling-america/provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ChroniclingAmericaProvider', () => {
  let provider: ChroniclingAmericaProvider;

  beforeEach(() => {
    provider = new ChroniclingAmericaProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('chronicling_america');
    expect(provider.name).toBe('Chronicling America');
    expect(provider.type).toBe('api');
  });

  it('returns newspaper results from LOC collections API', async () => {
    const locResponse = {
      results: [
        {
          id: 'http://www.loc.gov/resource/sn83045555/1902-08-09/ed-1/?sp=9',
          title: 'Deseret Evening News',
          date: '1902-08-09',
          description: [
            'AND SMITH FAMILY GENEALOGY records from Topsfield.',
          ],
          image_url: [
            'https://tile.loc.gov/image-services/iiif/service:ndnp:uuml:batch_uuml_nine_ver01/full/pct:6.25/0/default.jpg',
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => locResponse,
    });

    const results = await provider.search({ freeText: 'Smith genealogy' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://www.loc.gov/collections/chronicling-america/');
    expect(url).toContain('q=Smith+genealogy');
    expect(url).toContain('fo=json');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: 'chronicling_america',
      externalId: 'http://www.loc.gov/resource/sn83045555/1902-08-09/ed-1/?sp=9',
      title: 'Deseret Evening News',
      recordType: 'newspaper',
    });
    expect(results[0].snippet).toContain('SMITH FAMILY GENEALOGY');
  });

  it('supports date range filtering via date params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await provider.search({
      freeText: 'Smith',
      dateRange: { start: 1900, end: 1920 },
      location: 'Illinois',
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('dates=1900-1920');
    expect(url).toContain('fa=location%3Aillinois');
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const results = await provider.search({ freeText: 'Smith' });
    expect(results).toEqual([]);
  });

  it('returns empty array on fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const results = await provider.search({ freeText: 'Smith' });
    expect(results).toEqual([]);
  });

  it('health check returns healthy when API responds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('health check returns down when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});
