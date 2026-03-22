# Hono Worker Phase 2: Minimal Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Hono worker app with jobs infrastructure, GEDCOM import job, WebSocket progress reporting, shared auth, and Railway deployment — the "Phase 2: Minimal Worker" from the backend architecture spec.

**Architecture:** A Hono backend (`apps/worker`) deployed to Railway handles long-running GEDCOM imports. Next.js dispatches jobs via type-safe RPC. The client connects directly to the worker via WebSocket for real-time progress. Both services share `packages/db` (Drizzle schema) and `packages/shared` (auth, types). A new `packages/jobs` package defines the shared job contract.

**Tech Stack:** Hono, Node.js, Drizzle ORM, better-sqlite3 (local) / Turso (web), jose (JWT), nanoid, pino, vitest

**Spec:** `docs/superpowers/specs/2026-03-21-backend-architecture-design.md`

**Prerequisites:** Phase 1 must be complete. The monorepo must have `apps/web` (Next.js + NextAuth), `packages/db` (Drizzle schema + migrations including `jobs` table), `packages/shared` (with `src/auth/` stubs), and `packages/jobs` (with `types.ts` and `schema.ts` stubs). Phase 1's exit gate includes these items — see `docs/phases/phase-1-core.md`.

---

## File Structure

```
packages/
  jobs/
    package.json              # Package manifest
    tsconfig.json             # TypeScript config (extends root)
    src/
      index.ts                # Public API barrel export
      types.ts                # Job, JobType, JobStatus types
      schema.ts               # Drizzle schema for jobs table
      queries.ts              # Job CRUD query builders
  shared/
    src/
      auth/
        verify-token.ts       # JWT verification (shared by web + worker)
        ws-token.ts           # Short-lived WebSocket token create/verify

apps/
  worker/
    package.json              # Hono + deps
    tsconfig.json             # TypeScript config
    Dockerfile                # Railway deployment
    src/
      index.ts                # Hono app entry + server start
      app.ts                  # Hono app definition (routes mounted here)
      routes/
        health.ts             # GET /health
        jobs.ts               # POST /jobs/* endpoints
      ws/
        job-progress.ts       # WebSocket /ws/jobs/:jobId handler
      jobs/
        gedcom-import.ts      # GEDCOM import job handler
        runner.ts             # Job lifecycle runner (pick up, execute, update)
      middleware/
        auth.ts               # Hono middleware: verify JWT from header or WS query
      lib/
        logger.ts             # pino logger instance
        db.ts                 # Database connection (SQLite local / Turso prod)

  web/
    app/
      api/
        jobs/
          [id]/
            route.ts          # GET /api/jobs/:id - poll job status
        gedcom/
          import/
            route.ts          # POST /api/gedcom/import - dispatch to worker
        auth/
          ws-token/
            route.ts          # POST /api/auth/ws-token - issue short-lived WS token
    lib/
      worker-client.ts        # Hono RPC client (type-safe)
```

---

## Task 1: Create `packages/jobs` - Job Types and Schema

**Files:**
- Create: `packages/jobs/package.json`
- Create: `packages/jobs/tsconfig.json`
- Create: `packages/jobs/src/types.ts`
- Create: `packages/jobs/src/schema.ts`
- Create: `packages/jobs/src/queries.ts`
- Create: `packages/jobs/src/index.ts`
- Test: `packages/jobs/src/__tests__/queries.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ancstra/jobs",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ancstra/db": "workspace:*",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "better-sqlite3": "^11.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write job types**

Create `packages/jobs/src/types.ts`:

```typescript
export type JobType =
  | 'gedcom-import'
  | 'batch-match'
  | 'ocr-process'
  | 'entity-extract'
  | 'familysearch-sync'
  | 'duplicate-scan';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  progressDetail: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  checkpoint: string | null;
  createdBy: string;
  treeId: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateJobInput {
  type: JobType;
  input: Record<string, unknown>;
  createdBy: string;
  treeId: string;
}

