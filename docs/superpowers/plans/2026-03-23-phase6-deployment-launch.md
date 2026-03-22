# Phase 6: Deployment & Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Ancstra to production (Vercel + Turso + Railway), add Playwright E2E tests, Sentry monitoring, Nextra docs site, and polish (welcome flow, error messages, accessibility).

**Architecture:** Infrastructure-first — deploy the app, add monitoring, write tests against production, then docs and polish. Key infra: Vercel (Next.js), Turso (multi-tenant SQLite), Railway (Hono worker + Gotenberg). Turso driver swap in `packages/db/src/index.ts` is the critical path.

**Tech Stack:** Vercel, Turso Platform API, Railway, @sentry/nextjs, @playwright/test, Nextra, Hono

**Spec:** `docs/superpowers/specs/2026-03-23-phase6-deployment-launch-design.md`

**Important:** Next.js 16 — read `node_modules/next/dist/docs/` before writing Next.js code. Never use `.js` extensions in TS imports.

**Prerequisite:** Phases 1-5 must be merged to master. Verify `packages/db/src/family-schema.ts`, `packages/db/src/central-schema.ts`, `apps/web/lib/auth/api-guard.ts` exist.

---

## File Map

### New files

```
# Sentry
apps/web/sentry.client.config.ts
apps/web/sentry.server.config.ts
apps/web/sentry.edge.config.ts
apps/web/app/global-error.tsx
apps/web/lib/error-messages.ts

# Playwright E2E
tests/package.json
tests/playwright.config.ts
tests/e2e/auth.spec.ts
tests/e2e/gedcom-import.spec.ts
tests/e2e/person-crud.spec.ts
tests/e2e/tree-view.spec.ts
tests/e2e/export.spec.ts
tests/e2e/collaboration.spec.ts
tests/e2e/ai-chat.spec.ts
tests/e2e/quality-dashboard.spec.ts
tests/fixtures/sample.ged

# Nextra docs
apps/docs/package.json
apps/docs/next.config.mjs
apps/docs/theme.config.tsx
apps/docs/pages/index.mdx
apps/docs/pages/getting-started.mdx
apps/docs/pages/tree-view.mdx
apps/docs/pages/persons.mdx
apps/docs/pages/research.mdx
apps/docs/pages/collaboration.mdx
apps/docs/pages/export.mdx
apps/docs/pages/privacy.mdx
apps/docs/pages/terms.mdx

# Polish
apps/web/components/onboarding/welcome-card.tsx
```

### Modified files

```
packages/db/src/index.ts            — Turso driver detection (libsql:// vs better-sqlite3)
packages/db/src/turso.ts            — createTursoDatabase() Platform API
packages/auth/src/families.ts       — web mode: create Turso DB on family creation
apps/web/next.config.ts             — wrap with withSentryConfig
apps/web/package.json               — add @sentry/nextjs
apps/web/lib/auth/api-guard.ts      — Sentry.captureException for unexpected errors
apps/web/components/app-sidebar.tsx  — Help link to docs
apps/web/app/(auth)/dashboard/page.tsx — welcome card
apps/worker/Dockerfile              — copy all workspace package dependencies
apps/worker/src/index.ts            — add WEB_URL for CORS in production
.github/workflows/ci.yml            — add E2E job
turbo.json                          — add test:e2e pipeline
pnpm-workspace.yaml                 — add "tests" to packages list
```

---

## Task 1: Turso driver swap in packages/db

**Files:**
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/turso.ts`
- Create: `packages/db/__tests__/driver-swap.test.ts`

This is the most critical task — without it, nothing connects to Turso in production.

**Critical design decision: sync vs async driver divergence.**

`drizzle-orm/better-sqlite3` returns `BetterSQLite3Database` (sync methods: `.get()`, `.all()`, `.run()`). `drizzle-orm/libsql` returns `LibSQLDatabase` (async methods: `.get()`, `.all()`, `.run()` return Promises).

**Strategy: Use `@libsql/client` everywhere.** The `@libsql/client` package supports both local SQLite files AND remote Turso URLs. By always using the libsql driver, we get a unified async API regardless of deployment mode. Local files use `file:` URLs instead of `libsql://`.

This means:
- Local mode: `createClient({ url: 'file:~/.ancstra/ancstra.sqlite' })`
- Web mode: `createClient({ url: 'libsql://...', authToken: '...' })`
- Same Drizzle driver (`drizzle-orm/libsql`) in both cases
- All DB access becomes async — but most call sites already use `await` or are in async functions

