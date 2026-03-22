# FTS5 Search + Cmd+K Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FTS5 full-text search on person names with a global Cmd+K command palette for fast navigation, and upgrade the existing LIKE search to use FTS5.

**Architecture:** SQLite FTS5 virtual table (`persons_fts`) with auto-sync triggers keeps search index current. Raw SQL queries via better-sqlite3's `prepare().all()` since Drizzle doesn't support FTS5. Search API returns ranked results via `bm25()`. Command palette uses shadcn Command (cmdk) rendered globally in root layout.

**Tech Stack:** SQLite FTS5, better-sqlite3 raw SQL, cmdk (via shadcn command), Next.js 16, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-fts5-search-cmdk-design.md`

---

## File Structure

```
packages/db/src/
  index.ts                          — ADD: initFts5() setup function

apps/web/
  lib/
    queries.ts                      — ADD: searchPersonsFts() function

  app/api/
    search/route.ts                 — NEW: GET /api/search (FTS5 query)
    persons/route.ts                — MODIFY: replace LIKE with FTS5 when ?q=

  components/
    command-palette.tsx             — NEW: global Cmd+K command palette
    app-header.tsx                  — MODIFY: add search button (becomes client component)

  app/layout.tsx                    — MODIFY: render CommandPalette

  components/tree/
    tree-canvas.tsx                 — MODIFY: remove / key handler (palette handles it)

  __tests__/
    api/search.test.ts              — NEW: FTS5 search integration tests
```

---

## Task 0: FTS5 Virtual Table Setup

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add initFts5() to packages/db/src/index.ts**

Read the file first. Add an exported function that creates the FTS5 virtual table and auto-sync triggers using raw better-sqlite3 SQL. This must be called once per database to set up FTS5.

The function:
- Opens a raw better-sqlite3 connection (same path as createDb)
- Creates `persons_fts` virtual table with `fts5(given_name, surname, content=person_names, content_rowid=rowid)`
- Creates AFTER INSERT/UPDATE/DELETE triggers on `person_names` to keep FTS in sync
- Runs `INSERT INTO persons_fts(persons_fts) VALUES('rebuild')` to populate from existing data
- Uses `IF NOT EXISTS` / `DROP TRIGGER IF EXISTS` for idempotency

- [ ] **Step 2: Run initFts5 on the existing database**

```bash
cd D:/projects/ancstra/packages/db && pnpm tsx -e "import { initFts5 } from './src/index'; initFts5();"
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add packages/db/src/index.ts
git commit -m "feat(search): FTS5 virtual table setup + auto-sync triggers"
```

---

## Task 1: Search Query Helper + API + Tests

**Files:**
- Modify: `apps/web/lib/queries.ts`
- Create: `apps/web/app/api/search/route.ts`
- Create: `apps/web/__tests__/api/search.test.ts`

- [ ] **Step 1: Write FTS5 search tests**

Create `apps/web/__tests__/api/search.test.ts` with in-memory SQLite. The test beforeEach must create all standard tables PLUS the FTS5 virtual table and triggers. Tests:

- finds persons by surname prefix (`smith*` → 2 results)
- finds persons by given name prefix (`john*` → 2 results including Jonathan)
- excludes soft-deleted persons
- returns empty for no match
- auto-syncs on insert via trigger

Use raw SQLite FTS5 queries in the tests to verify the FTS5 table works.

- [ ] **Step 2: Add searchPersonsFts() to queries.ts**

Read the file. Add a function that:
- Sanitizes query (remove FTS5 special chars `'"*()`)
- Splits on whitespace, adds `*` suffix to each word for prefix matching
- Runs raw SQL via `(db as any).$client` to get the better-sqlite3 instance
- Joins `persons_fts` → `person_names` (via rowid) → `persons` (via person_id)
- Filters `deleted_at IS NULL` and `is_primary = 1`
- Orders by `bm25(persons_fts)` (relevance)
- Adds birth/death dates from events table
- Returns `PersonListItem[]`

- [ ] **Step 3: Create search API route**

`apps/web/app/api/search/route.ts`: Auth check, require `?q=` (400 if missing), optional `?limit=` (default 10, max 50), call `searchPersonsFts()`, return `{ persons }`.

