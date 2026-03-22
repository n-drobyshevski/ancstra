import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WikiTreeProvider } from '../providers/wikitree/provider';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('WikiTreeProvider', () => {
  let provider: WikiTreeProvider;

  beforeEach(() => {
    provider = new WikiTreeProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct metadata', () => {
    expect(provider.id).toBe('wikitree');
    expect(provider.name).toBe('WikiTree');
    expect(provider.type).toBe('api');
  });

  it('sends POST to WikiTree API and maps results', async () => {
    const apiResponse = {
      searchResults: [
        {
          Id: 12345,
          Name: 'Smith-123',
          FirstName: 'John',
          LastNameAtBirth: 'Smith',
          BirthDate: '1820-03-15',
          DeathDate: '1890-11-22',
          BirthLocation: 'Boston, Massachusetts',
          IsLiving: 0,
        },
        {
          Id: 67890,
          Name: 'Doe-456',
          FirstName: 'Jane',
          LastNameAtBirth: 'Doe',
          BirthDate: '1830-06-10',
          DeathDate: '1900-01-05',
          BirthLocation: 'New York',
          IsLiving: 0,
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiResponse,
    });

    const results = await provider.search({
      givenName: 'John',
      surname: 'Smith',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.wikitree.com/api.php');
    expect(options.method).toBe('POST');

    const body = options.body as string;
    expect(body).toContain('action=searchPerson');
    expect(body).toContain('FirstName=John');
    expect(body).toContain('LastName=Smith');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      providerId: 'wikitree',
      externalId: '12345',
      title: 'John Smith',
      url: 'https://www.wikitree.com/wiki/Smith-123',
      recordType: 'online',
    });
    expect(results[0].snippet).toContain('1820-03-15');
    expect(results[0].extractedData?.birthDate).toBe('1820-03-15');
  });

  it('filters out living persons', async () => {
    const apiResponse = {
      searchResults: [
        {
          Id: 100,
          Name: 'Alive-1',
          FirstName: 'Still',
          LastNameAtBirth: 'Alive',
          IsLiving: 1,
        },
        {
          Id: 200,
          Name: 'Dead-2',
          FirstName: 'Already',
          LastNameAtBirth: 'Dead',
          DeathDate: '2000-01-01',
          IsLiving: 0,
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiResponse,
    });

    const results = await provider.search({ surname: 'Test' });

    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe('200');
  });

  it('returns empty array on empty query', async () => {
    const results = await provider.search({});
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('returns empty array on network exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const results = await provider.search({ surname: 'Smith' });
    expect(results).toEqual([]);
  });

  it('healthCheck returns healthy when API responds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const status = await provider.healthCheck();
    expect(status).toBe('healthy');
  });

  it('healthCheck returns down on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const status = await provider.healthCheck();
    expect(status).toBe('down');
  });
});