**Migration impact on existing code:** The existing code uses `better-sqlite3` sync driver. Switching to libsql means all `.get()`, `.all()`, `.run()` calls become async. However:
- API route handlers are already async
- `packages/auth/` functions already use async patterns in many places
- The `packages/db/src/quality-queries.ts` uses raw SQL via `db.all()` which would need `await`
- `packages/auth/src/families.ts` `createFamily()` must become async
- All call sites of `createFamily()` must be updated to `await`

This is a significant refactor but necessary for production deployment. The alternative (maintaining two code paths) would be far more complex and error-prone.

- [ ] **Step 1: Write failing test**

Test that `isWebMode()` returns true when URL starts with `libsql://`, false for `file:` URLs and bare paths. Test that `createCentralDb()` returns a Drizzle instance in both modes.

- [ ] **Step 2: Implement unified libsql driver in index.ts**

```typescript
import 'dotenv/config';
import path from 'path';
import os from 'os';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './family-schema';
import * as centralSchema from './central-schema';

export function isWebMode(url?: string): boolean {
  return (url || '').startsWith('libsql://');
}

function resolveUrl(url: string): { url: string; authToken?: string } {
  if (url.startsWith('libsql://')) {
    return { url, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  // Local file — @libsql/client supports file: URLs
  if (url.startsWith('file:')) return { url };
  // Bare path — convert to file: URL
  const absPath = path.isAbsolute(url) ? url : path.resolve(url);
  return { url: `file:${absPath}` };
}

export function createCentralDb(url?: string) {
  const dbUrl = url || process.env.CENTRAL_DATABASE_URL || path.join(os.homedir(), '.ancstra', 'ancstra.sqlite');
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema: centralSchema });
}

export function createFamilyDb(dbFilename: string) {
  let dbUrl: string;
  if (dbFilename.startsWith('libsql://') || dbFilename.startsWith('file:')) {
    dbUrl = dbFilename;
  } else {
    dbUrl = path.join(os.homedir(), '.ancstra', 'families', dbFilename);
  }
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}

// Keep for backward compat during migration
export function createDb(url?: string) {
  const dbUrl = url || process.env.DATABASE_URL || './ancstra.db';
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}
```

- [ ] **Step 3: Update all sync DB calls to async**

Since `@libsql/client` is async, all `.get()`, `.all()`, `.run()` calls now return Promises. Audit and add `await` to:
- `packages/auth/src/families.ts` — `createFamily()` becomes async
- `packages/auth/src/invitations.ts` — all functions that use `.get()`, `.run()`
- `packages/auth/src/activity.ts` — same
- `packages/auth/src/moderation.ts` — same
- `packages/auth/src/oauth-linking.ts` — same
- `packages/db/src/quality-queries.ts` — all raw SQL calls
- `apps/web/lib/auth/context.ts` — `.get()` calls
- All API route handlers that call DB functions

Many of these already have `await` since the functions were written assuming async behavior. The key changes are functions that were sync but called `.get()` or `.run()` synchronously.

- [ ] **Step 4: Guard initFts5() for local mode only**

The existing `initFts5()` uses `BetterSqlite3` directly (sync, raw SQL). Add a guard:
```typescript
export function initFts5(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  if (isWebMode(dbPath)) {
    console.warn('FTS5 init skipped in web mode — not supported with libsql');
    return;
  }
  // ... existing BetterSqlite3 code
}
```

- [ ] **Step 5: Run all tests**

Run: `cd packages/db && npx vitest run && cd ../auth && npx vitest run`
Expected: All tests pass (tests use in-memory SQLite via better-sqlite3 directly, not through createDb — they should still work)

- [ ] **Step 6: Commit**

- [ ] **Step 3: Run tests**

Run: `cd packages/db && npx vitest run`
Expected: All existing + new tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/db/
git commit -m "feat(db): Turso driver detection — libsql:// URLs use @libsql/client"
```

---

## Task 2: Turso Platform API for family DB provisioning

**Files:**
- Modify: `packages/db/src/turso.ts`
- Modify: `packages/auth/src/families.ts`

- [ ] **Step 1: Add createTursoDatabase() to turso.ts**

```typescript
export async function createTursoDatabase(name: string): Promise<{ url: string }> {
  const org = process.env.TURSO_ORG;
  const token = process.env.TURSO_PLATFORM_TOKEN;
  if (!org || !token) throw new Error('TURSO_ORG and TURSO_PLATFORM_TOKEN required for web mode');

  const res = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, group: 'default' }),
  });

  if (!res.ok) throw new Error(`Turso API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const hostname = data.database?.hostname || `${name}-${org}.turso.io`;
  return { url: `libsql://${hostname}` };
}

