# Phase 1 Completion — Design Spec

> Date: 2026-03-23
> Status: Approved
> Scope: 6 remaining Phase 1 items to close out the foundation

## Overview

Phase 1 is ~90% complete. This spec covers the 6 remaining items needed to close the phase exit gate. FTS5 search was found to already be implemented during analysis — it is marked complete with no additional work.

## Items

1. Closure table (`ancestor_paths`) — pre-computed ancestor/descendant pairs
2. Person summary (`person_summary`) — denormalized display table
3. FTS5 search — already done (no work needed)
4. SQLite WAL + backup — local-mode crash safety and backup mechanism
5. Performance baselines — vitest bench suite
6. Accessible tree table view — keyboard-navigable table alternative to canvas
7. Pino structured logging — JSON logging with no PII

---

## 1. Closure Table (`ancestor_paths`)

### Schema

New table in `packages/db/src/family-schema.ts`:

```sql
CREATE TABLE ancestor_paths (
  ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_ap_descendant ON ancestor_paths(descendant_id, depth);
CREATE INDEX idx_ap_ancestor ON ancestor_paths(ancestor_id, depth);
```

Each row represents: "ancestor_id is an ancestor of descendant_id at distance depth." Self-referencing rows (depth=0) are included for query convenience.

### Maintenance Functions

Location: `packages/db/src/closure-table.ts`

#### `rebuildClosureTable(db: FamilyDatabase): Promise<void>`

Full rebuild from `families` + `children` tables:
1. Delete all rows from `ancestor_paths`
2. Insert self-referencing rows: `(person_id, person_id, 0)` for every non-deleted person
3. BFS from each root person (persons with no parents): walk children table, inserting `(ancestor, descendant, depth)` pairs at each level
4. Uses iterative BFS, not recursive CTE — better for full rebuilds

#### `addChildToFamily(db: FamilyDatabase, familyId: string, childId: string): Promise<void>`

Incremental insert when a child is linked to a family. Handles two-parent families:
1. Look up `partner1_id` and `partner2_id` from the family record
2. For each non-null parent:
   a. Find all ancestors of that parent (including self): `SELECT ancestor_id, depth FROM ancestor_paths WHERE descendant_id = ?`
   b. Find all descendants of `childId` (including self): `SELECT descendant_id, depth FROM ancestor_paths WHERE ancestor_id = ?`
   c. Insert cross-product: `(ancestor, descendant, ancestorDepth + descendantDepth + 1)` using `INSERT OR IGNORE`

#### `removeChildFromFamily(db: FamilyDatabase, familyId: string, childId: string): Promise<void>`

When a child is unlinked from a family, perform a targeted subtree rebuild rather than a naive delete. This correctly handles consanguinity (pedigree collapse) where a descendant may be reachable through multiple paths:
1. Collect all descendants of `childId` (including self)
2. Delete all `ancestor_paths` rows where `descendant_id` is in the descendant set (except self-references)
3. Re-walk from each descendant upward through `families`/`children` to re-insert any still-valid paths

This is O(subtree size), not O(full tree), so it remains fast for typical genealogy trees.

### Implementation Notes

All closure table functions use Drizzle's `sql` tagged template for raw queries (via `db.all(sql\`...\`)` and `db.run(sql\`...\`)`). This works with both local libsql and Turso — unlike `initFts5` which is local-only via `better-sqlite3`.

### Integration

- Call `addChildToFamily`/`removeChildFromFamily` from the children API routes (`POST /api/families/[id]/children`, `DELETE /api/families/[id]/children/[personId]`)
- Call `rebuildClosureTable` on app startup — **with a skip check**: if `SELECT COUNT(*) FROM ancestor_paths` returns > 0, skip the rebuild. Force rebuild via `POST /api/tree/rebuild` (requires `withAuth('family:admin')`)
- The AI tools (`analyzeTreeGaps`, `computeRelationship`) can query `ancestor_paths` directly instead of walking the tree in JS

