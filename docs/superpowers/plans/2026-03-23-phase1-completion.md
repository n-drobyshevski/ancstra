# Phase 1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the 6 remaining Phase 1 items: closure table, person_summary, WAL/backup, performance baselines, accessible tree table view, and pino structured logging.

**Architecture:** Two new tables (`ancestor_paths`, `person_summary`) in the per-family SQLite database provide pre-computed query acceleration and denormalized display data. Both are maintained incrementally via application-level calls (not DB triggers) for libsql/Turso compatibility. WAL + backup is local-mode only. Pino replaces console logging at key integration points.

**Tech Stack:** Drizzle ORM, libsql, better-sqlite3 (local), vitest, pino, shadcn/ui Table, React Flow

**Spec:** `docs/superpowers/specs/2026-03-23-phase1-completion-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/db/src/closure-table.ts` | Closure table rebuild, addChildToFamily, removeChildFromFamily |
| `packages/db/src/person-summary.ts` | Person summary rebuild, refreshSummary, refreshRelatedSummaries |
| `packages/db/src/backup.ts` | backupDatabase, pruneBackups, restoreDatabase (local-only) |
| `packages/db/src/__tests__/closure-table.test.ts` | Closure table unit tests |
| `packages/db/src/__tests__/person-summary.test.ts` | Person summary unit tests |
| `packages/db/src/__tests__/backup.test.ts` | Backup unit tests |
| `packages/db/src/__bench__/seed-bench.ts` | Synthetic tree generator for benchmarks |
| `packages/db/src/__bench__/closure-table.bench.ts` | Closure table benchmarks |
| `packages/db/src/__bench__/person-summary.bench.ts` | Person summary benchmarks |
| `packages/db/src/__bench__/fts5-search.bench.ts` | FTS5 search benchmarks |
| `apps/web/__bench__/tree-render.bench.ts` | treeDataToFlow transform benchmarks |
| `packages/shared/src/logger.ts` | Pino logger factory |
| `apps/web/components/tree/tree-table.tsx` | Accessible sortable tree table component |
| `apps/web/components/tree/tree-table-wrapper.tsx` | Client wrapper for TreeTable with router |
| `apps/web/app/api/tree/rebuild/route.ts` | Admin endpoint to force-rebuild closure table + summaries |

### Modified Files

| File | Changes |
|------|---------|
| `packages/db/src/family-schema.ts` | Add `ancestorPaths` and `personSummary` Drizzle table definitions |
| `packages/db/src/turso.ts` | Add `ancestor_paths` and `person_summary` DDL to `FAMILY_SCHEMA_DDL` |
| `packages/db/src/index.ts` | Add `initLocalPragmas()`, export new modules |
| `packages/shared/package.json` | Add `pino`, `pino-pretty` (devDep) |
| `packages/shared/src/index.ts` | Re-export logger |
| `packages/db/package.json` | Add `"bench"` script |
| `apps/web/lib/queries.ts` | Rewrite `getTreeData()` to read `person_summary`; update `searchPersonsFts()` to join person_summary |
| `apps/web/app/api/families/[id]/children/route.ts` | Call `addChildToFamily` + `refreshRelatedSummaries` after insert |
| `apps/web/app/api/families/[id]/children/[personId]/route.ts` | Call `removeChildFromFamily` + `refreshRelatedSummaries` after delete |
| `apps/web/app/(auth)/tree/page.tsx` | Add `?view=table` param handling, conditionally render TreeTable |
| `apps/web/components/tree/tree-toolbar.tsx` | Add canvas/table toggle button |

---

## Task 1: Schema — Drizzle Tables + DDL

**Files:**
- Modify: `packages/db/src/family-schema.ts` (append after line 208, before re-exports)
- Modify: `packages/db/src/turso.ts` (add DDL before the closing backtick at line 368)

- [ ] **Step 1: Add `ancestorPaths` table to family-schema.ts**

First, add `primaryKey` to the imports at the top of the file: `import { sqliteTable, text, integer, real, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';`

