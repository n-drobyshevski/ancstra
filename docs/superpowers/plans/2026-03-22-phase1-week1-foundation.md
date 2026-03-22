# Phase 1 Week 1 — Foundation + Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Ancstra monorepo and build a working vertical slice: Person Create form → API → database → Person Detail page, with real auth and the Indigo Heritage design system.

**Architecture:** Turborepo monorepo with 3 packages (web app, db, shared). Event-based database schema following `docs/architecture/data-model.md`. Person creation inserts into `persons`, `person_names`, and `events` tables in a single transaction. NextAuth.js v5 credentials provider for auth.

**Tech Stack:** Next.js 16 (canary), TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM, better-sqlite3, NextAuth.js v5, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-03-22-phase1-week1-foundation-design.md`

---

## File Structure

All paths relative to project root (`D:/projects/ancstra/`).

```
apps/web/                           # Next.js app
  app/globals.css                   # Tailwind + Indigo Heritage tokens
  app/layout.tsx                    # Root layout
  app/(auth)/layout.tsx             # Auth guard + app shell
  app/(auth)/dashboard/page.tsx     # Dashboard placeholder
  app/(auth)/person/new/page.tsx    # Person Create
  app/(auth)/person/[id]/page.tsx   # Person Detail
  app/login/page.tsx                # Login form
  app/api/auth/[...nextauth]/route.ts
  app/api/persons/route.ts          # POST create, GET list
  app/api/persons/[id]/route.ts     # GET detail
  auth.ts                           # NextAuth config
  middleware.ts                     # Route protection
  components/ui/                    # shadcn auto-generated
  components/app-sidebar.tsx
  components/app-header.tsx
  components/person-form.tsx
  components/person-detail.tsx
  lib/validation.ts                 # Zod schemas
  lib/utils.ts                      # cn() helper

packages/db/
  src/schema.ts                     # All Drizzle table definitions
  src/index.ts                      # DB connection factory
  src/seed.ts                       # Dev seed data
  drizzle.config.ts
  migrations/                       # Auto-generated

packages/shared/
  src/types.ts                      # Shared TS types
  src/dates.ts                      # Date parsing stub
  src/index.ts                      # Barrel export
```

---

## Task 0: Monorepo Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Initialize Turborepo**

```bash
cd D:/projects/ancstra
pnpm dlx create-turbo@latest --skip-install
```

If the interactive CLI asks questions: select pnpm, no example app. If it scaffolds too much, we'll clean up.

- [ ] **Step 2: Clean up and configure pnpm-workspace.yaml**

Ensure `pnpm-workspace.yaml` contains:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Configure turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "db:generate": { "cache": false },
    "db:migrate": { "cache": false },
    "db:seed": { "cache": false }
  }
}
```

- [ ] **Step 4: Configure root tsconfig.json**

Base TypeScript config that packages extend.

- [ ] **Step 5: Create .env.example**

```env
DATABASE_URL=./ancstra.db
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
AUTH_SECRET=change-me-to-a-random-secret
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

- [ ] **Step 6: Update .gitignore**

Add: `node_modules/`, `.next/`, `*.db`, `.env.local`, `.env`, `dist/`, `.turbo/`

- [ ] **Step 7: Install root dependencies**

```bash
pnpm install
```

- [ ] **Step 8: Verify monorepo structure**

```bash
pnpm ls --depth 0
ls apps/ packages/
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: initialize Turborepo monorepo with pnpm workspaces"
```

---

## Task 1: Database Package (packages/db)

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/schema.ts`, `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@ancstra/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/seed.ts"
  }
}
```

- [ ] **Step 2: Install db dependencies**

```bash
cd packages/db
pnpm add drizzle-orm better-sqlite3 dotenv
pnpm add -D drizzle-kit @types/better-sqlite3 tsx typescript
```

- [ ] **Step 3: Write packages/db/src/schema.ts**

Copy the exact schema definitions from the spec (lines 103-234): `users`, `persons`, `personNames`, `families`, `children`, `events` tables + all indexes. This is the single source of truth for the database schema in code.

- [ ] **Step 4: Write packages/db/src/index.ts**

