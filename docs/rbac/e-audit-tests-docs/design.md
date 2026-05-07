# RBAC Sub-spec E — Audit, Tests, Docs

**Status:** Design (brainstorm complete, plan pending)
**Date:** 2026-05-07
**Author:** brainstorm session w/ Claude
**Tracks against:** `docs/RBAC_ROADMAP.md` §"Sub-spec E — Audit, tests, docs"
**Cross-cutting architecture:** `docs/rbac/architecture.md`
**Prior sub-specs (all shipped):** B (2026-04-29), A + D1 + D2 (2026-04-30), C (2026-05-07)

---

## Context

Sub-spec E is the audit/tests/docs layer of the cross-cutting RBAC roadmap
(B → A → D1 → D2 → C → **E**). When the roadmap was drafted (2026-04-29), E
was projected as a substantial track including a 4-role × ~58-endpoint
integration grid, multiple new tests, a consolidating ADR, and three doc
rewrites.

In practice, the audit work that ran before this brainstorm revealed that
**most of the originally-projected new tests already exist** — added
incrementally during sub-specs A/D1/D2/C. The remaining genuine gaps are
narrower and the roadmap's "~58 endpoints" undercounts (actual is 63 REST +
~9 tRPC mutations ≈ 72). Building a 4×72 = 288-cell grid would be ceremony
for low marginal coverage — the existing per-feature tests already exercise
each endpoint's `requireAuthContext` + `requirePermission` calls, and
`packages/auth/__tests__/permissions.test.ts` already spot-tests the matrix.

**Existing RBAC tests (do not duplicate):**
- `apps/web/__tests__/auth/header-strip.test.ts` — header forgery blocked
- `apps/web/__tests__/auth/jwt-staleness.test.ts` — DB version vs JWT version
- `apps/web/__tests__/auth/jwt-refresh-debounce.test.tsx` — debounce
- `apps/web/__tests__/auth/jwt-refresh-observer.test.tsx` — cookie observer
- `apps/web/__tests__/auth/role-gate.test.tsx` — RoleGate component
- `apps/web/__tests__/auth/use-has-permission.test.tsx` — hooks
- `packages/auth/__tests__/permissions.test.ts` — role-spotting matrix tests
- `packages/auth/__tests__/transfer-ownership.test.ts` — sub-spec C atomicity
- `packages/db/__tests__/owner-uniqueness.test.ts` — partial UQ index

**The genuine remaining gaps:**
1. **24 hand-written central-schema test fixtures** — every test file that
   needs the central DB inlines its own `CREATE TABLE users` + family_registry +
   family_members DDL. Future schema additions need 24 lockstep edits. This is
   the highest-value cleanup in E and the largest open carry-forward from
   sub-spec A.
2. **No exhaustive permission-matrix test** — the existing
   `permissions.test.ts` is sample-based ("admin has all except settings:manage
   and tree:delete" + a few spot checks). A drift in the matrix could silently
   miss most cells. An exhaustive table-driven test closes this.
3. **No multi-family integration test** — every existing test runs against
   one family. Cross-family isolation is invariant #6 in `architecture.md` but
   has no direct test.
4. **Three docs are stale** — `docs/specs/collaboration.md` still says
   "Phase 5: Not Started", `docs/phases/phase-1-core.md:336-343` still lists
   "Multi-user auth" under "Won't (this phase)", and `docs/architecture/data-model.md`
   doesn't document the central-DB tables (`users`, `familyRegistry`,
   `familyMembers`, `invitations`, `activity_feed`).
5. **`docs/rbac/architecture.md` lacks a Decision-history section** linking
   the per-spec ADRs (013-017).

**Intended outcome.** RBAC roadmap closed (6/6 sub-specs shipped). Test
infrastructure consolidated so one schema change = one fixture update. Two
small high-value test additions catch matrix drift and cross-family leakage.
Three docs reflect implemented reality.

---

## Decisions captured this session