Then add after the `historicalContext` table, before the `export * from` lines:

```typescript
// ==================== ANCESTOR PATHS (closure table) ====================
export const ancestorPaths = sqliteTable('ancestor_paths', {
  ancestorId: text('ancestor_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  descendantId: text('descendant_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  depth: integer('depth').notNull(),
}, (table) => [
  index('idx_ap_descendant').on(table.descendantId, table.depth),
  index('idx_ap_ancestor').on(table.ancestorId, table.depth),
  primaryKey({ columns: [table.ancestorId, table.descendantId] }),
]);
```

- [ ] **Step 2: Add `personSummary` table to family-schema.ts**

Add immediately after `ancestorPaths`:

```typescript
// ==================== PERSON SUMMARY (denormalized display) ====================
export const personSummary = sqliteTable('person_summary', {
  personId: text('person_id').primaryKey().references(() => persons.id, { onDelete: 'cascade' }),
  givenName: text('given_name').notNull().default(''),
  surname: text('surname').notNull().default(''),
  sex: text('sex').notNull(),
  isLiving: integer('is_living', { mode: 'boolean' }).notNull(),
  birthDate: text('birth_date'),
  deathDate: text('death_date'),
  birthDateSort: integer('birth_date_sort'),
  deathDateSort: integer('death_date_sort'),
  birthPlace: text('birth_place'),
  deathPlace: text('death_place'),
  spouseCount: integer('spouse_count').notNull().default(0),
  childCount: integer('child_count').notNull().default(0),
  parentCount: integer('parent_count').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
```

- [ ] **Step 3: Add DDL to turso.ts**

In `packages/db/src/turso.ts`, add the following SQL before the final closing backtick of `FAMILY_SCHEMA_DDL` (before line 368). See the spec for the exact SQL. The DDL must use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to match the existing pattern.

- [ ] **Step 4: Verify the schema compiles**

Run: `cd packages/db && npx tsx -e "import './src/family-schema'; console.log('OK')"`
Expected: `OK` with no errors

- [ ] **Step 5: Commit**

```
git add packages/db/src/family-schema.ts packages/db/src/turso.ts
git commit -m "feat(db): add ancestor_paths and person_summary schema definitions"
```

---

## Task 2: Pino Structured Logging

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/src/logger.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Install pino**

Run: `cd packages/shared && pnpm add pino && pnpm add -D pino-pretty`

- [ ] **Step 2: Create logger.ts**

Create `packages/shared/src/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export function createLogger(service: string) {
  return logger.child({ service });
}
```

- [ ] **Step 3: Re-export from index.ts**

Read `packages/shared/src/index.ts`. Add to the end:

```typescript
export { logger, createLogger } from './logger';
```

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/shared && npx tsx -e "import { createLogger } from './src'; const log = createLogger('test'); log.info('works')"`
Expected: Pretty-printed log line

- [ ] **Step 5: Commit**

```
git add packages/shared/
git commit -m "feat(shared): add pino structured logging with createLogger factory"
```

---

## Task 3: Closure Table — Core Functions + Tests

**Files:**
- Create: `packages/db/src/closure-table.ts`
- Create: `packages/db/src/__tests__/closure-table.test.ts`
- Modify: `packages/db/src/index.ts` (add export)

- [ ] **Step 1: Write closure table test file**

Create `packages/db/src/__tests__/closure-table.test.ts` with these test cases:

1. `rebuildClosureTable` creates self-references (depth=0) for all persons
2. `rebuildClosureTable` builds parent-child paths (depth=1)
3. `rebuildClosureTable` builds multi-generation paths (grandparent at depth=2)
4. `rebuildClosureTable` handles two-parent families (both mom and dad get paths)
5. `addChildToFamily` inserts paths for both parents incrementally
6. `removeChildFromFamily` removes paths when child is unlinked but keeps self-references

Each test should:
- Create an in-memory better-sqlite3 database with the schema DDL (persons, families, children, ancestor_paths tables)
- Wrap it with `drizzle(sqlite, { schema })`
- Insert test data using `db.run(sql\`...\`)`
- Call the function under test
- Assert using `db.all(sql\`SELECT ... FROM ancestor_paths ...\`)`

See the spec (Section 1) for the function signatures and behavior. The tests should use the `drizzle-orm/better-sqlite3` driver since closure table functions use Drizzle's `sql` tagged template which works with both drivers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/db && pnpm test -- --run src/__tests__/closure-table.test.ts`
Expected: FAIL — module `../closure-table` not found

- [ ] **Step 3: Implement closure-table.ts**

Create `packages/db/src/closure-table.ts` implementing:

- `rebuildClosureTable(db)`: Delete all, insert self-refs, BFS from roots inserting all ancestor-descendant pairs
- `addChildToFamily(db, familyId, childId)`: Look up both parents from family, for each parent: get their ancestors, get child's descendants, insert cross-product with `INSERT OR IGNORE`
- `removeChildFromFamily(db, familyId, childId)`: Collect descendants, delete non-self paths for all descendants, re-walk upward through remaining children/families to re-insert still-valid paths

All functions use `db.all(sql\`...\`)` and `db.run(sql\`...\`)` from drizzle-orm. Import `createLogger` from `@ancstra/shared` for logging the rebuild.

Key implementation details from spec:
- Self-referencing rows (depth=0) are always included
- `addChildToFamily` resolves BOTH partner1_id and partner2_id from the family
- `removeChildFromFamily` does a targeted subtree rebuild (not naive delete) to handle consanguinity
- Use `INSERT OR IGNORE` to handle duplicate paths gracefully

- [ ] **Step 4: Export from index.ts**

Add to `packages/db/src/index.ts`:

```typescript
export { rebuildClosureTable, addChildToFamily, removeChildFromFamily } from './closure-table';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/db && pnpm test -- --run src/__tests__/closure-table.test.ts`
Expected: All tests PASS

If tests fail because the better-sqlite3 drizzle driver isn't installed:
Run: `cd packages/db && pnpm add -D drizzle-orm`
(better-sqlite3 is already a dependency per package.json)

- [ ] **Step 6: Commit**

```
git add packages/db/src/closure-table.ts packages/db/src/__tests__/closure-table.test.ts packages/db/src/index.ts
git commit -m "feat(db): closure table with rebuild, addChildToFamily, removeChildFromFamily"
```

---

## Task 4: Person Summary — Core Functions + Tests

**Files:**
- Create: `packages/db/src/person-summary.ts`
- Create: `packages/db/src/__tests__/person-summary.test.ts`
- Modify: `packages/db/src/index.ts` (add export)

- [ ] **Step 1: Write person summary test file**

Create `packages/db/src/__tests__/person-summary.test.ts` with these test cases:

1. `rebuildAllSummaries` creates summary rows for all non-deleted persons
2. `rebuildAllSummaries` includes birth/death dates and places from events
3. `rebuildAllSummaries` handles person without primary name (empty string defaults)
4. `rebuildAllSummaries` counts spouses, children, and parents correctly
5. `refreshSummary` updates a single person's row after adding an event
6. `refreshRelatedSummaries` updates the target person plus immediate family

Use the same in-memory better-sqlite3 + drizzle setup as Task 3. The DDL must include ALL tables needed: persons, person_names, families, children, events, person_summary.

Key test data patterns:
- A family with dad, mom, and kid — verify dad has spouse_count=1, child_count=1; kid has parent_count=2
- A person with no name record — verify given_name='' and surname='' (not missing from results)
- Insert a birth event with date_original, date_sort, place_text — verify all three appear in summary

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/db && pnpm test -- --run src/__tests__/person-summary.test.ts`
Expected: FAIL — module `../person-summary` not found

- [ ] **Step 3: Implement person-summary.ts**

Create `packages/db/src/person-summary.ts` implementing:

- `rebuildAllSummaries(db)`: DELETE all, then INSERT using LEFT JOINs across persons, person_names (is_primary=1), events (birth/death), and COUNT subqueries for relationship counts. LEFT JOIN ensures persons without names get empty string defaults.

  **Important:** If the complex single-pass SQL with UNION/CROSS JOIN for counts doesn't work across SQLite/libsql, fall back to: delete all, then iterate all person IDs and call `refreshSummary` for each. This is slower but guaranteed to work.

- `refreshSummary(db, personId)`: DELETE + re-INSERT for one person. Uses simple individual queries for name, birth event, death event, spouse count, child count, parent count.

- `refreshRelatedSummaries(db, personId)`: Collect the set of personId + all spouses + all parents + all children, then call `refreshSummary` for each.

- [ ] **Step 4: Export from index.ts**

Add to `packages/db/src/index.ts`:

```typescript
export { rebuildAllSummaries, refreshSummary, refreshRelatedSummaries } from './person-summary';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/db && pnpm test -- --run src/__tests__/person-summary.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
git add packages/db/src/person-summary.ts packages/db/src/__tests__/person-summary.test.ts packages/db/src/index.ts
git commit -m "feat(db): person_summary with rebuildAll, refreshSummary, refreshRelatedSummaries"
```

---

## Task 5: WAL Mode + Backup

**Files:**
- Modify: `packages/db/src/index.ts` (add `initLocalPragmas`)
- Create: `packages/db/src/backup.ts`
- Create: `packages/db/src/__tests__/backup.test.ts`

- [ ] **Step 1: Write backup test file**

Create `packages/db/src/__tests__/backup.test.ts` with test cases:

1. `backupDatabase` creates a valid SQLite backup file (verify by opening with better-sqlite3 and querying)
2. `pruneBackups` keeps only N most recent backups
3. `restoreDatabase` restores from a backup successfully
4. `restoreDatabase` rejects non-SQLite files (check magic bytes)

Each test creates a temp directory, creates a test SQLite database, runs the operation, and cleans up in `afterEach`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/db && pnpm test -- --run src/__tests__/backup.test.ts`
Expected: FAIL — module `../backup` not found

- [ ] **Step 3: Implement backup.ts**

Create `packages/db/src/backup.ts` implementing:

- `backupDatabase(sourcePath, backupDir?)`: Uses `better-sqlite3`'s `.backup(destPath)` API (crash-safe). Default backupDir is `~/.ancstra/backups/`. Creates backup dir if needed. Names backup with timestamp suffix.
- `pruneBackups(backupDir, keep=7)`: Lists files matching `*.sqlite.*`, groups by base name, keeps N most recent per group, deletes the rest.
- `restoreDatabase(backupPath, targetPath)`: Validates SQLite magic bytes (`SQLite format 3\0`), then copies file.

Import `createLogger` from `@ancstra/shared` for logging.

- [ ] **Step 4: Add initLocalPragmas to index.ts**

Read `packages/db/src/index.ts`. Add after the `initFts5` function:

```typescript
export function initLocalPragmas(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  if (isWebMode(dbPath)) return;

  const BetterSqlite3 = require('better-sqlite3');
  const raw = new BetterSqlite3(dbPath);
  try {
    raw.pragma('journal_mode = WAL');
    raw.pragma('busy_timeout = 5000');
  } finally {
    raw.close();
  }
}
```

Also add export: `export { backupDatabase, pruneBackups, restoreDatabase } from './backup';`

- [ ] **Step 5: Run tests**

Run: `cd packages/db && pnpm test -- --run src/__tests__/backup.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```
git add packages/db/src/backup.ts packages/db/src/__tests__/backup.test.ts packages/db/src/index.ts
git commit -m "feat(db): WAL mode pragma + crash-safe backup/restore/prune"
```

---

## Task 6: API Route Integration

**Files:**
- Modify: `apps/web/app/api/families/[id]/children/route.ts`
- Modify: `apps/web/app/api/families/[id]/children/[personId]/route.ts`
- Create: `apps/web/app/api/tree/rebuild/route.ts`
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Update children POST route**

Read `apps/web/app/api/families/[id]/children/route.ts`. Add imports at the top:

```typescript
import { addChildToFamily, refreshRelatedSummaries } from '@ancstra/db';
```

After the `familyDb.insert(children)...run()` call (currently around line 69-70), add:

```typescript
    await addChildToFamily(familyDb, familyId, data.personId);
    await refreshRelatedSummaries(familyDb, data.personId);
```

- [ ] **Step 2: Update children DELETE route**

Read `apps/web/app/api/families/[id]/children/[personId]/route.ts`. Add imports:

```typescript
import { removeChildFromFamily, refreshRelatedSummaries } from '@ancstra/db';
```

After the `familyDb.delete(children)...run()` call (around line 25-27), add:

```typescript
    await removeChildFromFamily(familyDb, familyId, personId);
    await refreshRelatedSummaries(familyDb, personId);
```

- [ ] **Step 3: Create rebuild admin endpoint**

Create `apps/web/app/api/tree/rebuild/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { rebuildClosureTable, rebuildAllSummaries } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST() {
  try {
    const { familyDb } = await withAuth('settings:manage');
    await rebuildClosureTable(familyDb);
    await rebuildAllSummaries(familyDb);
    return NextResponse.json({ success: true, message: 'Closure table and summaries rebuilt' });
  } catch (error) {
    return handleAuthError(error);
  }
}
```

- [ ] **Step 4: Rewrite getTreeData() to use person_summary**

Read `apps/web/lib/queries.ts` lines 340-415. Replace the `getTreeData` function body to:
1. Query `SELECT person_id, given_name, surname, sex, is_living, birth_date, death_date FROM person_summary` (with deleted person filter)
2. Map columns to the existing `PersonListItem` shape
3. Keep the existing families and childLinks queries unchanged

This eliminates the JOIN with person_names and the N+1 birth/death event lookups.

- [ ] **Step 5: Update searchPersonsFts to JOIN person_summary**

In the same file, update the `searchPersonsFts` function to LEFT JOIN `person_summary` for birth_date and death_date instead of the current N+1 per-row event queries.

Replace the FTS5 query to add: `LEFT JOIN person_summary ps ON ps.person_id = p.id` and select `ps.birth_date as birthDate, ps.death_date as deathDate`.

Remove the `Promise.all(rows.map(async ...))` block that does per-row event queries.

- [ ] **Step 6: Verify existing tests still pass**

Run: `cd apps/web && pnpm test -- --run`
Expected: All existing tests PASS

- [ ] **Step 7: Commit**

```
git add apps/web/app/api/families/ apps/web/app/api/tree/ apps/web/lib/queries.ts
git commit -m "feat: integrate closure table + person_summary into API routes and queries"
```

---

## Task 7: Accessible Tree Table View

**Files:**
- Create: `apps/web/components/tree/tree-table.tsx`
- Create: `apps/web/components/tree/tree-table-wrapper.tsx`
- Modify: `apps/web/components/tree/tree-toolbar.tsx`
- Modify: `apps/web/app/(auth)/tree/page.tsx`

- [ ] **Step 1: Create tree-table.tsx**

Create `apps/web/components/tree/tree-table.tsx` — a client component implementing:

- Props: `treeData: TreeData`, `relationships: { parents, spouses }` maps, `onSelectPerson: (id) => void`
- State: `sortKey`, `sortDir`, `search` filter
- Columns: Name (default sort), Birth Date (sort by `birthDateSort`), Death Date (sort by `deathDateSort`), Birth Place, Sex (Badge), Parents (links), Spouses (links), Children (count)
- Sorting: click column header toggles ascending/descending
- Filtering: text input filters by given_name/surname
- Keyboard: `tabIndex={0}` on rows, Enter opens detail, `aria-label` on rows
- Accessibility: `role="table"`, `aria-sort` on sortable headers
- Uses shadcn/ui `Table`, `Badge`, `Input` components
- Empty state message when no persons

See the spec (Section 6) for the full column spec and interaction details.

- [ ] **Step 2: Create tree-table-wrapper.tsx**

Create `apps/web/components/tree/tree-table-wrapper.tsx` — a thin client wrapper:

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { TreeTable } from './tree-table';
// ... accepts treeData + relationships, passes onSelectPerson as router.push
```

- [ ] **Step 3: Add canvas/table toggle to TreeToolbar**

Read `apps/web/components/tree/tree-toolbar.tsx`. Add two new props to `TreeToolbarProps`:

```typescript
view: 'canvas' | 'table';
onToggleView: () => void;
```

Add a toggle button before `<TreeExport />` in the right-side button group.

- [ ] **Step 4: Update tree page to support ?view=table**

Read `apps/web/app/(auth)/tree/page.tsx`. Update:
1. Accept `view` from `searchParams` (alongside existing `focus`)
2. When `view === 'table'`: build relationship maps from treeData (parents/spouses), render `<TreeTableWrapper>`
3. Default: render `<TreeCanvas>` as before

The relationship data is derived from `treeData.families` and `treeData.childLinks` — no additional DB queries needed. Build a `fetchRelationships` helper that maps child links to parent names and family records to spouse names.

- [ ] **Step 5: Verify the pages render**

Run: `cd apps/web && pnpm dev`
Navigate to `/tree` (canvas works) and `/tree?view=table` (table renders).

- [ ] **Step 6: Commit**

```
git add apps/web/components/tree/tree-table.tsx apps/web/components/tree/tree-table-wrapper.tsx apps/web/components/tree/tree-toolbar.tsx "apps/web/app/(auth)/tree/page.tsx"
git commit -m "feat: accessible tree table view with sortable columns and keyboard nav"
```

---

## Task 8: Performance Baselines

**Files:**
- Create: `packages/db/src/__bench__/seed-bench.ts`
- Create: `packages/db/src/__bench__/closure-table.bench.ts`
- Create: `packages/db/src/__bench__/person-summary.bench.ts`
- Create: `packages/db/src/__bench__/fts5-search.bench.ts`
- Create: `apps/web/__bench__/tree-render.bench.ts`
- Modify: `packages/db/package.json` (add bench script)
- Modify: `apps/web/package.json` (add bench script)

- [ ] **Step 1: Create synthetic data generator**

Create `packages/db/src/__bench__/seed-bench.ts` implementing `generateTree(n: number)`:
- Creates an in-memory better-sqlite3 database with ALL table DDL (persons, person_names, families, children, events, ancestor_paths, person_summary)
- Generates N persons with realistic family structures: 2-5 children per family, multiple generations
- Uses randomized first/last names, birth years from 1700-2000
- Adds birth/death events for each person
- Returns the raw `better-sqlite3` Database instance

- [ ] **Step 2: Create closure table benchmark**

Create `packages/db/src/__bench__/closure-table.bench.ts`:
- For each scale point (100, 500, 1K, 5K persons): generate tree, rebuild closure table, then benchmark:
  - "find all ancestors (closure table)" — `SELECT FROM ancestor_paths WHERE descendant_id = ?`
  - "find all descendants (closure table)" — `SELECT FROM ancestor_paths WHERE ancestor_id = ?`
  - "find all ancestors (recursive CTE)" — `WITH RECURSIVE` query for comparison

- [ ] **Step 3: Create person summary benchmark**

Create `packages/db/src/__bench__/person-summary.bench.ts`:
- For each scale point: generate tree, rebuild summaries, then benchmark:
  - "load tree data (person_summary)" — `SELECT * FROM person_summary`
  - "load tree data (JOINs)" — the old multi-table JOIN approach

- [ ] **Step 4: Create FTS5 benchmark**

Create `packages/db/src/__bench__/fts5-search.bench.ts`:
- For 1K and 5K persons: generate tree, create FTS5 virtual table, rebuild index, then benchmark:
  - "search by prefix" — `persons_fts MATCH 'Joh*'`
  - "search by full name" — `persons_fts MATCH 'John* Smith*'`

- [ ] **Step 5: Create tree-render benchmark**

Create `apps/web/__bench__/tree-render.bench.ts`:
- Import `treeDataToFlow` from `../components/tree/tree-utils`
- Import `generateTree` from `@ancstra/db` bench utils (or duplicate the data generation inline)
- For 500, 1K, 5K nodes: generate tree data in the `PersonListItem[]` format, benchmark `treeDataToFlow()` transformation
- Pure JS benchmark — no DOM or React rendering

Also add `"bench": "vitest bench"` to `apps/web/package.json` scripts.

- [ ] **Step 6: Add bench script to packages/db/package.json**

Read `packages/db/package.json`. Add `"bench": "vitest bench"` to scripts.

- [ ] **Step 7: Run benchmarks**

Run: `cd packages/db && pnpm bench`
Expected: Benchmark results printed. Closure table queries should be under 5ms for 5K persons.

- [ ] **Step 8: Commit**

```
git add packages/db/src/__bench__/ packages/db/package.json apps/web/__bench__/ apps/web/package.json
git commit -m "perf(db): add benchmark suite for closure table, person_summary, FTS5, and tree render"
```

---

## Task 9: Pino Integration Points

**Files:**
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/backup.ts`
- Modify: `packages/db/src/closure-table.ts`

- [ ] **Step 1: Add logging to packages/db/src/index.ts**

Read the file. Add import at top:

```typescript
import { createLogger } from '@ancstra/shared';
const log = createLogger('db');
```

Replace `console.warn('FTS5 init skipped in web mode')` with `log.info('FTS5 init skipped in web mode')`.
Add `log.info('WAL mode and busy_timeout set')` at the end of `initLocalPragmas`.

- [ ] **Step 2: Add logging to backup.ts and closure-table.ts**

Read each file. Add `createLogger` import and logging:
- `backup.ts`: Log after backup created, after prune, after restore
- `closure-table.ts`: Log after rebuild complete (with person count if easy to get)

Use structured logging: `log.info({ backupPath }, 'backup created')` — no PII.

- [ ] **Step 3: Verify everything still compiles and tests pass**

Run: `cd packages/db && pnpm test -- --run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```
git add packages/db/src/index.ts packages/db/src/backup.ts packages/db/src/closure-table.ts
git commit -m "feat: integrate pino logging into db package"
```

---

## Implementation Notes

**Behavior change in getTreeData():** The old implementation uses `innerJoin` on `personNames`, excluding persons without a primary name from the tree. The new version reads from `person_summary` which uses LEFT JOIN — persons without names now appear with empty string names. This is intentional per spec.

**Startup orchestration (deferred):** The spec describes a startup sequence (initLocalPragmas → rebuildClosureTable → rebuildAllSummaries → auto-backup check) with skip-if-populated logic. This plan implements all the individual functions but does NOT wire them into an automatic startup hook. Reason: the app uses libsql in production (Turso), where initLocalPragmas and backup are no-ops. The rebuild functions can be triggered manually via `POST /api/tree/rebuild`. Wiring automatic startup orchestration should be done when the app's initialization flow is formalized (likely Phase 6 launch prep).

**Logging scope:** This plan adds pino logging to `packages/db` only. The spec also lists auth events, API errors, and GEDCOM import/export as logging targets — these are deferred to avoid touching many files. They can be added incrementally.

---

## Task 10: Final — Update ROADMAP + Verify

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Run all package tests**

Run: `cd packages/db && pnpm test -- --run`
Expected: All tests PASS (closure-table, person-summary, backup, plus existing tests)

- [ ] **Step 2: Update ROADMAP.md Phase 1 section**

Read `ROADMAP.md`. Mark the following items as `100% Complete`:
- Closure table + person_summary
- FTS5 full-text search engine (already done)
- SQLite WAL + backup
- Performance baselines (bench suite)
- Accessible tree list view
- pino structured logging

Update Phase 1 overall percentage to `100% Complete`.

- [ ] **Step 3: Commit**

```
git add ROADMAP.md
git commit -m "docs: mark Phase 1 as 100% complete"
```
