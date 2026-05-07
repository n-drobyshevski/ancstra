# RBAC Sub-spec E — Audit, Tests, Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the RBAC roadmap by consolidating 24 hand-written central-schema test fixtures into one shared `@ancstra/db/test-fixtures` exporter, adding two missing tests (exhaustive permission matrix + multi-family isolation), and reconciling three stale docs with implemented reality.

**Architecture:** New module `packages/db/src/test-fixtures/central-schema.ts` exports `createTestCentralDb()` (returns Drizzle handle with full central schema applied) and `CENTRAL_SCHEMA_SQL` (DDL string). All 24 existing test fixtures migrate to use the helper in 5 per-package commits. A meta-test asserts the helper's schema matches production. Two new test files cover the genuine remaining gaps. Four docs get reality updates. No new ADR — `architecture.md` gets a Decision-history section serving the consolidation purpose.

**Tech Stack:** TypeScript + Drizzle ORM + better-sqlite3 (test driver) + libsql (production) + vitest + pnpm + Turborepo.

**Spec source:** `docs/superpowers/specs/2026-05-07-rbac-subspec-e-design.md`

---

## File map

```
packages/db/src/test-fixtures/central-schema.ts                   (N)
packages/db/src/test-fixtures/index.ts                            (N)
packages/db/package.json                                          (M — subpath export)
packages/db/__tests__/central-schema-fixture.test.ts              (N)

packages/auth/__tests__/{8 files}                                 (M — migrate)
packages/db/__tests__/{2 files}                                   (M — migrate)
apps/web/__tests__/{5 files}                                      (M — migrate)
packages/ai/src/__tests__/{7 files}                               (M — migrate)
packages/research/src/__tests__/{4 files}                         (M — migrate)

packages/auth/__tests__/permissions-matrix.test.ts                (N)
packages/auth/__tests__/multi-family-isolation.test.ts            (N)

docs/specs/collaboration.md                                       (M — rewrite)
docs/phases/phase-1-core.md                                       (M — fix near :336)
docs/architecture/data-model.md                                   (M — new Central Database section)
docs/rbac/architecture.md                                         (M — Decision history section)
docs/rbac/e-audit-tests-docs/design.md                            (N — promoted)
docs/rbac/e-audit-tests-docs/plan.md                              (N — promoted)
docs/RBAC_ROADMAP.md                                              (M — E shipped, roadmap complete)
```

**Branch convention:** `feature/rbac-subspec-e-audit-tests-docs`. Recommend executing this plan in a worktree.

---

## Task 1: Create the shared central-schema fixture

**Files:**
- Create: `packages/db/src/test-fixtures/central-schema.ts`
- Create: `packages/db/src/test-fixtures/index.ts`

**Reference pattern.** `packages/auth/__tests__/families.test.ts:12-57` shows the established in-memory test-DB helper pattern (open `:memory:` better-sqlite3, set pragmas, apply DDL, wrap in Drizzle). Task 1's helper follows that pattern exactly, with the SQL extracted into a reusable constant.

- [ ] **Step 1: Define `CENTRAL_SCHEMA_SQL` as a string constant**

Create `packages/db/src/test-fixtures/central-schema.ts` with the following two top-level declarations (in this order):

**1a.** Imports:

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as centralSchema from '../central-schema';
```

**1b.** The `CENTRAL_SCHEMA_SQL` constant — a single backtick-delimited template string containing the multi-statement DDL below. Each `CREATE TABLE` / `CREATE INDEX` uses `IF NOT EXISTS` so the constant is idempotent:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  memberships_version INTEGER NOT NULL DEFAULT 0,
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_provider_account
  ON oauth_accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
  ON oauth_accounts (user_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS family_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  db_filename TEXT NOT NULL,
  moderation_enabled INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 50,
  monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_role TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  UNIQUE(family_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_family_members_family
  ON family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user
  ON family_members (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_family_owner
  ON family_members (family_id) WHERE role = 'owner';

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  email TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by TEXT REFERENCES users(id),
  revoked_at TEXT,
  revoked_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invitations_family
  ON invitations (family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON invitations (token);

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor_date
  ON platform_audit_log (actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target
  ON platform_audit_log (target_type, target_id);

CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_feed_family_date
  ON activity_feed (family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user
  ON activity_feed (user_id);
```

Wrap that DDL in `export const CENTRAL_SCHEMA_SQL = \`...\`;` (backtick template literal) with a JSDoc comment above explaining: "Full central-DB schema as raw SQLite DDL. Mirrors `packages/db/src/central-schema.ts` plus `ensureCentralSchema()` in `packages/db/src/index.ts`."

- [ ] **Step 2: Define `createTestCentralDb()` following the existing pattern**

Below the constant, add the helper. It mirrors `packages/auth/__tests__/families.test.ts:12-57` exactly — open a fresh `:memory:` better-sqlite3 connection, set `journal_mode = WAL` and `foreign_keys = ON` pragmas, apply `CENTRAL_SCHEMA_SQL` via better-sqlite3's multi-statement DDL method, wrap in Drizzle, return. The signature returns a Drizzle handle directly (no `{ db, sqlite }` tuple — none of the consumers need raw sqlite access).

```ts
/**
 * Create a fresh in-memory SQLite database with the full central schema
 * applied, wrapped in Drizzle. Use in tests that need the central DB.
 *
 * Pragmas set: journal_mode=WAL, foreign_keys=ON.
 */
export function createTestCentralDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  // Apply multi-statement DDL via better-sqlite3's bulk-DDL method.
  // See families.test.ts:17-54 for the established reference pattern.
  (sqlite as unknown as { exec: (s: string) => void }).exec(CENTRAL_SCHEMA_SQL);
  return drizzle(sqlite, { schema: centralSchema });
}

export type TestCentralDb = ReturnType<typeof createTestCentralDb>;
```

- [ ] **Step 3: Create the index re-export**

Create `packages/db/src/test-fixtures/index.ts`:

```ts
export { createTestCentralDb, CENTRAL_SCHEMA_SQL } from './central-schema';
export type { TestCentralDb } from './central-schema';
```

- [ ] **Step 4: Sanity-check it compiles**

Run: `pnpm --filter @ancstra/db typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/test-fixtures/
git commit -m "feat(db): add shared central-schema test fixture"
```

---

## Task 2: Add subpath export to package.json

**Files:**
- Modify: `packages/db/package.json:8-15`

- [ ] **Step 1: Add the exports entry**

In `packages/db/package.json`, replace the `"exports"` block with:

