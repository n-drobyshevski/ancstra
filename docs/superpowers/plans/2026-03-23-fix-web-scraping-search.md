# Fix Web Scraping & Search Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 7 broken/missing pieces in the web scraping and search pipeline so that federated search returns real results and URL scraping connects to the Playwright worker.

**Architecture:** The research package has a provider registry that dispatches searches to multiple backends (NARA, Chronicling America, Web Search). Two external APIs changed their endpoints. The scrape API route uses simple fetch instead of dispatching to the Hono worker. The AI scrape tool has a response type mismatch, the search route doesn't register the web search provider, and suggest-searches has an operator precedence bug.

**Tech Stack:** TypeScript, Vitest, Next.js API routes, Hono worker, Playwright, Vercel AI SDK tools

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/research/src/providers/nara/provider.ts` | Modify | Migrate to NARA v2 API |
| `packages/research/src/__tests__/nara-provider.test.ts` | Modify | Update test assertions for v2 |
| `packages/research/src/providers/chronicling-america/provider.ts` | Modify | Fix base URL and response mapping |
| `packages/research/src/__tests__/chronicling-america-provider.test.ts` | Modify | Update test assertions for new URL/response |
| `apps/web/app/api/research/search/route.ts` | Modify | Register WebSearchProvider |
| `apps/web/app/api/research/scrape/route.ts` | Modify | Dispatch to Hono worker when available |
| `packages/ai/src/tools/research/scrape-url.ts` | Modify | Fix response type mismatch |
| `packages/ai/src/tools/research/suggest-searches.ts` | Modify | Fix operator precedence bug on line 98 |

---

### Task 1: Migrate NARA provider to v2 API

**Files:**
- Modify: `packages/research/src/providers/nara/provider.ts`
- Modify: `packages/research/src/__tests__/nara-provider.test.ts`

The NARA v1 API (`catalog.archives.gov/api/v1`) is dead — it returns SPA HTML. The v2 API lives at `/api/v2/records/search`, requires an `x-api-key` header, and returns a different response shape. The env var `NARA_API_KEY` is already in `.env.example`.

- [ ] **Step 1: Update the test to reflect v2 API contract**

The test currently asserts the v1 URL and v1 response shape. Update it for v2.

In `packages/research/src/__tests__/nara-provider.test.ts`, change:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd packages/research && npx vitest run src/__tests__/nara-provider.test.ts`
Expected: Multiple failures — v2 URL not used, no API key handling, response shape mismatch.

- [ ] **Step 3: Update NARA provider implementation**

Replace `packages/research/src/providers/nara/provider.ts` with:

```typescript
import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';

const NARA_API_BASE = 'https://catalog.archives.gov/api/v2/records/search';

interface NaraDigitalObject {
  objectUrl?: string;
}

interface NaraItem {
  title?: string;
  scopeAndContentNote?: string;
  digitalObjectArray?: {
    digitalObject?: NaraDigitalObject[];
  };
}

interface NaraHit {
  _id: string;
  _source?: {
    description?: {
      item?: NaraItem;
    };
  };
}

interface NaraV2Response {
  body?: {
    hits?: {
      total?: number;
      hits?: NaraHit[];
    };
  };
}

export class NARAProvider implements SearchProvider {
  readonly id = 'nara';
  readonly name = 'NARA Catalog';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['NARA_API_KEY'];
  }

  async search(query: SearchRequest): Promise<SearchResult[]> {
    if (!this.apiKey) return [];

    try {
      const q = this.buildQueryString(query);
      if (!q) return [];

      const limit = query.limit ?? 20;
      const params = new URLSearchParams({
        q,
        limit: String(limit),
      });

      await this.limiter.acquire();
      const res = await fetch(`${NARA_API_BASE}?${params.toString()}`, {
        headers: { 'x-api-key': this.apiKey },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as NaraV2Response;
      const hits = data.body?.hits?.hits ?? [];

      return hits.map((hit) => this.mapResult(hit));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.apiKey) return 'down';

    try {
      await this.limiter.acquire();
      const res = await fetch(`${NARA_API_BASE}?q=test&limit=1`, {
        headers: { 'x-api-key': this.apiKey },
      });
      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private buildQueryString(query: SearchRequest): string {
    const parts: string[] = [];
    if (query.surname) parts.push(query.surname);
    if (query.givenName) parts.push(query.givenName);
    if (query.freeText) parts.push(query.freeText);
    return parts.join(' ').trim();
  }

  private mapResult(hit: NaraHit): SearchResult {
    const item = hit._source?.description?.item;
    const thumbnail =
      item?.digitalObjectArray?.digitalObject?.[0]?.objectUrl;

    return {
      providerId: this.id,
      externalId: String(hit._id),
      title: item?.title ?? 'Untitled Record',
      snippet: item?.scopeAndContentNote ?? '',
      url: `https://catalog.archives.gov/id/${hit._id}`,
      ...(thumbnail ? { thumbnailUrl: thumbnail } : {}),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/research && npx vitest run src/__tests__/nara-provider.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/research/src/providers/nara/provider.ts packages/research/src/__tests__/nara-provider.test.ts
