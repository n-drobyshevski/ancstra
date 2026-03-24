# Hybrid Scrape Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable background Playwright scraping with job tracking, toast notifications, and graceful fallback for JavaScript-heavy sites.

**Architecture:** New `scrape_jobs` table tracks scrape requests. Web app creates job rows and dispatches to the Playwright worker. Worker writes results directly to the DB (both job status and research item content) in a single transaction. Client polls for job completion and shows toast notifications. Falls back to server-side fetch extraction when worker is unavailable.

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite/Turso, Playwright, Vitest, sonner (toast), shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-24-hybrid-scrape-pipeline.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `packages/research/src/items/scrape-jobs.ts` | CRUD for scrape_jobs table |
| `packages/research/src/__tests__/scrape-jobs.test.ts` | Tests for scrape job queries |
| `apps/web/app/api/research/scrape-jobs/[jobId]/route.ts` | Poll endpoint for job status |
| `apps/web/lib/research/scrape-job-poller.ts` | `useScrapeJob` polling hook |

### Modified files
| File | Changes |
|------|---------|
| `packages/db/src/research-schema.ts` | Add `scrapeJobs` table + indexes |
| `packages/db/src/turso.ts` | Add `CREATE TABLE IF NOT EXISTS scrape_jobs` DDL for Turso provisioning |
| `packages/db/src/index.ts` | Export `scrapeJobs` table (note: also auto-exported via family-schema barrel) |
| `packages/research/src/index.ts` | Export scrape job functions |
| `apps/web/app/api/research/scrape/route.ts` | Create job row, duplicate guard, new response shapes |
| `apps/web/lib/research/scrape-client.ts` | Handle jobId response, add polling integration |
| `apps/web/components/research/item-detail/item-content.tsx` | Integrate polling + toast |
| `apps/web/components/research/item-detail/item-detail-shell.tsx` | Wire up scrape job state |
| `apps/worker/src/routes/scrape.ts` | Require jobId + itemId, remove jobId generation |
| `apps/worker/src/jobs/scrape-url.ts` | Add DB connection, transactional writes |

---

## Task 1: Add `scrapeJobs` table to schema

**Files:**
- Modify: `packages/db/src/research-schema.ts:104` (add after last table)
- Modify: `packages/db/src/turso.ts:302` (add DDL after canvas positions section)
- Modify: `packages/db/src/index.ts` (export new table)

- [ ] **Step 1: Add the scrapeJobs table definition**

In `packages/db/src/research-schema.ts`, add after the `researchCanvasPositions` table (line 104):

```typescript
export const scrapeJobs = sqliteTable('scrape_jobs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => researchItems.id),
  url: text('url').notNull(),
  status: text('status').notNull().default('pending'),
  fullText: text('full_text'),
  title: text('title'),
  snippet: text('snippet'),
  error: text('error'),
  method: text('method'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  index('idx_scrape_jobs_item').on(table.itemId),
  index('idx_scrape_jobs_status').on(table.status),
]);
```

Import `index` from `drizzle-orm/sqlite-core` if not already imported (it is already imported in the current file).

- [ ] **Step 2: Add DDL to turso.ts for production databases**

In `packages/db/src/turso.ts`, add after the canvas positions DDL (around line 302):

```sql
-- ==================== SCRAPE JOBS (research-schema) ====================
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES research_items(id),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  full_text TEXT,
  title TEXT,
  snippet TEXT,
  error TEXT,
  method TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_item ON scrape_jobs(item_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
```

This ensures both new and existing Turso databases get the table. Local SQLite uses `CREATE TABLE IF NOT EXISTS` via the same DDL path.

- [ ] **Step 3: Export the table from the db package**

In `packages/db/src/index.ts`, find where `researchItems` and related tables are exported and add:

```typescript
export { scrapeJobs } from './research-schema';
```

- [ ] **Step 4: Verify the schema compiles**

Run: `cd packages/db && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/research-schema.ts packages/db/src/turso.ts packages/db/src/index.ts
git commit -m "feat(db): add scrape_jobs table schema with indexes and DDL"
```

