# RBAC Cross-Cutting Architecture — Ancstra

> **Looking for a narrative overview?** See [`docs/architecture/rbac-and-family-spaces.md`](../architecture/rbac-and-family-spaces.md). This document is the original design spec + decision log; it assumes the reader is reviewing past decisions.

**Status:** Cross-cutting design spec. NOT an implementation plan.
**Date:** 2026-04-29
**Author:** brainstorm session w/ Claude

---

## Context

**The need.** Ancstra is moving from single-user (Phase 1 docs) toward multi-user families with role-scoped access. A user must be able to belong to multiple families with different roles in each (e.g. `admin` in their own family, `viewer` in a sibling's). The system must guarantee that a user can only see/mutate data for families where they hold a membership, and that within a family their actions are bounded by their role.

**Surprise finding from exploration.** Most of the underlying RBAC machinery is already built but undocumented and unfinished:
- `packages/auth/src/permissions.ts:19-35` — full 4-role permission matrix
- `packages/db/src/central-schema.ts:52-65` — `familyMembers` join table with role
- `packages/db/src/central-schema.ts:39-49` — `familyRegistry` with `ownerId` + per-family `dbFilename` (each family lives in its own SQLite file)
- `packages/db/src/central-schema.ts:68-84` — `invitations` table
- `apps/web/proxy.ts` — Next.js middleware that resolves active family and sets `x-family-*` headers
- `apps/web/lib/auth/api-guard.ts:22-29` — `withAuth(permission)` wrapper used by 51 mutating route handlers
- `apps/web/components/auth/family-picker.tsx` — switcher UI **built but never mounted**

**The gap.** Hardening, missing UX, doc drift, and an unverified trust model:
- 7 server actions in `apps/web/app/actions/` only check `session?.user?.id`, not per-family role
- `withAuth()` trusts headers; a forged `x-family-role` from outside the proxy could escalate
- `FamilyPicker` is unwired; users with multiple memberships have no way to switch
- No client-side `<RoleGate>` — viewers see edit affordances and rely on 403 from the API
- `docs/phases/phase-1-core.md:336-343` lists multi-user RBAC as out-of-scope, contradicting reality
- No tests for multi-family scenarios, no permission-matrix tests
- `docs/specs/collaboration.md` is marked "Phase 5: Not Started" but the schema is in production code

**Intended outcome.** A documented architecture that (1) pins down the role model + invariants, (2) defines the enforcement layers and trust model, (3) decomposes the remaining work into 5 sub-projects with execution order, and (4) gives each sub-project a clear scope so it can be brainstormed and planned independently.

---

## Decisions captured this session

| # | Decision | Rationale |
|---|---|---|
| D1 | Keep 4 roles in DB; surface only 3 in UI | `owner` becomes implicit (family creator). Preserves destroy-rights distinction without cluttering UX. |
| D2 | Re-derive role from JWT in `withAuth()`, headers are hint-only | Closes header-forgery bypass. ~20 lines in `api-guard.ts`. |
| D3 | Exactly one owner per family, transferable via single transaction | Mirrors GitHub/Linear. DB-enforced via partial unique index. |
| D4 | tRPC migration is the long-term substrate for action-level enforcement | All future writes (server actions + new mutations) become `protectedProcedure(permission)` calls. |
| D5 | Build tRPC first; subsequent sub-specs (A, C, D, E) assume it | Avoids throwaway inline `requirePermission()` stop-gaps. |
| D6 | Audit/tests/docs is its own sub-spec (E), not folded into A | Cross-cutting; verifies A+B+C+D together. |

---

## Role model

```
                    DB columns         UI dropdown        Uniqueness          Distinguishing perms
┌──────────────┬──────────────────┬─────────────────┬──────────────────┬───────────────────────────────────────┐
│ owner        │ familyMembers    │ NO (implicit)   │ exactly 1 / fam  │ tree:delete, settings:manage,         │
│              │   .role='owner'  │                 │  (partial UQ)    │  members:transfer-ownership (NEW)     │
├──────────────┼──────────────────┼─────────────────┼──────────────────┼───────────────────────────────────────┤
│ admin        │ "                │ YES             │ many / fam       │ members:manage, all CRUD              │
│ editor       │ "                │ YES             │ many / fam       │ CRUD persons/events/sources, ai:res.  │
│ viewer       │ "                │ YES             │ many / fam       │ tree:view, activity:view              │
└──────────────┴──────────────────┴─────────────────┴──────────────────┴───────────────────────────────────────┘
```

**Schema additions** (one migration in `packages/db/migrations/`):
- `CREATE UNIQUE INDEX family_members_one_owner ON family_members (family_id) WHERE role = 'owner';` (partial UQ — SQLite ≥ 3.8 supports this)
- Add column `users.memberships_version INTEGER NOT NULL DEFAULT 0` — bumped whenever the user's memberships change, used by middleware to detect stale JWTs

**Permission matrix additions** (in `packages/auth/src/permissions.ts`):
- `members:transfer-ownership` → owner only
- `family:switch` → all roles (trivial; used only for UI guard symmetry)

**Ownership transfer**: single transaction in central DB → demote current `owner` → `admin`, promote target `admin` → `owner`, bump both users' `memberships_version`, append to `activityFeed`. Atomicity is the partial unique index doing its job.

---

## Enforcement layers (defense-in-depth, fail-closed)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ L1 — middleware.ts (rename from proxy.ts)                                      │
│   • Resolve active family: ?family= → cookie → memberships[0]                  │
│   • STRIP any client-supplied x-family-* / x-user-* headers (NEW)              │
│   • Verify activeFamilyId ∈ JWT.memberships, else 403                          │
│   • Set x-user-id, x-family-id, x-family-db (NO x-family-role anymore)         │
│   • Refresh JWT if memberships_version stale                                   │
│   • Redirect unauth to /login                                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│ L2 — withAuth(permission)  [api-guard.ts]                                      │
│   • Re-derive role from JWT.memberships[familyId]  ← NOT from x-family-role   │
│   • requirePermission(role, permission) → throws ForbiddenError                │
│   • Returns { ctx, familyDb, centralDb }                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│ L3 — tRPC protectedProcedure(permission)  [new packages/trpc, sub-spec B]     │
│   • Per-procedure permission middleware                                        │
│   • Replaces 7 server actions in apps/web/app/actions/                         │
│   • New mutations for share UX, switcher, etc. land here from day one          │
├────────────────────────────────────────────────────────────────────────────────┤
│ L4 — <RoleGate permission="..."> + useHasPermission()  [client, sub-spec D]   │
│   • Hides edit affordances client-side                                         │
│   • UX-only — never the security boundary                                      │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Read-path note.** Per-family DB physical isolation (each family = own SQLite file via `createFamilyDb(dbFilename)` in `packages/db/src/index.ts:41-50`) means cross-family data leakage at the family-DB layer is essentially impossible — the connection literally points at a different file. Central-DB queries (memberships, invitations, activity feed) still need explicit `WHERE familyId = ctx.familyId` filters.

---

## Header / JWT contract

**JWT shape** (already implemented in `apps/web/auth.ts:77-115`):

```ts
{
  sub: userId,
  memberships: Array<{ familyId, role, dbFilename }>,
  memberships_version: number,  // NEW — bumped on any membership change
}
```

**Refresh policy.** Today, memberships only refresh on sign-in or explicit `update` trigger. New rule: when middleware sees `JWT.memberships_version < users.memberships_version`, force refresh on next request. Trigger version bumps on: invite accepted, role updated, owner transferred, member removed, family deleted.

**Headers set by middleware (downstream-trusted, hint-only):**
- `x-user-id` — from JWT, never client-supplied
- `x-family-id` — resolved active family
- `x-family-db` — for fast `createFamilyDb()` without a central-DB lookup
- ~~`x-family-role`~~ — **removed.** Role is always re-derived in `withAuth()` from `JWT.memberships[familyId]`.

---

## Family-scope invariants (testable promises)

1. **Membership = sole access grant.** No row in `familyMembers (userId, familyId)` ⇒ no access to that family's data.
2. **Active family ∈ user's memberships.** Middleware refuses to set `x-family-id` for a non-membership family; returns 403.
3. **Role is per-family.** No global admin concept.
4. **Permission lookup is pure.** `hasPermission(role, permission)` is a pure function over the in-memory matrix.
5. **Owner uniqueness is DB-enforced** (partial unique index, not application check).
6. **Per-family DB isolation.** A connection from `createFamilyDb('A.db')` cannot see family B's family-scoped tables.

Sub-spec E adds an integration-test suite that verifies each of these directly.

---

## Sub-spec breakdown & execution order

Today's deliverable defines the architecture. Each sub-spec gets its own brainstorm → spec → plan cycle.

**Order: B → A → D → C → E** (per D5).

### Sub-spec B — tRPC migration (do first)

**Scope.**
- New `packages/trpc` workspace: router, `createTRPCContext()` reading from middleware-set headers + JWT, `protectedProcedure(permission)` middleware
- React-Query client setup in `apps/web/`
- Migrate the 7 actions in `apps/web/app/actions/` to tRPC procedures:
  - `auth.ts`, `create-family.ts`, `create-related-person.ts`, `export-gedcom.ts`, `import-gedcom.ts`, `join.ts`, `person-detail.ts`
- **Out of scope:** migrating the 51 route handlers (defer; they keep `withAuth()` for now). Route handlers may stay forever for: file uploads, NextAuth callback, AI streaming responses, webhooks.

**Critical files to create/modify.**
- `packages/trpc/src/{router.ts, context.ts, middleware.ts, index.ts}` (new)
- `apps/web/lib/trpc/{client.ts, provider.tsx, server.ts}` (new)
- `apps/web/app/actions/*.ts` (migrate then delete)
- All call-sites of those actions (`<form action={...}>` → `useMutation()` or `<form action={trpcAction}>` via tRPC's Next.js form-action helper)

**Context7 lookups required at brainstorm time.** tRPC v11 + Next.js 16 App Router patterns; React-Query v5 SSR.

### Sub-spec A — Enforcement hardening

**Scope.**
- Rename `apps/web/proxy.ts` → `apps/web/middleware.ts` (Next.js convention; current "proxy" naming is misleading)
- Strip incoming `x-family-*` and `x-user-*` headers in middleware
- Remove `x-family-role` from middleware-set headers
- Re-derive role from JWT inside `withAuth()` — **do this for every remaining route handler**
- Drizzle migration: partial unique index on `family_members (family_id) WHERE role='owner'`
- Drizzle migration: add `users.memberships_version`
- Membership-version refresh logic in `auth.ts` JWT callback + middleware

**Critical files.**
- `apps/web/middleware.ts` (rename + edit)
- `apps/web/lib/auth/api-guard.ts:22-29`
- `apps/web/auth.ts:77-115`
- `packages/db/migrations/0009_*.sql` (new)
- `packages/db/src/central-schema.ts` (add column + index)

### Sub-spec D — Family switcher + multi-family UX + RoleGate

**Scope.**
- Wire `apps/web/components/auth/family-picker.tsx` into the app header/sidebar
- Persist `lastSeenAt` on `familyMembers` per active-family request (already a column, never written)
- Use `lastSeenAt DESC` to pick default active family (replaces `memberships[0]`)
- Redirect-on-deletion: if active family no longer in memberships, fall back to last-used or `/onboarding`
- New `<RoleGate permission="...">` and `useHasPermission()` in `apps/web/components/auth/role-gate.tsx`
- Apply `<RoleGate>` to: tree-edit toolbar, person-form save button, event editors, share/invite buttons
- Multi-family onboarding: handle the "user accepts invite while logged in to another family" flow

**Critical files.**
- `apps/web/components/auth/family-picker.tsx` (wire in)
- `apps/web/components/layout/app-header.tsx` (or wherever the topbar lives — find at brainstorm)
- `apps/web/components/auth/role-gate.tsx` (new)
- `apps/web/middleware.ts` (last-seen-based default selection)
- `apps/web/components/person-form.tsx`, `apps/web/components/tree/*` (apply gates)

### Sub-spec C — Share / invite UX

**Scope.**
- `/settings/members` page: list members (name + role badge + join date + last-seen), pending invites table
- Per-row actions: change role (admin can change non-owner roles; owner can change any), remove member, transfer ownership
- "Invite by email" dialog with role picker (admin/editor/viewer only — owner is hidden)
- Backend: 3 new tRPC procedures (`updateMemberRole`, `removeMember`, `transferOwnership`); invite flow already exists at `packages/auth/src/invitations.ts`

**Critical files.**
- `apps/web/app/(auth)/settings/members/page.tsx:10` (already exists, expand)
- `apps/web/components/members/*` (likely needs new components)
- `packages/trpc/src/routers/members.ts` (new procedures)

### Sub-spec E — Audit, tests, docs

**Scope.**
- Property test for the permission matrix (`packages/auth`)
- Integration test grid: per role × per route — 4 roles × ~58 endpoints, automated
- Multi-family integration tests: create user with 2 memberships, verify isolation
- Header-forgery test: forge `x-family-role`, confirm 403
- Owner-uniqueness test: try to insert second owner, confirm DB error
- New ADR: `docs/architecture/decisions/009-rbac-roles-and-scoping.md`
- Rewrite `docs/specs/collaboration.md` to reflect implemented state
- Update `docs/phases/phase-1-core.md:336-343` to remove "multi-user RBAC won't" line
- Update `docs/architecture/data-model.md` to document `familyRegistry` + `familyMembers` + `invitations`

**Critical files.** Listed above.

---

## Verification

**For this cross-cutting spec.** Verification = "the four sub-specs together, when implemented, satisfy the six invariants in §Family-scope invariants." Concretely, sub-spec E's integration test grid is the verification artifact.

**Per-sub-spec verification** belongs in each sub-spec's plan — each must include:
- A test command (`pnpm test` for matrix tests, `pnpm test:e2e` for integration)
- A manual sanity check (e.g., for D: "Sign in as user with 2 memberships, switcher dropdown shows both, click second, page re-renders with second family's data")
- A verification of invariants relevant to that sub-spec

---

## Open questions deferred to sub-spec brainstorms

These are deliberately **not** answered today; they belong in the relevant sub-spec brainstorm:

- **B:** tRPC v11 + Next.js 16 App Router compatibility nuances; React-Query SSR boundary; do we use `@tanstack/react-form` or `react-hook-form`?
- **A:** Exact JWT-refresh trigger mechanism — pull from DB on every middleware run (perf) vs. lazy-refresh on cache miss?
- **D:** Where in the layout does the family switcher live — header dropdown, sidebar, settings link only? Visual treatment of role badge.
- **C:** Bulk-invite (CSV)? Invite-via-link (no email)? Email delivery provider?
- **E:** Coverage threshold for the matrix test? Snapshot vs. table-driven?

---

## Files this plan does NOT touch (but the sub-specs will)

Deliberately listing these so a future reader sees the affected surface area:

- `apps/web/proxy.ts` → `apps/web/middleware.ts` (rename + edit; sub-spec A)
- `apps/web/lib/auth/api-guard.ts` (sub-spec A)
- `apps/web/auth.ts` (sub-spec A)
- `apps/web/app/actions/*.ts` (sub-spec B — migrate then delete)
- `apps/web/components/auth/family-picker.tsx` (sub-spec D — wire in)
- `apps/web/components/auth/role-gate.tsx` (sub-spec D — new)
- `apps/web/app/(auth)/settings/members/page.tsx` (sub-spec C — expand)
- `packages/auth/src/permissions.ts` (sub-specs A + B — add 2 perms)
- `packages/db/src/central-schema.ts` (sub-spec A — add column + index)
- `packages/db/migrations/0009_*.sql` (sub-spec A — new)
- `packages/trpc/**` (sub-spec B — new workspace)
- `docs/architecture/decisions/009-rbac-roles-and-scoping.md` (sub-spec E — new ADR)
- `docs/specs/collaboration.md` (sub-spec E — rewrite)
- `docs/phases/phase-1-core.md` (sub-spec E — fix scope-out line)
- `docs/architecture/data-model.md` (sub-spec E — document central schema)

---

## Next step

After this spec is approved, the immediate next action is: **brainstorm sub-spec B (tRPC migration)**. That brainstorm will use Context7 to verify tRPC v11 + Next.js 16 + Auth.js v5 integration patterns, then produce its own spec → plan → execution.

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