Database connection factory — copy from spec lines 239-253. Exports `createDb()`, `Database` type, and all schema re-exports.

- [ ] **Step 5: Write packages/db/drizzle.config.ts**

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './ancstra.db',
  },
});
```

- [ ] **Step 6: Generate initial migration**

```bash
cd packages/db
pnpm db:generate
```

Expected: creates `migrations/` directory with SQL migration file.

- [ ] **Step 7: Run migration locally**

```bash
pnpm db:migrate
```

Expected: creates `ancstra.db` with all tables. Verify with:
```bash
sqlite3 ancstra.db ".tables"
```
Should show: `users persons person_names families children events`

- [ ] **Step 8: Write packages/db/src/seed.ts**

Seed script that:
- Creates dev user (email: `dev@ancstra.app`, bcrypt-hashed password: `password`, salt rounds: 10)
- Creates 3 sample persons with names and birth/death events
- Uses transactions for data integrity

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 9: Run seed**

```bash
pnpm db:seed
```

Verify: `sqlite3 ancstra.db "SELECT email FROM users"` → `dev@ancstra.app`

- [ ] **Step 10: Commit**

```bash
git add packages/db/ && git commit -m "feat(db): Drizzle schema with persons, names, events + seed data"
```

---

## Task 2: Shared Package (packages/shared)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/types.ts`, `packages/shared/src/dates.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

- [ ] **Step 2: Write packages/shared/src/types.ts**

TypeScript types for Person (assembled from persons + person_names + events), CreatePersonInput, PersonListItem. These are the API contract types used by both the API routes and the frontend.

- [ ] **Step 3: Write packages/shared/src/dates.ts**

Stub for genealogical date parsing. For now: a function `parseDateToSort(dateStr: string): number | null` that converts "15 Mar 1872" → `18720315`. Basic regex parsing. Full implementation comes later.

- [ ] **Step 4: Write barrel export**

- [ ] **Step 5: Commit**

```bash
git add packages/shared/ && git commit -m "feat(shared): types and date parsing stub"
```

---

## Task 3: Next.js App Setup + Design System

**Files:**
- Create: `apps/web/` (Next.js app with Tailwind v4, shadcn/ui, Indigo Heritage palette)

- [ ] **Step 1: Create Next.js 16 app**

```bash
cd apps
pnpm dlx create-next-app@canary web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

- [ ] **Step 2: Configure Tailwind CSS v4**

Verify `app/globals.css` uses `@import "tailwindcss"` (CSS-first, no tailwind.config.js). If the scaffolder created a config file, remove it.

- [ ] **Step 3: Write Indigo Heritage tokens in globals.css**

Replace the default shadcn/ui theme variables in `globals.css` with the Indigo Heritage OKLCH palette from spec lines 335-365.

- [ ] **Step 4: Install shadcn/ui**

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