| # | Decision | Rationale |
|---|---|---|
| E1 | Pragmatic-middle scope: fixture + 2 tests + docs | Existing RBAC tests already cover most of the originally-planned grid (A/D1/D2/C added them incrementally). Building the full 4×72 matrix would be 288 ceremony cases for low marginal coverage. |
| E2 | All-in-one helper + big-bang migrate (5 commits) | One canonical `createTestCentralDb()` exporter at `packages/db/src/test-fixtures/`; migrate all 24 files in this PR (one commit per package: auth, web, ai, research, db). Atomic; future schema changes update one place. |
| E3 | Subpath export `@ancstra/db/test-fixtures` | Matches the user's saved feedback rule on package subpath exports. Tests import via `import { createTestCentralDb } from '@ancstra/db/test-fixtures'`. |
| E4 | Table-driven exhaustive matrix test | `describe.each(VALID_ROLES) → describe.each(ALL_PERMISSIONS)`. ~104 explicit assertions. Drift in `permissions.ts` fails the test with a specific (role, permission) diff. No fast-check; finite domain doesn't need property-based generation. |
| E5 | 6-case multi-family isolation test | Focused; not exhaustive. Covers the architecture.md invariants directly. |
| E6 | Skip ADR-018 — append "Decision history" to architecture.md | `architecture.md` already serves as the canonical decision record. ADRs 013-017 link to it. Adding ADR-018 would duplicate. Instead, append a Decision-history table to architecture.md cross-referencing the per-spec ADRs. |
| E7 | Schema-drift meta-test | One small test in `packages/db/__tests__/central-schema-fixture.test.ts` introspects the production schema vs the fixture and fails on divergence. ~30 lines; one-time cost. |
| E8 | Defer standalone cleanups | `createCentralDb()` singleton sweep (14 callers), `@ancstra/ai` zod/v3 migration (12 files), GEDCOM body-size guard — each gets its own dedicated PR. Not absorbed into E. |

---

## Scope

### In scope

**Shared central-schema fixture** (`packages/db/src/test-fixtures/`)
- `central-schema.ts` exports:
  - `createTestCentralDb(): CentralDatabase` — fresh in-memory Drizzle handle
    with the full central schema applied.
  - `CENTRAL_SCHEMA_SQL: string` — same DDL as a string for tests that
    already own a sqlite handle.
- `index.ts` re-exports the above.
- Schema covers ALL central-DB tables/indexes/triggers in production:
  `users` (full 9-column shape with `memberships_version` + `is_platform_admin`),
  `family_registry`, `family_members` (with `last_seen_at`),
  partial UQ index `uq_family_members_family_owner`,
  `invitations`, `activity_feed`, `oauth_accounts`,
  `password_reset_tokens`. Idempotent — uses `CREATE TABLE IF NOT EXISTS`
  patterns mirroring `ensureCentralSchema()`.
- Returns a Drizzle handle directly; no `{ db, sqlite }` tuple.

**Workspace export** (`packages/db/package.json`)
```json
"./test-fixtures": {
  "types": "./src/test-fixtures/index.ts",
  "default": "./src/test-fixtures/index.ts"
}
```

**Big-bang migration of 24 test files** (5 commits, one per package, within
this PR):
- `packages/auth/__tests__/` — 8 files
  (`activity.test.ts`, `families.test.ts`, `integration.test.ts`,
  `invitations.test.ts`, `moderation.test.ts`, `nextauth-adapter.test.ts`,
  `oauth-linking.test.ts`, `transfer-ownership.test.ts`)
- `packages/db/__tests__/` — 2 files
  (`owner-uniqueness.test.ts`, `split-to-multi-db.test.ts`)
- `apps/web/__tests__/` — 5 files
  (`api/events.test.ts`, `api/families.test.ts`, `api/persons.test.ts`,
  `api/search.test.ts`, `lib/last-seen-tracker.test.ts`)
- `packages/ai/src/__tests__/` — 7 files
  (`analyze-tree-gaps.test.ts`, `compute-relationship.test.ts`,
  `cost-tracker.test.ts`, `detect-conflicts.test.ts`,
  `propose-relationship.test.ts`, `search-local-tree.test.ts`,
  `tree-context.test.ts`)
- `packages/research/src/__tests__/` — 4 files
  (`conflicts.test.ts`, `facts-queries.test.ts`, `items-queries.test.ts`,
  `scrape-jobs.test.ts`)

Each commit runs that package's full test suite (`pnpm --filter <pkg> test`)
before moving on.

**Permission matrix exhaustive test**
(`packages/auth/__tests__/permissions-matrix.test.ts` — new)
- Single `EXPECTED_MATRIX: Record<Role, Set<Permission>>` constant inside
  the test file (hand-written, mirrors `permissions.ts`).
- `describe.each(VALID_ROLES)` outer × `describe.each(ALL_PERMISSIONS)` inner
  → one `it` per (role, permission) cell asserting
  `hasPermission(role, perm) === EXPECTED_MATRIX[role].has(perm)`.
  ~104 explicit assertions.
