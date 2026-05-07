# RBAC Roadmap

Permanent reference for the role-based access control work in Ancstra. The cross-cutting architecture started as five sub-specs (B → A → D → C → E); D was split into D1 (foundation) + D2 (UX) during the D brainstorm because its surface grew (carry-forwards from B/A + ~30-component RoleGate adoption). Five shipped, one pending. This doc is the entry point for everything RBAC.

**Status:**

| Sub-spec | Topic | Status | Tag | ADR |
|---|---|---|---|---|
| **B** | tRPC migration (action substrate) | ✅ Shipped 2026-04-29 | `sub-spec-b-complete` | [ADR-013](architecture/decisions/013-trpc-as-action-substrate.md) |
| **A** | Enforcement hardening (header trust, JWT staleness, owner-uniqueness) | ✅ Shipped 2026-04-30 | `sub-spec-a-complete` | [ADR-014](architecture/decisions/014-rbac-enforcement-hardening.md) |
| **D1** | Client-side enforcement foundation (SessionProvider, useHasPermission, RoleGate, JWT refresh observer + 409 link) | ✅ Shipped 2026-04-30 | `sub-spec-d1-complete` | [ADR-015](architecture/decisions/015-rbac-client-foundation.md) |
| **D2** | Family switcher UX + RoleGate adoption sweep + lastSeenAt + onboarding | ✅ Shipped 2026-04-30 | `sub-spec-d2-complete` | [ADR-016](architecture/decisions/016-rbac-d2-ux-layer.md) |
| **C** | Share / invite UX (settings/members page) | ✅ Shipped 2026-05-07 | `sub-spec-c-complete` | [ADR-017](architecture/decisions/017-rbac-share-invite-ux.md) |
| **E** | Audit, tests, docs (test fixture consolidation, matrix tests) | ⏳ Pending | — | — |

---

## File map

```
docs/
├── RBAC_ROADMAP.md              ← you are here
├── rbac/                         ← canonical artifacts (committed)
│   ├── architecture.md          ← cross-cutting design (decisions D1–D6)
│   ├── b-trpc-migration/
│   │   ├── design.md            ← spec
│   │   └── plan.md              ← 26-task implementation plan
│   ├── a-hardening/
│   │   ├── design.md            ← spec
│   │   └── plan.md              ← 17-task implementation plan
│   ├── d1-foundation/
│   │   ├── design.md            ← spec
│   │   └── plan.md              ← 13-task implementation plan
│   ├── d2-ux/                   ← drafts not promoted (worktree cleanup;
│   │                              ADR-016 carries the decisions)
│   └── c-share-invite/
│       ├── design.md            ← spec
│       └── plan.md              ← 14-task implementation plan
└── architecture/decisions/
    ├── 013-trpc-as-action-substrate.md
    ├── 014-rbac-enforcement-hardening.md
    ├── 015-rbac-client-foundation.md
    ├── 016-rbac-d2-ux-layer.md
    └── 017-rbac-share-invite-ux.md
```

The per-sub-spec design + plan files in `docs/rbac/<name>/` are the historical artifacts as they were at execution time, committed alongside this roadmap. Working drafts for in-flight sub-specs live in `docs/superpowers/{specs,plans}/` (gitignored) and are promoted to `docs/rbac/` when the sub-spec ships.

---

## Cross-cutting decisions (from `rbac/architecture.md`)

| # | Decision | Status |
|---|---|---|
| D1 | 4 roles in DB (owner/admin/editor/viewer); UI surfaces only 3 (owner is implicit, set at family creation) | Implemented |
| D2 | Re-derive role from `JWT.memberships` everywhere; `x-family-role` header is never trusted | Implemented (sub-spec A) |
| D3 | Exactly one owner per family, transferable via single transaction; DB-enforced via partial unique index | Implemented (sub-spec A) |
| D4 | tRPC v11 is the long-term substrate for action-level mutations | Implemented (sub-spec B) |
| D5 | Build tRPC first (sub-spec B); subsequent sub-specs build on it | Followed |
| D6 | Audit, tests, docs (sub-spec E) is its own track, not folded into A | Pending — sub-spec E |