git commit -m "fix(research): migrate NARA provider to v2 API with API key auth

NARA deprecated their v1 API — it now returns SPA HTML instead of JSON.
The v2 API uses /api/v2/records/search with x-api-key header auth and
a different response shape (body.hits.hits[] instead of opaResponse)."
```

---

### Task 2: Fix Chronicling America provider URL and response mapping

**Files:**
- Modify: `packages/research/src/providers/chronicling-america/provider.ts`
- Modify: `packages/research/src/__tests__/chronicling-america-provider.test.ts`

The old URL `chroniclingamerica.loc.gov` now 308-redirects and the search path returns 404. The new API is at `www.loc.gov/collections/chronicling-america/` with `?q=<query>&fo=json&c=<count>`. The response shape changed: results are in `results[]` instead of `items[]`, and OCR text is now in `description[]` instead of `ocr_eng`. Fields: `id`, `title`, `date`, `description[]`, `image_url[]`, `location[]`.

- [ ] **Step 1: Update the test to reflect the new API contract**

Replace `packages/research/src/__tests__/chronicling-america-provider.test.ts` with:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd packages/research && npx vitest run src/__tests__/chronicling-america-provider.test.ts`
Expected: Multiple failures — old URL used, response shape mismatch.

- [ ] **Step 3: Update Chronicling America provider implementation**

Replace `packages/research/src/providers/chronicling-america/provider.ts` with:

