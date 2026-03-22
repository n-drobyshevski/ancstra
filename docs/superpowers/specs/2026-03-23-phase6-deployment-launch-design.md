# Phase 6: Deployment & Launch — Design Spec

> Status: Approved | Date: 2026-03-23
> Phase: 6 | Duration: 3 weeks | Dependencies: Phase 1-5 complete

## Overview

Deploy Ancstra to production (Vercel + Turso + Railway), add comprehensive testing (Playwright E2E, security, accessibility), monitoring (Sentry), user documentation (Nextra), legal placeholders, and polish (welcome flow, error messages, loading states).

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Phase 6 only (Phase 6.5 beta separate) |
| 2 | Deployment | Deploy now for real |
| 3 | Domain | Vercel default (ancstra.vercel.app) |
| 4 | CI/CD | Already configured, add E2E step |
| 5 | E2E testing | Full Playwright suite (8 tests) |
| 6 | Monitoring | Full Sentry integration (errors + performance) |
| 7 | User docs | Nextra docs site (separate Vercel deploy) |
| 8 | Legal docs | Minimal placeholder (beta notice) |
| 9 | Turso | Multi-tenant (central + per-family DBs) |
| 10 | Backend infra | Hono worker + Gotenberg on Railway |
| 11 | Accessibility | Keyboard + basics (no full WCAG audit) |

## Architecture: Infrastructure-First

Build order:
1. Deploy infrastructure (Vercel + Turso + Railway)
2. Add monitoring (Sentry) + CI/CD E2E step
3. Write Playwright tests against deployed app
4. Docs site (Nextra) + legal placeholders
5. Polish pass (accessibility, errors, loading, welcome flow)

## Vercel Deployment

### Configuration

- Connect GitHub repo to Vercel
- Framework: Next.js
- Build command: `pnpm build`
- Root directory: `apps/web`
- Node.js 20.x
- Push to `main` → auto-deploy

### Environment variables

```
CENTRAL_DATABASE_URL=libsql://ancstra-central-{username}.turso.io
TURSO_AUTH_TOKEN=...
TURSO_ORG=...
TURSO_PLATFORM_TOKEN=...
NEXTAUTH_URL=https://ancstra.vercel.app
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
GOTENBERG_URL=https://{gotenberg-service}.railway.app
HONO_WORKER_URL=https://{hono-worker}.railway.app
WORKER_AUTH_SECRET=...
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
```

### Turso driver swap (needs implementation)

**Current state:** `createCentralDb()` and `createFamilyDb()` in `packages/db/src/index.ts` are hardcoded to `better-sqlite3`. A separate `createTursoDb()` exists in `turso.ts` but is not integrated into the main DB creation functions.

**Required change:** Refactor `createCentralDb()` and `createFamilyDb()` to detect the URL scheme:
- If URL starts with `libsql://` → use `drizzle-orm/libsql` driver with `@libsql/client`
- Otherwise → use `drizzle-orm/better-sqlite3` driver with `better-sqlite3`

Both drivers return Drizzle instances with the same schema, so the return type remains compatible. The detection is based on the `CENTRAL_DATABASE_URL` env var for central DB, and `family_registry.db_filename` for family DBs (which stores either a local filename or a `libsql://` URL).

This is the most critical implementation task in Phase 6 — without it, the app cannot connect to Turso in production.

## Turso Production Setup

### Central DB

Created manually via Turso CLI:
```bash
turso db create ancstra-central
turso db tokens create ancstra-central
```

Run schema DDL against the new DB to create all central tables.

### Family DB provisioning

`createFamily()` in `packages/auth/src/families.ts` gains a web-mode path:

```
Is TURSO_PLATFORM_TOKEN set?
  → YES (web mode): POST Turso Platform API to create DB, store libsql:// URL
  → NO (local mode): Create .sqlite file (existing behavior)
```

### Turso Platform API utility

New function in `packages/db/src/turso.ts`:

```typescript
export async function createTursoDatabase(name: string): Promise<{ url: string; token: string }>
```

Calls `POST https://api.turso.tech/v1/organizations/{org}/databases` with auth token. Returns the `libsql://` URL for the new DB.

### Schema migration on new DBs

**Central DB:** After creating via Turso CLI, run schema DDL using `turso db shell ancstra-central < schema.sql` or programmatically via a migration script that uses `@libsql/client` to execute all CREATE TABLE statements from `central-schema.ts`.

**Family DBs:** After creating via Platform API, run family schema DDL programmatically via `@libsql/client`. The `createFamily()` function handles this — after provisioning the Turso DB, it executes the same DDL that the local `better-sqlite3` path uses.

### Additional env vars

