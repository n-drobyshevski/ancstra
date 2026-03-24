# Hybrid Scrape Pipeline

## Problem

When a user clicks "Scrape URL" on a research item detail page, many genealogy sites (LOC, WikiTree) are behind Cloudflare or require JavaScript, so the server-side `fetch` fallback produces no content. The existing Playwright worker is fully built but has a critical gap: it scrapes and archives to disk but never writes `fullText` back to the research item in the DB. Users see "No full text available" with no recourse.

## Solution

A three-tier scrape pipeline with background job tracking, toast notifications, and graceful degradation:

1. **Playwright worker** (preferred) — handles JS-rendered and Cloudflare-protected pages
2. **Fetch fallback** — server-side HTML extraction for simple pages when worker is unavailable
3. **User guidance** — clear messaging when neither approach works, directing user to start the worker

## Data Model

### New table: `scrape_jobs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | UUID |
| `itemId` | text FK | → research_items.id |
| `url` | text | Target URL |
| `status` | text | `pending` → `processing` → `completed` / `failed` |
| `fullText` | text | Scraped content (null until done) |
| `title` | text | Extracted page title |
| `snippet` | text | Extracted meta description |
| `error` | text | Error message if failed |
| `method` | text | `playwright` / `fetch_fallback` |
| `createdAt` | text | ISO timestamp |
| `completedAt` | text | ISO timestamp (null until done) |

**Indexes:** `idx_scrape_jobs_item` on `itemId`, `idx_scrape_jobs_status` on `status`.

**Cleanup:** Completed/failed jobs older than 7 days are eligible for deletion. Run a cleanup query at app startup or as a periodic task.

Add to `packages/db/src/research-schema.ts`. The table lives in the family DB alongside `research_items`.

### Query functions: `scrape-jobs.ts`

```typescript
// Create a new scrape job (called by web app before dispatching to worker)
createScrapeJob(db, { id, itemId, url, method: 'playwright' }): Promise<void>

// Update job status and results (called by worker)
updateScrapeJob(db, jobId, updates: Partial<ScrapeJobRow>): Promise<void>

// Get job by ID (called by poll endpoint)
getScrapeJob(db, jobId): Promise<ScrapeJobRow | null>

// Find active job for an item (for duplicate guard)
findActiveScrapeJob(db, itemId): Promise<ScrapeJobRow | null>

// Delete stale jobs (cleanup)
deleteStaleJobs(db, olderThanDays: number): Promise<void>
```

## Flow

```
User clicks "Scrape URL"
        │
        ▼
  POST /api/research/scrape { url, itemId }
        │
        ├─── Check for existing pending/processing job for itemId
        │    (if found, return existing jobId instead of creating new one)
        │
        ├─── WORKER_URL set? ───────────────────────┐
        │         yes                                │
        ▼                                            ▼ no
  Insert scrape_jobs row (pending)            Fetch fallback
  POST {WORKER_URL}/jobs/scrape-url           (existing behavior)
    { jobId, itemId, url }
  Return { jobId } to client                  Update item directly
        │                                     Return updated item
        ▼
  Client starts polling
  GET /api/research/scrape-jobs/{jobId}
  every 3s, max 90s
        │
        ▼
  Worker picks up job:
  1. Update scrape_jobs → 'processing'
  2. Playwright scrape (networkidle, 30s page timeout)
  3. In a single transaction:
     - Update scrape_jobs → 'completed' + content
     - Update research_items fullText/snippet/title
     - Update archivedHtmlPath/screenshotPath if archived
        │
        ▼
  Poll detects 'completed'
  → Toast notification
  → If on item detail page, refresh item data
```

## API Surface

### Modified: `POST /api/research/scrape`

Request body (unchanged): `{ url, itemId?, extractEntities?, personId? }`

**Duplicate guard:** Before creating a new job, check `findActiveScrapeJob(db, itemId)`. If a `pending` or `processing` job exists, return its `jobId` instead of creating a new one.

Response changes based on path taken:

```typescript
// Worker available — job dispatched (or existing job found)
{ jobId: string, itemId: string, status: 'pending' | 'processing' }

// Worker unavailable, fetch fallback succeeds
{ itemId: string, status: 'completed', fullText: string | null }

// Worker unavailable, fetch fallback fails
{ itemId: string, status: 'failed', error: string }
```

### New: `GET /api/research/scrape-jobs/[jobId]`

Poll endpoint. Returns job status without the full content (keeps responses small):

```typescript
{
  id: string,
  itemId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  error: string | null,
  completedAt: string | null
}
```

Client fetches fresh item data separately when status is `completed`.

### Modified: Worker `POST /jobs/scrape-url`

Request body changes (worker no longer generates its own `jobId`):

```typescript
{
  jobId: string,       // Required — created by web app
  itemId: string,      // Required — research item to update
  url: string,
  dbFilename: string,  // Required — family DB filename from auth context
  extractEntities?: boolean  // Accepted but deferred (not used yet)
}
```

The existing Zod schema changes: `jobId` and `itemId` become required fields. The worker stops generating its own UUID for `jobId`.

Response stays `202 Accepted` with `{ status: 'accepted' }`.

## Worker DB Access