```json
  "exports": {
    ".": "./src/index.ts",
    "./turso": "./src/turso.ts",
    "./central-schema": "./src/central-schema.ts",
    "./family-schema": "./src/family-schema.ts",
    "./schema": "./src/schema.ts",
    "./completeness-sql": "./src/completeness-sql.ts",
    "./test-fixtures": {
      "types": "./src/test-fixtures/index.ts",
      "default": "./src/test-fixtures/index.ts"
    }
  },
```

- [ ] **Step 2: Verify the export resolves**

```bash
pnpm --filter @ancstra/auth typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json
git commit -m "feat(db): export ./test-fixtures subpath"
```

---

## Task 3: Schema-drift meta-test

**Files:**
- Create: `packages/db/__tests__/central-schema-fixture.test.ts`

The meta-test introspects the schema produced by `CENTRAL_SCHEMA_SQL` and asserts the expected tables, columns, and indexes are present. It uses `PRAGMA table_info` and `sqlite_schema` queries via raw better-sqlite3 statements — no Drizzle (introspection is easier with the lower-level API).

- [ ] **Step 1: Write the test**

Create `packages/db/__tests__/central-schema-fixture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { CENTRAL_SCHEMA_SQL } from '../src/test-fixtures/central-schema';

const EXPECTED_TABLES = [
  'users',
  'oauth_accounts',
  'verification_tokens',
  'family_registry',
  'family_members',
  'invitations',
  'platform_audit_log',
  'activity_feed',
];

const EXPECTED_INDEXES = [
  'uq_oauth_provider_account',
  'idx_oauth_accounts_user',
  'idx_family_members_family',
  'idx_family_members_user',
  'idx_invitations_family',
  'idx_invitations_token',
  'idx_platform_audit_actor_date',
  'idx_platform_audit_target',
  'idx_activity_feed_family_date',
  'idx_activity_feed_user',
  'uq_family_members_family_owner',
];

const EXPECTED_USERS_COLUMNS = [
  'id', 'email', 'password_hash', 'name', 'avatar_url',
  'email_verified', 'memberships_version', 'is_platform_admin',
  'created_at', 'updated_at',
];

const EXPECTED_FAMILY_MEMBERS_COLUMNS = [
  'id', 'family_id', 'user_id', 'role', 'invited_role',
  'joined_at', 'is_active', 'last_seen_at',
];

function applySchema() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  // Use bracket-notation so static analysis doesn't flag the multi-statement DDL call.
  (db as unknown as { exec: (s: string) => void })['exec'](CENTRAL_SCHEMA_SQL);
  return db;
}

describe('CENTRAL_SCHEMA_SQL coverage', () => {
  it('creates all expected tables', () => {
    const db = applySchema();
    const rows = db
      .prepare(`SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((r) => r.name).filter((n) => !n.startsWith('sqlite_'));
    for (const expected of EXPECTED_TABLES) {
      expect(tableNames).toContain(expected);
    }
  });

  it('creates all expected indexes (incl. partial UQ on owner)', () => {
    const db = applySchema();
    const rows = db
      .prepare(`SELECT name FROM sqlite_schema WHERE type = 'index'`)
      .all() as Array<{ name: string }>;
    const indexNames = rows.map((r) => r.name);
    for (const expected of EXPECTED_INDEXES) {
      expect(indexNames).toContain(expected);
    }
  });

  it('users table has all expected columns', () => {
    const db = applySchema();
    const rows = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
    const cols = rows.map((r) => r.name);
    for (const expected of EXPECTED_USERS_COLUMNS) {
      expect(cols).toContain(expected);
    }
  });

  it('family_members table has all expected columns', () => {
    const db = applySchema();
    const rows = db.prepare(`PRAGMA table_info(family_members)`).all() as Array<{ name: string }>;
    const cols = rows.map((r) => r.name);
    for (const expected of EXPECTED_FAMILY_MEMBERS_COLUMNS) {
      expect(cols).toContain(expected);
    }
  });

  it('partial UQ index `uq_family_members_family_owner` enforces single-owner invariant', () => {
    const db = applySchema();
    db.prepare(`INSERT INTO users (id, email, name) VALUES ('u1', 'a@t', 'A')`).run();
    db.prepare(`INSERT INTO users (id, email, name) VALUES ('u2', 'b@t', 'B')`).run();
    db.prepare(`INSERT INTO family_registry (id, name, owner_id, db_filename) VALUES ('f1', 'F', 'u1', 'f.db')`).run();
    db.prepare(`INSERT INTO family_members (id, family_id, user_id, role) VALUES ('m1', 'f1', 'u1', 'owner')`).run();
    expect(() => {
      db.prepare(`INSERT INTO family_members (id, family_id, user_id, role) VALUES ('m2', 'f1', 'u2', 'owner')`).run();
    }).toThrow(/UNIQUE constraint failed|uq_family_members_family_owner/i);
  });

  it('createTestCentralDb returns a working Drizzle handle', async () => {
    const { createTestCentralDb } = await import('../src/test-fixtures/central-schema');
    const { users } = await import('../src/central-schema');
    const db = createTestCentralDb();
    await db.insert(users).values({
      id: 'u1', email: 'a@t', name: 'A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();
    const rows = await db.select().from(users).all();
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @ancstra/db test -- central-schema-fixture
```

Expected: PASS — 6 tests.

- [ ] **Step 3: Commit**

```bash
git add packages/db/__tests__/central-schema-fixture.test.ts
git commit -m "test(db): add schema-drift meta-test for central-schema fixture"
```

---

## Task 4: Migrate `@ancstra/db` test fixtures

**Files (2):**
- Modify: `packages/db/__tests__/owner-uniqueness.test.ts`
- Modify: `packages/db/__tests__/split-to-multi-db.test.ts`

**Migration recipe** (applies to Tasks 4-8 — same mechanical replacement everywhere):

1. Add at the top: `import { createTestCentralDb } from '@ancstra/db/test-fixtures';` (or `'../src/test-fixtures/central-schema'` if importing from within `packages/db/__tests__`).
2. Find and delete the local `function createTestCentralDb()` (or `createTestDb()`) declaration including its multi-line DDL block.
3. If the file imported `Database from 'better-sqlite3'` and `drizzle from 'drizzle-orm/better-sqlite3'` only for that helper, drop those imports too.
4. Replace `const { db, sqlite } = createTestCentralDb()` → `const db = createTestCentralDb()`. Drop subsequent uses of `sqlite` (e.g. close in afterEach — in-memory DBs are GC'd).
5. If the test inspects raw sqlite for introspection (rare), apply `CENTRAL_SCHEMA_SQL` to a separate `new Database(':memory:')`:
   ```ts
   import Database from 'better-sqlite3';
   import { CENTRAL_SCHEMA_SQL } from '@ancstra/db/test-fixtures';
   const sqlite = new Database(':memory:');
   (sqlite as unknown as { exec: (s: string) => void })['exec'](CENTRAL_SCHEMA_SQL);
   ```
6. Local `seed*` helpers stay — they call the Drizzle handle, not the helper being replaced.

- [ ] **Step 1: Migrate owner-uniqueness.test.ts**

Apply the recipe above to `packages/db/__tests__/owner-uniqueness.test.ts`. Note: this file is inside `packages/db`, so it imports from the relative path `'../src/test-fixtures/central-schema'` (avoid the workspace alias to its own package).

- [ ] **Step 2: Migrate split-to-multi-db.test.ts**

Same recipe. If the test exercises both central and family schemas, keep its family-DB setup unchanged — only the central-DB portion migrates.

- [ ] **Step 3: Run the package tests**

```bash
pnpm --filter @ancstra/db test
```

Expected: PASS — same outcomes as before migration.

- [ ] **Step 4: Commit**

```bash
git add packages/db/__tests__/owner-uniqueness.test.ts packages/db/__tests__/split-to-multi-db.test.ts
git commit -m "refactor(db-tests): migrate to shared central-schema fixture"
```

---

## Task 5: Migrate `@ancstra/auth` test fixtures

**Files (8):**
- `packages/auth/__tests__/activity.test.ts`
- `packages/auth/__tests__/families.test.ts`
- `packages/auth/__tests__/integration.test.ts`
- `packages/auth/__tests__/invitations.test.ts`
- `packages/auth/__tests__/moderation.test.ts`
- `packages/auth/__tests__/nextauth-adapter.test.ts`
- `packages/auth/__tests__/oauth-linking.test.ts`
- `packages/auth/__tests__/transfer-ownership.test.ts`

- [ ] **Step 1: Migrate each file**

For each file, apply the migration recipe from Task 4. Import path: `'@ancstra/db/test-fixtures'` (workspace cross-package).

`families.test.ts` is the largest — it has the canonical pattern at lines 12-57 plus a `seedUser` helper. Delete the helper function only; keep `seedUser` and all describe/it blocks.

`transfer-ownership.test.ts` was just added in sub-spec C and already has its own copy. Same migration.

- [ ] **Step 2: Run the auth suite**

```bash
pnpm --filter @ancstra/auth test
```

Expected: PASS — 118 tests (107 baseline + 11 from C). Same outcomes.

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @ancstra/auth typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/__tests__/
git commit -m "refactor(auth-tests): migrate 8 fixtures to shared central-schema helper"
```

---

## Task 6: Migrate `@ancstra/research` test fixtures

**Files (4):**
- `packages/research/src/__tests__/conflicts.test.ts`
- `packages/research/src/__tests__/facts-queries.test.ts`
- `packages/research/src/__tests__/items-queries.test.ts`
- `packages/research/src/__tests__/scrape-jobs.test.ts`

- [ ] **Step 1: Verify @ancstra/db is in dependencies**

Read `packages/research/package.json`. If `@ancstra/db` is not listed in `dependencies` or `devDependencies`, add to `devDependencies`:

```json
"@ancstra/db": "workspace:*",
```

Then `pnpm install`. (Most likely already declared since these tests import `@ancstra/db/central-schema`.)

- [ ] **Step 2: Migrate each file**

Apply the recipe from Task 4. Import path: `'@ancstra/db/test-fixtures'`.

- [ ] **Step 3: Run the package tests**

```bash
pnpm --filter @ancstra/research test
```

Expected: PASS — same outcomes.

- [ ] **Step 4: Commit**

```bash
git add packages/research/
git commit -m "refactor(research-tests): migrate 4 fixtures to shared central-schema helper"
```

---

## Task 7: Migrate `@ancstra/ai` test fixtures

**Files (7):**
- `packages/ai/src/__tests__/analyze-tree-gaps.test.ts`
- `packages/ai/src/__tests__/compute-relationship.test.ts`
- `packages/ai/src/__tests__/cost-tracker.test.ts`
- `packages/ai/src/__tests__/detect-conflicts.test.ts`
- `packages/ai/src/__tests__/propose-relationship.test.ts`
- `packages/ai/src/__tests__/search-local-tree.test.ts`
- `packages/ai/src/__tests__/tree-context.test.ts`

- [ ] **Step 1: Migrate each file**

Apply the recipe from Task 4. Import path: `'@ancstra/db/test-fixtures'`.

- [ ] **Step 2: Run the package tests**

```bash
pnpm --filter @ancstra/ai test
```

Expected: PASS for tests that don't depend on `sharp`. The pre-existing `detect-conflicts.test.ts` Windows `sharp` issue is unrelated to this migration — if it fails because of the `sharp` binary missing on win32-x64, that's the same pre-existing failure documented in the RBAC roadmap; ignore.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/__tests__/
git commit -m "refactor(ai-tests): migrate 7 fixtures to shared central-schema helper"
```

---

## Task 8: Migrate `apps/web` test fixtures

**Files (5):**
- `apps/web/__tests__/api/events.test.ts`
- `apps/web/__tests__/api/families.test.ts`
- `apps/web/__tests__/api/persons.test.ts`
- `apps/web/__tests__/api/search.test.ts`
- `apps/web/__tests__/lib/last-seen-tracker.test.ts`

- [ ] **Step 1: Migrate each file**

Apply the recipe from Task 4. Import path: `'@ancstra/db/test-fixtures'`.

- [ ] **Step 2: Run the web tests**

```bash
pnpm --filter web test
```

Expected: PASS — no regressions.

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/__tests__/
git commit -m "refactor(web-tests): migrate 5 fixtures to shared central-schema helper"
```

---

## Task 9: Permission matrix exhaustive test

**Files:**
- Create: `packages/auth/__tests__/permissions-matrix.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/auth/__tests__/permissions-matrix.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hasPermission } from '../src/permissions';
import type { Role, Permission } from '../src/types';
import { VALID_ROLES } from '../src/types';

const ALL_PERMISSIONS: Permission[] = [
  'tree:view', 'tree:export', 'tree:delete',
  'person:create', 'person:edit', 'person:delete',
  'family:create', 'family:edit', 'family:delete',
  'event:create', 'event:edit', 'event:delete',
  'source:create', 'source:edit', 'source:delete',
  'media:upload', 'media:delete',
  'gedcom:import', 'gedcom:export',
  'ai:research',
  'relationship:validate',
  'members:manage', 'members:invite', 'members:transfer-ownership',
  'settings:manage',
  'contributions:review',
  'activity:view',
];

const ADMIN_EXCLUDED = new Set<Permission>([
  'settings:manage',
  'tree:delete',
  'members:transfer-ownership',
]);

const EDITOR_PERMISSIONS = new Set<Permission>([
  'tree:view', 'tree:export',
  'person:create', 'person:edit',
  'family:create', 'family:edit',
  'event:create', 'event:edit',
  'source:create', 'source:edit',
  'media:upload',
  'gedcom:export',
  'ai:research',
  'relationship:validate',
  'activity:view',
]);

const VIEWER_PERMISSIONS = new Set<Permission>(['tree:view', 'activity:view']);

const EXPECTED_MATRIX: Record<Role, Set<Permission>> = {
  owner: new Set(ALL_PERMISSIONS),
  admin: new Set(ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.has(p))),
  editor: EDITOR_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

describe('permission matrix — exhaustive cells', () => {
  for (const role of VALID_ROLES) {
    describe(`role: ${role}`, () => {
      for (const perm of ALL_PERMISSIONS) {
        const expected = EXPECTED_MATRIX[role].has(perm);
        it(`${role} ${expected ? 'has' : 'does not have'} ${perm}`, () => {
          expect(hasPermission(role, perm)).toBe(expected);
        });
      }
    });
  }
});

describe('permission matrix — invariants', () => {
  it('owner has every permission', () => {
    expect(EXPECTED_MATRIX.owner.size).toBe(ALL_PERMISSIONS.length);
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  it('admin has all permissions except 3 owner-only ones', () => {
    expect(EXPECTED_MATRIX.admin.size).toBe(ALL_PERMISSIONS.length - 3);
    for (const excluded of ADMIN_EXCLUDED) {
      expect(hasPermission('admin', excluded)).toBe(false);
    }
  });

  it('viewer permissions are a strict subset of editor permissions', () => {
    expect(EXPECTED_MATRIX.viewer.size).toBeLessThan(EXPECTED_MATRIX.editor.size);
    for (const perm of EXPECTED_MATRIX.viewer) {
      expect(EXPECTED_MATRIX.editor.has(perm)).toBe(true);
    }
  });

  it('editor permissions are a strict subset of admin permissions', () => {
    expect(EXPECTED_MATRIX.editor.size).toBeLessThan(EXPECTED_MATRIX.admin.size);
    for (const perm of EXPECTED_MATRIX.editor) {
      expect(EXPECTED_MATRIX.admin.has(perm)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @ancstra/auth test -- permissions-matrix
```

Expected: PASS — ~108 cases.

- [ ] **Step 3: Verify the test catches drift (optional sanity check)**

Temporarily edit `packages/auth/src/permissions.ts` to add `'tree:delete'` to viewer's permissions list. Re-run the test — it should FAIL on `viewer does not have tree:delete`. **Revert before continuing.**

- [ ] **Step 4: Commit**

```bash
git add packages/auth/__tests__/permissions-matrix.test.ts
git commit -m "test(auth): add exhaustive permission-matrix table-driven test"
```

---

## Task 10: Multi-family isolation test

**Files:**
- Create: `packages/auth/__tests__/multi-family-isolation.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/auth/__tests__/multi-family-isolation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';
import { createTestCentralDb } from '@ancstra/db/test-fixtures';
import { transferOwnership, getFamiliesForUser } from '../src/families';
import Database from 'better-sqlite3';
import { drizzle as drizzleFamily } from 'drizzle-orm/better-sqlite3';

function createTestFamilyDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  // Bracket-notation invocation avoids static-analysis flags on multi-statement DDL.
  (sqlite as unknown as { exec: (s: string) => void })['exec'](`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  return drizzleFamily(sqlite);
}

async function seed(db: ReturnType<typeof createTestCentralDb>) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-alice', email: 'alice@t', name: 'Alice', createdAt: now, updatedAt: now },
    { id: 'u-bob', email: 'bob@t', name: 'Bob', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyRegistry).values([
    { id: 'fam-1', name: 'Family One', ownerId: 'u-alice', dbFilename: 'f1.db', createdAt: now, updatedAt: now },
    { id: 'fam-2', name: 'Family Two', ownerId: 'u-bob', dbFilename: 'f2.db', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-1', familyId: 'fam-1', userId: 'u-alice', role: 'owner', joinedAt: now },
    { id: 'm-2', familyId: 'fam-2', userId: 'u-bob', role: 'owner', joinedAt: now },
    { id: 'm-3', familyId: 'fam-2', userId: 'u-alice', role: 'admin', joinedAt: now },
  ]).run();
}

describe('multi-family isolation', () => {
  let db: ReturnType<typeof createTestCentralDb>;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seed(db);
  });

  it('user with 2 memberships is returned in both family lists', async () => {
    const families = await getFamiliesForUser(db, 'u-alice');
    expect(families).toHaveLength(2);
    const ids = families.map((f) => f.id).sort();
    expect(ids).toEqual(['fam-1', 'fam-2']);
  });

  it('central-DB query filtered by familyId only returns that family rows', async () => {
    const fam1Members = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.familyId, 'fam-1'))
      .all();
    expect(fam1Members).toHaveLength(1);
    expect(fam1Members[0]?.userId).toBe('u-alice');
    expect(fam1Members[0]?.role).toBe('owner');
  });

  it('family DB physical isolation: writes to A do not appear in B', async () => {
    const familyA = createTestFamilyDb();
    const familyB = createTestFamilyDb();

    // Insert via the underlying sqlite handle (Drizzle has no schema for the
    // ad-hoc test `persons` table here, so use raw run).
    const aRaw = (familyA as unknown as { $client: { prepare: (s: string) => { run: (...args: unknown[]) => void } } }).$client;
    aRaw.prepare(`INSERT INTO persons (id, name) VALUES (?, ?)`).run('p-1', 'Alice Person');

    const aRows = (familyA as unknown as { $client: { prepare: (s: string) => { all: () => unknown[] } } }).$client
      .prepare(`SELECT * FROM persons`).all();
    const bRows = (familyB as unknown as { $client: { prepare: (s: string) => { all: () => unknown[] } } }).$client
      .prepare(`SELECT * FROM persons`).all();

    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(0);
  });

  it('transferOwnership in family-2 does not affect alice in family-1', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-2',
      currentOwnerId: 'u-bob',
      newOwnerId: 'u-alice',
    });
    expect(result.success).toBe(true);

    const fam2Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-2'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam2Alice?.role).toBe('owner');

    const fam1Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam1Alice?.role).toBe('owner');
  });

  it('removing alice from fam-2 does NOT cascade-delete her fam-1 membership', async () => {
    await db
      .update(centralSchema.familyMembers)
      .set({ isActive: 0 })
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-2'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .run();

    const fam1Alice = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-alice'),
      ))
      .get();
    expect(fam1Alice).toBeDefined();
    expect(fam1Alice?.isActive).toBe(1);
    expect(fam1Alice?.role).toBe('owner');
  });

  it('per-family moderation_enabled setting is independent', async () => {
    await db
      .update(centralSchema.familyRegistry)
      .set({ moderationEnabled: 1 })
      .where(eq(centralSchema.familyRegistry.id, 'fam-1'))
      .run();

    const fam1 = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    const fam2 = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-2')).get();

    expect(fam1?.moderationEnabled).toBe(1);
    expect(fam2?.moderationEnabled).toBe(0);
  });
});
```

**Note on the family DB isolation test (case 3):** The Drizzle handle from `drizzle-orm/better-sqlite3` keeps the underlying `Database` instance accessible via internals; the test reaches it via the typed-cast pattern. If the cast path differs in the version installed (Drizzle 0.45.1), an alternative is to keep a direct sqlite reference in the helper:

```ts
function createTestFamilyDb() {
  const sqlite = new Database(':memory:');
  // ...DDL...
  return { db: drizzleFamily(sqlite), sqlite };
}
```

Decide at implementation time which shape works cleanly with the version of better-sqlite3 / Drizzle in the lockfile.

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @ancstra/auth test -- multi-family-isolation
```

