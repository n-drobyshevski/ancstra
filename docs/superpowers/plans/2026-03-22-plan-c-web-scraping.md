# Plan C: Web Scraping + Clipping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full-power web scraping (Playwright on Hono worker), hybrid clipping (URL/text paste), and additional search providers (FindAGrave, WikiTree, web search).

**Architecture:** Playwright runs in Hono worker on Railway. Scrape jobs are dispatched via POST /jobs/scrape-url. Results (text, metadata, screenshot) are stored to filesystem. Providers implement the SearchProvider interface from packages/research. FindAGrave and Geneanet use scraping; WikiTree and web search use APIs.

**Tech Stack:** Playwright, Hono, sharp (screenshots), Vitest

**Spec:** [Research Workspace Design](../../superpowers/specs/2026-03-22-research-workspace-design.md)
**Depends on:** [Plan A](2026-03-22-plan-a-search-foundation.md) (worker scaffold, SearchProvider interface)

---

## File Structure

### New Files

```
packages/research/src/
  scraper/
    url-scraper.ts              # Playwright page extraction (text, metadata)
    screenshot.ts               # Screenshot capture via Playwright + sharp
    archiver.ts                 # HTML + screenshot archive to filesystem
    robots.ts                   # robots.txt parser + checker
    rate-limiter-domain.ts      # Per-domain rate limiter (1 req/sec/domain)
    extractor.ts                # AI entity extraction from pasted text
    types.ts                    # ScrapeResult, ScrapeOptions, ArchiveResult
  providers/
    findagrave/
      provider.ts               # FindAGraveProvider (scraper-based)
      parser.ts                 # HTML parser for FindAGrave memorial pages
    wikitree/
      provider.ts               # WikiTreeProvider (API-based)
      types.ts                  # WikiTree API response types
    web-search/
      provider.ts               # WebSearchProvider (SearXNG / Brave)
      searxng.ts                # SearXNG adapter
      brave.ts                  # Brave Search API adapter
      types.ts                  # Web search response types
  __tests__/
    url-scraper.test.ts
    screenshot.test.ts
    archiver.test.ts
    robots.test.ts
    rate-limiter-domain.test.ts
    extractor.test.ts
    findagrave-provider.test.ts
    findagrave-parser.test.ts
    wikitree-provider.test.ts
    web-search-provider.test.ts

apps/worker/src/
  routes/
    scrape.ts                   # POST /jobs/scrape-url, POST /jobs/scrape-batch
  jobs/
    scrape-url.ts               # Single URL scrape job handler
    scrape-batch.ts             # Batch URL scrape job handler
  lib/
    playwright.ts               # Shared browser instance management
  __tests__/
    scrape-route.test.ts
    scrape-url-job.test.ts
    scrape-batch-job.test.ts

apps/web/
  app/
    api/research/
      scrape/route.ts           # Dispatch scrape to worker
      paste/route.ts            # Text paste + AI extraction
  components/research/
    url-paste-input.tsx          # URL paste UI component
    text-paste-modal.tsx         # Text paste + extraction modal
    scrape-status.tsx            # Scrape job progress indicator
  lib/research/
    scrape-client.ts            # React hooks for scrape dispatch + status
```

### Modified Files

```
apps/worker/src/index.ts        # Mount scrape routes
apps/worker/package.json        # Add playwright, sharp dependencies
packages/research/src/index.ts  # Export scraper + new providers
packages/research/package.json  # Add cheerio, robotstxt-parser deps
apps/web/components/research/search-bar.tsx  # Add URL paste detection
.env.example                    # Add SEARXNG_URL, BRAVE_API_KEY, ARCHIVE_PATH
```

---

## Task 1: Playwright Setup on Worker + scrape-url Job Route

**Files:**
- Create: `apps/worker/src/lib/playwright.ts`, `apps/worker/src/routes/scrape.ts`, `apps/worker/src/jobs/scrape-url.ts`
- Modify: `apps/worker/package.json`, `apps/worker/src/index.ts`
- Test: `apps/worker/src/__tests__/scrape-route.test.ts`