```
TURSO_ORG=...              # Turso org slug
TURSO_PLATFORM_TOKEN=...   # For provisioning new databases
TURSO_AUTH_TOKEN=...       # For connecting to databases
```

## Railway Deployment

### Hono Worker

**Note:** `apps/worker/` already exists with Hono, JWT auth (via `jose` + `AUTH_SECRET` env var), scrape routes, and a Dockerfile (port 3001). Phase 6 does NOT recreate the worker — it deploys the existing one to Railway and adds:

1. Turso DB connection (add `TURSO_AUTH_TOKEN` + `CENTRAL_DATABASE_URL` env vars)
2. Gotenberg integration (add `GOTENBERG_URL` env var pointing to Railway internal URL)
3. Fix Dockerfile to copy all workspace package dependencies (currently missing `packages/research/` etc.)

Existing auth model (JWT via `jose` + `AUTH_SECRET`) is kept — it's more robust than a simple secret header. The existing health check at `GET /health` is already implemented.

### Gotenberg

Uses `gotenberg/gotenberg:8` image directly on Railway. Internal networking — called by Hono worker and Vercel functions via Railway URL. No additional auth needed.

### Railway project structure

One project, two services:
- `ancstra-worker` — Hono (custom Docker)
- `ancstra-gotenberg` — Gotenberg (official image, port 3000)

## Sentry Integration

### Setup

Install `@sentry/nextjs` in `apps/web`. Three config files:

- `sentry.client.config.ts` — client-side error + performance
- `sentry.server.config.ts` — server-side error + performance
- `sentry.edge.config.ts` — edge runtime (proxy.ts)

All configs:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% for performance
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
});
```

### Integration points

- `next.config.ts` wrapped with `withSentryConfig()` for source maps
- `apps/web/app/global-error.tsx` — Sentry error boundary
- `apps/web/lib/auth/api-guard.ts` — `Sentry.captureException()` for unexpected errors
- Free tier: 5K errors + 10K performance events/month

## Playwright E2E Tests

### Setup

New `tests/` workspace in monorepo with `@playwright/test`.

```
tests/
├── playwright.config.ts
├── package.json
├── e2e/
│   ├── auth.spec.ts
│   ├── gedcom-import.spec.ts
│   ├── person-crud.spec.ts
│   ├── tree-view.spec.ts
│   ├── export.spec.ts
│   ├── collaboration.spec.ts
│   ├── ai-chat.spec.ts
│   └── quality-dashboard.spec.ts
├── fixtures/
│   └── sample.ged
```

### Config

Runs against local dev server by default (`http://localhost:3001`). Can target production via `PLAYWRIGHT_BASE_URL` env var. Chromium only. Screenshots on failure. Trace on first retry.

**Important:** The config must include a `webServer` block so Playwright starts the dev server automatically (especially in CI):
```typescript
webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
  command: 'pnpm --filter @ancstra/web dev --port 3001',
  port: 3001,
  reuseExistingServer: !process.env.CI,
},
```

### Test descriptions (8 tests)

1. **auth** — Login with credentials, verify dashboard. Visit protected route unauthenticated → redirect. OAuth buttons visible.
2. **gedcom-import** — Login → import → upload sample.ged → success → tree renders persons.
3. **person-crud** — Create person → verify in list → edit name → add event → delete → verify gone.
4. **tree-view** — Login with seeded data → tree loads → search person → verify focus.
5. **export** — Export GEDCOM 5.5.1 → verify file header. Export 7.0 → verify 7.0 header.
6. **collaboration** — Owner creates invite → copy link → incognito signup → accept → verify membership.
7. **ai-chat** — Navigate to research → type question → verify response (mock Claude API in CI).
8. **quality-dashboard** — Navigate to analytics → metric cards render → charts exist.

### CI integration

Add to `.github/workflows/ci.yml`:
```yaml
e2e:
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - run: pnpm install --frozen-lockfile
    - run: npx playwright install --with-deps chromium
    - run: pnpm test:e2e
```

AI chat test mocks Claude API via Playwright route interception.

## Security Testing

### Automated (in Playwright)

- Auth boundary: unauthenticated `/api/persons` → 401
- RBAC: viewer DELETE `/api/persons/{id}` → 403
- Living person: viewer GET persons → redacted names

### Manual checklist

- [ ] SQL injection in person name field → stored as literal
- [ ] XSS in notes field → rendered escaped
- [ ] CSRF: cookies have SameSite=Lax
- [ ] Rate limiting on `/join` endpoint
- [ ] Expired JWT → redirect to login
- [ ] Expired/revoked invite tokens → error page
- [ ] No secrets in client bundle (network tab audit)
- [ ] CORS: worker only allows production domain (check `WEB_URL` env var)