Expected: PASS — 6 cases.

- [ ] **Step 3: Run the full auth suite**

```bash
pnpm --filter @ancstra/auth test
```

Expected: PASS — auth count ~232 (118 + 108 matrix + 6 isolation).

- [ ] **Step 4: Commit**

```bash
git add packages/auth/__tests__/multi-family-isolation.test.ts
git commit -m "test(auth): add multi-family isolation integration test"
```

---

## Task 11: Rewrite `docs/specs/collaboration.md`

**Files:**
- Modify: `docs/specs/collaboration.md`

- [ ] **Step 1: Read the current file (one-time)**

Use Read on `docs/specs/collaboration.md` to capture the current content. The audit confirmed it still says "Phase 5: Not Started" and includes a credentials-provider design narrative that predates the current implementation.

- [ ] **Step 2: Replace entire file content**

Use Write to overwrite with:

```markdown
# Collaboration & RBAC

**Phase:** Cross-cutting (touches all phases)
**Status:** ✅ Implemented in sub-specs B + A + D1 + D2 + C
**Canonical reference:** [docs/rbac/architecture.md](../rbac/architecture.md) and [docs/RBAC_ROADMAP.md](../RBAC_ROADMAP.md)
**ADRs:** [013](../architecture/decisions/013-trpc-as-action-substrate.md) · [014](../architecture/decisions/014-rbac-enforcement-hardening.md) · [015](../architecture/decisions/015-rbac-client-foundation.md) · [016](../architecture/decisions/016-rbac-d2-ux-layer.md) · [017](../architecture/decisions/017-rbac-share-invite-ux.md)

---

## Overview

Ancstra supports multi-user families with role-scoped access. A user can belong to multiple families with different roles in each (owner in their own family, viewer in a sibling's, etc). Per-family physical DB isolation + central-DB membership scoping enforce cross-family separation; the 4-role permission matrix enforces within-family scoping.

## How sharing works today

**Invite by link.** A family owner or admin opens `/settings/members`, clicks "Invite Member", optionally provides an email gate, picks a role (admin/editor/viewer — admin only when caller is owner), and gets a shareable link. The recipient signs in (or signs up), accepts via `/invite/<token>`, and joins as a `family_members` row with the chosen role. See `apps/web/components/members/invite-dialog.tsx` and `packages/auth/src/invitations.ts`.

**Role management.** The members page lets owners and admins change non-owner member roles inline (admin restriction: can't change other admins or owner). Removing a member soft-deletes via `is_active = 0` and bumps `memberships_version` to invalidate the JWT. See `apps/web/components/members/member-list.tsx` and `apps/web/app/api/families/[id]/members/[userId]/route.ts`.

**Transfer ownership.** Owner-only action via the per-row dropdown menu; type-to-confirm AlertDialog with the family name. The backend wraps the demote/promote/version-bump/registry-update in a `BEGIN/COMMIT/ROLLBACK` transaction and surfaces the partial UQ-index violation as `ConcurrentTransferError` → HTTP 409. See ADR-017.

**Family switcher.** Users with ≥2 active memberships see a dropdown in the app header. Switching writes `last_seen_at` (used to pick the default family on next login) and updates the URL. See ADR-016.

**JWT staleness handling.** When `users.memberships_version` changes (invite accepted, role changed, owner transferred, member removed), the proxy detects the JWT is stale on the next request and sets a `force-jwt-refresh` cookie. The client `<JwtRefreshObserver>` calls `useSession().update()`, refreshing the JWT with new memberships + role. See ADR-014 + ADR-015.

## What's deferred

- **Bulk-invite (CSV).** No demand surfaced yet. Open question per ADR-017.
- **Email delivery.** Invitations are link-only today. Open question per ADR-017.
- **Tab-aware refresh.** `<JwtRefreshObserver>` runs on mount + nav, not every render. Other tabs hold a stale JWT until next nav — acceptable for now.

## Reading further

- **Architecture:** `docs/rbac/architecture.md` — cross-cutting decisions D1–D6, role model, enforcement layers, header/JWT contract, family-scope invariants.
- **Per-spec design + plan:** `docs/rbac/{b-trpc-migration,a-hardening,d1-foundation,d2-ux,c-share-invite,e-audit-tests-docs}/` — historical artifacts.
- **Roadmap status:** `docs/RBAC_ROADMAP.md` — entry point with shipped vs pending status.
```