- [ ] **Step 1:** Add `playwright` and `sharp` to `apps/worker/package.json` dependencies. Add `playwright install chromium --with-deps` to a postinstall script. Update the Dockerfile to install Playwright browser dependencies (libnss3, libatk-bridge2.0-0, etc.) in the build stage.

- [ ] **Step 2:** Create `apps/worker/src/lib/playwright.ts` — singleton browser manager:
```typescript
// Exports:
// getBrowser(): Promise<Browser> — lazy-launches Chromium, reuses instance
// closeBrowser(): Promise<void> — graceful shutdown
// withPage<T>(fn: (page: Page) => Promise<T>, options?: { timeout?: number }): Promise<T>
//   — acquires a page from the browser, runs fn, closes page in finally block
//   — default timeout: 30_000ms
```
Browser launches with `{ headless: true, args: ['--no-sandbox', '--disable-gpu'] }`. Process `SIGTERM` handler calls `closeBrowser()`.

- [ ] **Step 3:** Create `apps/worker/src/routes/scrape.ts` — Hono route group:
  - `POST /jobs/scrape-url` — accepts `{ url: string, extractEntities?: boolean, personId?: string }`. Validates URL with `zod.string().url()`. Dispatches to `scrapeUrlJob()`. Returns `{ jobId, status: 'accepted' }` with 202 status.
  - `POST /jobs/scrape-batch` — placeholder (implemented in Task 4). Returns 501.

- [ ] **Step 4:** Create `apps/worker/src/jobs/scrape-url.ts` — stub job handler:
```typescript
export async function scrapeUrlJob(input: ScrapeUrlInput): Promise<ScrapeResult> {
  // Stub: returns mock ScrapeResult for now
  // Full implementation in Task 2
}
```

- [ ] **Step 5:** Mount scrape routes in `apps/worker/src/index.ts`:
```typescript
import { scrapeRoutes } from './routes/scrape.js';
app.route('/jobs', scrapeRoutes);
```

- [ ] **Step 6:** Write `apps/worker/src/__tests__/scrape-route.test.ts`:
```typescript
describe('POST /jobs/scrape-url', () => {
  it('returns 202 with jobId for valid URL', async () => { ... });
  it('returns 400 for invalid URL', async () => { ... });
  it('returns 400 for missing URL', async () => { ... });
});

describe('POST /jobs/scrape-batch', () => {
  it('returns 501 not implemented', async () => { ... });
});
```

- [ ] **Step 7:** Run: `cd apps/worker && pnpm test` — Expected: PASS

- [ ] **Step 8:** Commit: `feat(worker): Playwright setup and scrape-url job route`

---

## Task 2: URL Scraper — Text + Metadata Extraction

**Files:**
- Create: `packages/research/src/scraper/types.ts`, `packages/research/src/scraper/url-scraper.ts`
- Test: `packages/research/src/__tests__/url-scraper.test.ts`

- [ ] **Step 1:** Create `packages/research/src/scraper/types.ts`:
```typescript
export interface ScrapeOptions {
  url: string;
  timeout?: number;           // default 30_000
  waitForSelector?: string;   // optional: wait for element before extracting
  extractEntities?: boolean;  // run AI extraction on text
  userAgent?: string;
}

export interface ScrapeResult {
  url: string;
  finalUrl: string;           // after redirects
  title: string;
  textContent: string;        // cleaned body text
  html: string;               // raw HTML
  screenshotPath?: string;    // populated by archiver
  metadata: PageMetadata;
  extractedEntities?: EntityExtractionOutput;
  scrapedAt: string;          // ISO timestamp
}

export interface PageMetadata {
  author?: string;
  publishedDate?: string;
  siteName?: string;
  description?: string;
  language?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export interface ArchiveResult {
  htmlPath: string;
  screenshotPath: string;
  archivedAt: string;
}
```

- [ ] **Step 2:** Write `packages/research/src/__tests__/url-scraper.test.ts`:
```typescript
describe('UrlScraper', () => {
  // Uses a mock Page object (no real browser in unit tests)
  it('extracts title from page', async () => { ... });
  it('extracts body text content (stripped of scripts/styles)', async () => { ... });
  it('extracts Open Graph metadata', async () => { ... });
  it('extracts meta author and published date', async () => { ... });
  it('records final URL after redirects', async () => { ... });
  it('throws on timeout', async () => { ... });
});
```