// Note: All family DBs share the single TURSO_AUTH_TOKEN (org-level token).
// Per-DB tokens are not needed for a single-user/small-family app.
// If security isolation is needed later, create per-DB tokens via
// POST /v1/organizations/{org}/databases/{name}/auth/tokens
```

- [ ] **Step 2: Update createFamily() for web mode**

In `packages/auth/src/families.ts`, add web mode path:

```typescript
import { createTursoDatabase, runFamilySchemaDDL } from '@ancstra/db/turso';
import { isWebMode } from '@ancstra/db';

// Inside createFamily():
let dbFilename: string;
if (isWebMode(process.env.CENTRAL_DATABASE_URL)) {
  // Web mode: create Turso DB via Platform API
  const { url } = await createTursoDatabase(`ancstra-family-${familyId}`);
  dbFilename = url; // Store the libsql:// URL
  // Run schema DDL against the new Turso DB to create all tables
  await runFamilySchemaDDL(dbFilename);
} else {
  // Local mode: create .sqlite file (existing behavior)
  dbFilename = `family-${familyId}.sqlite`;
}
```

**New function `runFamilySchemaDDL()`** in `packages/db/src/turso.ts`:
```typescript
export async function runFamilySchemaDDL(dbUrl: string): Promise<void> {
  const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN! });
  // Execute CREATE TABLE statements for all family schema tables
  // Extract from family-schema.ts or maintain a ddl.sql file
  // Use client.executeMultiple() for batch DDL
  await client.executeMultiple(FAMILY_SCHEMA_DDL);
}
```

The `FAMILY_SCHEMA_DDL` string contains all CREATE TABLE + CREATE INDEX statements from the family schema. Maintain this as a constant in turso.ts, derived from the Drizzle schema. Test by creating a DB and verifying all tables exist.
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/turso.ts packages/auth/src/families.ts
git commit -m "feat(db): Turso Platform API for family DB provisioning in web mode"
```

---

## Task 3: Sentry integration

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Create: `apps/web/app/global-error.tsx`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/auth/api-guard.ts`

- [ ] **Step 1: Install @sentry/nextjs**

```bash
cd apps/web && pnpm add @sentry/nextjs
```

- [ ] **Step 2: Create Sentry config files**

All three configs follow the same pattern:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
});
```

- [ ] **Step 3: Wrap next.config.ts with withSentryConfig**

```typescript
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

Check Next.js 16 compatibility — read `node_modules/next/dist/docs/` for any Sentry-related guidance. If `withSentryConfig` is incompatible with Next.js 16, use Sentry's manual setup instead.

- [ ] **Step 4: Create global-error.tsx**

```typescript
'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <html><body>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p>We've been notified and are looking into it.</p>
        <button onClick={reset}>Try again</button>
      </div>
    </body></html>
  );
}
```

- [ ] **Step 5: Add Sentry.captureException to api-guard.ts**

Read `apps/web/lib/auth/api-guard.ts`. In `handleAuthError()`, add:
```typescript
import * as Sentry from '@sentry/nextjs';

// For unexpected errors (not auth-related):
Sentry.captureException(error);
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/sentry.*.config.ts apps/web/app/global-error.tsx apps/web/next.config.ts apps/web/package.json apps/web/lib/auth/api-guard.ts pnpm-lock.yaml
git commit -m "feat(web): Sentry error + performance monitoring"
```

---

## Task 4: Playwright setup + first test

**Files:**
- Create: `tests/package.json`
- Create: `tests/playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/fixtures/sample.ged`
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`

- [ ] **Step 1: Add tests/ to pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tests"
```

- [ ] **Step 2: Create tests/package.json**

```json
{
  "name": "@ancstra/tests",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.1"
  }
}
```

- [ ] **Step 3: Create tests/playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'pnpm --filter @ancstra/web dev -- --port 3001',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [ ] **Step 4: Create sample GEDCOM fixture**

Create `tests/fixtures/sample.ged` — a minimal valid GEDCOM 5.5.1 file with 3 persons (2 parents + 1 child), 1 family, and birth/death events.

- [ ] **Step 5: Write auth.spec.ts**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('OAuth buttons are visible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('unauthenticated user redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with credentials works', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('dev@ancstra.app');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/create-family/);
  });
});
```