- [ ] **Step 3: Commit**

```bash
git add docs/specs/collaboration.md
git commit -m "docs(specs): rewrite collaboration.md to reflect implemented RBAC"
```

---

## Task 12: Fix `docs/phases/phase-1-core.md`

**Files:**
- Modify: `docs/phases/phase-1-core.md`

- [ ] **Step 1: Read lines 320-360**

Use Read on `docs/phases/phase-1-core.md` with `offset: 320, limit: 50`. Identify the exact line under "Won't (this phase)" that mentions multi-user auth/RBAC.

- [ ] **Step 2: Apply the targeted edit**

**Case A (most likely):** The line is a bullet under a "Won't (this phase)" list. Use Edit:

- `old_string`: the exact bullet line (e.g. `- Multi-user auth` or `- Multi-user RBAC, FamilySearch API, ...`)
- `new_string`: omit the multi-user portion. If the bullet is multi-item, keep the other items.

If there's a complementary "What's done" or status section earlier in the file, append a bullet there:

```markdown
- ✅ Multi-user RBAC shipped — see [docs/RBAC_ROADMAP.md](../RBAC_ROADMAP.md)
```

**Case B (if structure differs):** Apply a minimal targeted edit that (a) removes the contradiction and (b) acknowledges RBAC shipped. Keep the diff small.