- [ ] **Step 3:** Run test — Expected: FAIL (module not found)

- [ ] **Step 4:** Implement `packages/research/src/scraper/url-scraper.ts`:
  - `scrapeUrl(page: Page, options: ScrapeOptions): Promise<ScrapeResult>` — navigates to URL, waits for `networkidle`, extracts:
    - `title` via `page.title()`
    - `textContent` via `page.evaluate()` — strips `<script>`, `<style>`, `<nav>`, `<footer>` elements, then gets `document.body.innerText`
    - `html` via `page.content()`
    - `metadata` via `page.evaluate()` — reads `<meta>` tags for og:title, og:description, og:image, author, article:published_time, og:site_name, canonical link
    - `finalUrl` via `page.url()`
  - Respects `options.timeout` (default 30s).
  - If `options.waitForSelector` provided, waits for that selector before extraction.

- [ ] **Step 5:** Run test — Expected: PASS

- [ ] **Step 6:** Wire scraper into `apps/worker/src/jobs/scrape-url.ts` — replace stub with real implementation using `withPage()` + `scrapeUrl()`.

- [ ] **Step 7:** Add `cheerio` to `packages/research/package.json` for any future HTML parsing needs.

- [ ] **Step 8:** Export scraper types and function from `packages/research/src/index.ts`.

- [ ] **Step 9:** Commit: `feat(research): URL scraper — text, metadata, and HTML extraction via Playwright`

---

## Task 3: Screenshot Capture + Archive Storage