---

## What shipped (sub-specs B + A + D1 + D2 + C)

**Sub-spec B — tRPC migration** ([design](rbac/b-trpc-migration/design.md) · [plan](rbac/b-trpc-migration/plan.md))
- Typed tRPC v11 layer at `apps/web/server/api/` (init, 3 middlewares, 4 procedure flavors, 5 routers, RSC caller, React Query client + provider)
- All 7 server actions migrated to procedures with declarative `.meta({ permission })`
- `apps/web/app/actions/` deleted entirely
- Zod 4 standardized; `typescript.ignoreBuildErrors` removed; ADR-013

**Sub-spec A — Enforcement hardening** ([design](rbac/a-hardening/design.md) · [plan](rbac/a-hardening/plan.md))
- `users.memberships_version` column + partial UQ index `uq_family_members_family_owner` via idempotent `ensureCentralSchema()` (mirrors `ensureFamilySchema()`)
- `apps/web/lib/db-singleton.ts` — lazy `getCentralDb()` (auto-runs ensureCentralSchema) + `getCentralDbSync()` (for Auth.js callbacks)
- JWT type augmentation + JWT callback populates `membershipsVersion`
- `getAuthContext()` re-derives role from JWT (no header trust); `parseRole()` validation; warn logs on tamper / multi-membership ambiguity
- `proxy.ts` strips inbound `x-user-*`/`x-family-*`; stops setting `x-family-role`; detects stale JWT; **blocks mutations on /api/ with 409 when stale** (the security teeth)
- 97 `withAuth(perm)` + 9 `requireAuthContext()` callers swept to pass `request` (closes prerender hazard)
- `bumpMembershipsVersion(Many)` helper wired in **5 mutation sites**: acceptInvite, createFamily, transferOwnership (×2), member role-change, member removal
- `family/_actions.ts` rebuilt via `createCallerFactory(familyRouter)`
- `/api/debug` gated behind `NODE_ENV !== 'production'`
- ADR-014; new tests: header-strip + jwt-staleness + owner-uniqueness

**Sub-spec D1 — Client-side enforcement foundation** ([design](rbac/d1-foundation/design.md) · [plan](rbac/d1-foundation/plan.md))
- `<AppSessionProvider>` mounts NextAuth's `<SessionProvider>` inside `<TRPCReactProvider>` (any descendant can call `useSession()`)
- `useActiveMembership(familyIdHint?)` + `useHasPermission(permission)` hooks (hint precedence: explicit > URL `?family=` > `memberships[0]`)
- `<RoleGate permission="x:y" fallback?>` — UX-only client affordance hiding (server still enforces via 403/409)
- `<JwtRefreshObserver>` reads `force-jwt-refresh` cookie on mount + every navigation, calls `useSession().update()`, clears cookie, toasts
- `jwtStaleLink` — custom tRPC link intercepts 409 with `code: 'JWT_STALE'`; clears cookie before update to prevent observer double-fire; toast `'Session refreshed — please retry'`
- `force-jwt-refresh` cookie made non-httpOnly (carries no secret; JWT itself stays httpOnly)
- `TRPCReactProvider` split into outer (SessionProvider mount) + inner (uses `useSession` to wire link); `useRef(update)` pattern protects against NextAuth v5's per-render `update` identity
- Carry-forwards from A: `getCentralDbSync()` triggers `ensureCentralSchema` via shared `_ensurePromise` (closes fresh-deploy hazard); `formAction` renamed to `protectedFormAction` for symmetry
- ADR-015; new tests: 11 hooks + 5 RoleGate + 4 observer + 3 stale-link = 23; total apps/web 429 (was 406)

