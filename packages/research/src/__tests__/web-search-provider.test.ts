import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSearchProvider, createWebSearchProvider } from '../providers/web-search/provider';
import type { WebSearchAdapter, WebSearchResult } from '../providers/web-search/types';

describe('WebSearchProvider', () => {
  let mockAdapter: WebSearchAdapter;
  let provider: WebSearchProvider;

  beforeEach(() => {
    mockAdapter = {
      name: 'MockSearch',
      search: vi.fn<(query: string, limit?: number) => Promise<WebSearchResult[]>>().mockResolvedValue([]),
      healthCheck: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    };
    provider = new WebSearchProvider(mockAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('web_search');
    expect(provider.name).toBe('Web Search');
    expect(provider.type).toBe('web_search');
  });

  it('builds genealogy query with name, year, and place', () => {
    const query = provider.buildGenealogyQuery({
      givenName: 'John',
      surname: 'Smith',
      birthYear: 1820,
      birthPlace: 'Boston',
    });

    expect(query).toContain('"John Smith"');
    expect(query).toContain('genealogy');
    expect(query).toContain('1820');
    expect(query).toContain('Boston');
  });

  it('builds genealogy query with surname only', () => {
    const query = provider.buildGenealogyQuery({ surname: 'Smith' });
    expect(query).toContain('"Smith"');
    expect(query).toContain('genealogy');
  });

  it('calls adapter.search with built query and maps results', async () => {
    const adapterResults: WebSearchResult[] = [
      {
        title: 'John Smith Family Tree',
        url: 'https://example.com/smith',
        snippet: 'John Smith b. 1820 in Boston.',
      },
      {
        title: 'Smith Genealogy Records',
        url: 'https://example.com/smith-records',
        snippet: 'Records for the Smith family.',
      },
    ];

    (mockAdapter.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce(adapterResults);

    const results = await provider.search({
      givenName: 'John',
      surname: 'Smith',
      limit: 10,
    });

    expect(mockAdapter.search).toHaveBeenCalledOnce();
    const searchQuery = (mockAdapter.search as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(searchQuery).toContain('"John Smith"');
    expect(searchQuery).toContain('genealogy');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'web_search',
      title: 'John Smith Family Tree',
      url: 'https://example.com/smith',
      recordType: 'online',
    });
  });

  it('deduplicates results by URL', async () => {
    const adapterResults: WebSearchResult[] = [
      { title: 'Result 1', url: 'https://example.com/same', snippet: 'First' },
      { title: 'Result 2', url: 'https://example.com/same', snippet: 'Duplicate' },
      { title: 'Result 3', url: 'https://example.com/different', snippet: 'Third' },
    ];

    (mockAdapter.search as ReturnType<typeof vi.fn>).mockResolvedValueOnce(adapterResults);

    const results = await provider.search({ surname: 'Smith' });

    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://example.com/same');
    expect(results[1].url).toBe('https://example.com/different');
  });

  it('returns empty array when adapter throws', async () => {
    (mockAdapter.search as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Search failed'),
    );

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('delegates healthCheck to adapter', async () => {
    (mockAdapter.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
    expect(mockAdapter.healthCheck).toHaveBeenCalledOnce();
  });

  it('returns down when adapter healthCheck fails', async () => {
    (mockAdapter.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });

  it('returns down when adapter healthCheck throws', async () => {
    (mockAdapter.healthCheck as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Connection refused'),
    );
    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});

describe('createWebSearchProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns SearXNG-based provider when SEARXNG_URL is set', () => {
    process.env['SEARXNG_URL'] = 'http://localhost:8080';
    const provider = createWebSearchProvider();
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe('web_search');
  });

  it('returns Brave-based provider when BRAVE_API_KEY is set', () => {
    delete process.env['SEARXNG_URL'];
    process.env['BRAVE_API_KEY'] = 'test-key-123';
    const provider = createWebSearchProvider();
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe('web_search');
  });

  it('prefers SearXNG over Brave when both are set', () => {
    process.env['SEARXNG_URL'] = 'http://localhost:8080';
    process.env['BRAVE_API_KEY'] = 'test-key-123';
    const provider = createWebSearchProvider();
    expect(provider).not.toBeNull();
  });

  it('returns null when neither env var is set', () => {
    delete process.env['SEARXNG_URL'];
    delete process.env['BRAVE_API_KEY'];
    const provider = createWebSearchProvider();
    expect(provider).toBeNull();
  });
});