- Plus a `describe('matrix invariants')` block:
  - `EXPECTED_MATRIX.owner.size === ALL_PERMISSIONS.length` (owner has all)
  - `EXPECTED_MATRIX.viewer.size < EXPECTED_MATRIX.editor.size`
  - `EXPECTED_MATRIX.editor.size < EXPECTED_MATRIX.admin.size`
  - `EXPECTED_MATRIX.admin.size === ALL_PERMISSIONS.length - 3`
    (admin lacks settings:manage, tree:delete, members:transfer-ownership)
- Existing `permissions.test.ts` stays — it's role-spotting (sample
  assertions); the new file is exhaustive. Different responsibilities.

**Multi-family isolation test**
(`packages/auth/__tests__/multi-family-isolation.test.ts` — new)
- 6 cases, each with `createTestCentralDb()` + two in-memory family DBs:
  1. `getFamiliesForUser('u-alice')` returns 2 rows when alice is in
     fam-1 and fam-2.
  2. Insert person row in family A's DB → query family B's DB → no row
     visible (physical isolation).
  3. Central-DB query `SELECT * FROM family_members WHERE familyId='fam-1'`
     returns only fam-1 rows even when alice is a member of both.
  4. `transferOwnership` in family A does NOT affect alice's role in
     family B.
  5. Removing alice from family A does NOT cascade-delete her family B
     membership.
  6. Privacy-level filtering on family A respects family A's
     `moderation_enabled` setting independently of family B's.

**Schema-drift meta-test**
(`packages/db/__tests__/central-schema-fixture.test.ts` — new)
- Asserts that the shared fixture's schema matches what
  `central-schema.ts` + `ensureCentralSchema()` would produce in production.
- Implementation sketch: introspect both via `PRAGMA table_info()` and
  `sqlite_schema` queries; compare column lists, types, indexes, triggers.
- Fails loudly if a future contributor adds a column to the central schema
  without updating the fixture.

**Doc rewrites**

1. `docs/specs/collaboration.md` — full rewrite from ~150 lines to ~80.
   - Replace status block: "Phase 5: Not Started" → "Implemented in
     sub-specs B + A + D1 + D2 + C". Add "Canonical reference:
     docs/rbac/architecture.md + docs/RBAC_ROADMAP.md". List ADRs 013-017.
   - Drop the credentials-provider design narrative (predates Auth.js v5
     + JWT-derived role model; misleading).
   - Replace with three short sections: "How sharing works today" (3
     paragraphs pointing at concrete files), "What's deferred" (bulk-invite,
     email delivery, tab-aware refresh per ADR-017), "Reading further"
     (links to canonical docs).

2. `docs/phases/phase-1-core.md:336-343` — small targeted fix.
   - Read the actual current section structure first.
   - Remove the "Multi-user auth" line from the "Won't (this phase)"
     section.
   - Add a one-line "Multi-user RBAC ✓ shipped — see
     docs/RBAC_ROADMAP.md" note in the appropriate "What's done" or
     "Cross-cutting" section.

3. `docs/architecture/data-model.md` — new "Central Database" section.
   - Append after the existing per-family schema section.
   - Top of section: a "Per-family vs central" diagram showing physical
     isolation (each family's `dbFilename` → separate SQLite file; central
     DB has identity + membership + invitations + activity).
   - Document each table with: short purpose sentence, field table
     (column | type | notes), Relationships subsection.
   - Tables: `users`, `familyRegistry`, `familyMembers`, `invitations`,
     `activity_feed`.
   - Note that `oauth_accounts` and `password_reset_tokens` exist for
     Auth.js + reset-flow internals but aren't part of the
     application-level data model — point at `packages/auth` for those.

4. `docs/rbac/architecture.md` — append "Decision history" section.
   - Short table at the bottom mapping ADR → date → sub-spec → topic for
     ADRs 013-017.
   - One-paragraph note that `architecture.md` is the canonical decision
     record; ADRs are point-in-time snapshots tied to specific sub-specs.
   - Mark the roadmap complete: "All six sub-specs (B, A, D1, D2, C, E)
     shipped."

5. `docs/RBAC_ROADMAP.md` — sign-off update.
   - E row in status table → `✅ Shipped 2026-05-DD`,
     tag `sub-spec-e-complete`, no ADR (per E6).
   - Move "Sub-spec E — Audit, tests, docs" section out of "What's
     pending" into "What shipped" with a summary.
   - Update intro: "Six shipped, zero pending."
   - Update "Suggested execution order": `B → A → D1 → D2 → C → E` all
     struck through, "**Next: standalone cleanups**".
   - Strike through the test-fixture consolidation row in "Carries forward
     into E" (now resolved).