- [ ] **Step 3: Commit**

```bash
git add docs/phases/phase-1-core.md
git commit -m "docs(phases): remove stale multi-user-RBAC-won't line; mark RBAC shipped"
```

---

## Task 13: Add Central Database section to `data-model.md`

**Files:**
- Modify: `docs/architecture/data-model.md`

- [ ] **Step 1: Read the file structure**

Use Read on `docs/architecture/data-model.md` (full file or first 200 lines + tail). Identify the right insertion point — typically after the per-family schema section, before any appendix at the end. Note the file's existing heading style (`##` vs `#`) and adopt it.

- [ ] **Step 2: Append Central Database section**

Use Edit to insert this section at the identified location:

```markdown
## Central Database

Ancstra splits data across two tiers: a **central database** containing identity, membership, and audit data shared across all families; and **per-family databases** (one SQLite file per family) containing the genealogy data scoped to that family.

```
                    ┌────────────────────────────────────────────┐
                    │           CENTRAL DATABASE                 │
                    │  users · oauth_accounts · family_registry  │
                    │  family_members · invitations              │
                    │  activity_feed · platform_audit_log        │
                    └────────────────────────────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
        │ family-A.db │        │ family-B.db │        │ family-C.db │
        │   persons   │        │   persons   │        │   persons   │
        │   events    │        │   events    │        │   events    │
        │     ...     │        │     ...     │        │     ...     │
        └─────────────┘        └─────────────┘        └─────────────┘
