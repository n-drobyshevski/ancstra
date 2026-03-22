import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FindAGraveProvider } from '../providers/findagrave/provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FindAGraveProvider', () => {
  let provider: FindAGraveProvider;

  beforeEach(() => {
    provider = new FindAGraveProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('findagrave');
    expect(provider.name).toBe('Find A Grave');
    expect(provider.type).toBe('scraper');
  });

  it('builds search URL with query params and parses results', async () => {
    const searchHtml = `
      <html><body>
        <div class="memorial-item">
          <a href="/memorial/11111/john-smith">John Smith</a>
          <span class="memorial-dates">1820-1890</span>
          <span class="memorial-location">Brooklyn, NY</span>
        </div>
        <div class="memorial-item">
          <a href="/memorial/22222/jane-doe">Jane Doe</a>
          <span class="memorial-dates">1830-1900</span>
          <span class="memorial-location">Manhattan, NY</span>
        </div>
      </body></html>
    `;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => searchHtml,
    });

    const results = await provider.search({
      givenName: 'John',
      surname: 'Smith',
      birthYear: 1820,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('findagrave.com/memorial/search');
    expect(url).toContain('firstname=John');
    expect(url).toContain('lastname=Smith');
    expect(url).toContain('birthyear=1820');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'findagrave',
      externalId: '11111',
      title: 'John Smith',
      url: 'https://www.findagrave.com/memorial/11111',
      recordType: 'cemetery',
    });
    expect(results[0].snippet).toContain('1820-1890');
    expect(results[1].externalId).toBe('22222');
  });

  it('returns empty array on empty query', async () => {
    const results = await provider.search({});
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('returns empty array on network exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('getRecord fetches and parses a memorial page', async () => {
    const memorialHtml = `
      <html><body>
        <h1 id="bio-name">John Smith</h1>
        <span id="birthDateLabel">15 Mar 1820</span>
        <span id="birthLocationLabel">Boston, MA</span>
        <span id="deathDateLabel">22 Nov 1890</span>
        <span id="deathLocationLabel">New York, NY</span>
        <span id="cemeteryNameLabel">Green-Wood Cemetery</span>
        <div id="annotationBio">A prominent merchant.</div>
      </body></html>
    `;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => memorialHtml,
    });

    const record = await provider.getRecord('11111');

    expect(record.providerId).toBe('findagrave');
    expect(record.externalId).toBe('11111');
    expect(record.title).toBe('John Smith');
    expect(record.fullText).toBe('A prominent merchant.');
    expect(record.metadata['birthDate']).toBe('15 Mar 1820');
    expect(record.metadata['cemetery']).toBe('Green-Wood Cemetery');
    expect(record.recordType).toBe('cemetery');
  });

  it('getRecord throws on failed fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(provider.getRecord('99999')).rejects.toThrow(
      'Failed to fetch memorial 99999: 404',
    );
  });

  it('healthCheck returns healthy when homepage loads', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('healthCheck returns down on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});