- [ ] **Step 6: Add test:e2e to turbo.json**

```json
"test:e2e": { "dependsOn": ["build"], "cache": false }
```

- [ ] **Step 7: Install Playwright browsers and run**

```bash
cd tests && pnpm install && npx playwright install chromium
npx playwright test e2e/auth.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add tests/ pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "feat(tests): Playwright E2E setup with auth tests"
```

---

## Task 5: Remaining Playwright E2E tests

**Files:**
- Create: `tests/e2e/gedcom-import.spec.ts`
- Create: `tests/e2e/person-crud.spec.ts`
- Create: `tests/e2e/tree-view.spec.ts`
- Create: `tests/e2e/export.spec.ts`
- Create: `tests/e2e/collaboration.spec.ts`
- Create: `tests/e2e/ai-chat.spec.ts`
- Create: `tests/e2e/quality-dashboard.spec.ts`

- [ ] **Step 1: gedcom-import.spec.ts**

Login → navigate to /import → upload sample.ged via file input → verify success toast/message → navigate to /tree → verify at least 3 persons rendered.

- [ ] **Step 2: person-crud.spec.ts**

Login → /person/new → fill name fields → save → verify redirect to person detail → edit name → save → verify updated → delete → verify redirected away.

- [ ] **Step 3: tree-view.spec.ts**

Login (with seeded data) → /tree → verify canvas renders → use search to find a person → verify result appears.

- [ ] **Step 4: export.spec.ts**

Login → /export → select GEDCOM 5.5.1 → click download → intercept response, verify starts with `0 HEAD`. Select 7.0 → verify `2 VERS 7.0`.

- [ ] **Step 5: collaboration.spec.ts**

Login as owner → /settings/members → click invite → copy link → open in new context (incognito) → signup → accept invite → verify dashboard loads.

- [ ] **Step 6: ai-chat.spec.ts**

Mock the Claude API via route interception:
```typescript
await page.route('**/api/ai/chat', route => {
  route.fulfill({ body: 'This is a mocked AI response about genealogy.', contentType: 'text/plain' });
});
```
Navigate to research → type question → verify response text appears.

- [ ] **Step 7: quality-dashboard.spec.ts**

Login → /analytics/quality → verify metric cards render → verify chart containers exist → verify priority table has rows.

- [ ] **Step 8: Run all E2E tests**

```bash
cd tests && npx playwright test
```

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/
git commit -m "feat(tests): 7 additional E2E tests covering all critical paths"
```

---

## Task 6: CI/CD E2E step

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add E2E job to CI**

Add after the existing `ci` job:

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: [ci]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: cd tests && npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: cd tests && npx playwright test
        env:
          NEXTAUTH_SECRET: test-secret-for-ci
          NEXTAUTH_URL: http://localhost:3001
          # Uses local SQLite (file: URLs) — no Turso needed in CI
          # The dev server will create a local test DB automatically

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: tests/playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Playwright E2E tests to CI pipeline"
```

---

## Task 7: Worker Dockerfile fix + Railway prep

**Files:**
- Modify: `apps/worker/Dockerfile`
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Fix Dockerfile to copy workspace deps**

The current Dockerfile only copies `apps/worker/` but the worker depends on workspace packages. Update the deps stage:

```dockerfile
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/research/package.json packages/research/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile --filter @ancstra/worker...
```

And the build stage:
```dockerfile
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/ ./packages/
COPY tsconfig.json ./
COPY apps/worker/ apps/worker/
WORKDIR /app/apps/worker
RUN pnpm build
```

- [ ] **Step 2: Add production CORS origin**

In `apps/worker/src/index.ts`, ensure `WEB_URL` env var is set for production CORS:
```typescript
origin: [
  'http://localhost:3000',
  ...(process.env.WEB_URL ? [process.env.WEB_URL] : []),
],
```
This already exists — just verify it's there. The `WEB_URL` will be set to `https://ancstra.vercel.app` on Railway.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/
git commit -m "fix(worker): Dockerfile copies all workspace deps for Railway deployment"
```

---

## Task 8: Nextra docs site

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/next.config.mjs`
- Create: `apps/docs/theme.config.tsx`
- Create: `apps/docs/pages/*.mdx` (9 files)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ancstra/docs",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.0.0",
    "nextra": "^4.0.0",
    "nextra-theme-docs": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Check the actual Next.js and Nextra versions available. Nextra 4.x supports Next.js 15+ — verify it works with 16. If not, use Nextra 3.x with appropriate Next.js compat.