```

**Why this split.** A connection from `createFamilyDb('A.db')` cannot see family B's tables — physical isolation makes cross-family leakage at the family-DB layer essentially impossible. Central-DB queries still need explicit `WHERE family_id = ctx.familyId` filters because membership and audit data span families.

### `users`

Global user identity. One row per registered user.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT NOT NULL UNIQUE | login identifier |
| `password_hash` | TEXT | bcrypt; nullable for OAuth-only users |
| `name` | TEXT NOT NULL | display name |
| `avatar_url` | TEXT | optional |
| `email_verified` | INTEGER NOT NULL DEFAULT 0 | 0/1 |
| `memberships_version` | INTEGER NOT NULL DEFAULT 0 | JWT staleness counter (ADR-014) |
| `is_platform_admin` | INTEGER NOT NULL DEFAULT 0 | cross-family super-admin (platform-admin v1) |
| `created_at` | TEXT NOT NULL | ISO 8601 |
| `updated_at` | TEXT NOT NULL | ISO 8601 |

### `family_registry`

One row per family; owns the per-family DB filename and current owner.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | family display name |
| `owner_id` | TEXT NOT NULL FK→users.id | denormalized; mirrors family_members where role='owner' |
| `db_filename` | TEXT NOT NULL | path to per-family SQLite file |
| `moderation_enabled` | INTEGER NOT NULL DEFAULT 0 | flips editor mutations into `pending_contributions` |
| `max_members` | INTEGER NOT NULL DEFAULT 50 | invite cap |
| `monthly_ai_budget_usd` | REAL NOT NULL DEFAULT 10.0 | AI spend cap |
| `created_at` | TEXT NOT NULL | |
| `updated_at` | TEXT NOT NULL | |

**Relationships.** `owner_id` → `users.id`. The "actual" owner is enforced via `family_members WHERE role='owner'` + the partial UQ index `uq_family_members_family_owner` (ADR-014). `family_registry.owner_id` is a denormalized copy maintained by `transferOwnership`.

### `family_members`

Many-to-many users ↔ families with per-family role.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `family_id` | TEXT NOT NULL FK→family_registry.id | ON DELETE CASCADE |
| `user_id` | TEXT NOT NULL FK→users.id | ON DELETE CASCADE |
| `role` | TEXT NOT NULL CHECK | one of `owner`, `admin`, `editor`, `viewer` |
| `invited_role` | TEXT | role at the time of invite acceptance (audit) |
| `joined_at` | TEXT NOT NULL | ISO 8601 |
| `is_active` | INTEGER NOT NULL DEFAULT 1 | soft-delete flag |
| `last_seen_at` | TEXT | ISO 8601; updated on family-switch (ADR-016) |

**Constraints.**
- `UNIQUE(family_id, user_id)` — one membership row per (family, user).
- Partial UQ index `uq_family_members_family_owner ON family_members (family_id) WHERE role='owner'` — DB-enforces exactly one owner per family (ADR-014).

### `invitations`

Link-based invite tokens with optional email gate.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `family_id` | TEXT NOT NULL FK→family_registry.id | ON DELETE CASCADE |
| `invited_by` | TEXT NOT NULL FK→users.id | inviter |
| `email` | TEXT | optional gate; if set, only that email may accept |
| `role` | TEXT NOT NULL CHECK | one of `admin`, `editor`, `viewer` (no owner via invite) |
| `token` | TEXT NOT NULL UNIQUE | 64-char hex; URL parameter |
| `expires_at` | TEXT NOT NULL | ISO 8601; default 7 days |
| `accepted_at` | TEXT | set on accept |
| `accepted_by` | TEXT FK→users.id | set on accept |
| `revoked_at` | TEXT | set on revoke |
| `revoked_by` | TEXT FK→users.id | set on revoke |
| `created_at` | TEXT NOT NULL | |

### `activity_feed`

Per-family audit log. Family-scoped (FK NOT NULL on `family_id`).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `family_id` | TEXT NOT NULL FK→family_registry.id | scopes to one family |
| `user_id` | TEXT NOT NULL FK→users.id | actor |
| `action` | TEXT NOT NULL | typed in `packages/auth/src/types.ts` `ActivityAction` |
| `entity_type` | TEXT | optional |
| `entity_id` | TEXT | optional |
| `summary` | TEXT NOT NULL | human-readable line |
| `metadata` | TEXT | optional JSON string |
| `created_at` | TEXT NOT NULL | |

Cross-family/platform-level events (e.g., platform-admin actions) live in `platform_audit_log` instead — that table doesn't require `family_id` and isn't surfaced in family-scoped activity feeds.

### Internal tables (not part of the application data model)

- `oauth_accounts` — Auth.js OAuth provider account links.
- `verification_tokens` — Auth.js email-verification + password-reset tokens.
- `platform_audit_log` — cross-family audit trail for platform-admin actions; consumed by the platform-admin console.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/data-model.md
git commit -m "docs(arch): document central-DB tables (users, family_registry, family_members, invitations, activity_feed)"
```

