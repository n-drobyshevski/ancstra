# RBAC Roadmap

Permanent reference for the role-based access control work in Ancstra. The cross-cutting architecture is split into five sub-specs (B → A → D → C → E); two are shipped, three are queued. This doc is the entry point for everything RBAC.

**Status:**

| Sub-spec | Topic | Status | Tag | ADR |
|---|---|---|---|---|
| **B** | tRPC migration (action substrate) | ✅ Shipped 2026-04-29 | `sub-spec-b-complete` | [ADR-013](architecture/decisions/013-trpc-as-action-substrate.md) |
| **A** | Enforcement hardening (header trust, JWT staleness, owner-uniqueness) | ✅ Shipped 2026-04-30 | `sub-spec-a-complete` | [ADR-014](architecture/decisions/014-rbac-enforcement-hardening.md) |
| **D** | Family switcher UX + RoleGate component | ⏳ Pending | — | — |
| **C** | Share / invite UX (settings/members page) | ⏳ Pending | — | — |
| **E** | Audit, tests, docs (test fixture consolidation, matrix tests) | ⏳ Pending | — | — |

---

## File map

```
docs/
├── RBAC_ROADMAP.md              ← you are here
├── rbac/
│   ├── architecture.md          ← cross-cutting design (decisions D1–D6)
│   ├── b-trpc-migration/
│   │   ├── design.md            ← spec
│   │   └── plan.md              ← 26-task implementation plan
│   └── a-hardening/
│       ├── design.md            ← spec
│       └── plan.md              ← 17-task implementation plan
└── architecture/decisions/
    ├── 013-trpc-as-action-substrate.md
    └── 014-rbac-enforcement-hardening.md
```

The per-sub-spec design + plan files are the historical artifacts as they were at execution time. They're committed alongside this roadmap so the project has one self-contained RBAC reference.

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

## What shipped (sub-specs B + A)

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

---

## What's pending

### Sub-spec D — Family switcher + RoleGate

**Original scope** (from cross-cutting architecture):
- Wire `apps/web/components/auth/family-picker.tsx` into the app header (component exists at `family-picker.tsx:21-56` but is unmounted)
- Persist `lastSeenAt` on `familyMembers` per active-family request (column exists, never written)
- Use `lastSeenAt DESC` to pick default active family (replaces current `memberships[0]`)
- Redirect-on-deletion: if active family no longer in memberships, fall back to last-used or `/onboarding`
- New `<RoleGate permission="...">` component + `useHasPermission()` hook reading session.memberships
- Apply `<RoleGate>` to: tree-edit toolbar, person-form save button, event editors, share/invite buttons
- Multi-family onboarding: handle "user accepts invite while logged in to another family"

**Carries forward into D** (from B + A reviews — the natural home for client-side concerns):
- **Client observer for `force-jwt-refresh` cookie** — sub-spec A sets the cookie on staleness detection but no consumer reads it. Mutations are blocked with 409, but reads still see stale role until next sign-in. Needs `useSession().update()` hook in `TRPCReactProvider` (or a new client component) + `/api/session/refresh` route. **D is the natural home** since RoleGate is also client-side and benefits from fresh session data.
- Naming asymmetry in tRPC procedure builders (`formAction` vs `authedFormAction`/`publicFormAction`) — small rename for symmetry
- `CommandPalette` is currently outside `TRPCReactProvider`; if it ever needs tRPC, must move inside

### Sub-spec C — Share / invite UX

- `/settings/members` page expansion: list members (name, role badge, join date, last-seen), pending invites table
- Per-row actions: change role, remove member, transfer ownership (admin can change non-owner roles; owner can change any)
- Invite-by-email dialog with role picker (admin/editor/viewer only — owner hidden)
- The REST routes at `/api/families/[id]/members/[userId]` already cover the mutations and now bump `memberships_version` (sub-spec A's C1 fix); C should surface them via the existing UI rather than duplicate as tRPC procedures
- Invite flow already exists at `packages/auth/src/invitations.ts` — wire into UI

**Open questions for C's brainstorm:**
- Bulk-invite (CSV)?
- Invite-via-link (no email)?
- Email delivery provider?

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
| `transferOwnership` non-atomic across role swap + version bumps + registry update | sub-spec A final review (I4) | D (or a dedicated transaction-wrap PR) |
| `getCentralDbSync()` doesn't trigger `ensureCentralSchema` | sub-spec A final review (I2) | D — fresh prod deploy hitting `/api/auth/*` before any proxied route could throw |
| ~10 routes still call `createCentralDb()` directly (bypass singleton) | sub-spec A final review (M1) | E or minor cleanup |
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

Per the original roadmap (B → A → **D** → C → E), sub-spec D is up next. Reasons:

1. The cookie-observer carry-forward from A belongs in D — RoleGate is also client-side and the `useSession().update()` integration fits naturally.
2. RoleGate is the missing piece for client-side enforcement; without it, the UI still relies on 403/409 from the server for affordance hiding.
3. C (share UX) will naturally consume RoleGate once D ships.

**Alternative**: a pre-D minor-cleanup PR could absorb the small carry-forwards (`getCentralDbSync` ensureCentralSchema; `createCentralDb` singleton sweep; `transferOwnership` atomicity) before starting D's larger UX work. Worth considering if the next session has limited context budget.

---

## How to use this doc

- **Returning to the project after a break?** Read this file top-to-bottom, then dive into the spec/plan of whichever sub-spec is next.
- **Picking up D/C/E?** The "What's pending" section above is the brief — the full brainstorm/spec/plan still need to happen for each. Use the same flow as B and A: brainstorming skill → writing-plans → subagent-driven-development.
- **Scratch versions live in `docs/superpowers/{specs,plans}/`** (gitignored) — those are the working drafts produced by the brainstorming skill. The committed copies in `docs/rbac/` are the canonical reference and may diverge over time. Treat the gitignored ones as historical scratch.
- **Cross-cutting architecture (`docs/rbac/architecture.md`) is the foundation.** Any new sub-spec must respect decisions D1–D6.
