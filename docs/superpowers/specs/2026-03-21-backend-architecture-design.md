# Backend Architecture Design: Next.js (Vercel) + Hono Worker (Railway)

> Date: 2026-03-21 | Status: Draft
> Decision: Add a Hono-based TypeScript backend worker alongside Next.js, deployed to Railway, with progressive phase-gated adoption.

## Problem Statement

Ancstra's planned workloads include several that strain Next.js API routes on Vercel's free tier:
- GEDCOM imports (10K+ persons) exceed the 10s serverless timeout
- Batch record matching is CPU-bound and blocks the event loop
- OCR processing has heavy WASM cold starts (~3-8s)
- Face detection loads large ML models (~5-20MB)
- External API orchestration (FamilySearch rate limiting) needs retries without timeout pressure
- Real-time collaboration (Phase 4) needs WebSocket connections Vercel doesn't support
- Scheduled background jobs (1 cron/day on Vercel hobby tier is insufficient)

This design introduces a separate Hono backend to handle these heavy workloads while keeping Next.js for fast-path operations.

### Relationship to ADR-001

ADR-001 established "single Node.js process" as a principle. This design refines that decision: while both services remain TypeScript on Node.js (preserving the "single language, shared code" benefit), the worker is architecturally a second process. This is acceptable because:
- The worker is progressively adopted (doesn't exist in Phase 1)
- It shares all monorepo packages (zero code duplication)
- It can be turned off without breaking core functionality
- The alternative (Python/Java sidecar) is what ADR-001 actually rejected

A follow-up ADR-007 should be written when the worker is first implemented (Phase 2) to formally record this refinement.

## Architecture Overview

```
Client (Browser / PWA)
    |                              |
    | HTTP / Server Actions        | WebSocket / HTTP
    |                              |
Next.js 16 (Vercel)          Hono Worker (Railway)
    |                              |
    |    Shared Turso Database     |
    +-------------+----------------+
                  |
           Drizzle ORM
           packages/db
```

### Split Principle

Next.js handles anything that is fast (<10s), user-facing, or needs SSR. Hono handles anything that is long-running, CPU-bound, scheduled, or needs persistent connections.

Both services connect to the same Turso database using the same Drizzle schema from `packages/db`. No data synchronization needed — they share state through the database.

In local mode, both services run against SQLite (better-sqlite3) instead of Turso, started together via Turborepo.

## Workload Routing

### Next.js (Vercel) -- Fast Path

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/persons/[id]` | GET/PATCH/DELETE | Person CRUD |
| `/api/persons` | POST | Create person |
| `/api/families` | CRUD | Family/relationship management |
| `/api/events` | CRUD | Life events |
| `/api/sources` | CRUD | Source citations |
| `/api/media` | POST | Upload media (store to R2/S3) |
| `/api/tree` | GET | Full tree data for visualization |
| `/api/search` | GET | Full-text search (FTS5) |
| `/api/ai/chat` | POST | AI research assistant streaming |
| `/api/auth/*` | * | NextAuth.js routes |
| `/api/gedcom/export` | GET | GEDCOM export |
| `/api/gedcom/import` | POST | GEDCOM import dispatcher (forwards to worker) |
| `/api/jobs/[id]` | GET | Poll job status (fallback if WS unavailable) |

### Hono Worker (Railway) -- Heavy Path

| Route | Method | What it does |
|-------|--------|-------------|
| `/jobs/gedcom-import` | POST | Parse and import large GEDCOM files |
| `/jobs/batch-match` | POST | Run matching engine across tree |
| `/jobs/ocr-process` | POST | Server-side OCR pipeline (batch) |
| `/jobs/entity-extract` | POST | Extract genealogical entities from OCR text |
| `/jobs/familysearch-sync` | POST | Orchestrated FamilySearch search |
| `/jobs/duplicate-scan` | POST | Full-tree duplicate detection |
| `/ws/jobs/:jobId` | WS | Job progress streaming |
| `/ws/collab/:treeId` | WS | Real-time collaboration (Phase 4) |
| `/health` | GET | Health check |
| `/cron/familysearch-poll` | POST | Scheduled: check for new records |
| `/cron/cache-warm` | POST | Scheduled: refresh closure table |

### Browser Web Workers -- Client-Side Heavy

| Worker | What it does | Why client-side |
|--------|-------------|-----------------|
| `gedcom-parser.worker.ts` | Parse GEDCOM text into structured records | Pure text parsing, no DB needed, enables progress bar before upload |
| `ocr.worker.ts` | tesseract.js OCR on uploaded images | Designed for browser, works offline, no server cost |
| `face-detect.worker.ts` | face-api.js face detection in photos | TensorFlow.js targets browser, works offline |
| `match-single.worker.ts` | Match a single record against local cache | Fast enough client-side for one-at-a-time |

### Decision Tree

1. Is it simple CRUD or read? -> Next.js API route
2. Is it AI chat streaming? -> Next.js API route (Vercel AI SDK)
3. Can it run in the browser (parsing, OCR, face detect)? -> Browser Web Worker (client-first)
4. Is it CPU-bound, long-running, or needs scheduling? -> Hono Worker (Railway)
5. Does it need persistent connections (WebSocket)? -> Hono Worker (Railway)

## Communication Patterns

### Job Dispatch (Next.js -> Hono)

Next.js kicks off heavy work by calling the Hono worker's REST API. Hono returns a `jobId` immediately (fire-and-forget).

```
Client                    Next.js (Vercel)           Hono Worker (Railway)
  |                           |                           |
  |  POST /api/gedcom/import  |                           |
  |  (file upload)            |                           |
  |-------------------------->|                           |
  |                           |  POST /jobs/gedcom-import |
  |                           |  { fileUrl, treeId }      |
  |                           |-------------------------->|
  |                           |  { jobId: "abc123" }      |
  |                           |<--------------------------|
  |  { jobId: "abc123" }      |                           |
  |<--------------------------|                           |
  |                           |                           |
  |  WS connect /ws/jobs/abc123                           |
  |------------------------------------------------------>|
  |  progress: 3200/10000 persons...                      |
  |<------------------------------------------------------|
  |  complete: { imported: 10000, skipped: 12, errors: 3 }|
  |<------------------------------------------------------|
```

### File Transfer for Large Imports

GEDCOM files can be several megabytes. Passing file content directly in a JSON payload is inefficient. Strategy:

- **Small files (<1MB):** Inline in the job request body as a string. Simple and sufficient.
- **Large files (>1MB):** Upload to Cloudflare R2 (or S3) via a presigned URL from Next.js. Pass the object storage URL to the worker. Worker fetches, processes, and deletes the temp file.
- **Local mode:** Pass file path directly (both services access the same filesystem).

### WebSocket (Client -> Hono Direct)

The client connects directly to the Hono worker via WebSocket for:
- Job progress (GEDCOM import, batch matching)
- Real-time collaboration updates (Phase 4)

This avoids routing WebSocket traffic through Vercel (which doesn't support it).

### Shared Authentication

1. NextAuth.js issues a JWT on login (stored in httpOnly cookie)
2. Next.js API routes verify JWT natively via NextAuth
3. Hono verifies the same JWT using a shared secret (`NEXTAUTH_SECRET`)
4. JWT verification logic lives in `packages/shared/auth/verify-token.ts`, imported by both apps

**WebSocket auth:** Uses short-lived, single-use tokens (not the main session JWT). Flow:
1. Client requests a WS auth token from Next.js: `POST /api/auth/ws-token` -> returns a token valid for 30 seconds
2. Client connects to Hono WebSocket with `?token=xxx`
3. Hono verifies the short-lived token on upgrade, then discards it
4. This avoids exposing the long-lived session JWT in query params, logs, or referrer headers

### Worker Authorization

The Hono worker has unrestricted database write access (same Drizzle schema, same connection). This is a known simplification for a personal/family app. Authorization is enforced in application logic:
- Every job record includes `createdBy` (userId) and `treeId`
- Job handlers verify that the authenticated user has permission for the target tree before processing
- The worker never writes to a tree it wasn't explicitly asked to operate on

This is sufficient for the current scope (solo user, small family groups). If Ancstra ever becomes multi-tenant at scale, worker-side authorization should be revisited.

### Service Discovery

| Environment | Next.js -> Hono URL |
|-------------|---------------------|
| Local dev | `http://localhost:3001` via `.env.local` |
| Production | `https://ancstra-worker.up.railway.app` via `WORKER_URL` env var |

### Failure Handling

- If Hono worker is down, Next.js returns "background service unavailable" error. CRUD and AI chat still work — only heavy jobs are affected.
- If a job fails mid-processing, the job record stores the error + last checkpoint. User can retry, and the job resumes from where it left off.
- The database is the source of truth, not either service.

## Monorepo Structure

```
ancstra/
+-- apps/
|   +-- web/                          # Next.js 16 -> Vercel
|   |   +-- app/
|   |   |   +-- (auth)/               # Auth-required pages
|   |   |   +-- api/                   # Fast-path API routes
|   |   |   +-- layout.tsx
|   |   +-- components/
|   |   +-- lib/
|   |   |   +-- queries/              # React Query hooks
|   |   |   +-- workers/              # Web Worker entry points
|   |   |   +-- worker-client.ts      # Hono RPC client (type-safe)
|   |   +-- next.config.ts
|   |   +-- package.json
|   |
|   +-- worker/                       # Hono backend -> Railway
|       +-- src/
|       |   +-- index.ts              # Hono app entry + server start
|       |   +-- routes/
|       |   |   +-- jobs.ts           # Job dispatch endpoints
|       |   |   +-- cron.ts           # Scheduled task endpoints
|       |   |   +-- health.ts         # Health check
|       |   +-- ws/
|       |   |   +-- job-progress.ts   # WebSocket: job updates
|       |   |   +-- collab.ts         # WebSocket: real-time collab
|       |   +-- jobs/
|       |   |   +-- gedcom-import.ts  # GEDCOM import logic
|       |   |   +-- batch-match.ts    # Batch matching logic
|       |   |   +-- ocr-pipeline.ts   # Server-side OCR
|       |   |   +-- entity-extract.ts # AI entity extraction
|       |   |   +-- familysearch-sync.ts
|       |   +-- middleware/
|       |       +-- auth.ts           # JWT verification
|       +-- Dockerfile
|       +-- package.json
|
+-- packages/
|   +-- db/                           # Shared: Drizzle schema + queries
|   +-- gedcom/                       # Shared: parser + exporter
|   +-- matching/                     # Shared: comparators + scorer
|   +-- ai/                           # Shared: tools + prompts + context
|   +-- ocr/                          # Shared: tesseract + transkribus
|   +-- jobs/                         # Shared: job types + status + schema
|   +-- shared/                       # Shared: types + utils + auth
|
+-- turbo.json
+-- pnpm-workspace.yaml
+-- docker-compose.yml                # Local dev: both services
```

### Shared Job Contract (packages/jobs)

```typescript
// packages/jobs/types.ts

type JobType =
  | 'gedcom-import'
  | 'batch-match'
  | 'ocr-process'
  | 'entity-extract'
  | 'familysearch-sync'
  | 'duplicate-scan';

interface Job {
  id: string;
  type: JobType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;        // 0-100
  progressDetail?: string; // "3200/10000 persons imported"
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  checkpoint?: string;     // Resume point on retry
  createdBy: string;       // userId
  treeId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### Entity Extraction Output Schema

The `entity-extract` job produces structured genealogical data from OCR text. Its output flows into the validation pipeline:

```typescript
// packages/jobs/types.ts

interface EntityExtractionOutput {
  proposedPersons: Array<{
    givenName?: string;
    surname?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    role?: string;          // "father", "witness", "spouse"
    confidence: number;     // 0-1
    sourceText: string;     // exact text span that produced this
  }>;
  proposedRelationships: Array<{
    person1Ref: number;     // index into proposedPersons
    person2Ref: number;
    relationshipType: 'parent_child' | 'partner' | 'sibling';
    evidence: string;
    confidence: number;
  }>;
  proposedEvents: Array<{
    personRef: number;      // index into proposedPersons
    eventType: string;
    date?: string;
    place?: string;
    confidence: number;
  }>;
  sourceDocumentId: string; // media ID of the OCR'd document
}
```

On job completion:
1. `proposedPersons` are inserted into the `proposed_relationships` table with `source_type = 'entity_extraction'`
2. An editor reviews and accepts/rejects each proposed entity (same validation pipeline as AI-suggested relationships)
3. Accepted persons are promoted to the `persons` table

### Type-Safe Cross-Service Calls

```typescript
// apps/web/lib/worker-client.ts
import { hc } from 'hono/client';
import type { AppType } from '@ancstra/worker';

export const workerClient = hc<AppType>(process.env.WORKER_URL!);
// Fully typed — TS error if payload shape is wrong
```

## Deployment

### Production: Vercel + Railway

GitHub push triggers both deployments in parallel.

**Vercel (Next.js):**
- Standard Next.js deployment
- Env vars: `WORKER_URL`, `NEXTAUTH_SECRET`, `TURSO_*`

**Railway (Hono Worker):**
- Dockerfile-based deployment from `apps/worker/Dockerfile`
- Env vars: `PORT`, `NEXTAUTH_SECRET`, `TURSO_*`, `FAMILYSEARCH_*`, `ANTHROPIC_API_KEY`
- Sleep after 10min inactivity (saves execution hours)
- Health check: `GET /health` (Railway only checks while the service is awake -- it does not wake a sleeping service)
- Cron: Railway cron trigger hits `/cron/familysearch-poll` daily at 6am UTC (this wakes the service, runs the job, service sleeps again after idle timeout)

### Railway Free Tier Resource Budget

**RAM (512MB):**

| Job Type | Estimated Peak Memory | Notes |
|----------|----------------------|-------|
| Hono baseline | ~30MB | Always |
| GEDCOM import (10K persons) | ~80-120MB | In-memory parse + batch inserts |
| Batch matching (10K tree) | ~100-150MB | Person index + comparison buffers |
| OCR (tesseract.js server-side) | ~200-400MB | WASM + language data + image buffer |
| Entity extraction (Claude API) | ~50MB | Mostly network I/O |
| FamilySearch sync | ~50MB | Mostly network I/O |

Conclusion: Most jobs fit comfortably. Server-side OCR of large images is the tightest fit -- limit to one concurrent OCR job. For batch OCR of many documents, prefer client-side Web Workers.

**Execution Hours (500 hrs/month):**

Typical usage scenario (solo researcher, occasional family sharing):
- Worker wakes ~5 times/day for jobs (GEDCOM import, matching, sync)
- Average job duration: 2-5 minutes
- Active time per day: ~15-30 minutes
- Monthly: ~8-15 hours
- Daily cron wake: ~2 min/day = ~1 hour/month
- **Total: ~10-16 hours/month (3% of budget)**

Even with 10x usage growth (active family group), the budget is comfortable.

**Scheduling: Railway Cron Triggers (not node-cron)**

Scheduled jobs use Railway's external cron triggers, not in-process `node-cron`. This is because:
- A sleeping container cannot run `node-cron` (the process isn't running)
- Railway cron wakes the service, hits the endpoint, service processes and sleeps again
- This is more reliable and doesn't burn execution hours keeping the service awake

### Local Development

```bash
# Single command starts both
pnpm dev
# apps/web on :3000
# apps/worker on :3001
# Both use local SQLite
```

**docker-compose.yml** (optional, for isolated setup):

```yaml
version: '3.8'
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - WORKER_URL=http://worker:3001
      - DATABASE_URL=file:/data/local.db
    volumes:
      - db-data:/data
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DATABASE_URL=file:/data/local.db
    volumes:
      - db-data:/data

volumes:
  db-data:
```

### Cross-Origin

Hono CORS middleware allows requests from `localhost:3000` (dev) and `ancstra.vercel.app` (prod) with credentials enabled.

## Observability

Both services use the same monitoring strategy from the existing architecture overview:

| Concern | Tool | Configuration |
|---------|------|---------------|
| Error tracking | Sentry free tier | Separate Sentry projects for `web` and `worker` to distinguish errors |
| Structured logging | pino | JSON logs, same format in both services. Railway captures stdout automatically |
| Performance | Web Vitals (Next.js), custom timing (Hono) | Job duration and memory usage logged per job completion |
| Database | Drizzle logger | Query timing in both services |
| Job monitoring | Custom dashboard page in Next.js | Reads from `jobs` table -- shows status, duration, errors for all jobs |

## Progressive Adoption

The worker is not built all at once. It grows phase by phase.

### Phase 1: No Worker

- Next.js API routes only
- GEDCOM import via client-side Web Worker + batched POSTs
- Handles trees up to ~2K persons on Vercel
- Worker not created yet

**Trigger for Phase 2:** GEDCOM file that takes >10s on Vercel, or need for background progress reporting.

### Phase 2: Minimal Worker (GEDCOM + Jobs Infra)

- Create `packages/jobs` schema
- Scaffold `apps/worker` with Hono
- Write ADR-007 documenting the refinement of ADR-001
- Routes: `/jobs/gedcom-import`, `/ws/jobs/:id`, `/health`
- Railway deployment with Dockerfile
- Effort: ~2-3 days

### Phase 3: Add Batch Matching + OCR

- Routes: `/jobs/batch-match`, `/jobs/ocr-process`, `/jobs/entity-extract`
- `worker_threads` for CPU-bound matching
- Server-side tesseract.js for batch OCR (limit to 1 concurrent, prefer client-side for single images)
- Entity extraction chaining with Claude API, output flows to `proposed_relationships` validation pipeline
- Effort: ~1 week

### Phase 4: Add External API Orchestration + Scheduling + Real-Time Collaboration

- Routes: `/jobs/familysearch-sync`, `/cron/*`, `/ws/collab/:treeId`
- Railway cron triggers for scheduled tasks
- Rate-limited FamilySearch sync with retries
- WebSocket hub for real-time tree edits, presence indicators
- Effort: ~3 weeks

### Graceful Degradation (Not a Full Escape Hatch)

If the worker is turned off, core functionality continues but some features degrade:

| Feature | With Worker | Without Worker |
|---------|------------|----------------|
| CRUD, tree viewing, AI chat | Works | Works (no change) |
| GEDCOM import (<2K persons) | Works (via worker) | Works (client-side batching) |
| GEDCOM import (>2K persons) | Works (via worker) | Fails on Vercel (10s timeout) |
| Single-record OCR | Works (client Web Worker) | Works (client Web Worker) |
| Batch OCR (many documents) | Works (via worker) | Not available |
| Single-record matching | Works (API route) | Works (API route) |
| Full-tree duplicate scan | Works (via worker) | Not available |
| FamilySearch scheduled sync | Works (via cron) | Not available (manual only) |
| Real-time collaboration | Works (WebSocket) | Polling fallback (15-30s delay) |

No architectural lock-in -- shared packages don't care who imports them.

## Technology Choices

### Why Hono (Not Fastify/Express)

- Ultrafast (~14KB), low memory footprint -- maximizes Railway's 512MB free RAM
- Web Standards API (Request/Response) -- same mental model as Next.js API routes
- RPC client (`hc`) for type-safe cross-service calls -- zero codegen
- Runs on Node.js, Bun, Deno, Cloudflare -- portable if hosting needs change
- Built-in WebSocket support

### Why TypeScript (Not Java/Python/Go)

- Shares all monorepo packages: `packages/db`, `packages/matching`, `packages/ai`, `packages/shared`
- Zero code duplication between Next.js and worker
- Same Drizzle schema, same types, same matching engine
- Solo developer maintains one language, one dependency tree
- Aligns with ADR-001 (JS/TS over Python sidecar)

### Why Railway (Not Fly.io/Self-Hosted)

- User preference
- Generous free tier (512MB RAM, 500 exec hrs/month)
- Dockerfile support with auto-deploy from GitHub
- Sleep-on-idle for execution hour conservation
- Built-in cron triggers (wakes sleeping services)
- Simple environment variable management

## Related Documentation

- [Architecture Overview](../../architecture/overview.md) -- this spec supersedes the single-service portions when the worker is introduced
- [AI Strategy](../../architecture/ai-strategy.md)
- [ADR-001: JS/TS Over Python](../../architecture/decisions/001-js-over-python.md) -- refined by this design (see ADR-007 when written)
- [Phase 1: Core](../../phases/phase-1-core.md)
- [Collaboration Spec](../../specs/collaboration.md)