### Out of scope (deferred)

- **Full 4×72 endpoint integration grid.** Existing per-feature tests
  cover defense-in-depth at the right layer; a generated grid would be
  ceremony for low marginal value.
- **New ADR-018.** `architecture.md` Decision-history section serves the
  consolidation purpose without duplicating content.
- **`createCentralDb()` direct-caller sweep** (14 sites). Mechanical
  cleanup, dedicated PR.
- **`@ancstra/ai` `zod/v3` migration** (12 files). Larger refactor,
  dedicated PR.
- **GEDCOM body-size guard.** Touches UX, dedicated PR.
- **Header-strip / jwt-staleness / owner-uniqueness / transfer-ownership /
  role-gate tests.** Already exist (audit confirmed).

### Touched files (full surface)

```
packages/db/src/test-fixtures/central-schema.ts                     (N)
packages/db/src/test-fixtures/index.ts                              (N)
packages/db/package.json                                            (M — add subpath export)
packages/db/__tests__/central-schema-fixture.test.ts                (N — meta-test)

packages/auth/__tests__/{8 files}                                   (M — migrate)
packages/db/__tests__/{2 files}                                     (M — migrate)
apps/web/__tests__/{5 files}                                        (M — migrate)
packages/ai/src/__tests__/{7 files}                                 (M — migrate)
packages/research/src/__tests__/{4 files}                           (M — migrate)

packages/auth/__tests__/permissions-matrix.test.ts                  (N)
packages/auth/__tests__/multi-family-isolation.test.ts              (N)

docs/specs/collaboration.md                                         (M — rewrite)
docs/phases/phase-1-core.md                                         (M — small fix at 336-343)
docs/architecture/data-model.md                                     (M — new Central Database section)
docs/rbac/architecture.md                                           (M — Decision history section)
docs/rbac/e-audit-tests-docs/design.md                              (N — promoted from this draft)
docs/rbac/e-audit-tests-docs/plan.md                                (N — promoted from plan draft)
docs/RBAC_ROADMAP.md                                                (M — E row → ✅ Shipped, mark complete)
```

---

## Architecture

### Fixture flow

```
[test file]
  → import { createTestCentralDb } from '@ancstra/db/test-fixtures'
  → const db = createTestCentralDb()
  → ...test code uses db like any Drizzle handle...
  → (GC reclaims at end of test; in-memory SQLite has no cleanup needed)
```

`createTestCentralDb()` internally:
1. Opens a fresh `new Database(':memory:')` via better-sqlite3
2. Sets `journal_mode = WAL` + `foreign_keys = ON` pragmas
3. Executes `CENTRAL_SCHEMA_SQL` (full DDL: 5 tables + indexes + triggers)
4. Wraps in Drizzle: `drizzle(sqlite, { schema: centralSchema })`
5. Returns the handle

The raw sqlite handle is not returned. The meta-test runs its own
introspection by importing `CENTRAL_SCHEMA_SQL` and applying it to
a separate fresh in-memory connection.

### Schema-drift meta-test flow

```
[meta-test]
  → spinUpProductionDb():
      open :memory: SQLite
      run drizzle-kit push for centralSchema (or equivalent DDL extraction)
      run ensureCentralSchema()  ← idempotent ALTERs / CREATE INDEX IF NOT EXISTS
      return introspection of all tables/columns/indexes
  → spinUpFixtureDb():
      open :memory: SQLite
      execute CENTRAL_SCHEMA_SQL
      return introspection
  → assertSchemasMatch(prod, fixture):
      compare table names, column lists, types, NOT NULL flags,
      DEFAULT values, primary keys, foreign keys, indexes (incl. partial
      WHERE clauses), triggers
  → fail with structured diff if any divergence
```

This catches drift like:
- New column added to `central-schema.ts` but not added to `CENTRAL_SCHEMA_SQL`
- New index added to `ensureCentralSchema()` but not to the fixture
- Type widening (TEXT → BLOB) on either side

### Permission matrix invariants this spec preserves

From `docs/rbac/architecture.md` §"Family-scope invariants":
1. **Membership = sole access grant** — verified by multi-family case 1.
2. **Active family ∈ user's memberships** — verified by central-DB
   filter test (case 3) + existing middleware tests.