---

## 2. Person Summary (`person_summary`)

### Schema

New table in `packages/db/src/family-schema.ts`:

```sql
CREATE TABLE person_summary (
  person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  given_name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL,
  is_living INTEGER NOT NULL,
  birth_date TEXT,
  death_date TEXT,
  birth_date_sort INTEGER,
  death_date_sort INTEGER,
  birth_place TEXT,
  death_place TEXT,
  spouse_count INTEGER NOT NULL DEFAULT 0,
  child_count INTEGER NOT NULL DEFAULT 0,
  parent_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
```

Note: `birth_date`/`death_date` store the display string (`date_original` from events). `birth_date_sort`/`death_date_sort` store the sortable integer (`date_sort` from events) for correct column sorting in the table view.

### Maintenance Functions

Location: `packages/db/src/person-summary.ts`

#### `rebuildAllSummaries(db: FamilyDatabase): Promise<void>`

Full rebuild in a single pass:
1. Delete all rows from `person_summary`
2. INSERT using LEFT JOINs across persons, personNames (where `is_primary = 1`), events (birth/death), and COUNT subqueries for spouse/child/parent counts
3. LEFT JOIN ensures persons without a primary name still get a summary row (with empty string defaults for given_name/surname)

#### `refreshSummary(db: FamilyDatabase, personId: string): Promise<void>`

Refresh one person's row. Called after any person, event, or name mutation.

#### `refreshRelatedSummaries(db: FamilyDatabase, personId: string): Promise<void>`

Refresh the target person plus all immediate family members (spouses, parents, children), since relationship counts change when links are modified.

### Usage

- `getTreeData()` in `apps/web/lib/queries.ts` switches from its current multi-table JOIN to: `SELECT * FROM person_summary WHERE person_id NOT IN (SELECT id FROM persons WHERE deleted_at IS NOT NULL)`
- The React Flow adapter (`treeDataToFlow`) reads person_summary rows directly
- Eliminates the N+1 birth/death event lookups in `getTreeData()`

### Staleness Policy

- Acceptable for display purposes (not authoritative — person table is source of truth)
- Startup: skip rebuild if `SELECT COUNT(*) FROM person_summary` returns > 0. Force rebuild via `POST /api/tree/rebuild`.
- Mutations trigger targeted `refreshSummary`/`refreshRelatedSummaries` in API routes
- No database triggers — handled in application code for libsql compatibility

---

## 3. FTS5 Search — Already Complete

`initFts5()` in `packages/db/src/index.ts` creates the `persons_fts` virtual table with insert/update/delete triggers on `person_names`. `searchPersonsFts()` in `apps/web/lib/queries.ts` performs BM25-ranked prefix search. The search API route and Cmd+K command palette are wired up. No additional work needed.

**Minor improvement**: `searchPersonsFts()` currently does N+1 queries for birth/death events per result. After person_summary is available, replace the per-row event lookups with a JOIN against `person_summary` for birth_date/death_date.

---

## 4. SQLite WAL + Backup

### WAL Mode

New function in `packages/db/src/index.ts`:

```typescript
export function initLocalPragmas(dbPath: string): void
```

- Only runs when `!isWebMode(dbPath)`
- Sets `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000`
- Called alongside `initFts5()` during app startup
- Uses `better-sqlite3` directly (same as `initFts5`)

### Backup

New file: `packages/db/src/backup.ts`

#### `backupDatabase(sourcePath: string, backupDir?: string): Promise<string>`

- Default backupDir: `~/.ancstra/backups/`
- Uses `better-sqlite3`'s `.backup(destPath)` API for crash-safe online backup (not file copy — a naive copy of WAL-mode databases is unsafe during active writes)
- Backup file named with timestamp suffix (e.g., `family-abc.sqlite.2026-03-23T14-30-00`)
- Returns the backup file path

#### `pruneBackups(backupDir: string, keep: number = 7): Promise<void>`