- [ ] **Step 2: Create next.config.mjs**

```javascript
import nextra from 'nextra';

const withNextra = nextra({ theme: 'nextra-theme-docs', themeConfig: './theme.config.tsx' });

export default withNextra({});
```

- [ ] **Step 3: Create theme.config.tsx**

```tsx
import type { DocsThemeConfig } from 'nextra-theme-docs';

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 700 }}>Ancstra Docs</span>,
  project: { link: 'https://github.com/your-username/ancstra' },
  docsRepositoryBase: 'https://github.com/your-username/ancstra/tree/main/apps/docs',
  footer: { content: 'Ancstra — AI-Powered Personal Genealogy' },
};

export default config;
```

- [ ] **Step 4: Create content pages**

Write 9 MDX pages with practical content:
- `index.mdx` — Welcome, what Ancstra is, quick links
- `getting-started.mdx` — Create account, import GEDCOM, add first person
- `tree-view.mdx` — Navigate tree, views, search, filters
- `persons.mdx` — Add/edit persons, events, sources, relationships
- `research.mdx` — AI assistant, research workspace, evidence analysis
- `collaboration.mdx` — Invite family, roles (owner/admin/editor/viewer), moderation
- `export.mdx` — GEDCOM 5.5.1 and 7.0, PDF export
- `privacy.mdx` — Beta privacy notice (minimal placeholder from spec)
- `terms.mdx` — Beta terms (minimal placeholder from spec)

Each page: 100-300 words, practical steps, no fluff.

- [ ] **Step 5: Install and verify**

```bash
cd apps/docs && pnpm install && pnpm dev
```
Visit http://localhost:3002 — verify docs render.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/
git commit -m "feat(docs): Nextra docs site with user guide and legal placeholders"
```

---

## Task 9: Error messages utility

**Files:**
- Create: `apps/web/lib/error-messages.ts`

- [ ] **Step 1: Create error-messages.ts**

```typescript
import { ForbiddenError } from '@ancstra/auth';