```typescript
import type {
  SearchProvider,
  SearchRequest,
  SearchResult,
  HealthStatus,
  ProviderType,
} from '../types';
import { RateLimiter } from '../rate-limiter';

const CA_API_BASE =
  'https://www.loc.gov/collections/chronicling-america/';

interface LocItem {
  id?: string;
  title?: string;
  date?: string;
  description?: string[];
  image_url?: string[];
  location?: string[];
}

interface LocApiResponse {
  results?: LocItem[];
}

export class ChroniclingAmericaProvider implements SearchProvider {
  readonly id = 'chronicling_america';
  readonly name = 'Chronicling America';
  readonly type: ProviderType = 'api';

  private limiter = new RateLimiter(30);

  async search(query: SearchRequest): Promise<SearchResult[]> {
    try {
      const searchText = this.buildSearchText(query);
      if (!searchText) return [];

      const params = new URLSearchParams({
        q: searchText,
        fo: 'json',
        c: String(query.limit ?? 20),
      });

      if (query.dateRange?.start && query.dateRange?.end) {
        params.set('dates', `${query.dateRange.start}-${query.dateRange.end}`);
      }
      if (query.location) {
        params.set('fa', `location:${query.location.toLowerCase()}`);
      }

      await this.limiter.acquire();
      const res = await fetch(`${CA_API_BASE}?${params.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as LocApiResponse;
      const items = data.results ?? [];

      return items.map((item) => this.mapResult(item));
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.limiter.acquire();
      const res = await fetch(`${CA_API_BASE}?q=test&fo=json&c=1`);
      return res.ok ? 'healthy' : 'down';
    } catch {
      return 'down';
    }
  }

  private buildSearchText(query: SearchRequest): string {
    const parts: string[] = [];
    if (query.surname) parts.push(query.surname);
    if (query.givenName) parts.push(query.givenName);
    if (query.freeText) parts.push(query.freeText);
    return parts.join(' ').trim();
  }

  private mapResult(item: LocItem): SearchResult {
    const snippet = item.description?.[0]
      ? item.description[0].slice(0, 300)
      : '';

    return {
      providerId: this.id,
      externalId: item.id ?? '',
      title: item.title ?? 'Untitled Newspaper Page',
      snippet,
      url: item.id ?? '',
      recordType: 'newspaper',
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/research && npx vitest run src/__tests__/chronicling-america-provider.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/research/src/providers/chronicling-america/provider.ts packages/research/src/__tests__/chronicling-america-provider.test.ts
git commit -m "fix(research): update Chronicling America to LOC collections API

chroniclingamerica.loc.gov now 308-redirects and returns 404. The new
endpoint is www.loc.gov/collections/chronicling-america/ with fo=json.
Response shape changed: results[] instead of items[], description[]
instead of ocr_eng."
```

---

### Task 3: Register WebSearchProvider in the search API route

**Files:**
- Modify: `apps/web/app/api/research/search/route.ts`

The search route registers NARA and ChroniclingAmerica but never calls `createWebSearchProvider()`. When `BRAVE_API_KEY` or `SEARXNG_URL` is set, web search should be available.

- [ ] **Step 1: Update the search route to register the web search provider**

In `apps/web/app/api/research/search/route.ts`, add the import and registration:

```typescript
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  ProviderRegistry,
  MockProvider,
  NARAProvider,
  ChroniclingAmericaProvider,
} from '@ancstra/research';
import { createWebSearchProvider } from '@ancstra/research';
import type { SearchRequest } from '@ancstra/research';

function buildRegistry(providerIds?: string[]): ProviderRegistry {
  const registry = new ProviderRegistry();

  // In dev mode, register MockProvider
  if (process.env.NODE_ENV === 'development') {
    registry.register(new MockProvider());
  }

  registry.register(new NARAProvider());
  registry.register(new ChroniclingAmericaProvider());

  const webSearch = createWebSearchProvider();
  if (webSearch) {
    registry.register(webSearch);
  }

  // If specific providers requested, disable all others
  if (providerIds && providerIds.length > 0) {
    const requestedSet = new Set(providerIds);
    for (const p of registry.listAll()) {
      if (!requestedSet.has(p.id)) {
        registry.setEnabled(p.id, false);
      }
    }
  }

  return registry;
}
```

The rest of the file (the `GET` handler) stays the same.

- [ ] **Step 2: Verify `createWebSearchProvider` is exported from the research package**

Run: `grep -n 'createWebSearchProvider' packages/research/src/index.ts`
Expected: Should be exported. If not, add `export { createWebSearchProvider } from './providers/web-search/provider';` to `packages/research/src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/research/search/route.ts
git commit -m "feat(research): register WebSearchProvider in search API route

When BRAVE_API_KEY or SEARXNG_URL is configured, the web search
provider is now included in federated search results."
```

---

### Task 4: Fix AI scrape tool response type mismatch

**Files:**
- Modify: `packages/ai/src/tools/research/scrape-url.ts`

The AI tool dispatches to the Hono worker at `/jobs/scrape-url`, which returns `{ jobId, status: "accepted" }` (HTTP 202, fire-and-forget). But the tool expects a `ScrapeResult` with `title`, `textContent`, `metadata`. The tool should return the acceptance response as-is and indicate the scrape is async, OR fall back to a simple fetch extraction when no worker is available.

The best fix: when worker is available, return the job acceptance; when no worker, do a lightweight fetch-based extraction (same logic as the scrape route).

- [ ] **Step 1: Update the AI scrape tool**

Replace `packages/ai/src/tools/research/scrape-url.ts` with:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

interface ScrapeResult {
  title: string | null;
  textContent: string;
  metadata: Record<string, string | undefined>;
  jobId?: string;
  async?: boolean;
  error?: string;
}

/**
 * Create the scrapeUrl tool.
 * Dispatches to the scraper worker if available, otherwise does a lightweight fetch.
 */
export function createScrapeUrlTool(options?: {
  workerBaseUrl?: string;
}) {
  return tool({
    description: 'Scrape a URL to extract its text content and metadata for genealogy research',
    parameters: z.object({
      url: z.string().url().describe('The URL to scrape'),
      extractEntities: z.boolean().default(false).describe('Whether to attempt entity extraction from the page content'),
    }),
    execute: async ({ url, extractEntities }) => {
      if (options?.workerBaseUrl) {
        try {
          const response = await fetch(`${options.workerBaseUrl}/jobs/scrape-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, extractEntities }),
          });

          if (!response.ok) {
            return {
              title: null,
              textContent: '',
              metadata: {},
              error: `Scraper worker returned status ${response.status}`,
            } satisfies ScrapeResult;
          }

          const data = await response.json() as { jobId: string; status: string };
          return {
            title: null,
            textContent: '',
            metadata: {},
            jobId: data.jobId,
            async: true,
            error: undefined,
          } satisfies ScrapeResult;
        } catch (err) {
          // Worker unavailable — fall through to lightweight fetch
        }
      }

      // Lightweight fetch fallback (no Playwright)
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Ancstra/1.0 (genealogy research tool)',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          return {
            title: null,
            textContent: '',
            metadata: {},
            error: `Fetch returned ${res.status}`,
          } satisfies ScrapeResult;
        }

        const html = await res.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() ?? null;

        const descMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
        );
        const description = descMatch?.[1]?.trim();

        // Extract visible text (rough: strip tags)
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10_000);

        return {
          title,
          textContent,
          metadata: {
            description,
          },
        } satisfies ScrapeResult;
      } catch (err) {
        return {
          title: null,
          textContent: '',
          metadata: {},
          error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        } satisfies ScrapeResult;
      }
    },
  });
}
```

- [ ] **Step 2: Run existing AI tool tests**

Run: `pnpm --filter @ancstra/ai test 2>&1 | tail -20`
Expected: All existing tests pass. The scrape-url tool had no dedicated test file, so no regressions expected.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/tools/research/scrape-url.ts
git commit -m "fix(ai): fix scrape tool response type mismatch and add fetch fallback

The worker returns {jobId, status} not ScrapeResult. Now the tool
correctly returns the async job info when worker is available, and
falls through to a lightweight fetch-based extraction when it's not."
```