export interface JobProgressUpdate {
  jobId: string;
  progress: number;
  progressDetail?: string;
}
```

- [ ] **Step 4: Write Drizzle schema for jobs table**

Create `packages/jobs/src/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  progress: real('progress').notNull().default(0),
  progressDetail: text('progress_detail'),
  input: text('input').notNull(),       // JSON stringified
  output: text('output'),               // JSON stringified
  error: text('error'),
  checkpoint: text('checkpoint'),
  createdBy: text('created_by').notNull(),
  treeId: text('tree_id').notNull(),
  createdAt: text('created_at').notNull().default("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});
```

- [ ] **Step 5: Write the failing tests for job queries**

Create `packages/jobs/src/__tests__/queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createJob, getJob, updateJobProgress, completeJob, failJob } from '../queries.js';
import { jobs } from '../schema.js';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0,
      progress_detail TEXT,
      input TEXT NOT NULL,
      output TEXT,
      error TEXT,
      checkpoint TEXT,
      created_by TEXT NOT NULL,
      tree_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      started_at TEXT,
      completed_at TEXT
    )
  `);
  return drizzle(sqlite, { schema: { jobs } });
}

describe('job queries', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a job with pending status', async () => {
    const job = await createJob(db, {
      type: 'gedcom-import',
      input: { fileUrl: 'test.ged' },
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.progress).toBe(0);
    expect(job.type).toBe('gedcom-import');
  });

  it('retrieves a job by id', async () => {
    const created = await createJob(db, {
      type: 'gedcom-import',
      input: { fileUrl: 'test.ged' },
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    const found = await getJob(db, created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.input).toEqual({ fileUrl: 'test.ged' });
  });

  it('returns null for non-existent job', async () => {
    const found = await getJob(db, 'nonexistent');
    expect(found).toBeNull();
  });

  it('updates job progress', async () => {
    const job = await createJob(db, {
      type: 'gedcom-import',
      input: {},
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    await updateJobProgress(db, job.id, 45, '4500/10000 persons imported');
    const updated = await getJob(db, job.id);
    expect(updated!.status).toBe('running');
    expect(updated!.progress).toBe(45);
    expect(updated!.progressDetail).toBe('4500/10000 persons imported');
    expect(updated!.startedAt).toBeDefined();
  });

  it('marks a job as completed', async () => {
    const job = await createJob(db, {
      type: 'gedcom-import',
      input: {},
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    await completeJob(db, job.id, { imported: 10000, skipped: 5 });
    const updated = await getJob(db, job.id);
    expect(updated!.status).toBe('completed');
    expect(updated!.progress).toBe(100);
    expect(updated!.output).toEqual({ imported: 10000, skipped: 5 });
    expect(updated!.completedAt).toBeDefined();
  });

  it('marks a job as failed with error and checkpoint', async () => {
    const job = await createJob(db, {
      type: 'gedcom-import',
      input: {},
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    await failJob(db, job.id, 'Parse error at line 543', 'line:543');
    const updated = await getJob(db, job.id);
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('Parse error at line 543');
    expect(updated!.checkpoint).toBe('line:543');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/jobs && pnpm install && pnpm test`
Expected: FAIL - `queries.js` does not exist yet

- [ ] **Step 7: Implement job queries**

Create `packages/jobs/src/queries.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { jobs } from './schema.js';
import type { Job, CreateJobInput } from './types.js';

function deserializeJob(row: typeof jobs.$inferSelect): Job {
  return {
    ...row,
    input: JSON.parse(row.input),
    output: row.output ? JSON.parse(row.output) : null,
  };
}

export async function createJob(db: any, input: CreateJobInput): Promise<Job> {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(jobs).values({
    id,
    type: input.type,
    status: 'pending',
    progress: 0,
    input: JSON.stringify(input.input),
    createdBy: input.createdBy,
    treeId: input.treeId,
    createdAt: now,
  });

  return (await getJob(db, id))!;
}

export async function getJob(db: any, jobId: string): Promise<Job | null> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (rows.length === 0) return null;
  return deserializeJob(rows[0]);
}

export async function updateJobProgress(
  db: any,
  jobId: string,
  progress: number,
  progressDetail?: string,
): Promise<void> {
  const now = new Date().toISOString();
  // Only set startedAt on the first progress update (when transitioning from pending)
  const current = await getJob(db, jobId);
  await db
    .update(jobs)
    .set({
      status: 'running',
      progress,
      progressDetail: progressDetail ?? null,
      ...(current && !current.startedAt ? { startedAt: now } : {}),
    })
    .where(eq(jobs.id, jobId));
}

export async function completeJob(
  db: any,
  jobId: string,
  output: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(jobs)
    .set({
      status: 'completed',
      progress: 100,
      output: JSON.stringify(output),
      completedAt: now,
    })
    .where(eq(jobs.id, jobId));
}

export async function failJob(
  db: any,
  jobId: string,
  error: string,
  checkpoint?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(jobs)
    .set({
      status: 'failed',
      error,
      checkpoint: checkpoint ?? null,
      completedAt: now,
    })
    .where(eq(jobs.id, jobId));
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/jobs && pnpm test`
Expected: All 5 tests PASS

- [ ] **Step 9: Create barrel export**

Create `packages/jobs/src/index.ts`:

```typescript
export type { Job, JobType, JobStatus, CreateJobInput, JobProgressUpdate } from './types.js';
export { jobs } from './schema.js';
export { createJob, getJob, updateJobProgress, completeJob, failJob } from './queries.js';
```

- [ ] **Step 10: Generate Drizzle migration for jobs table**

The jobs schema must be included in the project's Drizzle migration pipeline. Add the jobs schema to `packages/db`'s Drizzle config so it generates the migration:

Run: `cd packages/db && pnpm drizzle-kit generate`
Verify: A new migration SQL file is created that includes `CREATE TABLE jobs`.

- [ ] **Step 11: Commit**

```
git add packages/jobs/
git commit -m "feat(jobs): add shared job contract package with types, schema, and queries"
```

---

## Task 2: Add Shared Auth Utilities to `packages/shared`