**Sub-spec D2 — Family switcher UX + RoleGate adoption** (design + plan pending promotion to `docs/rbac/d2-ux/`)
- Family switcher wired into `<AppHeader>` between Search and ModeToggle; uses `family.listMine` tRPC query; renders only when ≥2 memberships; 240px width cap with truncate
- `family_members.lastSeenAt` written on every family switch (fire-and-forget); proxy default-family selection now orders by `lastSeenAt DESC NULLS LAST, joinedAt DESC`
- URL-mismatch redirect: unknown `?family=` param cleared from URL + cookie cleared, preventing infinite redirect loops
- 47 `<RoleGate>` adoptions across 15 client components: tree toolbar + context menu, person form/dialog/detail, members + settings, GEDCOM import/export + tree export, AI biography + events
- `runRefresh` debounce module: `<JwtRefreshObserver>` + `jwtStaleLink` coalesce into a single in-flight refresh + `queryClient.invalidateQueries()` + single toast (absorbs D1 race carry-forward)
- `JWT_REFRESH_COOKIE_NAME` extracted to `packages/auth/src/constants.ts` (was duplicated across 4 sites — absorbs D1 cookie-const carry-forward)
- Welcome toast on dashboard after invite-accept
- ADR-016; new tests: +30; total apps/web 459 (was 429)

**Sub-spec C — Share / invite UX** ([design](rbac/c-share-invite/design.md) · [plan](rbac/c-share-invite/plan.md))
- New permission `members:transfer-ownership` (owner-only) added to matrix
- `transferOwnership` wrapped in explicit `BEGIN/COMMIT/ROLLBACK` transaction (raw SQL, driver-agnostic for both better-sqlite3 and libsql) — closes the non-atomic carry-forward from A
- UQ partial-index violation surfaced as `ConcurrentTransferError` → HTTP 409 `{ code: 'CONCURRENT_TRANSFER' }`
- New `POST /api/families/[id]/members/[userId]/transfer-ownership` endpoint (no body — caller transfers their own ownership)
- `<TransferOwnershipDialog>` — type-to-confirm with family name (whitespace-trimmed match)
- Per-row `<DropdownMenu>` in `<MemberList>` (Transfer ownership + Remove member); replaces the old standalone trash button
- New "Last seen" column in members table; GET `/members` now returns `lastSeenAt`; rendered via `formatDistanceToNow`
- `<InviteDialog>` hides "admin" role option for non-owner inviters (UX polish; server already enforced)
- ADR-017; `sub-spec-c-complete` tag; 11 new tests in `@ancstra/auth` (107 → 118)

**Open questions deferred from C** (revisit if user demand surfaces):
- Bulk-invite (CSV)?
- Email delivery provider?

---

## What's pending

### Sub-spec E — Audit, tests, docs

- Property test for the permission matrix (`packages/auth`)
- Integration test grid: per-role × per-route — 4 roles × ~58 endpoints, automated
- Multi-family integration tests: user with 2 memberships → verify isolation
- ADR for the 4-roles-but-3-user-facing model (cross-cutting decision D1) — currently scattered across ADR-013, ADR-014; consolidate
- Rewrite `docs/specs/collaboration.md` to reflect implemented state
- Update `docs/phases/phase-1-core.md:336-343` to remove "multi-user RBAC won't" line
- Update `docs/architecture/data-model.md` to document `familyRegistry` + `familyMembers` + `invitations`

**Carries forward into E** (from A reviews):
- **Shared test fixture for central schema** — 22 test files (web 4, auth 7, ai 7, research 4) now hand-write `users` CREATE TABLE with `memberships_version`. Future schema additions need to update them all in lockstep. Recommended fix: a `packages/db/src/test-fixtures/central-schema-sql.ts` exporter, or call `await ensureCentralSchema(db)` after a base CREATE TABLE so the fixture lives in one place.
- Coverage threshold for the matrix test? Snapshot vs. table-driven?

---

## Bucket of follow-ups not specifically tied to D/C/E