- Keep the N most recent backups per database file, delete older ones

#### `restoreDatabase(backupPath: string, targetPath: string): Promise<void>`

- Copies backup file back to target location
- Validates it's a valid SQLite file before overwriting (check magic bytes)

### Auto-Backup

- On app startup: check `~/.ancstra/backups/` for last backup timestamp. If older than 24h, trigger backup.
- On-demand: wire into the existing `/api/settings/backup` route

### Web/Turso Mode

Skip all local backup logic. Turso handles snapshots via its platform API (already integrated in Phase 6 worktree).

---

## 5. Performance Baselines

### Location

`packages/db/src/__bench__/` using vitest bench (`vitest bench`).

### Synthetic Data Generator

`packages/db/src/__bench__/seed-bench.ts`:
- `generateTree(n: number)` — creates N persons with realistic family structures
- 2-5 children per family, 3-8 generations
- Realistic name distribution, date ranges (1700-2000)
- Returns an in-memory SQLite database (better-sqlite3)

### Benchmark Files

#### `closure-table.bench.ts`
- "Find all ancestors of person X" — closure table SELECT vs recursive CTE
- "Find all descendants of person X" — same comparison
- "Find path between two persons" — closure table vs BFS
- Scale points: 100, 500, 1K, 5K persons
- Target: all queries under 5ms for 5K persons

#### `person-summary.bench.ts`
- "Load tree data (old)" — current `getTreeData()` with JOINs
- "Load tree data (new)" — `SELECT * FROM person_summary`
- Scale points: 100, 500, 1K, 5K persons

#### `fts5-search.bench.ts`
- "Search by name prefix" — FTS5 MATCH query
- "Search by full name" — FTS5 MATCH query
- Scale points: 1K, 5K persons

#### `tree-render.bench.ts`
- Location: `apps/web/__bench__/tree-render.bench.ts` (not in `packages/db`, since `treeDataToFlow` lives in `apps/web`)
- "Transform to React Flow nodes/edges" — `treeDataToFlow()` at 500, 1K, 5K nodes
- Pure JS benchmark (no DOM)

### CI Integration

- Add `"bench": "vitest bench"` to `packages/db/package.json` and `apps/web/package.json`
- Not CI-blocking (benchmarks are informational)
- Results logged to console

---

## 6. Accessible Tree Table View

### Route

`/tree?view=table` — same page, query param toggle. A button in the existing tree toolbar switches between `canvas` (default) and `table` views.

### Component

`apps/web/components/tree/tree-table.tsx`

#### Columns

| Column | Source | Sortable | Notes |
|--------|--------|----------|-------|
| Name | `given_name`, `surname` | Yes (default sort) | Link to detail panel |
| Birth Date | `birth_date` | Yes (sorts by `birth_date_sort`) | Display string |
| Death Date | `death_date` | Yes (sorts by `death_date_sort`) | Display string |
| Birth Place | `birth_place` | Yes | — |
| Sex | `sex` | Yes | M/F/U badge |
| Parents | derived | No | Comma-separated names, each a link |
| Spouses | derived | No | Comma-separated names, each a link |
| Children | `child_count` | Yes | Numeric count |

#### Data Source

- Primary: `person_summary` table (fast, no JOINs for most columns)
- Parents/Spouses columns: requires a secondary query since person_summary only stores counts. Two options:
  - (A) Add parent/spouse name fields to person_summary — denormalize further
  - (B) Fetch relationship names separately on page load
- **Choice: B** — keep person_summary lean. Fetch relationship data from families/children tables in a single query on page load. The table view loads all data upfront anyway.

#### Interaction

- Row click opens the same slide-out detail panel used by the canvas view
- Search filter at top: input field that calls `searchPersonsFts()`, filters visible rows
- Column header click sorts (ascending/descending toggle)
- Keyboard: Tab through rows, Enter to open detail, arrow keys for column header sorting