When prompted: style=default, base-color=slate (we override with OKLCH), CSS variables=yes, import-alias=@/*.

- [ ] **Step 5: Install shadcn/ui components**

```bash
pnpm dlx shadcn@latest add button input select textarea card label sidebar sheet avatar badge separator sonner switch
```

- [ ] **Step 6: Verify the palette works**

Create a temporary test page that renders a `<Button>` with `bg-primary`. Open in browser. Confirm it renders in the Indigo Heritage indigo-blue, not the default zinc.

If OKLCH doesn't work with shadcn's HSL-based system, configure the `cssVariables` option or convert OKLCH to HSL fallbacks.

- [ ] **Step 7: Install Inter + Fira Code fonts**

Add Google Fonts import to `app/layout.tsx` or install `@fontsource/inter` + `@fontsource/fira-code`.

- [ ] **Step 8: Add workspace dependency on @ancstra/db and @ancstra/shared**

```bash
cd apps/web
pnpm add @ancstra/db@workspace:* @ancstra/shared@workspace:*
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/ && git commit -m "feat(web): Next.js 16 + Tailwind v4 + shadcn/ui + Indigo Heritage palette"
```

---

## Task 4: Authentication

**Files:**
- Create: `apps/web/auth.ts`, `apps/web/middleware.ts`, `apps/web/app/login/page.tsx`, `apps/web/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Install NextAuth**

```bash
cd apps/web
pnpm add next-auth@beta bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Write apps/web/auth.ts**

NextAuth config with credentials provider — copy from spec lines 277-306. Uses `createDb()` from `@ancstra/db` to look up users.

- [ ] **Step 3: Write API route for NextAuth**

```typescript
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Write middleware.ts**

Route protection — copy from spec lines 311-318. Matcher protects `/dashboard/*`, `/person/*`, etc.

- [ ] **Step 5: Write login page**

`apps/web/app/login/page.tsx` — a simple form with email + password inputs and a Sign In button. Uses shadcn/ui `Card`, `Input`, `Button`, `Label`. Calls `signIn('credentials', { email, password, redirectTo: '/dashboard' })`.

- [ ] **Step 6: Create .env.local**

```bash
cp .env.example .env.local
# Edit AUTH_SECRET to a random value
```

Generate a secret: `openssl rand -base64 32`

- [ ] **Step 7: Test auth flow**

```bash
pnpm dev
```

1. Navigate to `http://localhost:3000/dashboard` → should redirect to `/login`
2. Log in with `dev@ancstra.app` / `password` → should redirect to `/dashboard`
3. Session should persist across page refreshes

- [ ] **Step 8: Commit**

```bash
git add apps/web/auth.ts apps/web/middleware.ts apps/web/app/login/ apps/web/app/api/auth/ .env.example
git commit -m "feat(auth): NextAuth.js v5 credentials provider + login page"
```

---

## Task 5: App Shell (Sidebar + Header)

**Files:**
- Create: `apps/web/components/app-sidebar.tsx`, `apps/web/components/app-header.tsx`, `apps/web/app/(auth)/layout.tsx`, `apps/web/app/(auth)/dashboard/page.tsx`

- [ ] **Step 1: Write app-sidebar.tsx**

shadcn Sidebar component with `collapsible="icon"`. Nav items:
- Dashboard (Home icon) — links to `/dashboard`
- Tree (GitBranch icon) — links to `/tree` (placeholder)
- Search (Search icon) — placeholder
- Research (BookOpen icon) — placeholder
- Import (Upload icon) — placeholder
- Settings (Settings icon, in SidebarFooter) — placeholder

Uses `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarRail`.

- [ ] **Step 2: Write app-header.tsx**

56px header bar inside `SidebarInset`. Contains:
- Left: `SidebarTrigger` + breadcrumb/page title
- Right: search trigger (non-functional placeholder) + user avatar (from session)

- [ ] **Step 3: Write (auth)/layout.tsx**

Auth check layout. Uses `auth()` from `@/auth` to get session. If no session, redirect to `/login`. Renders `<SidebarProvider>` + `<AppSidebar />` + `<SidebarInset>` with `<AppHeader />` + `{children}`.

- [ ] **Step 4: Write dashboard page**

`apps/web/app/(auth)/dashboard/page.tsx` — Simple placeholder page with "Welcome to Ancstra" heading and a link to `/person/new`.

- [ ] **Step 5: Test shell**

Run `pnpm dev`, log in, verify:
- Sidebar renders at 64px with icon nav
- Sidebar toggle expands/collapses
- Header shows with breadcrumb
- Dashboard page renders in content area

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/app-sidebar.tsx apps/web/components/app-header.tsx apps/web/app/\(auth\)/
git commit -m "feat(ui): app shell — sidebar + header matching wireframe WF-01"
```

---

## Task 6: Validation Schemas + API Routes

**Files:**
- Create: `apps/web/lib/validation.ts`, `apps/web/app/api/persons/route.ts`, `apps/web/app/api/persons/[id]/route.ts`
- Test: `apps/web/__tests__/validation.test.ts`

- [ ] **Step 1: Write Zod validation schemas**

`apps/web/lib/validation.ts`:
- `createPersonSchema`: givenName (string, min 1), surname (string, min 1), sex (enum M/F/U), birthDate (optional string), birthPlace (optional string), deathDate (optional string), deathPlace (optional string), isLiving (boolean), notes (optional string)

- [ ] **Step 2: Write validation tests**

```bash
cd apps/web
pnpm add -D vitest
```

`apps/web/__tests__/validation.test.ts`:
- Test valid input passes
- Test missing given name fails
- Test invalid sex fails
- Test optional fields are truly optional

- [ ] **Step 3: Run tests, verify they pass**

```bash
pnpm vitest run __tests__/validation.test.ts
```

- [ ] **Step 4: Write POST /api/persons route**

`apps/web/app/api/persons/route.ts`:
- Parse and validate body with Zod
- Check session with `auth()` → 401 if missing
- Transaction: insert `persons` → insert `person_names` (is_primary=true) → optionally insert birth/death `events`
- Use `parseDateToSort()` from `@ancstra/shared` for date_sort
- Set `updatedAt: new Date().toISOString()` explicitly
- Return 201 with person data

- [ ] **Step 5: Write GET /api/persons route (list)**

Same file. Query `persons` WHERE `deleted_at IS NULL`, JOIN `person_names` WHERE `is_primary = true`. Paginate with limit/offset. Return `{ persons, total, page }`.

- [ ] **Step 6: Write GET /api/persons/[id] route**

`apps/web/app/api/persons/[id]/route.ts`:
- Check session
- Query person by ID WHERE `deleted_at IS NULL`
- JOIN `person_names` (primary)
- LEFT JOIN `events` WHERE `event_type IN ('birth', 'death')`
- Return assembled person object or 404

- [ ] **Step 7: Test API manually**

```bash
pnpm dev
# In another terminal:
curl -X POST http://localhost:3000/api/persons \
  -H "Content-Type: application/json" \
  -d '{"givenName":"John","surname":"Smith","sex":"M"}'
```

Should get 401 (no session). Test with a session cookie from the browser.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/validation.ts apps/web/app/api/persons/ apps/web/__tests__/
git commit -m "feat(api): person CRUD API routes with Zod validation + transactional insert"
```

---

## Task 7: Person Create Form

**Files:**
- Create: `apps/web/components/person-form.tsx`, `apps/web/app/(auth)/person/new/page.tsx`

- [ ] **Step 1: Write person-form.tsx**

Client component (`"use client"`). Uses shadcn/ui: Card, Input, Select, Textarea, Button, Label, Switch, Sonner toast.

Fields per spec (lines 380-389). On submit: POST to `/api/persons`, show success toast, redirect to `/person/[id]` using `router.push()`.

Uses `useForm` from React or simple `useState` + `fetch`. Error handling: show validation errors inline.

- [ ] **Step 2: Write person/new page**

```typescript
// apps/web/app/(auth)/person/new/page.tsx
import { PersonForm } from '@/components/person-form';

export default function NewPersonPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Add New Person</h1>
      <PersonForm />
    </div>
  );
}
```

- [ ] **Step 3: Test the form**

Run `pnpm dev`, navigate to `/person/new`:
1. Fill in Given Name "John", Surname "Smith", Sex "Male"
2. Add birth date "15 Mar 1845", birth place "Springfield, IL"
3. Click Save
4. Should redirect to `/person/[id]` (404 for now — detail page not built yet)
5. Check database: `sqlite3 ancstra.db "SELECT * FROM person_names"` → should show John Smith

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/person-form.tsx apps/web/app/\(auth\)/person/new/
git commit -m "feat(ui): person create form with validation + transactional save"
```

---

## Task 8: Person Detail Page

**Files:**
- Create: `apps/web/components/person-detail.tsx`, `apps/web/app/(auth)/person/[id]/page.tsx`

- [ ] **Step 1: Write person-detail.tsx**

Server-compatible component that receives person data as props. Displays:
- Name as heading (text-xl semibold)
- Sex badge (Badge component)
- Birth info (date + place) if present
- Death info (date + place) if present
- "Living" badge if is_living
- Notes
- Created/updated timestamps in muted text
- "Edit" button (disabled/placeholder link)
- "Back to Dashboard" link

- [ ] **Step 2: Write person/[id] page**

Server Component that:
1. Gets the `id` from params
2. Fetches from the database directly (server component, no API call needed)
3. JOINs `person_names` + `events` to assemble the full person
4. Renders `<PersonDetail person={person} />`
5. Shows `notFound()` if person doesn't exist or is soft-deleted

- [ ] **Step 3: Test the full vertical slice**

Run `pnpm dev`:
1. Log in → Dashboard
2. Click "Add Person" → `/person/new`
3. Fill form: "John Smith", Male, birth "15 Mar 1845" in "Springfield, IL"
4. Save → redirect to `/person/[john-id]`
5. See: "John Smith" heading, "Male" badge, "Birth: 15 Mar 1845, Springfield, IL"
6. Click "Back to Dashboard" → `/dashboard`

**This completes the vertical slice.**

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/person-detail.tsx apps/web/app/\(auth\)/person/\[id\]/
git commit -m "feat(ui): person detail page — completes the vertical slice"
```

---

## Task 9: Integration Tests

**Files:**
- Create: `apps/web/__tests__/api/persons.test.ts`, `vitest.config.ts` (root)

- [ ] **Step 1: Set up Vitest config**

Root `vitest.config.ts` with workspace support, or per-package configs. Configure test database (`ancstra-test.db`).

- [ ] **Step 2: Write API integration tests**

`apps/web/__tests__/api/persons.test.ts`:

Tests:
1. `POST /api/persons` with valid data → 201, returns person with ID
2. `POST /api/persons` with missing givenName → 400
3. `POST /api/persons` without auth → 401
4. `GET /api/persons/[id]` → 200, returns person with name + events
5. `GET /api/persons/[nonexistent-id]` → 404
6. `GET /api/persons` → 200, returns paginated list

Each test uses a fresh test database. Use `beforeEach` to migrate + seed, `afterEach` to clean up.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

All tests should pass.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts apps/web/__tests__/
git commit -m "test: API integration tests for person CRUD"
```

---

## Task 10: Turso Spike Validation

**Files:**
- Create: `packages/db/src/turso.ts`, `packages/db/scripts/test-turso.ts`, `docs/architecture/decisions/007-turso-validation.md`

- [ ] **Step 1: Write packages/db/src/turso.ts**

Turso connection factory — copy from spec lines 257-269.

- [ ] **Step 2: Install libsql client**

```bash
cd packages/db
pnpm add @libsql/client
```

- [ ] **Step 3: Create Turso database**

```bash
turso db create ancstra-dev
turso db tokens create ancstra-dev
```

Add credentials to `.env.local`.

- [ ] **Step 4: Write test script**

`packages/db/scripts/test-turso.ts`:
1. Connect to Turso with `createTursoDb()`
2. Run migration (push schema)
3. Insert a person (transaction: persons + person_names + events)
4. Read it back
5. Verify all fields match
6. Log "PASS" or "FAIL" with details

- [ ] **Step 5: Run Turso test**

```bash
cd packages/db
pnpm tsx scripts/test-turso.ts
```

- [ ] **Step 6: Document results**

Write `docs/architecture/decisions/007-turso-validation.md` with:
- Test date, driver versions
- Pass/fail status
- Any quirks or incompatibilities found
- Recommendation for production deployment

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/turso.ts packages/db/scripts/ docs/architecture/decisions/007-turso-validation.md
git commit -m "spike: validate Drizzle + Turso driver swap — person CRUD works on both drivers"
```

---

## Summary

| Task | Description | Depends On | Est. |
|------|-------------|-----------|------|
| 0 | Monorepo scaffolding | — | 30min |
| 1 | Database package (schema, migration, seed) | 0 | 1hr |
| 2 | Shared package (types, dates) | 0 | 20min |
| 3 | Next.js app + Tailwind + shadcn + palette | 0 | 1hr |
| 4 | Authentication (NextAuth + login) | 1, 3 | 45min |
| 5 | App shell (sidebar + header) | 3, 4 | 45min |
| 6 | Validation + API routes | 1, 2, 4 | 1hr |
| 7 | Person Create form | 5, 6 | 45min |
| 8 | Person Detail page | 6 | 30min |
| 9 | Integration tests | 6 | 45min |
| 10 | Turso spike validation | 1 | 30min |

**Critical path:** 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8

**Parallelizable:** Task 2 parallel with 1. Task 10 parallel with 3-8. Task 9 parallel with 7-8.

**Total estimated:** ~7 hours of implementation
