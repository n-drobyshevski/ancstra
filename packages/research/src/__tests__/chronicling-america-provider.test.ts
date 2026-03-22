import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChroniclingAmericaProvider } from '../providers/chronicling-america/provider.js';

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

  it('returns newspaper results', async () => {
    const caResponse = {
      totalItems: 1,
      itemsPerPage: 20,
      items: [
        {
          id: '/lccn/sn83030214/1920-05-01/ed-1/seq-3/',
          title: 'Springfield Daily News',
          date: '19200501',
          ocr_eng:
            'John Smith was honored at the annual Springfield fair for his agricultural achievements.',
          url: 'https://chroniclingamerica.loc.gov/lccn/sn83030214/1920-05-01/ed-1/seq-3/',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => caResponse,
    });

    const results = await provider.search({ freeText: 'John Smith' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(
      'https://chroniclingamerica.loc.gov/search/pages/results/',
    );
    expect(url).toContain('andtext=John+Smith');
    expect(url).toContain('format=json');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: 'chronicling_america',
      externalId: '/lccn/sn83030214/1920-05-01/ed-1/seq-3/',
      title: 'Springfield Daily News',
      recordType: 'newspaper',
      url: 'https://chroniclingamerica.loc.gov/lccn/sn83030214/1920-05-01/ed-1/seq-3/',
    });
  });

  it('supports date range filtering', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await provider.search({
      freeText: 'Smith',
      dateRange: { start: 1900, end: 1920 },
      location: 'Illinois',
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('date1=1900');
    expect(url).toContain('date2=1920');
    expect(url).toContain('state=Illinois');
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
      json: async () => ({ items: [] }),
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