The web app passes `dbFilename` (the family DB filename, e.g. `my-family.db` or `libsql://...`) in the job payload. This is an identifier, not a credential. The worker calls `createFamilyDb(dbFilename)` which resolves to the correct local SQLite path (`~/.ancstra/families/<filename>`) or Turso URL.

**Local dev (SQLite):** `dbFilename` is a bare filename like `my-family.db`. Worker resolves to `~/.ancstra/families/my-family.db`.

**Production (Turso):** `dbFilename` is a `libsql://` URL. Worker connects directly.

The worker already depends on `@ancstra/research` (which transitively includes `@ancstra/db`), so no new package dependencies are needed.

Worker imports `updateResearchItemContent` from `@ancstra/research` and new `updateScrapeJob`/`getScrapeJob` query functions. Uses `(db as any).transaction()` pattern (same as `promote.ts`) for atomic writes.

## Worker Job Execution

```typescript
async function executeScrapeJob(payload: ScrapeJobPayload) {
  const db = createFamilyDb(payload.dbFilename);

  // 1. Mark processing
  await updateScrapeJob(db, payload.jobId, { status: 'processing' });

  try {
    // 2. Scrape with Playwright (30s page timeout, total wall time may be longer)
    const result = await withPage(async (page) => {
      return scrapeUrl(page, { url: payload.url, timeout: 30_000 });
    });

    // 3. Archive (existing behavior)
    const archive = await archiveScrapeResult(result);

    // 4. Atomic update: scrape job + research item in one transaction
    //    Uses (db as any).transaction() pattern — see promote.ts
    await (db as any).transaction(async (tx: any) => {
      await updateScrapeJob(tx, payload.jobId, {
        status: 'completed',
        title: result.title,
        snippet: result.metadata.ogDescription,
        fullText: result.textContent,
        method: 'playwright',
        completedAt: new Date().toISOString(),
      });

      await updateResearchItemContent(tx, payload.itemId, {
        title: result.title,
        snippet: result.metadata.ogDescription,
        fullText: result.textContent,
      });
    });
  } catch (err) {
    await updateScrapeJob(db, payload.jobId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
  }
}
```

The transaction in step 4 ensures the job and item are always in sync — if the worker crashes between writes, neither update persists.

## Client UX

### Scrape button behavior

- **Click:** Button disabled, shows "Scraping..." spinner
- **Worker path:** Returns `jobId` immediately. Spinner stays. Polling starts in background.
- **Fallback path:** 10-15s wait, then shows result or error inline.
- **Double-click guard:** Button is disabled while scraping. Server-side duplicate guard returns existing `jobId` if a job is already active.

### Polling hook: `useScrapeJob(jobId)`

- Polls `GET /api/research/scrape-jobs/{jobId}` every 3 seconds
- Stops on `completed`, `failed`, or 90s timeout
- Returns `{ status, error, completedAt }`
- 90s timeout allows headroom above the 30s page-load timeout (browser launch + extraction + DB write + archive can add 15-30s)

### Toast notifications

Uses existing shadcn/ui toast primitives (sonner) — no separate toast provider needed.

- **Success:** "Scraped www.loc.gov — full text extracted" (green, auto-dismiss 5s)
- **Failure:** "Could not scrape www.loc.gov — {error}" (orange, stays until dismissed)
- **Timeout:** "Scrape is taking longer than expected" (neutral)

### Auto-refresh

- If user is on the item detail page when scrape completes, refresh item data automatically (fullText appears)
- If user navigated away, toast still shows. Next visit to item detail gets fresh data from server component.

### Worker unavailable + fallback fails

Message: "Could not extract text from this page. The site may require JavaScript or block automated access. [Start the scrape worker](/settings) for JavaScript-heavy sites."

Links to `/settings` where worker status is already visible.

## Files to Create/Modify

### New files
- `packages/db/src/research-schema.ts` — add `scrapeJobs` table definition + indexes
- `packages/research/src/items/scrape-jobs.ts` — CRUD for scrape_jobs (create, update, get, findActive, deleteStale)
- `apps/web/app/api/research/scrape-jobs/[jobId]/route.ts` — poll endpoint
- `apps/web/lib/research/scrape-job-poller.ts` — `useScrapeJob` polling hook

### Modified files
- `packages/research/src/index.ts` — export new scrape job functions
- `apps/web/app/api/research/scrape/route.ts` — create scrape_jobs row, duplicate guard, new response shapes
- `apps/web/components/research/item-detail/item-content.tsx` — integrate polling + toast
- `apps/web/components/research/item-detail/item-detail-shell.tsx` — wire up scrape job state
- `apps/web/lib/research/scrape-client.ts` — handle new response shapes (use `jobId` field name consistently)
- `apps/worker/src/routes/scrape.ts` — require `jobId` + `itemId` in Zod schema, stop generating own jobId
- `apps/worker/src/jobs/scrape-url.ts` — add DB connection, transactional writes for job + item

### No new worker environment variables needed
Worker gets `dbFilename` from each job payload (from web app's auth context).

## Testing

- Unit test: `scrape-jobs.ts` CRUD operations (create, update, get, findActive, deleteStale)
- Unit test: duplicate guard returns existing jobId
- Integration test: scrape API creates job row, returns jobId
- Integration test: poll endpoint returns correct status progression
- Integration test: worker transactional write updates both tables atomically
- Manual test: click Scrape URL on Cloudflare-protected item with worker running, verify fullText appears via toast