- [ ] **Step 4: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
cd D:/projects/ancstra && git add apps/web/lib/queries.ts apps/web/app/api/search/ apps/web/__tests__/api/search.test.ts
git commit -m "feat(search): FTS5 search query helper + /api/search endpoint with tests"
```

---

## Task 2: Upgrade /persons LIKE to FTS5

**Files:**
- Modify: `apps/web/app/api/persons/route.ts`
- Modify: `apps/web/__tests__/api/persons.test.ts`

- [ ] **Step 1: Replace LIKE with FTS5 in GET /api/persons**

Read `apps/web/app/api/persons/route.ts`. When `q` is present, replace the LIKE `whereClause` with a call to `searchPersonsFts()`. The FTS5 returns all matches, so slice for pagination:

```typescript
if (q) {
  const allResults = searchPersonsFts(db, q, 1000);
  const total = allResults.length;
  const items = allResults.slice(offset, offset + pageSize);
  return NextResponse.json({ items, total, page, pageSize });
}
```

Remove the LIKE-specific `whereClause` and `sql` template code for the `q` case.

- [ ] **Step 2: Update persons search tests**

Add FTS5 DDL (virtual table + triggers) to the `beforeEach` setup in `apps/web/__tests__/api/persons.test.ts`. Existing search tests should still pass — FTS5 prefix matching covers the same cases as LIKE.

- [ ] **Step 3: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
cd D:/projects/ancstra && git add apps/web/app/api/persons/route.ts apps/web/__tests__/api/persons.test.ts
git commit -m "feat(search): upgrade /api/persons search from LIKE to FTS5"
```

---

## Task 3: Command Palette + Integration

**Files:**
- Create: `apps/web/components/command-palette.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/app-header.tsx`
- Modify: `apps/web/components/tree/tree-canvas.tsx`

- [ ] **Step 1: Install shadcn command + dialog**

```bash
cd D:/projects/ancstra/apps/web && pnpm dlx shadcn@latest add command dialog
```

- [ ] **Step 2: Create command-palette.tsx**

Client component using `CommandDialog` from shadcn. Features:
- Global Cmd+K / Ctrl+K / `/` keyboard shortcut (useEffect listener)
- Debounced search (200ms) → `GET /api/search?q=<term>&limit=8`
- "People" CommandGroup showing FTS5 results (name, sex badge, birth date)
- "Actions" CommandGroup with static actions filtered client-side by query
- Navigate on select → router.push, close palette
- Static actions: Add Person, Import GEDCOM, Export GEDCOM, Go to Tree/People/Sources/Dashboard

- [ ] **Step 3: Add to root layout**

Modify `apps/web/app/layout.tsx`: import `CommandPalette`, render inside ThemeProvider after `{children}` and before `<Toaster />`.

- [ ] **Step 4: Add search button to app header**

Modify `apps/web/components/app-header.tsx`: make it a `'use client'` component, add a search button with Search icon + "⌘K" badge that dispatches the keyboard event to open the palette.

- [ ] **Step 5: Remove / key handler from tree canvas**

Read `apps/web/components/tree/tree-canvas.tsx`. Remove the `/` key handler from the keyboard useEffect (the global command palette now handles it).

- [ ] **Step 6: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/command-palette.tsx apps/web/components/ui/command.tsx apps/web/components/ui/dialog.tsx apps/web/app/layout.tsx apps/web/components/app-header.tsx apps/web/components/tree/tree-canvas.tsx
git commit -m "feat(search): Cmd+K command palette with person search + quick actions"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Type check**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
```

Expected: All tests pass (103 existing + ~5 search = ~108).

- [ ] **Step 3: Manual smoke test**

1. Cmd+K → palette opens, type "john" → person results appear
2. Click person → navigates, palette closes
3. Type "import" → Import GEDCOM action shown
4. Press `/` on any page → palette opens
5. Click search button in header → palette opens
6. /persons page → search "smith" → FTS5 results
7. Test empty query → actions shown, no people group

- [ ] **Step 4: Commit any remaining changes**

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | FTS5 virtual table + setup function | — |
| 1 | Search query helper + API route + tests | 0 |
| 2 | Upgrade /persons LIKE to FTS5 | 1 |
| 3 | Command palette + header + layout | 1 |
| 4 | Final verification | All |

**Critical path:** 0 → 1 → 3

**Parallelizable:** Tasks 2 and 3 after Task 1.