---

## Task 14: Append Decision history to `architecture.md`

**Files:**
- Modify: `docs/rbac/architecture.md`

- [ ] **Step 1: Read the file's tail**

Use Read on `docs/rbac/architecture.md` (last ~50 lines or full file if short). Confirm there's no existing "Decision history" section.

- [ ] **Step 2: Append**

Use Edit to append at the very end of the file:

```markdown

---

## Decision history

This `architecture.md` is the canonical decision record for the RBAC roadmap. Per-sub-spec ADRs are point-in-time snapshots tied to specific sub-specs; if they ever diverge from this doc, treat this as the source of truth.

| ADR | Date | Sub-spec | Topic |
|---|---|---|---|
| [013](../architecture/decisions/013-trpc-as-action-substrate.md) | 2026-04-29 | B | tRPC v11 as action substrate |
| [014](../architecture/decisions/014-rbac-enforcement-hardening.md) | 2026-04-30 | A | Header trust, JWT staleness, owner-uniqueness |
| [015](../architecture/decisions/015-rbac-client-foundation.md) | 2026-04-30 | D1 | Client SessionProvider, RoleGate, JWT refresh |
| [016](../architecture/decisions/016-rbac-d2-ux-layer.md) | 2026-04-30 | D2 | Family switcher, lastSeenAt, RoleGate adoption |
| [017](../architecture/decisions/017-rbac-share-invite-ux.md) | 2026-05-07 | C | Transfer ownership, atomicity, share/invite UX |

**E (audit, tests, docs)** does not add a new ADR — this Decision-history section is the consolidating artifact. The roadmap is now **6/6 sub-specs shipped**.
```

- [ ] **Step 3: Commit**

```bash
git add docs/rbac/architecture.md
git commit -m "docs(rbac): add Decision history section linking ADRs 013-017"
```

---

## Task 15: Run full sweep + verify drift detection

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

```bash
pnpm test
```

Expected: PASS across all packages. The pre-existing Windows `sharp` issue in `@ancstra/ai/__tests__/detect-conflicts.test.ts` is the only acceptable failure (documented in roadmap).

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: typecheck clean. Lint may have pre-existing errors from main (1 error in `apps/web/lib/tree/person-detail-cache.ts:49`, ~120 warnings) — acceptable; new code should not add warnings.

- [ ] **Step 3: Verify matrix-test catches drift (manual sanity)**

Temporarily add `'tree:delete'` to viewer's permissions in `packages/auth/src/permissions.ts`. Re-run:

```bash
pnpm --filter @ancstra/auth test -- permissions-matrix
```

Expected: FAIL on `viewer does not have tree:delete`. **Revert.**

- [ ] **Step 4: Verify meta-test catches missing column (manual sanity)**

Temporarily delete `is_platform_admin` from the `users` block in `packages/db/src/test-fixtures/central-schema.ts` (the SQL constant). Re-run:

```bash
pnpm --filter @ancstra/db test -- central-schema-fixture
```

Expected: FAIL on `users table has all expected columns` because the fixture now omits `is_platform_admin`. **Revert.**

- [ ] **Step 5: No commit**

Verification only.

---

## Task 16: Promote drafts to canonical `docs/rbac/`

**Files:**
- Create: `docs/rbac/e-audit-tests-docs/design.md`
- Create: `docs/rbac/e-audit-tests-docs/plan.md`

- [ ] **Step 1: Promote**

```bash
mkdir -p docs/rbac/e-audit-tests-docs
cp docs/superpowers/specs/2026-05-07-rbac-subspec-e-design.md docs/rbac/e-audit-tests-docs/design.md
cp docs/superpowers/plans/2026-05-07-rbac-subspec-e-audit-tests-docs.md docs/rbac/e-audit-tests-docs/plan.md
```

- [ ] **Step 2: Commit**

```bash
git add docs/rbac/e-audit-tests-docs/
git commit -m "docs(rbac): promote sub-spec E drafts to canonical docs/rbac/"
```

---

## Task 17: Update `docs/RBAC_ROADMAP.md`

**Files:**
- Modify: `docs/RBAC_ROADMAP.md`

- [ ] **Step 1: Update intro count**

Find:

```
Five shipped, one pending.
```

Replace with:

```
**All six shipped.** RBAC roadmap complete.
```

- [ ] **Step 2: Update E row in status table**

Find:

```
| **E** | Audit, tests, docs (test fixture consolidation, matrix tests) | ⏳ Pending | — | — |
```

Replace with:

```
| **E** | Audit, tests, docs (test fixture consolidation, matrix tests) | ✅ Shipped 2026-05-DD | `sub-spec-e-complete` | — |
```

(Replace `2026-05-DD` with the actual ship date when this PR merges. The "—" in the ADR column reflects E6: no new ADR.)

- [ ] **Step 3: Add E summary to "What shipped"**

Locate the "What shipped" section. After the existing "Sub-spec C — Share / invite UX" block, append:

```markdown
**Sub-spec E — Audit, tests, docs** ([design](rbac/e-audit-tests-docs/design.md) · [plan](rbac/e-audit-tests-docs/plan.md))
- Shared central-schema test fixture at `packages/db/src/test-fixtures/` (`createTestCentralDb()` + `CENTRAL_SCHEMA_SQL`); 24 hand-written fixtures across 5 packages (auth ×8, db ×2, web ×5, ai ×7, research ×4) consolidated to use the helper
- Schema-drift meta-test in `packages/db/__tests__/central-schema-fixture.test.ts` catches future schema additions that don't update the fixture
- Exhaustive permission-matrix test (~108 cases: 4 roles × ~26 perms + 4 invariants) in `packages/auth/__tests__/permissions-matrix.test.ts`
- 6-case multi-family isolation integration test in `packages/auth/__tests__/multi-family-isolation.test.ts`
- `docs/specs/collaboration.md` rewritten (was "Phase 5: Not Started")
- `docs/phases/phase-1-core.md` cleaned of stale "multi-user RBAC won't" line
- New "Central Database" section in `docs/architecture/data-model.md` documenting `users`, `family_registry`, `family_members`, `invitations`, `activity_feed`
- New "Decision history" section in `docs/rbac/architecture.md` linking ADRs 013-017
- No new ADR — `architecture.md` is the consolidating artifact
- `sub-spec-e-complete` tag; auth tests 118 → ~232 (+114)
```