---

## Task 2: Create scrape-jobs CRUD functions

**Files:**
- Create: `packages/research/src/items/scrape-jobs.ts`
- Create: `packages/research/src/__tests__/scrape-jobs.test.ts`
- Modify: `packages/research/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/research/src/__tests__/scrape-jobs.test.ts`. Follow the existing test patterns (vitest, in-memory SQLite). Check `packages/research/src/__tests__/items-queries.test.ts` for the exact DB setup pattern — it creates tables via raw SQL DDL and seeds required parent rows.

**Important:** The `scrape_jobs` table has a FK to `research_items`, which in turn references other tables. The test setup must:
1. Create all parent tables (`research_items` and its dependencies) via raw SQL from `turso.ts` DDL
2. Seed at least one research item (e.g., `INSERT INTO research_items ...` with `id = 'item-1'`)
3. Create the `scrape_jobs` table via the new DDL

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// Import test DB setup from existing test helpers — match items-queries.test.ts pattern
// Import the functions we'll create
import {
  createScrapeJob,
  getScrapeJob,
  updateScrapeJob,
  findActiveScrapeJob,
  deleteStaleJobs,
} from '../items/scrape-jobs';

describe('scrape-jobs', () => {
  // Use same DB setup pattern as items-queries.test.ts

  describe('createScrapeJob', () => {
    it('creates a job with pending status', async () => {
      const job = await createScrapeJob(db, {
        id: 'job-1',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      expect(job.id).toBe('job-1');
      expect(job.status).toBe('pending');
    });
  });

  describe('getScrapeJob', () => {
    it('returns null for nonexistent job', async () => {
      const result = await getScrapeJob(db, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns the job by id', async () => {
      await createScrapeJob(db, {
        id: 'job-2',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      const result = await getScrapeJob(db, 'job-2');
      expect(result).not.toBeNull();
      expect(result!.url).toBe('https://example.com');
    });
  });

  describe('updateScrapeJob', () => {
    it('updates status and content fields', async () => {
      await createScrapeJob(db, {
        id: 'job-3',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      await updateScrapeJob(db, 'job-3', {
        status: 'completed',
        fullText: 'Extracted text',
        title: 'Page Title',
        completedAt: new Date().toISOString(),
      });
      const result = await getScrapeJob(db, 'job-3');
      expect(result!.status).toBe('completed');
      expect(result!.fullText).toBe('Extracted text');
    });
  });

  describe('findActiveScrapeJob', () => {
    it('returns null when no active job exists', async () => {
      const result = await findActiveScrapeJob(db, 'item-1');
      expect(result).toBeNull();
    });

    it('returns pending job for item', async () => {
      await createScrapeJob(db, {
        id: 'job-4',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      const result = await findActiveScrapeJob(db, 'item-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('job-4');
    });

    it('ignores completed jobs', async () => {
      await createScrapeJob(db, {
        id: 'job-5',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      await updateScrapeJob(db, 'job-5', {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      const result = await findActiveScrapeJob(db, 'item-1');
      expect(result).toBeNull();
    });
  });

  describe('deleteStaleJobs', () => {
    it('deletes completed jobs older than N days', async () => {
      await createScrapeJob(db, {
        id: 'job-old',
        itemId: 'item-1',
        url: 'https://example.com',
        method: 'playwright',
      });
      // Manually backdate the job
      await updateScrapeJob(db, 'job-old', {
        status: 'completed',
        completedAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
      });
      await deleteStaleJobs(db, 7);
      const result = await getScrapeJob(db, 'job-old');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/research && pnpm vitest run src/__tests__/scrape-jobs.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scrape-jobs.ts**

Create `packages/research/src/items/scrape-jobs.ts`:

```typescript
import { eq, and, or, lt, sql } from 'drizzle-orm';
import { scrapeJobs } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateScrapeJobInput {
  id: string;
  itemId: string;
  url: string;
  method: 'playwright' | 'fetch_fallback';
}

export async function createScrapeJob(db: Database, input: CreateScrapeJobInput) {
  const now = new Date().toISOString();
  await db.insert(scrapeJobs).values({
    id: input.id,
    itemId: input.itemId,
    url: input.url,
    status: 'pending',
    method: input.method,
    createdAt: now,
  }).run();

  return { id: input.id, status: 'pending' as const, createdAt: now };
}

export async function getScrapeJob(db: Database, id: string) {
  const rows = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, id)).all();
  return rows[0] ?? null;
}

export async function updateScrapeJob(
  db: Database,
  id: string,
  updates: Partial<{
    status: string;
    fullText: string;
    title: string;
    snippet: string;
    error: string;
    method: string;
    completedAt: string;
  }>
) {
  await db.update(scrapeJobs).set(updates).where(eq(scrapeJobs.id, id)).run();
}

export async function findActiveScrapeJob(db: Database, itemId: string) {
  const rows = await db
    .select()
    .from(scrapeJobs)
    .where(
      and(
        eq(scrapeJobs.itemId, itemId),
        or(eq(scrapeJobs.status, 'pending'), eq(scrapeJobs.status, 'processing'))
      )
    )
    .all();
  return rows[0] ?? null;
}

export async function deleteStaleJobs(db: Database, olderThanDays: number) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  await db
    .delete(scrapeJobs)
    .where(
      or(
        // Completed/failed jobs older than cutoff
        and(
          or(eq(scrapeJobs.status, 'completed'), eq(scrapeJobs.status, 'failed')),
          lt(scrapeJobs.completedAt, cutoff)
        ),
        // Zombie pending jobs (never processed) older than cutoff
        and(
          eq(scrapeJobs.status, 'pending'),
          lt(scrapeJobs.createdAt, cutoff)
        )
      )
    )
    .run();
}
```

- [ ] **Step 4: Export from package index**

In `packages/research/src/index.ts`, add after the existing research items exports:

```typescript
// Scrape Jobs
export {
  createScrapeJob,
  getScrapeJob,
  updateScrapeJob,
  findActiveScrapeJob,
  deleteStaleJobs,
} from './items/scrape-jobs';
export type { CreateScrapeJobInput } from './items/scrape-jobs';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/research && pnpm vitest run src/__tests__/scrape-jobs.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/research/src/items/scrape-jobs.ts packages/research/src/__tests__/scrape-jobs.test.ts packages/research/src/index.ts
git commit -m "feat(research): add scrape_jobs CRUD functions with tests"
```

---

## Task 3: Update scrape API route — job creation + duplicate guard

**Files:**
- Modify: `apps/web/app/api/research/scrape/route.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/web/app/api/research/scrape/route.ts`, add:

```typescript
import { createScrapeJob, findActiveScrapeJob } from '@ancstra/research';
```

- [ ] **Step 2: Add duplicate guard and job creation in the worker dispatch path**

Replace the worker dispatch section (the `if (workerUrl)` block). Key changes:
- Before dispatching, check `findActiveScrapeJob(familyDb, itemId)` — if found, return existing jobId
- Create a `scrape_jobs` row before dispatching to the worker
- Remove `dbUrl`/`dbFilePath` from the worker payload (worker reads from its own env)
- Return `{ jobId, itemId, status }` response shape

The worker payload becomes: `{ jobId, itemId, url, dbFilename: ctx.dbFilename, extractEntities }`

The `dbFilename` is the family DB filename from auth context (e.g., `my-family.db` or `libsql://...`). It's a filename/identifier, not a credential.

- [ ] **Step 3: Update response shapes for fallback path**

When the fallback path is used (worker unavailable):
- Success: return `{ itemId, status: 'completed', fullText }`
- Failure: return `{ itemId, status: 'failed', error: '...' }`

This unifies the response shape so the client can handle both paths.

- [ ] **Step 4: Verify compilation**

Run: `cd apps/web && pnpm tsc --noEmit 2>&1 | grep scrape`
Expected: No new errors related to scrape files

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/research/scrape/route.ts
git commit -m "feat(api): add scrape job creation and duplicate guard to scrape route"
```

---

## Task 4: Add poll endpoint for scrape job status

**Files:**
- Create: `apps/web/app/api/research/scrape-jobs/[jobId]/route.ts`

- [ ] **Step 1: Create the poll endpoint**

```typescript
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getScrapeJob } from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { jobId } = await params;
    const job = await getScrapeJob(familyDb, jobId);

    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Return status only — no fullText (keep poll responses small)
    return NextResponse.json({
      id: job.id,
      itemId: job.itemId,
      status: job.status,
      error: job.error ?? null,
      completedAt: job.completedAt ?? null,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/scrape-jobs/[jobId] GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify route compiles**

Run: `cd apps/web && pnpm tsc --noEmit 2>&1 | grep scrape-jobs`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/research/scrape-jobs/
git commit -m "feat(api): add scrape job poll endpoint"
```

---

## Task 5: Create `useScrapeJob` polling hook

**Files:**
- Create: `apps/web/lib/research/scrape-job-poller.ts`

- [ ] **Step 1: Implement the polling hook**

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';

interface ScrapeJobState {
  status: JobStatus;
  error: string | null;
  itemId: string | null;
}

interface UseScrapeJobOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onCompleted?: (itemId: string) => void;
  onFailed?: (error: string) => void;
  onTimeout?: () => void;
}

export function useScrapeJob(
  jobId: string | null,
  options: UseScrapeJobOptions = {}
): ScrapeJobState {
  const {
    intervalMs = 3_000,
    timeoutMs = 90_000,
    onCompleted,
    onFailed,
    onTimeout,
  } = options;

  const [state, setState] = useState<ScrapeJobState>({
    status: 'pending',
    error: null,
    itemId: null,
  });

  const callbacksRef = useRef({ onCompleted, onFailed, onTimeout });
  callbacksRef.current = { onCompleted, onFailed, onTimeout };

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    const startTime = Date.now();

    const poll = async () => {
      if (!active) return;

      if (Date.now() - startTime > timeoutMs) {
        setState((prev) => ({ ...prev, status: 'timeout' }));
        callbacksRef.current.onTimeout?.();
        return;
      }

      try {
        const res = await fetch(`/api/research/scrape-jobs/${jobId}`);
        if (!res.ok || !active) return;
        const data = await res.json();

        setState({
          status: data.status,
          error: data.error,
          itemId: data.itemId,
        });

        if (data.status === 'completed') {
          callbacksRef.current.onCompleted?.(data.itemId);
          return; // Stop polling
        }

        if (data.status === 'failed') {
          callbacksRef.current.onFailed?.(data.error ?? 'Unknown error');
          return; // Stop polling
        }

        // Continue polling
        setTimeout(poll, intervalMs);
      } catch {
        // Network error — retry
        if (active) setTimeout(poll, intervalMs);
      }
    };

    // Start first poll after a short delay (job needs time to be accepted)
    const timer = setTimeout(poll, 1_000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, intervalMs, timeoutMs]);

  return state;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/research/scrape-job-poller.ts
git commit -m "feat(client): add useScrapeJob polling hook"
```

---

## Task 6: Update scrape client hook for new response shapes

**Files:**
- Modify: `apps/web/lib/research/scrape-client.ts`

- [ ] **Step 1: Update ScrapeResult type and response handling**

The current `ScrapeResult` has `{ id, title, status, createdAt }`. Update to handle both paths:

```typescript
interface ScrapeResponse {
  // Worker path
  jobId?: string;
  // Fallback/common fields
  itemId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fullText?: string | null;
  error?: string;
}
```

Update the `scrape` function return type to `Promise<ScrapeResponse | null>`.

Update the fetch handler to return the raw response shape instead of mapping to the old `ScrapeResult`.

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && pnpm tsc --noEmit 2>&1 | grep scrape-client`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/research/scrape-client.ts
git commit -m "feat(client): update scrape client for new response shapes"
```

---

## Task 7: Integrate polling + toast into item detail UI

**Files:**
- Modify: `apps/web/components/research/item-detail/item-content.tsx`
- Modify: `apps/web/components/research/item-detail/item-detail-shell.tsx`

- [ ] **Step 1: Update ItemDetailShell to manage scrape job state**

In `item-detail-shell.tsx`:
- Add `useState<string | null>` for `scrapeJobId`
- Import `useScrapeJob` from `scrape-job-poller.ts`
- Import `toast` from `sonner`
- Wire up `useScrapeJob(scrapeJobId, { onCompleted, onFailed, onTimeout })`
- `onCompleted`: call `refreshItem()` to fetch fresh data, show success toast
- `onFailed`: show error toast
- `onTimeout`: show timeout toast
- Pass `scrapeJobId` setter and job status down to `ItemContent`

```typescript
import { toast } from 'sonner';
import { useScrapeJob } from '@/lib/research/scrape-job-poller';

// Inside component:
const [scrapeJobId, setScrapeJobId] = useState<string | null>(null);

const scrapeJob = useScrapeJob(scrapeJobId, {
  onCompleted: async () => {
    await refreshItem();
    toast.success(`Scraped ${new URL(item.url!).hostname} — full text extracted`);
    setScrapeJobId(null);
  },
  onFailed: (error) => {
    toast.error(`Could not scrape ${new URL(item.url!).hostname}`, {
      description: error,
    });
    setScrapeJobId(null);
  },
  onTimeout: () => {
    toast.info('Scrape is taking longer than expected');
    setScrapeJobId(null);
  },
});
```

Pass to ItemContent: `onScrapeJobStarted={setScrapeJobId}`, `scrapeJobStatus={scrapeJob.status}`

- [ ] **Step 2: Update ItemContent to handle both worker and fallback paths**

In `item-content.tsx`:
- Update props to accept `onScrapeJobStarted: (jobId: string) => void` and `scrapeJobStatus`
- In `handleScrape`:
  - Call `scrape(item.url, { itemId: item.id })`
  - If response has `jobId`: call `onScrapeJobStarted(jobId)` (worker path — polling handles the rest)
  - If response has `status === 'completed'`: call `onRefresh()` directly (fallback path)
  - If response has `status === 'failed'`: show inline error
- Show "Scraping..." spinner when `scrapeJobStatus` is `pending` or `processing`
- Keep the fallback error message with settings link: "Could not extract text from this page. The site may require JavaScript or block automated access. [Start the scrape worker](/settings) for JavaScript-heavy sites."

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && pnpm tsc --noEmit 2>&1 | grep -E "(item-content|item-detail-shell)"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/item-detail/item-content.tsx apps/web/components/research/item-detail/item-detail-shell.tsx
git commit -m "feat(ui): integrate scrape job polling with toast notifications"
```

---

## Task 8: Update worker to accept jobId/itemId and write to DB

**Files:**
- Modify: `apps/worker/src/routes/scrape.ts`
- Modify: `apps/worker/src/jobs/scrape-url.ts`

- [ ] **Step 1: Update worker route Zod schema**

In `apps/worker/src/routes/scrape.ts`, update the schema at lines 6-10:

```typescript
const scrapeUrlSchema = z.object({
  jobId: z.string().uuid('Invalid jobId'),
  itemId: z.string().uuid('Invalid itemId'),
  url: z.string().url('Invalid URL'),
  dbFilename: z.string().min(1, 'dbFilename required'),
  extractEntities: z.boolean().optional(),
});
```

Remove the `jobId = crypto.randomUUID()` line (line 30). Use `parsed.data.jobId` instead.

Pass `jobId` and `itemId` to the `scrapeUrlJob` call.

- [ ] **Step 2: Update scrape-url job to write to DB**

In `apps/worker/src/jobs/scrape-url.ts`:
- Add a `createFamilyDb` import from `@ancstra/db`
- Add imports for `updateScrapeJob`, `updateResearchItemContent` from `@ancstra/research`
- Update `ScrapeUrlJobInput` to include `itemId` and `dbFilename`
- Use `(db as any).transaction(async (tx: any) => ...)` pattern (same as `promote.ts`) because better-sqlite3 rejects async callbacks while libsql requires them

**DB connection:** `createFamilyDb(dbFilename)` takes a filename (e.g., `my-family.db`) and resolves to `~/.ancstra/families/my-family.db`. It also accepts `libsql://` or `file:` prefixed URLs for Turso/explicit paths. The `dbFilename` comes from the job payload (it's a filename, not a credential). The web app gets it from `ctx.dbFilename` in auth context.

```typescript
import { createFamilyDb } from '@ancstra/db';
import { updateScrapeJob, updateResearchItemContent } from '@ancstra/research';

export interface ScrapeUrlJobInput {
  jobId: string;
  itemId: string;
  url: string;
  dbFilename: string; // Family DB filename or libsql:// URL
  extractEntities?: boolean;
}

export async function scrapeUrlJob(input: ScrapeUrlJobInput): Promise<void> {
  const db = createFamilyDb(input.dbFilename);

  await updateScrapeJob(db, input.jobId, { status: 'processing' });

  try {
    const result = await withPage(async (page) => {
      return scrapeUrl(page, { url: input.url, timeout: 30_000 });
    });

    const archive = await archiveScrapeResult(result);

    // Atomic update: job status + research item content
    // Use (db as any).transaction pattern — see promote.ts for precedent.
    // better-sqlite3 rejects async callbacks; libsql requires them.
    await (db as any).transaction(async (tx: any) => {
      await updateScrapeJob(tx, input.jobId, {
        status: 'completed',
        title: result.title,
        snippet: result.metadata.ogDescription,
        fullText: result.textContent,
        method: 'playwright',
        completedAt: new Date().toISOString(),
      });
      await updateResearchItemContent(tx, input.itemId, {
        title: result.title,
        snippet: result.metadata.ogDescription,
        fullText: result.textContent,
      });
    });

    console.log(`[scrape-url] Job ${input.jobId} completed: "${result.title}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrape-url] Job ${input.jobId} failed:`, message);
    await updateScrapeJob(db, input.jobId, {
      status: 'failed',
      error: message,
      completedAt: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 3: Verify worker compiles**

Run: `cd apps/worker && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/routes/scrape.ts apps/worker/src/jobs/scrape-url.ts
git commit -m "feat(worker): accept jobId/itemId, write scrape results to DB transactionally"
```

---

## Task 9: Manual end-to-end validation

**Files:** None (testing only)

- [ ] **Step 1: Start the worker**

```bash
cd apps/worker && pnpm dev
```

Set `WORKER_URL=http://localhost:3001` in the web app's `.env`. The worker gets `dbFilename` from each job payload (passed by the web app from auth context), so no DB env vars are needed on the worker for local dev.

- [ ] **Step 2: Test happy path with worker**

Navigate to a research item with a URL (e.g., the WikiTree item). Click "Scrape URL". Verify:
- Button shows "Scraping..." immediately
- Toast appears within ~30s: "Scraped www.wikitree.com — full text extracted"
- Full text section populates without page reload
- `scrape_jobs` table has a `completed` row

- [ ] **Step 3: Test Cloudflare-protected URL with worker**

Navigate to the LOC Chronicling America item. Click "Scrape URL". Verify:
- Playwright worker can bypass the Cloudflare challenge
- Full text is extracted and displayed
- If Cloudflare still blocks Playwright: job status is `failed` with error toast

- [ ] **Step 4: Test fallback path (stop worker)**

Stop the worker process. Click "Scrape URL" on a simple URL. Verify:
- Falls through to fetch fallback
- Shows inline result or error message
- Error message includes link to `/settings` for worker guidance

- [ ] **Step 5: Test duplicate guard**

Start worker. Click "Scrape URL" quickly twice. Verify:
- Second click returns the same jobId (not a new one)
- Only one `scrape_jobs` row created

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual e2e testing"
```