**Files:**
- Create: `packages/shared/src/auth/verify-token.ts`
- Create: `packages/shared/src/auth/ws-token.ts`
- Test: `packages/shared/src/__tests__/auth.test.ts`

**Prerequisite:** `packages/shared` must already exist with a `package.json`. If it doesn't, create the package scaffolding first.

- [ ] **Step 1: Install jose dependency**

Run: `cd packages/shared && pnpm add jose`

- [ ] **Step 2: Write failing tests for auth utilities**

Create `packages/shared/src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { verifySessionToken } from '../auth/verify-token.js';
import { createWsToken, verifyWsToken } from '../auth/ws-token.js';

const TEST_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

async function createTestJwt(payload: Record<string, unknown>, secret: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
}

describe('verifySessionToken', () => {
  it('verifies a valid JWT and returns payload', async () => {
    const token = await createTestJwt(
      { userId: 'user-1', role: 'owner', treeId: 'tree-1' },
      TEST_SECRET,
    );
    const result = await verifySessionToken(token, TEST_SECRET);
    expect(result.userId).toBe('user-1');
    expect(result.role).toBe('owner');
    expect(result.treeId).toBe('tree-1');
  });

  it('rejects a token with wrong secret', async () => {
    const token = await createTestJwt(
      { userId: 'user-1', role: 'owner', treeId: 'tree-1' },
      TEST_SECRET,
    );
    await expect(
      verifySessionToken(token, 'wrong-secret-that-is-also-32-chars!!')
    ).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await new SignJWT({ userId: 'user-1', role: 'owner', treeId: 'tree-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-1h')
      .sign(new TextEncoder().encode(TEST_SECRET));
    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow();
  });
});

describe('WebSocket tokens', () => {
  it('creates and verifies a short-lived WS token', async () => {
    const wsToken = await createWsToken(
      { userId: 'user-1', treeId: 'tree-1' },
      TEST_SECRET,
    );
    const result = await verifyWsToken(wsToken, TEST_SECRET);
    expect(result.userId).toBe('user-1');
    expect(result.treeId).toBe('tree-1');
  });

  it('rejects a non-ws token', async () => {
    const regularToken = await createTestJwt(
      { userId: 'user-1', treeId: 'tree-1' },
      TEST_SECRET,
    );
    await expect(verifyWsToken(regularToken, TEST_SECRET)).rejects.toThrow(
      'Invalid token purpose',
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/shared && pnpm test`
Expected: FAIL - auth modules don't exist yet

- [ ] **Step 4: Implement verify-token.ts**

Create `packages/shared/src/auth/verify-token.ts`:

```typescript
import { jwtVerify } from 'jose';

export interface SessionPayload {
  userId: string;
  role: string;
  treeId: string;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
  );

  return {
    userId: payload.userId as string,
    role: payload.role as string,
    treeId: payload.treeId as string,
  };
}
```

- [ ] **Step 5: Implement ws-token.ts**

Create `packages/shared/src/auth/ws-token.ts`:

```typescript
import { SignJWT, jwtVerify } from 'jose';

export interface WsTokenPayload {
  userId: string;
  treeId: string;
}

export async function createWsToken(
  payload: WsTokenPayload,
  secret: string,
): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'ws' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30s')
    .sign(new TextEncoder().encode(secret));
}

export async function verifyWsToken(
  token: string,
  secret: string,
): Promise<WsTokenPayload> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(secret),
  );

  if (payload.purpose !== 'ws') {
    throw new Error('Invalid token purpose: expected ws token');
  }

  return {
    userId: payload.userId as string,
    treeId: payload.treeId as string,
  };
}
```

- [ ] **Step 6: Export from packages/shared barrel**