#### Accessibility

- `role="table"` on table (not `role="grid"` — grid requires full 2D cell navigation which is overkill for row-based interaction)
- `aria-sort="ascending|descending|none"` on sortable column headers
- `aria-label` on rows: "John Smith, born 1845, died 1920"
- Focus management: focus moves to detail panel on Enter, returns to row on Escape
- Screen reader announcement on sort change

#### UI

- Uses shadcn/ui `<Table>` component (already installed)
- No pagination — full load from person_summary. Virtual scrolling deferred unless trees exceed 5K.
- Empty state: "No persons in this tree yet. Add your first person to get started."

---

## 7. Pino Structured Logging

### Setup

New file: `packages/shared/src/logger.ts`

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

### Dependencies

- Add `pino` to `packages/shared/package.json` dependencies
- Add `pino-pretty` to `packages/shared/package.json` devDependencies

### Integration Points

Targeted replacement of `console.log`/`console.error` calls — not a full codebase retrofit:

| Location | Events Logged |
|----------|---------------|
| `packages/db/src/index.ts` | FTS5 init, WAL mode set, closure table rebuild |
| `packages/db/src/backup.ts` | Backup created, pruned, restored |
| `apps/web/lib/queries.ts` | (none — too hot-path) |
| `apps/web/app/api/*` | Error responses (status >= 500) |
| `apps/web/lib/gedcom/` | Import/export: person count, timing |
| `packages/auth/` | Login, signup, invitation accepted (user ID only) |

### No PII Rule

- Log person IDs, never names
- Log counts, never content
- Log user IDs for auth events, never email addresses

---

## Migration Strategy

Single Drizzle migration covering both new tables (`ancestor_paths`, `person_summary`). On first app startup after migration:
1. Run migration (Drizzle Kit)
2. `initLocalPragmas()` — WAL mode
3. `rebuildClosureTable()` — populate ancestor_paths (skipped if already populated)
4. `rebuildAllSummaries()` — populate person_summary (skipped if already populated)
5. Auto-backup check

For existing deployments (Turso): migration adds the tables, rebuild functions populate them via the API.

---

## Files Changed / Created

### New Files
- `packages/db/src/closure-table.ts`
- `packages/db/src/person-summary.ts`
- `packages/db/src/backup.ts`
- `packages/db/src/__bench__/seed-bench.ts`
- `packages/db/src/__bench__/closure-table.bench.ts`
- `packages/db/src/__bench__/person-summary.bench.ts`
- `packages/db/src/__bench__/fts5-search.bench.ts`
- `apps/web/__bench__/tree-render.bench.ts`
- `packages/shared/src/logger.ts`
- `apps/web/components/tree/tree-table.tsx`
- `apps/web/app/api/tree/rebuild/route.ts`

### Modified Files
- `packages/db/src/family-schema.ts` — add `ancestorPaths`, `personSummary` table definitions
- `packages/db/src/index.ts` — add `initLocalPragmas()`, call on startup
- `apps/web/lib/queries.ts` — `getTreeData()` reads from `person_summary`
- `apps/web/components/tree/tree-toolbar.tsx` — add canvas/table toggle button
- `apps/web/app/(auth)/tree/page.tsx` — render tree-table when `?view=table`
- `apps/web/lib/queries.ts` — `searchPersonsFts()` uses person_summary for birth/death dates (eliminates N+1)
- `apps/web/app/api/families/[id]/children/route.ts` — call `addChildToFamily` after child link
- `apps/web/app/api/families/[id]/children/[personId]/route.ts` — call `removeChildFromFamily` after child unlink
- `apps/web/package.json` — add bench script
- `packages/shared/package.json` — add pino dependencies
- `packages/db/package.json` — add bench script

### Test Files
- `packages/db/src/__tests__/closure-table.test.ts`
- `packages/db/src/__tests__/person-summary.test.ts`
- `packages/db/src/__tests__/backup.test.ts`