| Follow-up | Source | Suggested home |
|---|---|---|
| Migrate `@ancstra/ai` off the `zod/v3` shim | sub-spec B Task 1 review | E (or a dedicated minor cleanup PR) |
| Vercel 4.5 MB body-limit guard for GEDCOM imports | sub-spec B Task 23 review | Separate PR — UX touches the import dialog |
| ~~`transferOwnership` non-atomic across role swap + version bumps + registry update~~ | sub-spec A final review (I4) | ✅ Folded into C plan (Tasks 3-4) |
| ~~`getCentralDbSync()` doesn't trigger `ensureCentralSchema`~~ | sub-spec A final review (I2) | ✅ Folded into D1 plan (Task 10) |
| ~10 routes still call `createCentralDb()` directly (bypass singleton) | sub-spec A final review (M1) | E or minor cleanup (deferred from D1) |
| ~~Naming asymmetry: `formAction` vs `authedFormAction`/`publicFormAction`~~ | sub-spec B final review | ✅ Folded into D1 plan (Task 11) |
| ~~Extract `force-jwt-refresh` cookie name to shared constant~~ | sub-spec D1 final review | ✅ Absorbed into D2 (`JWT_REFRESH_COOKIE_NAME` in `packages/auth/src/constants.ts`) |
| ~~`queryClient.invalidateQueries()` after `update()` resolves~~ | sub-spec D1 final review | ✅ Absorbed into D2 (`runRefresh` debounce module) |
| ~~Concurrent observer + link race (duplicate toasts)~~ | sub-spec D1 final review | ✅ Absorbed into D2 (`runRefresh` coalesces both into single in-flight refresh) |
| `apps/web/server/api/routers/family.ts` may be redundant with `family/_actions.ts` post-rebuild | sub-spec B final review note | Audit during E |
| In-process LRU cache for `fetchMembershipsVersion` (~30s TTL) | sub-spec A spec open question | Defer until prod numbers warrant |
| Pre-existing Windows `sharp` failure in `@ancstra/ai/__tests__/detect-conflicts.test.ts` | recurring | Out of RBAC scope; install win32-x64 sharp binary or isolate the import |

---

## Trust contract (post sub-spec A)

| Source | Trusted for |
|---|---|
| `JWT.session.user.memberships` | role (always) |
| `x-user-id` header | userId (set by middleware from session) |
| `x-family-id` header | familyId hint (set by middleware from active selection) |
| `x-family-db` header | dbFilename (set by middleware from selected membership) |
| ~~`x-family-role` header~~ | **NEVER SET, NEVER READ** |
| `users.memberships_version` column | JWT-staleness signal |
| `family_members` partial UQ index `uq_family_members_family_owner` | one-owner-per-family invariant |

---

## Suggested execution order for what's next

Updated post-C: B → A → ~~D1~~ → ~~D2~~ → ~~C~~ → **E**.

**E is up next** — with C shipped, the integration-test grid can exercise the full RBAC matrix end-to-end (4 roles × ~58 endpoints), and the shared test fixture for central schema can finally be designed against the stable shape (closes the 22-files-hand-write-CREATE-TABLE maintenance hazard from sub-spec A).

**Standalone cleanup PRs** can land independently whenever convenient (createCentralDb singleton sweep, `@ancstra/ai` zod/v3 shim, GEDCOM body-limit guard).

---

## How to use this doc

- **Returning to the project after a break?** Read this file top-to-bottom, then dive into the spec/plan of whichever sub-spec is next.
- **Picking up D/C/E?** The "What's pending" section above is the brief — the full brainstorm/spec/plan still need to happen for each. Use the same flow as B and A: brainstorming skill → writing-plans → subagent-driven-development.
- **Scratch versions live in `docs/superpowers/{specs,plans}/`** (gitignored) — those are the working drafts produced by the brainstorming skill. The committed copies in `docs/rbac/` are the canonical reference and may diverge over time. Treat the gitignored ones as historical scratch.
- **Cross-cutting architecture (`docs/rbac/architecture.md`) is the foundation.** Any new sub-spec must respect decisions D1–D6.