Add to `packages/shared/src/index.ts` (or create if it doesn't exist):

```typescript
export { verifySessionToken, type SessionPayload } from './auth/verify-token.js';
export { createWsToken, verifyWsToken, type WsTokenPayload } from './auth/ws-token.js';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/shared && pnpm test`
Expected: All 4 tests PASS

- [ ] **Step 8: Commit**

```
git add packages/shared/src/auth/ packages/shared/src/__tests__/auth.test.ts
git commit -m "feat(shared): add JWT verification and WebSocket token utilities"
```

---

## Task 3: Scaffold `apps/worker` - Hono App with Health Route

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/app.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/routes/health.ts`
- Create: `apps/worker/src/lib/logger.ts`
- Create: `apps/worker/src/lib/db.ts`
- Create: `apps/worker/src/middleware/auth.ts`
- Test: `apps/worker/src/__tests__/health.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ancstra/worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/app.ts"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ancstra/db": "workspace:*",
    "@ancstra/jobs": "workspace:*",
    "@ancstra/shared": "workspace:*",
    "@hono/node-server": "^1.13.0",
    "@hono/node-ws": "^1.1.0",
    "hono": "^4.7.0",
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0",
    "better-sqlite3": "^11.0.0",
    "@libsql/client": "^0.14.0",
    "drizzle-orm": "^0.39.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create logger**

Create `apps/worker/src/lib/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

- [ ] **Step 4: Create database connection (lazy-initialized)**

Create `apps/worker/src/lib/db.ts`. Uses lazy initialization so tests can import `app.ts` without triggering a real DB connection. When deploying to Railway, update to use `@libsql/client` with Turso connection string.

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { jobs } from '@ancstra/jobs';
// import * as dbSchema from '@ancstra/db'; // Uncomment when @ancstra/db exists

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./local.db';
    const sqlite = new Database(DATABASE_URL.replace('file:', ''));
    _db = drizzle(sqlite, { schema: { /* ...dbSchema, */ jobs } });
  }
  return _db;
}

// For tests: allow injecting a custom DB instance
export function setDb(db: ReturnType<typeof drizzle>) {
  _db = db;
}
```

- [ ] **Step 5: Create auth middleware**

Create `apps/worker/src/middleware/auth.ts`:

```typescript
import { createMiddleware } from 'hono/factory';
import { verifySessionToken, type SessionPayload } from '@ancstra/shared';
import { logger } from '../lib/logger.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionPayload;
  }
}

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? '';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const user = await verifySessionToken(token, NEXTAUTH_SECRET);
    c.set('user', user);
    await next();
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});
```

- [ ] **Step 6: Create health route**

Create `apps/worker/src/routes/health.ts`:

```typescript
import { Hono } from 'hono';

const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { health };
```

- [ ] **Step 7: Create Hono app (routes mounted here)**

Create `apps/worker/src/app.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { health } from './routes/health.js';
import { logger } from './lib/logger.js';

const app = new Hono();

// CORS: allow Next.js origins
app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:3000',
      process.env.WEB_ORIGIN ?? 'https://ancstra.vercel.app',
    ],
    credentials: true,
  }),
);

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms });
});

// Routes
app.route('/', health);

// Export the app type for Hono RPC client in Next.js
export type AppType = typeof app;
export { app };
```

- [ ] **Step 8: Create server entry point**

Create `apps/worker/src/index.ts`:

```typescript
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { logger } from './lib/logger.js';

const port = Number(process.env.PORT ?? 3001);

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'Worker listening');
});

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      logger.error(err, 'Error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
});
```

- [ ] **Step 9: Write test for health endpoint**

Create `apps/worker/src/__tests__/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../app.js';

describe('GET /health', () => {
  it('returns status ok with timestamp and uptime', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });
});
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd apps/worker && pnpm install && pnpm test`
Expected: PASS

- [ ] **Step 11: Verify the server starts**

Run: `cd apps/worker && pnpm dev`
Expected: Log output shows "Worker listening" on port 3001
Test: `curl http://localhost:3001/health` returns `{"status":"ok",...}`
Stop the server with Ctrl+C.

- [ ] **Step 12: Commit**

```
git add apps/worker/
git commit -m "feat(worker): scaffold Hono worker app with health endpoint, auth middleware, and logging"
```

---

## Task 4: Add Job Routes + GEDCOM Import Job

**Files:**
- Create: `apps/worker/src/routes/jobs.ts`
- Create: `apps/worker/src/jobs/gedcom-import.ts`
- Create: `apps/worker/src/jobs/runner.ts`
- Modify: `apps/worker/src/app.ts` - mount job routes
- Test: `apps/worker/src/__tests__/jobs-route.test.ts`
- Test: `apps/worker/src/__tests__/gedcom-import.test.ts`

- [ ] **Step 1: Create the job runner (lifecycle manager)**

Create `apps/worker/src/jobs/runner.ts`:

```typescript
import { updateJobProgress, completeJob, failJob } from '@ancstra/jobs';
import { logger } from '../lib/logger.js';

export interface JobContext {
  db: any;
  jobId: string;
  input: Record<string, unknown>;
  onProgress: (progress: number, detail?: string) => Promise<void>;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown>>;

export async function runJob(
  db: any,
  jobId: string,
  input: Record<string, unknown>,
  handler: JobHandler,
  progressCallback?: (progress: number, detail?: string) => void,
): Promise<void> {
  const onProgress = async (progress: number, detail?: string) => {
    await updateJobProgress(db, jobId, progress, detail);
    progressCallback?.(progress, detail);
  };

  try {
    await onProgress(0, 'Starting...');
    const output = await handler({ db, jobId, input, onProgress });
    await completeJob(db, jobId, output);
    logger.info({ jobId }, 'Job completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, err }, 'Job failed');
    await failJob(db, jobId, message);
  }
}
```

- [ ] **Step 2: Create GEDCOM import job handler (stub)**

Create `apps/worker/src/jobs/gedcom-import.ts`. This is a minimal handler demonstrating the job lifecycle. The actual GEDCOM parsing uses `@ancstra/gedcom` (from Phase 1). For now it simulates processing.

```typescript
import type { JobContext } from './runner.js';
import { logger } from '../lib/logger.js';

export async function handleGedcomImport(ctx: JobContext): Promise<Record<string, unknown>> {
  const { input, onProgress } = ctx;
  const fileContent = input.fileContent as string | undefined;
  const fileUrl = input.fileUrl as string | undefined;

  if (!fileContent && !fileUrl) {
    throw new Error('Either fileContent or fileUrl must be provided');
  }

  let content: string;
  if (fileContent) {
    content = fileContent;
  } else {
    const res = await fetch(fileUrl!);
    if (!res.ok) throw new Error('Failed to fetch GEDCOM file: ' + res.status);
    content = await res.text();
  }

  const lines = content.split('\n');
  const totalRecords = lines.filter((l) => l.trim().startsWith('0 @')).length;
  logger.info({ totalRecords }, 'GEDCOM file parsed, starting import');

  // TODO: Replace with actual @ancstra/gedcom parser + DB inserts
  let processed = 0;
  const batchSize = 100;

  for (let i = 0; i < totalRecords; i += batchSize) {
    const batch = Math.min(batchSize, totalRecords - i);
    processed += batch;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const progress = Math.round((processed / totalRecords) * 100);
    await onProgress(progress, processed + '/' + totalRecords + ' records processed');
  }

  return {
    imported: totalRecords,
    skipped: 0,
    errors: 0,
  };
}
```

- [ ] **Step 3: Write test for GEDCOM import handler**

Create `apps/worker/src/__tests__/gedcom-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { handleGedcomImport } from '../jobs/gedcom-import.js';
import type { JobContext } from '../jobs/runner.js';

describe('handleGedcomImport', () => {
  it('processes a simple GEDCOM file and returns counts', async () => {
    const progressCalls: Array<{ progress: number; detail?: string }> = [];

    const ctx: JobContext = {
      db: {},
      jobId: 'test-job',
      input: {
        fileContent: [
          '0 HEAD',
          '1 SOUR TEST',
          '0 @I1@ INDI',
          '1 NAME John /Doe/',
          '0 @I2@ INDI',
          '1 NAME Jane /Doe/',
          '0 TRLR',
        ].join('\n'),
      },
      onProgress: async (progress, detail) => {
        progressCalls.push({ progress, detail });
      },
    };

    const result = await handleGedcomImport(ctx);

    // 2 level-0 @ records: @I1@ and @I2@
    expect(result.imported).toBe(2);
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1].progress).toBe(100);
  });

  it('throws if no file content or URL provided', async () => {
    const ctx: JobContext = {
      db: {},
      jobId: 'test-job',
      input: {},
      onProgress: async () => {},
    };

    await expect(handleGedcomImport(ctx)).rejects.toThrow(
      'Either fileContent or fileUrl must be provided',
    );
  });
});
```

- [ ] **Step 4: Run tests to verify they fail then pass**

Run: `cd apps/worker && pnpm test`
Expected: PASS after step 2 implementation

- [ ] **Step 5: Create job routes**

Create `apps/worker/src/routes/jobs.ts`:

```typescript
import { Hono } from 'hono';
import { createJob } from '@ancstra/jobs';
import { authMiddleware } from '../middleware/auth.js';
import { runJob } from '../jobs/runner.js';
import { handleGedcomImport } from '../jobs/gedcom-import.js';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const jobRoutes = new Hono();

jobRoutes.use('/*', authMiddleware);

jobRoutes.post('/jobs/gedcom-import', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const db = getDb();

  const job = await createJob(db, {
    type: 'gedcom-import',
    input: body,
    createdBy: user.userId,
    treeId: user.treeId,
  });

  logger.info({ jobId: job.id, type: 'gedcom-import' }, 'Job created');

  // Run job in background (don't await - return immediately)
  runJob(db, job.id, job.input, handleGedcomImport, (progress, detail) => {
    jobProgressBroadcast(job.id, progress, detail);
  }).catch((err) => {
    logger.error({ jobId: job.id, err }, 'Unhandled job error');
  });

  return c.json({ jobId: job.id }, 201);
});

export { jobRoutes };
```

- [ ] **Step 6: Write test for auth rejection on job routes**

Create `apps/worker/src/__tests__/jobs-route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../app.js';

describe('POST /jobs/gedcom-import', () => {
  it('returns 401 without auth header', async () => {
    const res = await app.request('/jobs/gedcom-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileContent: '0 HEAD' }),
    });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Mount job routes in app.ts**

Add to `apps/worker/src/app.ts` after the health route import:

```typescript
import { jobRoutes } from './routes/jobs.js';
```

And after `app.route('/', health);`:

```typescript
app.route('/', jobRoutes);
```

- [ ] **Step 8: Run tests**

Run: `cd apps/worker && pnpm test`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```
git add apps/worker/src/routes/jobs.ts apps/worker/src/jobs/ apps/worker/src/__tests__/
git commit -m "feat(worker): add job routes, runner, and GEDCOM import handler"
```

---

## Task 5: Add WebSocket Job Progress

**Files:**
- Create: `apps/worker/src/ws/job-progress.ts`
- Modify: `apps/worker/src/app.ts` - mount WS route + export injectWebSocket
- Modify: `apps/worker/src/index.ts` - inject WS into server
- Test: `apps/worker/src/__tests__/ws-progress.test.ts`

- [ ] **Step 1: Create WebSocket progress handler**

Create `apps/worker/src/ws/job-progress.ts`:

```typescript
import type { WSContext } from 'hono/ws';
import { verifyWsToken } from '@ancstra/shared';
import { getJob } from '@ancstra/jobs';
import { logger } from '../lib/logger.js';
import { getDb } from '../lib/db.js';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? '';

const jobSubscribers = new Map<string, Set<WSContext>>();

export function jobProgressBroadcast(
  jobId: string,
  progress: number,
  detail?: string,
): void {
  const subscribers = jobSubscribers.get(jobId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify({ type: 'progress', jobId, progress, detail });

  for (const ws of subscribers) {
    try {
      ws.send(message);
    } catch {
      subscribers.delete(ws);
    }
  }
}

// Called from the upgradeWebSocket handler — verifies token before upgrade
export async function verifyWsUpgrade(c: any): Promise<{ userId: string; treeId: string } | null> {
  const token = new URL(c.req.url).searchParams.get('token');
  if (!token) return null;

  try {
    return await verifyWsToken(token, NEXTAUTH_SECRET);
  } catch {
    return null;
  }
}

export function createJobProgressWs(jobId: string) {
  return {
    async onOpen(_evt: Event, ws: WSContext) {
      const db = getDb();
      const job = await getJob(db, jobId);
      if (!job) {
        ws.send(JSON.stringify({ type: 'error', message: 'Job not found' }));
        ws.close(4004, 'Not found');
        return;
      }

      if (!jobSubscribers.has(jobId)) {
        jobSubscribers.set(jobId, new Set());
      }
      jobSubscribers.get(jobId)!.add(ws);

      // Send current status immediately
      ws.send(JSON.stringify({
        type: 'status',
        jobId,
        status: job.status,
        progress: job.progress,
        progressDetail: job.progressDetail,
      }));

      logger.info({ jobId }, 'WS client subscribed to job');
    },

    onClose(_evt: CloseEvent, ws: WSContext) {
      for (const [jid, subscribers] of jobSubscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          jobSubscribers.delete(jid);
        }
      }
    },
  };
}
```

- [ ] **Step 2: Update app.ts to mount WebSocket route**

Update `apps/worker/src/app.ts` to add WebSocket support. Add these imports:

```typescript
import { createNodeWebSocket } from '@hono/node-ws';
import { createJobProgressWs, verifyWsUpgrade } from './ws/job-progress.js';
```

After app creation, add:

```typescript
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Auth happens on upgrade — unauthenticated requests get 401, not a WebSocket
app.get('/ws/jobs/:jobId', async (c, next) => {
  const user = await verifyWsUpgrade(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const jobId = c.req.param('jobId');
  return upgradeWebSocket(() => createJobProgressWs(jobId))(c, next);
});

export { injectWebSocket };
```

- [ ] **Step 3: Update index.ts to inject WebSocket**

Update `apps/worker/src/index.ts` to import and use `injectWebSocket`:

```typescript
import { app, injectWebSocket } from './app.js';
```

After the `serve` call:

```typescript
injectWebSocket(server);
```

- [ ] **Step 4: Wire up progress broadcast in job routes**

Update `apps/worker/src/routes/jobs.ts` to import and use `jobProgressBroadcast`:

```typescript
import { jobProgressBroadcast } from '../ws/job-progress.js';
```

Change the `runJob` call to include the progress callback:

```typescript
  runJob(db, job.id, job.input, handleGedcomImport, (progress, detail) => {
    jobProgressBroadcast(job.id, progress, detail);
  }).catch((err) => {
    logger.error({ jobId: job.id, err }, 'Unhandled job error');
  });
```

- [ ] **Step 5: Write WebSocket smoke test**

Create `apps/worker/src/__tests__/ws-progress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createJobProgressWs, jobProgressBroadcast } from '../ws/job-progress.js';

describe('jobProgressBroadcast', () => {
  it('does not throw when no subscribers exist', () => {
    expect(() => jobProgressBroadcast('nonexistent', 50, 'test')).not.toThrow();
  });
});

describe('createJobProgressWs', () => {
  it('returns handler object with required methods', () => {
    const ws = createJobProgressWs();
    expect(typeof ws.onOpen).toBe('function');
    expect(typeof ws.onMessage).toBe('function');
    expect(typeof ws.onClose).toBe('function');
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd apps/worker && pnpm test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```
git add apps/worker/src/ws/ apps/worker/src/app.ts apps/worker/src/index.ts apps/worker/src/routes/jobs.ts apps/worker/src/__tests__/ws-progress.test.ts
git commit -m "feat(worker): add WebSocket job progress broadcasting"
```

---

## Task 6: Add Next.js Integration (Job Dispatch + Status Polling + WS Token)

**Files:**
- Create: `apps/web/lib/worker-client.ts`
- Create: `apps/web/app/api/jobs/[id]/route.ts`
- Create: `apps/web/app/api/gedcom/import/route.ts`
- Create: `apps/web/app/api/auth/ws-token/route.ts`

**Prerequisite:** `apps/web` must already exist with NextAuth.js configured.

- [ ] **Step 1: Install hono client dependency in web app**

Run: `cd apps/web && pnpm add hono`

- [ ] **Step 2: Create type-safe worker client**

Create `apps/web/lib/worker-client.ts`:

```typescript
import { hc } from 'hono/client';
import type { AppType } from '@ancstra/worker';

const WORKER_URL = process.env.WORKER_URL ?? 'http://localhost:3001';

export const workerClient = hc<AppType>(WORKER_URL);

export function getWorkerWsUrl(jobId: string): string {
  const wsBase = WORKER_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  return wsBase + '/ws/jobs/' + jobId;
}
```

- [ ] **Step 3: Create WS token endpoint**

Create `apps/web/app/api/auth/ws-token/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createWsToken } from '@ancstra/shared';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? '';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await createWsToken(
    {
      userId: (session.user as any).userId,
      treeId: (session.user as any).treeId,
    },
    NEXTAUTH_SECRET,
  );

  return NextResponse.json({ token });
}
```

- [ ] **Step 4: Create GEDCOM import dispatch endpoint**

Create `apps/web/app/api/gedcom/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const WORKER_URL = process.env.WORKER_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const res = await fetch(WORKER_URL + '/jobs/gedcom-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (session as any).accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      return NextResponse.json(
        { error: 'Worker unavailable', detail: error },
        { status: 502 },
      );
    }

    const result = await res.json();
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Background service unavailable' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 5: Create job status polling endpoint**

Create `apps/web/app/api/jobs/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJob } from '@ancstra/jobs';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const job = await getJob(db, id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Authorization: only allow access to jobs in the user's tree
  const userId = (session.user as any).userId;
  if (job.createdBy !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(job);
}
```

- [ ] **Step 6: Add WORKER_URL to .env.local**

Add to `apps/web/.env.local`:

```
WORKER_URL=http://localhost:3001
```

- [ ] **Step 7: Commit**

```
git add apps/web/lib/worker-client.ts apps/web/app/api/jobs/ apps/web/app/api/gedcom/import/ apps/web/app/api/auth/ws-token/
git commit -m "feat(web): add worker client, job dispatch, status polling, and WS token endpoints"
```

---

## Task 7: Dockerfile + Turborepo Dev Config

**Files:**
- Create: `apps/worker/Dockerfile`
- Modify: `turbo.json` - add worker dev task if needed
- Verify: `pnpm-workspace.yaml` includes `apps/*`

- [ ] **Step 1: Create Dockerfile**

Create `apps/worker/Dockerfile`:

```dockerfile
FROM node:22-slim AS base
RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

COPY packages/db ./packages/db
COPY packages/jobs ./packages/jobs
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@ancstra/worker...

FROM node:22-slim AS runner
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/db/dist ./packages/db/dist
COPY --from=base /app/packages/db/package.json ./packages/db/package.json
COPY --from=base /app/packages/jobs/dist ./packages/jobs/dist
COPY --from=base /app/packages/jobs/package.json ./packages/jobs/package.json
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=base /app/apps/worker/dist ./apps/worker/dist
COPY --from=base /app/apps/worker/package.json ./apps/worker/package.json

EXPOSE 3001

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
```

- [ ] **Step 2: Verify pnpm-workspace.yaml includes apps/***

Read `pnpm-workspace.yaml` and confirm `apps/*` is listed under packages. If not, add it.

- [ ] **Step 3: Verify turbo.json has dev task**

Ensure `turbo.json` has a `dev` task with `persistent: true` so both `apps/web` and `apps/worker` run in parallel with `pnpm dev`.

- [ ] **Step 4: Test Docker build locally**

Run: `docker build -f apps/worker/Dockerfile -t ancstra-worker .`
Expected: Build succeeds

Run: `docker run -p 3001:3001 -e PORT=3001 -e NEXTAUTH_SECRET=test ancstra-worker`
Expected: Log shows "Worker listening" on port 3001
Test: `curl http://localhost:3001/health` returns OK

- [ ] **Step 5: Test pnpm dev starts both services**

Run: `pnpm dev`
Expected: Both `apps/web` (port 3000) and `apps/worker` (port 3001) start

- [ ] **Step 6: Commit**

```
git add apps/worker/Dockerfile turbo.json
git commit -m "feat(worker): add Dockerfile for Railway deployment and Turborepo dev config"
```

---

## Task 8: Write ADR-007

**Files:**
- Create: `docs/architecture/decisions/007-hono-worker-sidecar.md`

- [ ] **Step 1: Write ADR-007**

Create `docs/architecture/decisions/007-hono-worker-sidecar.md`:

```markdown
# ADR-007: Hono Worker Sidecar (Refinement of ADR-001)

> Date: 2026-03-21 | Status: Accepted

## Context

ADR-001 established "single Node.js process" as a principle, rejecting a Python sidecar.
However, several workloads strain Next.js API routes on Vercel's free tier:

- GEDCOM imports (10K+ persons) exceed the 10s serverless timeout
- Batch record matching is CPU-bound
- WebSocket connections are not supported on Vercel
- Scheduled background jobs are limited to 1 cron/day on hobby tier

## Decision

Add a Hono-based TypeScript worker (apps/worker) deployed to Railway alongside the
Next.js app on Vercel.

This refines ADR-001 rather than reversing it:
- Both services remain TypeScript (single language)
- Both share monorepo packages (zero code duplication)
- The worker is progressively adopted (Phase 2+, not Phase 1)
- Core functionality works without the worker (graceful degradation)

## Reasons

1. Same language, shared code - the benefit ADR-001 sought is preserved
2. Hono's 14KB footprint fits Railway's 512MB free RAM
3. Type-safe cross-service calls via Hono RPC client
4. WebSocket support for job progress and future real-time collaboration
5. No timeout constraints for long-running jobs

## Consequences

1. Two deployment targets (Vercel + Railway) instead of one
2. Cross-service debugging is slightly more complex
3. Railway free tier has 500 execution hour/month limit (sufficient for personal/family use)
4. CORS configuration required between services

## Related

- ADR-001: JS/TS Over Python (001-js-over-python.md)
- Backend Architecture Spec (docs/superpowers/specs/2026-03-21-backend-architecture-design.md)
```

- [ ] **Step 2: Commit**

```
git add docs/architecture/decisions/007-hono-worker-sidecar.md
git commit -m "docs: add ADR-007 documenting Hono worker sidecar decision"
```

---

## Task 9: End-to-End Integration Test

**Files:**
- Create: `apps/worker/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `apps/worker/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createJob, getJob, jobs } from '@ancstra/jobs';
import { runJob } from '../jobs/runner.js';
import { handleGedcomImport } from '../jobs/gedcom-import.js';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0,
      progress_detail TEXT,
      input TEXT NOT NULL,
      output TEXT,
      error TEXT,
      checkpoint TEXT,
      created_by TEXT NOT NULL,
      tree_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      started_at TEXT,
      completed_at TEXT
    )
  `);
  return drizzle(sqlite, { schema: { jobs } });
}

describe('Job lifecycle integration', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('runs a GEDCOM import job from pending to completed', async () => {
    const gedcomContent = [
      '0 HEAD',
      '1 SOUR TEST',
      '0 @I1@ INDI',
      '1 NAME John /Smith/',
      '0 @I2@ INDI',
      '1 NAME Jane /Smith/',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '0 TRLR',
    ].join('\n');

    const job = await createJob(db, {
      type: 'gedcom-import',
      input: { fileContent: gedcomContent },
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    expect(job.status).toBe('pending');

    const progressUpdates: number[] = [];

    await runJob(db, job.id, job.input, handleGedcomImport, (progress) => {
      progressUpdates.push(progress);
    });

    const completed = await getJob(db, job.id);
    expect(completed!.status).toBe('completed');
    expect(completed!.progress).toBe(100);
    expect(completed!.output).toBeDefined();
    expect((completed!.output as any).imported).toBeGreaterThan(0);
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('handles job failure gracefully', async () => {
    const job = await createJob(db, {
      type: 'gedcom-import',
      input: {},
      createdBy: 'user-1',
      treeId: 'tree-1',
    });

    await runJob(db, job.id, job.input, handleGedcomImport);

    const failed = await getJob(db, job.id);
    expect(failed!.status).toBe('failed');
    expect(failed!.error).toContain('fileContent or fileUrl');
  });
});
```

- [ ] **Step 2: Run all tests across the monorepo**

Run: `pnpm test`
Expected: All tests pass across `packages/jobs`, `packages/shared`, and `apps/worker`

- [ ] **Step 3: Commit**

```
git add apps/worker/src/__tests__/integration.test.ts
git commit -m "test(worker): add end-to-end job lifecycle integration test"
```

---

## Summary

| Task | What | Effort |
|------|------|--------|
| 1 | `packages/jobs` - types, schema, queries, tests | ~30 min |
| 2 | `packages/shared` - auth utilities + tests | ~20 min |
| 3 | `apps/worker` - Hono scaffold + health + middleware | ~30 min |
| 4 | Job routes + GEDCOM import handler + tests | ~40 min |
| 5 | WebSocket job progress + tests | ~30 min |
| 6 | Next.js integration (dispatch, polling, WS token) | ~20 min |
| 7 | Dockerfile + Turborepo config | ~20 min |
| 8 | ADR-007 documentation | ~10 min |
| 9 | End-to-end integration test | ~15 min |
| **Total** | | **~3.5 hours** |

After completing this plan, the worker is ready for Railway deployment. The GEDCOM import handler is a stub that demonstrates the full lifecycle -- it will be connected to the actual `@ancstra/gedcom` parser package when that's built in Phase 1.