3. **Role is per-family** — verified by case 4 (transfer in family A
   doesn't affect family B).
4. **Permission lookup is pure** — verified by the new exhaustive
   matrix test.
5. **Owner uniqueness is DB-enforced** — already covered by
   `packages/db/__tests__/owner-uniqueness.test.ts` + the partial UQ
   index in the new fixture.
6. **Per-family DB isolation** — verified by multi-family case 2.

E adds direct verification for invariants 1, 2, 3, 4, 6 (5 already had it).

---

## Testing

### New test file count

- `packages/auth/__tests__/permissions-matrix.test.ts` — ~104 cells
  + 4 invariant assertions = ~108 cases
- `packages/auth/__tests__/multi-family-isolation.test.ts` — 6 cases
- `packages/db/__tests__/central-schema-fixture.test.ts` — ~5-10 cases
  (one per table/index introspection check)

### Total runtime

All in-memory SQLite, no network. Estimated +2-4s to existing CI run.
Auth suite goes from 118 → ~232 tests. DB suite gains the meta-test.

### Migration verification (per package)

After each of the 5 migration commits:
```
pnpm --filter <package> test
```
Expected: all tests pass with the same count and outcomes as before
migration. The migration is mechanical replacement; semantics
unchanged.

After all migrations + new tests + docs:
```
pnpm test         # full workspace
pnpm typecheck    # full workspace
pnpm lint         # full workspace (pre-existing errors persist)
```

### Manual sanity check

1. Pull merged main, run `pnpm test` → full suite green (modulo
   documented Windows `sharp` issue).
2. Mutate `packages/auth/src/permissions.ts` (e.g., add `'tree:delete'`
   to viewer's perms) → confirm `permissions-matrix.test.ts` fails on
   the (`viewer`, `tree:delete`) cell. Revert.
3. Add a column to `packages/db/src/central-schema.ts` without
   updating `test-fixtures/central-schema.ts` → confirm meta-test
   fails. Revert.
4. Open `docs/specs/collaboration.md` → confirm "Phase 5: Not Started"
   gone, points at canonical sources.
5. Open `docs/architecture/data-model.md` → confirm new "Central
   Database" section with all 5 tables documented.
6. Open `docs/rbac/architecture.md` → confirm new Decision history
   section listing ADRs 013-017.

---

## Sign-off artifacts

- **No new ADR.** Decision-history table in `architecture.md` is the
  consolidating artifact (per E6). The standalone-cleanup work that
  follows E will land via individual PRs each with its own commit
  message — no shared ADR needed there either.
- Promote this draft → `docs/rbac/e-audit-tests-docs/design.md`. Same
  for plan.
- Update `docs/RBAC_ROADMAP.md` E row to "✅ Shipped 2026-05-DD" with
  tag `sub-spec-e-complete` (no ADR cell). Mark roadmap complete.
- `git tag sub-spec-e-complete` after merge.

---

## Open questions deferred to plan time

- **Order of fixture migration commits.** Suggested order is
  `db → auth → research → ai → web` (smallest packages first to
  validate the helper before larger sweeps), but reverse is also
  defensible (validate against the most-tested package first). Decide
  at plan time after a quick re-look at each package's test count.
- **Schema-drift meta-test mechanism.** The simplest implementation
  uses raw SQLite introspection (`PRAGMA table_info`,
  `SELECT * FROM sqlite_schema`). Drizzle has a programmatic schema
  introspection API that may produce cleaner output — investigate at
  plan time whether the extra abstraction is worth it for this
  one-off comparison.
- **`docs/phases/phase-1-core.md` exact edit.** Need to read the file
  during plan execution to identify the precise line numbers and
  surrounding section context. The 336-343 reference may have shifted
  since the roadmap was drafted.
- **`docs/specs/collaboration.md` length.** Target ~80 lines but
  actual length depends on how much "How sharing works today" prose
  is needed. Don't pad.
- **Fixture coverage of `oauth_accounts` and `password_reset_tokens`.**
  These are auth-internals and only some test files use them. Decide
  at plan time whether the shared fixture includes them by default or
  via an opt-in `withAuthInternals: true` parameter (latter avoids
  forcing every consumer to carry tables they don't use; former is
  simpler).

---

## Files this spec does NOT touch

- `apps/web/proxy.ts`, `apps/web/auth.ts` — RBAC enforcement code
  unchanged; tests are the only addition.
- `packages/auth/src/permissions.ts` — matrix unchanged (the new test
  validates it; doesn't modify it).
- `packages/db/src/central-schema.ts` — schema unchanged.
- Any sub-spec C surface — already shipped, stable.
- The 14 `createCentralDb()` direct callers — separate PR.
- The 12 `zod/v3` shim consumers in `packages/ai` — separate PR.
- The GEDCOM body-size guard — separate PR.