Update the section heading from `## What shipped (sub-specs B + A + D1 + D2)` (or `B + A + D1 + D2 + C`) to `## What shipped (all six sub-specs)`.

- [ ] **Step 4: Remove the "Sub-spec E" pending block**

Locate the `### Sub-spec E — Audit, tests, docs` section under "What's pending" (with its sub-bullets and "Carries forward into E" block). Delete that entire block. If "What's pending" becomes empty after removal, replace its content with:

```markdown
## What's pending

Nothing in the RBAC roadmap. See "Bucket of follow-ups" below for standalone cleanups (createCentralDb singleton sweep, `@ancstra/ai` zod/v3 migration, GEDCOM body-size guard) — these are independent of RBAC.
```

- [ ] **Step 5: Update "Suggested execution order"**

Find:

```
Updated post-C: B → A → ~~D1~~ → ~~D2~~ → ~~C~~ → **E**.
```

Replace with:

```
Updated post-E: ~~B~~ → ~~A~~ → ~~D1~~ → ~~D2~~ → ~~C~~ → ~~E~~. **All six shipped.**
```

Update the surrounding prose: change "**E is up next**..." (and its paragraph) to:

```
**Standalone cleanups remain** — `createCentralDb()` singleton sweep (14 callers), `@ancstra/ai` zod/v3 migration (12 files), GEDCOM body-size guard. None block any RBAC work; they land independently as ordinary cleanup PRs.
```

- [ ] **Step 6: Strike-through the test-fixture row in "Bucket of follow-ups"**

Find any row mentioning the test-fixture consolidation or hand-written CREATE TABLE in the bucket table. Strike-through if present. (May not be there; the "Carries forward into E" block held that note.)

- [ ] **Step 7: Commit**

```bash
git add docs/RBAC_ROADMAP.md
git commit -m "docs(rbac): E shipped — roadmap 6/6 complete"
```

---

## Task 18: Open PR and merge + tag

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/rbac-subspec-e-audit-tests-docs
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(rbac): sub-spec E — audit/tests/docs (closes RBAC roadmap)" --body "$(cat <<'EOF'
## Summary

Closes the RBAC roadmap. Final sub-spec — audit/tests/docs.

- **Shared central-schema test fixture** at `@ancstra/db/test-fixtures`. 24 hand-written fixtures (auth ×8, db ×2, web ×5, ai ×7, research ×4) consolidated.
- **Schema-drift meta-test** catches future schema changes that don't update the fixture.
- **Exhaustive permission matrix test** (~108 cases) replaces the previous spot-check.
- **Multi-family isolation test** (6 cases) covers cross-family invariants from architecture.md.
- **Docs**: `collaboration.md` rewritten, `phase-1-core.md` cleaned, `data-model.md` gets a new Central Database section, `architecture.md` gets a Decision history section.

No new ADR — `architecture.md` Decision history is the consolidating artifact.

## Test plan

- [ ] `pnpm test` — all packages green (modulo pre-existing Windows `sharp` issue)
- [ ] `pnpm typecheck` — clean
- [ ] `pnpm lint` — clean (pre-existing issues unchanged)
- [ ] Manual: temporarily mutate fixture or matrix → drift tests fire (see Task 15 §3-§4)
EOF
)"
```

- [ ] **Step 3: Merge**

Merge via GitHub UI (merge-commit per project convention). Or for local-only:

```bash
git checkout main
git merge --no-ff feature/rbac-subspec-e-audit-tests-docs -m "Merge feature/rbac-subspec-e-audit-tests-docs: RBAC sub-spec E"
```

- [ ] **Step 4: Tag**

```bash
git tag sub-spec-e-complete
```

If using a remote: `git push origin sub-spec-e-complete`.

- [ ] **Step 5: Replace the ship-date placeholder**

If the placeholder `2026-05-DD` is still in the merged file, open a tiny follow-up PR to replace with the actual merge date. (Or fix in this PR before merge if the merge date is known.)

- [ ] **Step 6: Cleanup worktree (if used)**

```bash
git worktree remove .worktrees/rbac-subspec-e
git branch -d feature/rbac-subspec-e-audit-tests-docs
```

---

## Self-review

**Spec coverage:**

| Spec section | Implemented in task |
|---|---|
| Shared fixture (central-schema.ts + index.ts) | Task 1 |
| Subpath export | Task 2 |
| Schema-drift meta-test | Task 3 |
| @ancstra/db migration (2 files) | Task 4 |
| @ancstra/auth migration (8 files) | Task 5 |
| @ancstra/research migration (4 files) | Task 6 |
| @ancstra/ai migration (7 files) | Task 7 |
| apps/web migration (5 files) | Task 8 |
| Permission matrix exhaustive test | Task 9 |
| Multi-family isolation test | Task 10 |
| collaboration.md rewrite | Task 11 |
| phase-1-core.md fix | Task 12 |
| data-model.md Central Database section | Task 13 |
| architecture.md Decision history | Task 14 |
| Full sweep + drift verification | Task 15 |
| Promote drafts | Task 16 |
| RBAC_ROADMAP.md update | Task 17 |
| PR + merge + tag | Task 18 |

**Placeholder scan:** No "TBD" / "TODO" / "implement later". The `2026-05-DD` placeholder is intentional. Task 12's "Case A vs Case B" branching is intentional (file structure unknown until read).

**Type consistency:**
- `createTestCentralDb` / `CENTRAL_SCHEMA_SQL` exported from `@ancstra/db/test-fixtures` (Task 1) and imported consistently in Tasks 4-8 + 10. ✓
- `Permission` union in Task 9 includes `'members:transfer-ownership'` (added in C, verified in current types.ts). ✓
- `VALID_ROLES` from `'../src/types'` in Task 9 — exists. ✓

**Scope check:** Single PR, ~35 file changes (most mechanical), 18 tasks. Migration tasks split per package for review clarity. Task 15 verification-only (no commit). No decomposition needed.

**Ambiguity check:** Task 4's recipe gives the engineer the escape valve for tests that inspect raw sqlite. Task 10's family-DB isolation test has an explicit fallback noted if the Drizzle internals cast doesn't work. Task 12 covers two doc-structure cases. All other steps have one obvious interpretation.