---

### Task 5: Connect scrape API route to the Hono worker

**Files:**
- Modify: `apps/web/app/api/research/scrape/route.ts`

The scrape route currently uses simple `fetch()` with regex extraction and has a TODO comment about dispatching to the Hono worker. When `WORKER_URL` is configured (it is — set in `.env.local`), dispatch to the worker for full Playwright scrape. Keep the fetch fallback for when the worker is unavailable.

- [ ] **Step 1: Update the scrape route**

Replace `apps/web/app/api/research/scrape/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createResearchItem } from '@ancstra/research';
import { z } from 'zod';

const requestSchema = z.object({
  url: z.string().url('Invalid URL'),
  extractEntities: z.boolean().optional(),
  personId: z.string().optional(),
});

async function fetchTitleAndSnippet(url: string): Promise<{ title: string; snippet?: string }> {
  const pageRes = await fetch(url, {
    headers: {
      'User-Agent': 'Ancstra/1.0 (genealogy research tool)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  });

  let title = new URL(url).hostname;
  let snippet: string | undefined;

  if (pageRes.ok) {
    const html = await pageRes.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim();
    }

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (descMatch?.[1]) {
      snippet = descMatch[1].trim().slice(0, 500);
    }
  }

  return { title, snippet };
}

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { url, extractEntities } = parsed.data;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must start with http:// or https://' },
        { status: 400 },
      );
    }

    // Dispatch to worker for full Playwright scrape if available
    const workerUrl = process.env['WORKER_URL'];
    if (workerUrl) {
      try {
        const workerRes = await fetch(`${workerUrl}/jobs/scrape-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, extractEntities }),
          signal: AbortSignal.timeout(5_000),
        });

        if (workerRes.ok) {
          const { jobId } = await workerRes.json() as { jobId: string };
          // Worker accepted — still save a research item with basic metadata
          const { title, snippet } = await fetchTitleAndSnippet(url).catch(() => ({
            title: new URL(url).hostname,
            snippet: undefined,
          }));

          const item = createResearchItem(familyDb, {
            title,
            url,
            snippet,
            discoveryMethod: 'paste_url',
            createdBy: ctx.userId,
          });

          return NextResponse.json({ ...item, workerJobId: jobId }, { status: 201 });
        }
      } catch {
        // Worker unavailable — fall through to fetch-based extraction
      }
    }

    // Fallback: simple fetch extraction
    try {
      const { title, snippet } = await fetchTitleAndSnippet(url);

      const item = createResearchItem(familyDb, {
        title,
        url,
        snippet,
        discoveryMethod: 'paste_url',
        createdBy: ctx.userId,
      });

      return NextResponse.json(item, { status: 201 });
    } catch {
      // Even if fetch fails, still save the URL
      try {
        const item = createResearchItem(familyDb, {
          title: new URL(url).hostname,
          url,
          discoveryMethod: 'paste_url',
          createdBy: ctx.userId,
        });
        return NextResponse.json(item, { status: 201 });
      } catch (dbErr) {
        console.error('[research/scrape POST] DB fallback failed:', dbErr);
        return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 });
      }
    }
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/scrape POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/research/scrape/route.ts
git commit -m "feat(research): dispatch scrape to Hono worker when available