export function getUserFriendlyError(error: unknown): string {
  if (error instanceof ForbiddenError) {
    return `You don't have permission to ${describePermission(error.permission)}. Contact a family admin.`;
  }
  if (error instanceof Error) {
    if (error.message.includes('Not authenticated')) return 'Please sign in to continue.';
    if (error.message.includes('fetch')) return 'Unable to connect. Check your internet connection.';
    if (error.message.includes('SQLITE_BUSY')) return 'Database is busy. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

function describePermission(permission: string): string {
  const map: Record<string, string> = {
    'person:delete': 'delete this person',
    'person:edit': 'edit this person',
    'person:create': 'add new persons',
    'settings:manage': 'change settings',
    'members:manage': 'manage family members',
    'tree:delete': 'delete this family tree',
    'gedcom:import': 'import GEDCOM files',
  };
  return map[permission] || 'perform this action';
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/error-messages.ts
git commit -m "feat(web): user-friendly error message utility"
```

---

## Task 10: Welcome card + polish

**Files:**
- Create: `apps/web/components/onboarding/welcome-card.tsx`
- Modify: `apps/web/app/(auth)/dashboard/page.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 1: Create welcome-card.tsx**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'ancstra-welcome-dismissed';

export function WelcomeCard() {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
  }, []);

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }

  return (
    <Card className="relative border-primary/20 bg-primary/5">
      <Button
        variant="ghost" size="icon" className="absolute right-2 top-2"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader>
        <CardTitle>Welcome to Ancstra!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">Here's how to get started:</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link href="/import">Import a GEDCOM file</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/person/new">Add a person</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/research">AI Research</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add welcome card to dashboard**

Read `apps/web/app/(auth)/dashboard/page.tsx`. Add `<WelcomeCard />` at the top of the page content.

- [ ] **Step 3: Add Help link to sidebar**

Read `apps/web/components/app-sidebar.tsx`. Add a "Help" link at the bottom pointing to the docs site URL (use `process.env.NEXT_PUBLIC_DOCS_URL || 'https://ancstra-docs.vercel.app'`). Opens in new tab.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/ apps/web/app/(auth)/dashboard/ apps/web/components/app-sidebar.tsx
git commit -m "feat(web): welcome card and help link"
```

---

## Task 11: Accessibility pass

**Files:**
- Modify: Various component files

- [ ] **Step 1: Audit icon-only buttons**

Search for buttons that only contain an icon (no text). Add `aria-label` to each:
- Sidebar toggle button
- Close buttons on dialogs
- Search button
- Theme toggle
- Any other icon-only buttons

```bash
grep -rn "size=\"icon\"" apps/web/components/ | head -20
```

- [ ] **Step 2: Add landmark roles**

Verify the layout has proper landmark roles:
- Sidebar: `role="navigation"` or `<nav>`
- Main content: `role="main"` or `<main>`
- Tree canvas: `aria-label="Family tree"`

Most of these may already be correct via shadcn's sidebar component — verify and fix gaps.

- [ ] **Step 3: Verify focus visibility**

Tab through login, dashboard, tree, person detail, settings. Verify focus ring is visible on all interactive elements. shadcn handles this mostly — check for any custom buttons or links missing focus styles.

- [ ] **Step 4: Verify contrast**

Check that `text-muted-foreground` meets WCAG AA (4.5:1 ratio) against both light and dark backgrounds. Use browser DevTools accessibility audit or a contrast checker tool. Fix any failing colors.

- [ ] **Step 5: Mobile responsive spot-check**

Verify at 375px viewport: login form usable, dashboard readable, tree view pan/zoom works, person detail scrollable, sidebar collapses. Fix any layout breaks.

- [ ] **Step 6: Loading states audit**

Check dashboard, persons list, tree page, analytics for loading states. Add Suspense boundaries or skeleton screens where data fetching causes blank flashes.

- [ ] **Step 7: Confirmation dialogs audit**

Verify all destructive actions have confirmation: delete person, remove member, revoke invitation, delete family. Most were added in Phase 4 — just verify none were missed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat(web): accessibility — aria labels, landmarks, focus visibility"
```

---

## Task 12: Security checklist automation

**Files:**
- Modify: `tests/e2e/auth.spec.ts` (add security tests)

- [ ] **Step 1: Add security tests to auth.spec.ts**

```typescript
test('unauthenticated API returns 401', async ({ request }) => {
  const response = await request.get('/api/persons');
  expect(response.status()).toBe(401);
});

test('viewer cannot delete person', async ({ page }) => {
  // Login as viewer, attempt DELETE /api/persons/{id} → expect 403
  // This requires a seeded viewer user
});

test('living person data is redacted for viewer', async ({ page }) => {
  // Login as viewer, GET /api/persons → check living persons show "Living"
});
```

- [ ] **Step 2: Create manual security checklist**

Create `docs/security-checklist.md` with the full manual checklist from the spec. This is for human execution, not automation.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/ docs/security-checklist.md
git commit -m "test: security tests in Playwright + manual security checklist"
```

---

## Task Dependency Order

```
Task 1 (Turso driver swap) → Task 2 (Turso Platform API + family provisioning)

Task 3 (Sentry) — independent
Task 4 (Playwright setup) → Task 5 (remaining E2E tests) → Task 6 (CI E2E step)
Task 4 → Task 12 (security tests)

Task 7 (Worker Dockerfile) — independent
Task 8 (Nextra docs) — independent
Task 9 (error messages) — independent
Task 10 (welcome card) — independent
Task 11 (accessibility) — independent
```

**Parallelizable groups:**
- After Task 1: Tasks 2, 3, 4, 7, 8, 9, 10, 11 can all run in parallel
- After Task 4: Tasks 5 and 12 can run in parallel
- Task 6 after Task 5

**Recommended execution order:**
1. Task 1 (critical path — Turso driver)
2. Tasks 2, 3, 4, 7, 8, 9, 10, 11 in parallel
3. Tasks 5, 12 in parallel
4. Task 6

**Manual steps (not in plan — require human action):**
- Create Turso account + org + database via CLI
- Create Vercel project, connect GitHub repo, set env vars
- Create Railway project with two services (worker + Gotenberg)
- Create Sentry project, get DSN
- Register Google OAuth app (Google Cloud Console)
- Register Apple OAuth app (Apple Developer)
- Set all env vars on Vercel + Railway