## Accessibility Basics

### Keyboard navigation

- Tab through all interactive elements on key pages
- Enter/Space activates buttons
- Escape closes dialogs/dropdowns
- Focus visible on all elements

### Aria labels

- Icon-only buttons get `aria-label`
- Sidebar: `role="navigation"`
- Content: `role="main"`
- Tree canvas: `aria-label="Family tree"`

### Contrast

- Verify muted-foreground meets WCAG AA (4.5:1)
- Check Indigo Heritage dark theme

## Docs Site (Nextra)

### Structure

New `apps/docs/` in monorepo using Nextra with `nextra-theme-docs`.

```
apps/docs/pages/
├── index.mdx            # Welcome
├── getting-started.mdx  # Account + first import
├── tree-view.mdx        # Navigation, views, search
├── persons.mdx          # Add/edit persons, events, sources
├── research.mdx         # AI assistant, workspace
├── collaboration.mdx    # Invitations, roles, moderation
├── export.mdx           # GEDCOM + PDF export
├── privacy.mdx          # Privacy placeholder
└── terms.mdx            # Terms placeholder
```

Deployed as separate Vercel project. Linked from app's help menu.

## Legal Placeholders

### Privacy notice

- Beta disclaimer
- Local-first data storage
- Turso for web mode
- Living person redaction policy
- AI: person data sent to Anthropic API
- No data sold
- Contact email

### Terms

- Beta, as-is
- User owns their data
- GEDCOM export available anytime
- Terms may update

## Polish & Welcome Flow

### Welcome card

Dismissible card on dashboard for first-time users:
- "Import a GEDCOM file" → /import
- "Add your first person" → /person/new
- "Try the AI research assistant" → /research
- Dismissed via localStorage flag

### Loading states

Audit and add skeleton screens to: dashboard, persons list, tree page, analytics.

### Error messages

`apps/web/lib/error-messages.ts` — maps technical errors to user-friendly messages:
- ForbiddenError → "You don't have permission..."
- Network error → "Unable to connect..."
- 500 → "Something went wrong..."

### Confirmation dialogs

Verify all destructive actions have confirmation (most added in Phase 4).

### Mobile check

Manual verification at 375px: login, dashboard, tree (pan/zoom), person detail, sidebar collapse.

## File Layout

### New packages/apps

```
apps/worker/           # Existing — deploy to Railway, fix Dockerfile, add Turso/Gotenberg env
apps/docs/             # NEW — Nextra docs site
tests/                 # NEW — Playwright E2E tests
```

### New files in apps/web

```
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
app/global-error.tsx
lib/error-messages.ts
components/onboarding/welcome-card.tsx
```

**Note:** `tests/` must be added to `pnpm-workspace.yaml` packages list (current config only includes `apps/*` and `packages/*`).

### Modified files

```
apps/web/next.config.ts              — withSentryConfig
apps/web/package.json                — @sentry/nextjs
apps/web/components/app-sidebar.tsx  — Help link
apps/web/app/(auth)/dashboard/page.tsx — welcome card
apps/web/lib/auth/api-guard.ts       — Sentry.captureException
packages/db/src/index.ts             — Turso driver detection (libsql:// vs better-sqlite3)
packages/db/src/turso.ts             — createTursoDatabase() Platform API
packages/auth/src/families.ts        — web mode Turso DB creation
apps/worker/Dockerfile               — fix: copy all workspace package dependencies
apps/worker/src/index.ts             — add Turso env vars, Gotenberg URL
.github/workflows/ci.yml            — E2E step (use pnpm/action-setup@v4 to match existing)
turbo.json                           — add "test:e2e": { "dependsOn": ["build"], "cache": false }
pnpm-workspace.yaml                  — add "tests" to packages list
```

### New dependencies

```
@sentry/nextjs       — apps/web
@playwright/test     — tests/
nextra               — apps/docs
nextra-theme-docs    — apps/docs
hono                 — apps/worker
```

## Exit Criteria

- [ ] App deployed and accessible at ancstra.vercel.app
- [ ] Central Turso DB running, family DB provisioning works
- [ ] Hono worker + Gotenberg running on Railway
- [ ] Sentry receiving errors and performance data
- [ ] All 8 Playwright E2E tests pass locally
- [ ] E2E tests pass in CI (GitHub Actions)
- [ ] Security manual checklist completed
- [ ] Keyboard navigation works on all key pages
- [ ] Nextra docs site deployed with 8 content pages
- [ ] Privacy + Terms placeholders published
- [ ] Welcome card shows for new users
- [ ] Error messages are user-friendly (no raw errors)
- [ ] Mobile responsive at 375px
- [ ] No console errors in production build