The scrape route now tries the Playwright worker first (WORKER_URL env)
for full page scrape with screenshot archival. Falls back to simple
fetch-based title/snippet extraction if worker is unreachable."
```

---

### Task 6: Fix operator precedence bug in suggest-searches

**Files:**
- Modify: `packages/ai/src/tools/research/suggest-searches.ts` (line 98)

The census suggestion condition has an operator precedence bug:

```typescript
// BUG: && binds tighter than ||, so this evaluates as:
// (birthYear && birthEvent?.place?.toLowerCase().includes('us')) ||
// birthEvent?.place?.toLowerCase().includes('united states') || ...
if (birthYear && birthEvent?.place?.toLowerCase().includes('us') ||
    birthEvent?.place?.toLowerCase().includes('united states') ||
    birthEvent?.place?.toLowerCase().includes('america')) {
```

When `birthYear` is null but place includes "united states", the census block still executes — then `year - birthYear` becomes `NaN`. The fix: add parentheses so the `||` chain is fully grouped.

- [ ] **Step 1: Fix the operator precedence**

In `packages/ai/src/tools/research/suggest-searches.ts`, change lines 98-100 from:

```typescript
  if (birthYear && birthEvent?.place?.toLowerCase().includes('us') ||
      birthEvent?.place?.toLowerCase().includes('united states') ||
      birthEvent?.place?.toLowerCase().includes('america')) {
```

to:

```typescript
  if (birthYear && (birthEvent?.place?.toLowerCase().includes('us') ||
      birthEvent?.place?.toLowerCase().includes('united states') ||
      birthEvent?.place?.toLowerCase().includes('america'))) {
```

- [ ] **Step 2: Run AI package tests**

Run: `pnpm --filter @ancstra/ai test 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/tools/research/suggest-searches.ts
git commit -m "fix(ai): fix operator precedence in census suggestion logic

The || chain wasn't parenthesized, so census suggestions could trigger
with a null birthYear when place matched, producing NaN in age calc."
```

---

### Task 7: Verify the research package exports createWebSearchProvider

**Files:**
- Possibly modify: `packages/research/src/index.ts`

Task 3 imports `createWebSearchProvider` from `@ancstra/research`. Confirm it's exported.

- [ ] **Step 1: Check the export**

Run: `grep 'createWebSearchProvider' packages/research/src/index.ts`

If not found, add to `packages/research/src/index.ts`:

```typescript
export { createWebSearchProvider } from './providers/web-search/provider';
```

- [ ] **Step 2: Run all research tests to confirm nothing broke**

Run: `pnpm --filter @ancstra/research test 2>&1 | grep -E "✓|FAIL|Tests"`
Expected: All scraping/search tests pass (the 4 pre-existing Drizzle failures are unrelated).

- [ ] **Step 3: Run all worker tests**

Run: `pnpm --filter @ancstra/worker test 2>&1 | grep -E "✓|FAIL|Tests"`
Expected: All 17 tests pass.

- [ ] **Step 4: Commit (if changes were needed)**

```bash
git add packages/research/src/index.ts
git commit -m "fix(research): export createWebSearchProvider from package barrel"
```

---

## Final Verification

After all tasks complete:

- [ ] Run full test suite: `pnpm --filter @ancstra/research test && pnpm --filter @ancstra/worker test && pnpm --filter @ancstra/ai test`
- [ ] Verify NARA tests pass with v2 response shape
- [ ] Verify Chronicling America tests pass with LOC collections URL
- [ ] Verify worker tests still pass
- [ ] Verify no TypeScript errors: `pnpm --filter @ancstra/research build && pnpm --filter @ancstra/ai build`