**Files:**
- Create: `packages/research/src/scraper/screenshot.ts`, `packages/research/src/scraper/archiver.ts`
- Test: `packages/research/src/__tests__/screenshot.test.ts`, `packages/research/src/__tests__/archiver.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/screenshot.test.ts`:
```typescript
describe('captureScreenshot', () => {
  it('returns a PNG buffer', async () => { ... });
  it('captures full page when fullPage=true', async () => { ... });
  it('resizes to max width via sharp', async () => { ... });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/scraper/screenshot.ts`:
  - `captureScreenshot(page: Page, options?: { fullPage?: boolean, maxWidth?: number }): Promise<Buffer>` — calls `page.screenshot({ type: 'png', fullPage })`, then uses `sharp` to resize if width exceeds `maxWidth` (default 1280px). Returns PNG buffer.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/research/src/__tests__/archiver.test.ts`:
```typescript
describe('Archiver', () => {
  it('saves HTML to filesystem with hashed filename', async () => { ... });
  it('saves screenshot PNG to filesystem', async () => { ... });
  it('returns paths relative to ARCHIVE_PATH', async () => { ... });
  it('creates subdirectories by date (YYYY/MM)', async () => { ... });
  it('handles special characters in URL for filename', async () => { ... });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/research/src/scraper/archiver.ts`:
  - `archiveScrapeResult(result: ScrapeResult, screenshotBuffer: Buffer, archivePath: string): Promise<ArchiveResult>` — generates a filename from SHA-256 of the URL (first 16 chars). Creates directory structure `{archivePath}/{YYYY}/{MM}/`. Writes `{hash}.html` and `{hash}.png`. Returns `{ htmlPath, screenshotPath, archivedAt }` with paths relative to `archivePath`.

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Update `scrapeUrlJob()` in `apps/worker/src/jobs/scrape-url.ts` to call `captureScreenshot()` + `archiveScrapeResult()` after scraping. Set `ARCHIVE_PATH` from env var (default `./data/archives`).

- [ ] **Step 10:** Add `ARCHIVE_PATH` to `.env.example`.

- [ ] **Step 11:** Commit: `feat(research): screenshot capture and HTML/PNG archive storage`

---

## Task 4: Scrape-Batch Job (Queue Multiple URLs)

**Files:**
- Create: `apps/worker/src/jobs/scrape-batch.ts`
- Modify: `apps/worker/src/routes/scrape.ts`
- Test: `apps/worker/src/__tests__/scrape-batch-job.test.ts`

- [ ] **Step 1:** Write `apps/worker/src/__tests__/scrape-batch-job.test.ts`:
```typescript
describe('scrapeBatchJob', () => {
  it('processes multiple URLs sequentially', async () => { ... });
  it('returns results array with per-URL status', async () => { ... });
  it('continues on individual URL failure', async () => { ... });
  it('respects maxConcurrency option', async () => { ... });
  it('reports progress after each URL', async () => { ... });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `apps/worker/src/jobs/scrape-batch.ts`:
```typescript
interface ScrapeBatchInput {
  urls: string[];               // max 20 URLs per batch
  extractEntities?: boolean;
  personId?: string;
  maxConcurrency?: number;      // default 1 (sequential for rate limiting)
}

interface ScrapeBatchResult {
  results: Array<{
    url: string;
    status: 'success' | 'error';
    result?: ScrapeResult;
    error?: string;
  }>;
  totalProcessed: number;
  totalSuccess: number;
  totalErrors: number;
}
```
  - Processes URLs with configurable concurrency (default 1, max 3).
  - Uses `p-limit` for concurrency control.
  - Each URL goes through the full pipeline: scrape -> screenshot -> archive.
  - Failures are captured per-URL; the batch continues.
  - Emits progress via a callback: `onProgress(completed: number, total: number)`.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Update `POST /jobs/scrape-batch` in `apps/worker/src/routes/scrape.ts`:
  - Accepts `{ urls: string[], extractEntities?, personId?, maxConcurrency? }`.
  - Validates: `urls` is array of valid URLs, max length 20.
  - Dispatches to `scrapeBatchJob()`.
  - Returns 202 with `{ jobId, urlCount }`.

- [ ] **Step 6:** Add `p-limit` to `apps/worker/package.json`.

- [ ] **Step 7:** Commit: `feat(worker): scrape-batch job — queue multiple URLs for scraping`

---

## Task 5: Rate Limiter + robots.txt Checker

**Files:**
- Create: `packages/research/src/scraper/robots.ts`, `packages/research/src/scraper/rate-limiter-domain.ts`
- Test: `packages/research/src/__tests__/robots.test.ts`, `packages/research/src/__tests__/rate-limiter-domain.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/robots.test.ts`:
```typescript
describe('RobotsChecker', () => {
  it('allows URL when no robots.txt exists (404)', async () => { ... });
  it('blocks URL disallowed by robots.txt', async () => { ... });
  it('allows URL not mentioned in robots.txt', async () => { ... });
  it('respects Crawl-delay directive', async () => { ... });
  it('caches robots.txt per domain (TTL 1 hour)', async () => { ... });
  it('identifies as Ancstra user agent', async () => { ... });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/scraper/robots.ts`:
  - `RobotsChecker` class with:
    - `isAllowed(url: string): Promise<boolean>` — fetches and parses `robots.txt` for the domain, checks if the path is allowed for the `Ancstra` user agent (falling back to `*`).
    - `getCrawlDelay(domain: string): Promise<number | null>` — returns Crawl-delay value if set.
    - Internal cache: `Map<domain, { rules, fetchedAt }>` with 1-hour TTL.
  - Uses `robotstxt-parser` npm package for parsing.
  - If robots.txt fetch fails (404, network error), defaults to allowed.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/research/src/__tests__/rate-limiter-domain.test.ts`:
```typescript
describe('DomainRateLimiter', () => {
  it('allows first request to a domain immediately', async () => { ... });
  it('enforces 1 second delay between requests to same domain', async () => { ... });
  it('allows parallel requests to different domains', async () => { ... });
  it('respects custom delay from robots.txt Crawl-delay', async () => { ... });
  it('cleans up stale domain entries after 10 minutes', async () => { ... });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/research/src/scraper/rate-limiter-domain.ts`:
  - `DomainRateLimiter` class with:
    - `acquire(domain: string, delayMs?: number): Promise<void>` — waits until enough time has passed since the last request to this domain. Default delay: 1000ms.
    - Internal `Map<domain, lastRequestTime>`.
    - `cleanup()` — removes entries older than 10 minutes (call periodically or on acquire).
  - Integrates with `RobotsChecker.getCrawlDelay()` to use the longer of (1s, Crawl-delay).

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Wire both into the scrape pipeline in `apps/worker/src/jobs/scrape-url.ts`:
  - Before scraping, call `robotsChecker.isAllowed(url)` — if disallowed, return error result with `reason: 'blocked_by_robots_txt'`.
  - Before navigating, call `domainRateLimiter.acquire(domain)`.
  - Set Playwright page user agent to `Ancstra/1.0 (+https://ancstra.app)`.

- [ ] **Step 10:** Add `robotstxt-parser` to `packages/research/package.json`.

- [ ] **Step 11:** Commit: `feat(research): robots.txt checker and per-domain rate limiter for respectful scraping`

---

## Task 6: URL Paste Workflow (Next.js -> Worker Dispatch)

**Files:**
- Create: `apps/web/app/api/research/scrape/route.ts`, `apps/web/components/research/url-paste-input.tsx`, `apps/web/components/research/scrape-status.tsx`, `apps/web/lib/research/scrape-client.ts`
- Modify: `apps/web/components/research/search-bar.tsx`

- [ ] **Step 1:** Create `apps/web/lib/research/scrape-client.ts` — React hooks:
  - `useScrapeUrl()` — returns `{ scrape(url, opts), status, result, error }`. Calls `POST /api/research/scrape` and polls for completion.
  - `useScrapeStatus(jobId)` — polls `GET /api/research/scrape?jobId=...` for job status.

- [ ] **Step 2:** Create `apps/web/app/api/research/scrape/route.ts`:
  - `POST` handler: receives `{ url, extractEntities?, personId? }`. Validates URL. Forwards to worker via `workerClient` (`POST /jobs/scrape-url`). On success, creates a `research_item` with `discovery_method = 'paste_url'` and returns it. Sets `archived_html_path` and `screenshot_path` from worker response.
  - `GET` handler: accepts `?jobId=...`, proxies job status from worker.

- [ ] **Step 3:** Create `apps/web/components/research/url-paste-input.tsx`:
  - Text input with placeholder "Paste a URL to scrape and archive..."
  - Detects pasted URLs (regex: starts with `http://` or `https://`).
  - On paste detection, shows confirmation: "Scrape this URL?" with Extract button.
  - Options: checkbox for "Extract entities with AI".
  - Person selector dropdown for tagging.
  - Calls `useScrapeUrl().scrape()` on submit.

- [ ] **Step 4:** Create `apps/web/components/research/scrape-status.tsx`:
  - Shows scrape progress: spinner while scraping, checkmark on success, error icon on failure.
  - On success, displays: page title, snippet preview, screenshot thumbnail, "View Full Archive" link.
  - "Save as Research Item" button (if not auto-saved).

- [ ] **Step 5:** Integrate URL paste detection into `apps/web/components/research/search-bar.tsx`:
  - If user pastes text that looks like a URL into the search bar, show an inline prompt: "This looks like a URL. Scrape it?" with a button that opens the URL paste flow.

- [ ] **Step 6:** Commit: `feat(web): URL paste workflow — scrape dispatch, status tracking, and auto-save`

---

## Task 7: Text Paste + AI Entity Extraction

**Files:**
- Create: `packages/research/src/scraper/extractor.ts`, `apps/web/app/api/research/paste/route.ts`, `apps/web/components/research/text-paste-modal.tsx`
- Test: `packages/research/src/__tests__/extractor.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/extractor.test.ts`:
```typescript
describe('extractEntitiesFromText', () => {
  it('extracts person names from obituary text', async () => { ... });
  it('extracts dates (birth, death, marriage)', async () => { ... });
  it('extracts place names', async () => { ... });
  it('extracts relationships (parent, spouse, child)', async () => { ... });
  it('returns confidence scores for each extraction', async () => { ... });
  it('handles empty or nonsensical text gracefully', async () => { ... });
  it('uses person context to improve extraction accuracy', async () => { ... });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/scraper/extractor.ts`:
  - `extractEntitiesFromText(text: string, options?: { personContext?: string, documentType?: string }): Promise<EntityExtractionOutput>` — calls Claude API with a structured prompt:
    - System prompt: "You are a genealogical entity extractor. Extract all persons, relationships, and events from the provided text. Return structured JSON."
    - Includes person context if provided (known facts about the person for disambiguation).
    - Includes document type hint if provided (obituary, census, will, etc.).
    - Uses `response_format: { type: 'json_object' }` for structured output.
    - Parses response into `EntityExtractionOutput` (reuses type from `packages/jobs/types.ts`).
    - Assigns confidence scores based on extraction clarity.

- [ ] **Step 4:** Run test — Expected: PASS (with mocked Claude API calls)

- [ ] **Step 5:** Create `apps/web/app/api/research/paste/route.ts`:
  - `POST` handler: receives `{ text: string, personId?: string, documentType?: string }`.
  - Validates text (non-empty, max 50,000 chars).
  - Calls `extractEntitiesFromText()`.
  - Creates `research_item` with `discovery_method = 'paste_text'`, stores text as `full_text`.
  - Creates `research_facts` from extracted entities.
  - If `personId` provided, tags the person via `research_item_persons`.
  - Returns the created research item with extracted facts.

- [ ] **Step 6:** Create `apps/web/components/research/text-paste-modal.tsx`:
  - Modal dialog (shadcn Dialog) with:
    - Large textarea for pasting text (min 4 rows, auto-grows).
    - Document type selector: dropdown with options (obituary, census, will, deed, newspaper, letter, other).
    - Person selector: optional person to associate with.
    - "Extract" button — calls `POST /api/research/paste`.
    - Results view: shows extracted persons, dates, places, relationships in a structured card layout.
    - "Save" button to confirm and create research item.
  - Loading state with skeleton during AI extraction.

- [ ] **Step 7:** Add a "Paste Text" button to the research workspace toolbar that opens the text paste modal.

- [ ] **Step 8:** Commit: `feat(research): text paste with AI entity extraction — Claude-powered genealogical parsing`

---

## Task 8: FindAGrave Provider

**Files:**
- Create: `packages/research/src/providers/findagrave/provider.ts`, `packages/research/src/providers/findagrave/parser.ts`
- Test: `packages/research/src/__tests__/findagrave-provider.test.ts`, `packages/research/src/__tests__/findagrave-parser.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/findagrave-parser.test.ts`:
```typescript
describe('FindAGraveParser', () => {
  it('extracts memorial name from HTML', () => { ... });
  it('extracts birth date and place', () => { ... });
  it('extracts death date and place', () => { ... });
  it('extracts cemetery name and location', () => { ... });
  it('extracts family member links', () => { ... });
  it('extracts memorial ID from URL', () => { ... });
  it('handles missing fields gracefully', () => { ... });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/providers/findagrave/parser.ts`:
  - `parseMemorialPage(html: string): MemorialData` — uses `cheerio` to parse FindAGrave memorial HTML.
  - Extracts: full name, birth date/place, death date/place, burial/cemetery info, family links (spouse, parents, children as names + memorial IDs), bio text.
  - Returns structured `MemorialData` object.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/research/src/__tests__/findagrave-provider.test.ts`:
```typescript
describe('FindAGraveProvider', () => {
  it('implements SearchProvider interface', () => { ... });
  it('searches by name and returns SearchResult[]', async () => { ... });
  it('maps memorial data to SearchResult format', async () => { ... });
  it('getRecord returns detailed memorial data', async () => { ... });
  it('respects rate limiting', async () => { ... });
  it('health check returns status', async () => { ... });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/research/src/providers/findagrave/provider.ts`:
  - `FindAGraveProvider` implements `SearchProvider`.
  - `id: 'findagrave'`, `name: 'Find A Grave'`, `type: 'scraper'`.
  - `search()` — constructs search URL: `https://www.findagrave.com/memorial/search` with query params (firstname, lastname, birthyear, deathyear, location). Fetches via Playwright (dispatched to worker) or plain fetch for the search results page. Parses result list into `SearchResult[]`.
  - `getRecord(memorialId)` — fetches memorial page, passes to `parseMemorialPage()`, returns `RecordDetail`.
  - Uses `RateLimiter` with 10 req/min. Respects robots.txt.
  - `healthCheck()` — fetches homepage, returns 'healthy' if 200.

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Register provider in `packages/research/src/index.ts` exports.

- [ ] **Step 10:** Commit: `feat(research): FindAGrave provider — scraper-based memorial search`

---

## Task 9: WikiTree Provider

**Files:**
- Create: `packages/research/src/providers/wikitree/provider.ts`, `packages/research/src/providers/wikitree/types.ts`
- Test: `packages/research/src/__tests__/wikitree-provider.test.ts`

- [ ] **Step 1:** Create `packages/research/src/providers/wikitree/types.ts`:
```typescript
export interface WikiTreeSearchResponse {
  status: number;
  searchResults: WikiTreePerson[];
}

export interface WikiTreePerson {
  Id: number;
  Name: string;            // WikiTree ID (e.g., "Smith-12345")
  FirstName: string;
  LastNameAtBirth: string;
  LastNameCurrent: string;
  BirthDate: string;       // YYYY-MM-DD or partial
  DeathDate: string;
  BirthLocation: string;
  DeathLocation: string;
  Gender: string;
  IsLiving: number;        // 0 or 1
  Photo?: string;
}
```

- [ ] **Step 2:** Write `packages/research/src/__tests__/wikitree-provider.test.ts`:
```typescript
describe('WikiTreeProvider', () => {
  it('implements SearchProvider interface', () => { ... });
  it('searches via WikiTree API and returns SearchResult[]', async () => { ... });
  it('maps WikiTree person to SearchResult format', async () => { ... });
  it('filters out living persons (IsLiving=1)', async () => { ... });
  it('constructs correct API URL with search params', async () => { ... });
  it('handles empty results', async () => { ... });
  it('health check pings API', async () => { ... });
});
```

- [ ] **Step 3:** Run test — Expected: FAIL

- [ ] **Step 4:** Implement `packages/research/src/providers/wikitree/provider.ts`:
  - `WikiTreeProvider` implements `SearchProvider`.
  - `id: 'wikitree'`, `name: 'WikiTree'`, `type: 'api'`.
  - `search()` — calls WikiTree Apps API: `POST https://api.wikitree.com/api.php` with `action=searchPerson`, `FirstName`, `LastName`, `BirthDate`, `DeathDate`, `fields` (comma-separated). Parses JSON response.
  - Filters out results where `IsLiving === 1` (respects living-person privacy, aligns with Ancstra's living-person filter).
  - Maps to `SearchResult` with `url: https://www.wikitree.com/wiki/{Name}`.
  - `getRecord(wikiTreeId)` — calls `action=getPerson` with `key={wikiTreeId}`, `fields=*`.
  - Uses `RateLimiter` with 30 req/min.
  - `healthCheck()` — calls `action=getHelp`, returns 'healthy' if response ok.

- [ ] **Step 5:** Run test — Expected: PASS

- [ ] **Step 6:** Register provider in `packages/research/src/index.ts` exports.

- [ ] **Step 7:** Commit: `feat(research): WikiTree provider — API-based person search`

---

## Task 10: Web Search Provider (SearXNG / Brave)

**Files:**
- Create: `packages/research/src/providers/web-search/provider.ts`, `packages/research/src/providers/web-search/searxng.ts`, `packages/research/src/providers/web-search/brave.ts`, `packages/research/src/providers/web-search/types.ts`
- Test: `packages/research/src/__tests__/web-search-provider.test.ts`

- [ ] **Step 1:** Create `packages/research/src/providers/web-search/types.ts`:
```typescript
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  source?: string;
}

export interface WebSearchAdapter {
  search(query: string, options?: { limit?: number; offset?: number }): Promise<WebSearchResult[]>;
  healthCheck(): Promise<boolean>;
}
```

- [ ] **Step 2:** Write `packages/research/src/__tests__/web-search-provider.test.ts`:
```typescript
describe('WebSearchProvider', () => {
  it('implements SearchProvider interface', () => { ... });
  it('appends genealogy context to search query', async () => { ... });
  it('searches via SearXNG adapter when configured', async () => { ... });
  it('searches via Brave adapter when configured', async () => { ... });
  it('maps web results to SearchResult format', async () => { ... });
  it('deduplicates results by URL', async () => { ... });
  it('health check delegates to active adapter', async () => { ... });
});
```

- [ ] **Step 3:** Run test — Expected: FAIL

- [ ] **Step 4:** Implement `packages/research/src/providers/web-search/searxng.ts`:
  - `SearXNGAdapter` implements `WebSearchAdapter`.
  - `search(query, options)` — calls `GET {SEARXNG_URL}/search?q={query}&format=json&engines=google,bing,duckduckgo&pageno={page}`.
  - Maps `results` array to `WebSearchResult[]`.
  - `healthCheck()` — calls `GET {SEARXNG_URL}/healthz`.

- [ ] **Step 5:** Implement `packages/research/src/providers/web-search/brave.ts`:
  - `BraveSearchAdapter` implements `WebSearchAdapter`.
  - `search(query, options)` — calls `GET https://api.search.brave.com/res/v1/web/search?q={query}&count={limit}` with header `X-Subscription-Token: {BRAVE_API_KEY}`.
  - Maps `web.results` array to `WebSearchResult[]`.
  - `healthCheck()` — performs a test search, returns true if 200.

- [ ] **Step 6:** Implement `packages/research/src/providers/web-search/provider.ts`:
  - `WebSearchProvider` implements `SearchProvider`.
  - `id: 'web_search'`, `name: 'Web Search'`, `type: 'web_search'`.
  - Constructor accepts `{ adapter: WebSearchAdapter }` — caller decides SearXNG vs Brave based on env config.
  - `search(request)` — builds a genealogy-focused query string from `SearchRequest` fields: `"{givenName} {surname}" genealogy {birthYear} {birthPlace}`. Calls adapter. Maps `WebSearchResult[]` to `SearchResult[]` with `providerId: 'web_search'`.
  - Deduplicates results by normalized URL.
  - Uses `RateLimiter` with configurable RPM (default 30).
  - `healthCheck()` — delegates to adapter.

- [ ] **Step 7:** Run test — Expected: PASS

- [ ] **Step 8:** Create factory function in `packages/research/src/providers/web-search/provider.ts`:
```typescript
export function createWebSearchProvider(): WebSearchProvider | null {
  if (process.env.SEARXNG_URL) {
    return new WebSearchProvider({ adapter: new SearXNGAdapter(process.env.SEARXNG_URL) });
  }
  if (process.env.BRAVE_API_KEY) {
    return new WebSearchProvider({ adapter: new BraveSearchAdapter(process.env.BRAVE_API_KEY) });
  }
  return null; // No web search configured
}
```

- [ ] **Step 9:** Register provider and factory in `packages/research/src/index.ts` exports. Add `SEARXNG_URL` and `BRAVE_API_KEY` to `.env.example`.

- [ ] **Step 10:** Commit: `feat(research): web search provider — SearXNG and Brave Search adapters`

---

## Summary

| Task | What | Tests | Key Files | ~Duration |
|------|------|-------|-----------|-----------|
| 1 | Playwright setup + scrape-url route | route validation | `apps/worker/src/lib/playwright.ts`, `routes/scrape.ts` | 0.5d |
| 2 | URL scraper — text + metadata | scraper extraction | `packages/research/src/scraper/url-scraper.ts` | 1d |
| 3 | Screenshot capture + archive storage | screenshot, archiver | `scraper/screenshot.ts`, `scraper/archiver.ts` | 0.5d |
| 4 | Scrape-batch job | batch processing | `apps/worker/src/jobs/scrape-batch.ts` | 0.5d |
| 5 | Rate limiter + robots.txt checker | robots, domain limiter | `scraper/robots.ts`, `scraper/rate-limiter-domain.ts` | 1d |
| 6 | URL paste workflow (Next.js -> worker) | — | `api/research/scrape/route.ts`, `url-paste-input.tsx` | 1d |
| 7 | Text paste + AI entity extraction | extractor | `scraper/extractor.ts`, `text-paste-modal.tsx` | 1.5d |
| 8 | FindAGrave provider | parser, provider | `providers/findagrave/provider.ts`, `parser.ts` | 1d |
| 9 | WikiTree provider | provider | `providers/wikitree/provider.ts` | 0.5d |
| 10 | Web search provider (SearXNG/Brave) | adapters, provider | `providers/web-search/provider.ts`, `searxng.ts`, `brave.ts` | 1d |

**Total estimated duration:** ~8.5 days
**Total commits:** ~10
