# Sub-spec A — Enforcement Hardening (RBAC roadmap)

**Status:** Design spec, awaiting user review.
**Date:** 2026-04-30
**Parent:** RBAC cross-cutting architecture spec at `~/.claude/plans/lets-plan-the-following-clever-rainbow.md`.
**Order in roadmap:** A (second of 5 sub-specs: B → A → D → C → E).
**Predecessor:** Sub-spec B (`docs/superpowers/specs/2026-04-29-rbac-subspec-b-trpc-migration-design.md`) — completed 2026-04-29, tagged `sub-spec-b-complete`.
**Author:** brainstorm session w/ Claude.

---

## Context

**Why this is the second sub-spec.** The cross-cutting RBAC architecture (decision D5) committed to building tRPC first as the substrate for new mutations, then hardening the residual enforcement surface (the 97 REST route handlers + the existing middleware). Sub-spec B left several deferred items that A is the natural home for:

- `withAuth()` still trusts `x-family-role` header on its hot path (cross-cutting D2 says re-derive from JWT)
- `family/_actions.ts` bypasses tRPC (carried from B's final review — should follow account/auth's createCaller pattern)
- `createCentralDb()` is called per-request in `init.ts` (waste — `auth.ts:14-19` shows the lazy-singleton precedent)
- `memberships_version` TODOs were planted in 4 mutation sites by sub-spec B but the column doesn't yet exist
- Owner-uniqueness invariant (cross-cutting D3) is application-level only; should be DB-enforced via partial unique index

**The state today.** Five concrete gaps:

1. **Header-trust gap.** `apps/web/lib/auth/context.ts:37-39` returns role directly from the `x-family-role` header on the hot path. A request bypassing the proxy (or with a forged header where the proxy somehow let it through) would set its own role. The fallback path at `context.ts:63-74` correctly queries the DB; the hot path is the vulnerability.

2. **Owner-uniqueness gap.** `packages/db/src/central-schema.ts:52-65` has `UNIQUE(familyId, userId)` but nothing prevents two `role='owner'` rows for the same family. `transferOwnership` in `packages/auth/src/families.ts:150-175` relies on application-level ordering; a race condition could create two owners.

3. **Stale-JWT gap.** Today, `apps/web/auth.ts:77-115` only refreshes memberships on initial sign-in, explicit `update()` trigger, or missing memberships in token. If a user is removed from a family or has their role downgraded, their JWT keeps the old memberships until they manually re-sign-in.

4. **Per-request connection waste.** `apps/web/server/api/init.ts:31` calls `createCentralDb()` on every tRPC request. `apps/web/auth.ts:14-19` already has a lazy-singleton pattern that should be mirrored.

5. **Pre-existing prerender hazard.** 86 of 97 `withAuth()` callers don't pass the `request` argument. Per the JSDoc on `withAuth` (`api-guard.ts:18-21`), this can cause `HANGING_PROMISE_REJECTION` during Next.js prerendering. Pre-existing but easy to sweep while we're hardening this layer.

**The intended outcome.** A hardened auth surface where:
- Role is always re-derived from `JWT.memberships`, never from any HTTP header
- Owner uniqueness is DB-enforced (not app-enforced)
- Stale JWTs are detected and refreshed within one request after a membership mutation
- Per-request DB connection waste is eliminated
- Every `withAuth()` call passes `request` (no prerender hangs)
- One ADR records the new contract; tests verify each invariant

After this sub-spec, sub-specs C (share/invite UX) and D (family switcher + RoleGate) build on a cleaner enforcement substrate, and the role-from-header attack surface is closed.

---

## Decisions captured this brainstorm

| # | Decision | Rationale |
|---|---|---|
| A1 | Keep `apps/web/proxy.ts` (do NOT rename to `middleware.ts`) | Next.js 16 supports both `proxy.ts` and `middleware.ts` as siblings (`node_modules/next/dist/build/utils.d.ts:135-136`). Renaming buys nothing functionally. Add a comment so future readers don't assume `proxy.ts` is legacy. |
| A2 | Re-derive role from JWT in BOTH `getAuthContext` and `withAuth` | Closes the header-trust hot path. Pure code change, no API surface change for callers. |
| A3 | Sweep all 86 `withAuth(...)` calls to add `request` arg | Mechanical fix while we're touching the layer. Closes pre-existing HANGING_PROMISE_REJECTION risk. Single sweeping commit. |
| A4 | Lazy `memberships_version` comparison in middleware | Per-request DB lookup of `users.memberships_version`. If JWT is stale → trigger NextAuth `update()` on the same request. No WebSocket infrastructure needed. Optional in-process cache (~30s TTL) deferred until prod numbers warrant. |
| A5 | DB-enforce single owner via partial unique index | `CREATE UNIQUE INDEX ... WHERE role='owner'`. SQLite ≥ 3.8 supports it. App-level checks remain as defense-in-depth but the index is the truth. |
| A6 | Bump `memberships_version` at all 4 mutation sites | Helper function in `packages/auth/src/memberships.ts`. Sites: `acceptInvite`, `createFamily`, `transferOwnership` (twice), and the rebuilt `family/_actions.ts` (which now goes through the procedure). |
| A7 | Lazy memoize `createCentralDb` in `init.ts` | Mirror `auth.ts:14-19` pattern. ~5 lines. |
| A8 | Rebuild `family/_actions.ts` via createCaller | Match `account/_actions.ts` + `auth/_actions.ts` shape so all three form-actions follow one pattern. Eliminates the bypass flagged in B's final review. |
| A9 | Defer Vercel 4.5MB body-limit guard for GEDCOM | Out of A's scope; track as separate follow-up issue. |

---

## Architecture

### Phase 1 — Schema migration (drizzle 0009)

**`packages/db/src/central-schema.ts` changes:**

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').notNull().default(0),
  membershipsVersion: integer('memberships_version').notNull().default(0), // NEW
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Below the familyMembers table definition, add:
export const familyMembersOwnerUnique = sqliteIndex('uq_family_members_family_owner')
  .on(familyMembers.familyId)
  .where(sql`role = 'owner'`)
  .unique();
```

(Drizzle's `sqliteIndex(...).where(sql\`...\`).unique()` may not be the exact API; verify against drizzle-kit docs. If unsupported declaratively, the migration can include the partial index as raw SQL — `0009_*.sql` will be hand-edited after generation.)

**Migration generation:**
```bash
pnpm --filter @ancstra/db drizzle-kit generate
```

Resulting `packages/db/migrations/0009_<name>.sql`:
```sql
ALTER TABLE `users` ADD `memberships_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_family_members_family_owner`
  ON `family_members` (`family_id`) WHERE `role` = 'owner';
```

### Phase 2 — Header trust hardening

**`apps/web/proxy.ts` changes:**

```ts
import { NextResponse } from 'next/server';
import { auth } from './auth';
import { getCentralDb } from './lib/db-singleton';
import { centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';

const TRUSTED_HEADER_PREFIXES = ['x-user-id', 'x-family-id', 'x-family-db'];
// NOTE: x-family-role removed — role is re-derived from JWT in getAuthContext

export const proxy = auth(async (request) => {
  let session = request.auth;

  if (!session?.user?.id) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Strip ALL inbound x-family-* and x-user-* headers — defense in depth
  // against requests that bypass the proxy or get crafted with fake headers.
  const requestHeaders = new Headers(request.headers);
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.startsWith('x-user-') || name.startsWith('x-family-')) {
      requestHeaders.delete(name);
    }
  }

  // Lazy memberships_version check — refresh JWT if stale
  const dbVersion = await fetchMembershipsVersion(session.user.id);
  if (dbVersion !== session.user.membershipsVersion) {
    // Re-call auth() with trigger='update' to rebuild memberships from DB
    session = await auth({ ...request, trigger: 'update' as const }) ?? session;
  }

  // ... existing active-family selection (?family= → cookie → memberships[0]) ...

  if (selected) {
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-family-id', selected.familyId);
    requestHeaders.set('x-family-db', selected.dbFilename);
    // x-family-role intentionally NOT set; re-derived from JWT downstream
  }

  // ... rest unchanged ...
});

async function fetchMembershipsVersion(userId: string): Promise<number> {
  const db = getCentralDb();
  const row = await db
    .select({ v: centralSchema.users.membershipsVersion })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  return row?.v ?? 0;
}
```

(The exact NextAuth update-trigger mechanism needs verification; Next-Auth v5 may require `await auth()` to be called fresh rather than passed `trigger`. The implementation plan resolves this.)

**`apps/web/lib/auth/context.ts` changes:**

Remove the hot-path lines 37-39 that return role from `x-family-role` header. Always go through the membership lookup:

```ts
export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  const headerStore = request?.headers ?? await headers();
  const userId = headerStore.get('x-user-id');
  const familyIdHint = headerStore.get('x-family-id');
  const dbFilename = headerStore.get('x-family-db');

  if (!userId) return null;

  // Always derive role from JWT memberships — never from x-family-role header
  const session = await auth();
  const memberships = session?.user?.memberships ?? [];
  const membership = familyIdHint
    ? memberships.find((m) => m.familyId === familyIdHint)
    : memberships[0];

  if (membership) {
    const role = parseRole(membership.role);
    if (role) {
      return {
        userId,
        familyId: membership.familyId,
        role,
        dbFilename: membership.dbFilename,
      };
    }
  }

  // Fallback: query DB (for invitations just accepted, JWT not yet refreshed)
  return dbFallback(userId, familyIdHint);
}
```

`parseRole` — reuse the helper added in sub-spec B at `packages/auth/src/types.ts`.

### Phase 3 — `withAuth` sweep

**No `withAuth` body change** — it already calls `requireAuthContext(request)` which now (post-Phase 2) returns the JWT-derived role.

**Mechanical sweep:** for every `withAuth(permission)` call site that doesn't pass `request`, add it. Pattern:

```ts
// Before
export async function POST(req: Request) {
  try {
    const { ctx, familyDb } = await withAuth('person:create');
    // ...
  } catch (e) { return handleAuthError(e); }
}

// After
export async function POST(req: Request) {
  try {
    const { ctx, familyDb } = await withAuth('person:create', req);
    // ...
  } catch (e) { return handleAuthError(e); }
}
```

86 routes. Each is a one-line diff. Single commit titled `refactor(api): pass request to withAuth in all 86 route handlers`.

The 11 routes that already pass `request` are untouched.

### Phase 4 — `memberships_version` bumps

**New helper file** `packages/auth/src/memberships.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import type { CentralDatabase } from '@ancstra/db';

export async function bumpMembershipsVersion(
  centralDb: CentralDatabase,
  userId: string,
): Promise<void> {
  await centralDb
    .update(centralSchema.users)
    .set({ membershipsVersion: sql`${centralSchema.users.membershipsVersion} + 1` })
    .where(eq(centralSchema.users.id, userId))
    .run();
}

export async function bumpMembershipsVersionMany(
  centralDb: CentralDatabase,
  userIds: ReadonlyArray<string>,
): Promise<void> {
  for (const id of userIds) await bumpMembershipsVersion(centralDb, id);
}
```

Re-export from `packages/auth/src/index.ts`.

**Mutation site updates:**

| Site | Bump |
|---|---|
| `packages/auth/src/invitations.ts:185-195` (`acceptInvite`) | `await bumpMembershipsVersion(centralDb, userId)` after the insert. Replace the `TODO(sub-spec-A)` marker. |
| `packages/auth/src/families.ts:59-66` (`createFamily`) | `await bumpMembershipsVersion(centralDb, opts.ownerId)` after the insert. |
| `packages/auth/src/families.ts:150-175` (`transferOwnership`) | `await bumpMembershipsVersionMany(centralDb, [oldOwnerId, newOwnerId])` after the role swap. |
| `apps/web/server/api/routers/family/_actions.ts` | Rebuilt to call into the procedure (see Phase 5); the procedure itself does the bump via the new helper. |
| `apps/web/server/api/routers/auth/_actions.ts` (acceptInvite formAction) | Already calls `acceptInvite` from `@ancstra/auth`, which after this change does the bump. No additional code. |

### Phase 5 — Carried-forward fixups

**5a. Lazy `createCentralDb` in `init.ts`:**

```ts
// apps/web/server/api/init.ts (top of file)
let _centralDb: ReturnType<typeof createCentralDb> | null = null;
function getCentralDb() {
  if (!_centralDb) _centralDb = createCentralDb();
  return _centralDb;
}

// In createTRPCContext:
const centralDb = getCentralDb();  // was: createCentralDb()
```

Mirrors `apps/web/auth.ts:14-19` pattern. Add brief comment pointing at the parallel.

**5b. Rebuild `family/_actions.ts`:**

```ts
// apps/web/server/api/routers/family/_actions.ts
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { familyRouter } from '../family';
import { createTRPCContext } from '../../init';
import { createCallerFactory } from '../../trpc';

export type CreateFamilyState = { error?: string } | undefined;

const createCaller = createCallerFactory(familyRouter);

export async function createFamilyAction(
  _state: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) return { error: 'Family name is required' };

  const ctx = await createTRPCContext({ headers: await headers() });
  const caller = createCaller(ctx);
  try {
    const { familyId } = await caller.create({ name });
    redirect(`/dashboard?family=${familyId}`);
  } catch (e) {
    return { error: (e as Error).message };
  }
}
```

Same shape as `account/_actions.ts:18-46`. The `family.create` procedure already exists from sub-spec B; we just route through it. The membership-version bump happens automatically because the procedure calls `createFamily` from `@ancstra/auth`, which after Phase 4 bumps the owner.

### Cross-cutting trust contract (post-A)

After this sub-spec ships:

| Source | Trusted for |
|---|---|
| JWT `session.user.memberships` | role (always) |
| `x-user-id` header | userId (set by middleware from session) |
| `x-family-id` header | familyId hint (set by middleware from active selection) |
| `x-family-db` header | dbFilename (set by middleware from selected membership) |
| ~~`x-family-role` header~~ | **NEVER SET, NEVER READ** |
| `users.membershipsVersion` column | JWT-staleness signal |
| `family_members` partial UQ index | one-owner-per-family invariant |

---

## Files modified

| Action | File | Phase |
|---|---|---|
| Edit | `packages/db/src/central-schema.ts` | 1 |
| Create | `packages/db/migrations/0009_<name>.sql` | 1 |
| Edit | `apps/web/proxy.ts` | 2 |
| Edit | `apps/web/lib/auth/context.ts` | 2 |
| Create | `packages/auth/src/memberships.ts` | 4 |
| Edit | `packages/auth/src/index.ts` (barrel re-export) | 4 |
| Edit | `packages/auth/src/invitations.ts` | 4 |
| Edit | `packages/auth/src/families.ts` | 4 |
| Edit | `apps/web/server/api/init.ts` | 5a |
| Edit | `apps/web/server/api/routers/family/_actions.ts` | 5b |
| Edit | 86 route handlers under `apps/web/app/api/` | 3 |
| Edit | `apps/web/auth.ts` (JWT callback to include `membershipsVersion`) | 2 |
| Create | `apps/web/__tests__/auth/header-strip.test.ts` | verification |
| Create | `apps/web/__tests__/auth/jwt-staleness.test.ts` | verification |
| Create | `packages/db/__tests__/owner-uniqueness.test.ts` (or extend existing) | verification |
| Create | `docs/architecture/decisions/014-rbac-enforcement-hardening.md` | ADR |

(JWT shape change: `apps/web/types/next-auth.d.ts` may need `membershipsVersion?: number` added on `session.user`.)

---

## Verification

**Type-level**
- `pnpm -r typecheck` clean (the `withAuth` sweep doesn't change signatures; the JWT extension is additive)

**Unit / integration**
- `header-strip.test.ts`: forge an `x-family-role: 'admin'` from a viewer's request → API returns 403 (because `getAuthContext` now ignores the header)
- `jwt-staleness.test.ts`: bump `users.membershipsVersion` directly in DB → next request's middleware detects mismatch → triggers refresh → role updates without re-sign-in
- `owner-uniqueness.test.ts`: `INSERT INTO family_members (family_id, role) VALUES ('f1', 'owner'), ('f1', 'owner')` → second insert fails with constraint error
- All existing 401 web tests + workspace tests still pass

**Manual smoke**
- `pnpm dev` → log in → check Network tab: requests have `x-user-id`, `x-family-id`, `x-family-db` but NOT `x-family-role`
- Browser devtools console: `await fetch('/api/persons/...', { headers: { 'x-family-role': 'admin' } })` from a viewer session → 403 (proves strip works)
- Open two browser tabs as different users; user A removes user B from a family; user B's next API call sees the removal within 1 request (proves staleness detection)
- DB inspector: try `INSERT INTO family_members (id, family_id, user_id, role, joined_at, is_active) VALUES (..., 'f1', 'u2', 'owner', ..., 1)` against a family that already has an owner → constraint violation

---

## Out of scope (deferred)

- Vercel 4.5MB body-limit guard for GEDCOM imports — separate follow-up
- In-process cache for `fetchMembershipsVersion` — defer until prod numbers show DB read becoming a bottleneck
- Migration of the 9 routes that DON'T use `withAuth` (NextAuth callback, debug, contributions, members, invitations) — they already use `requireAuthContext` directly which inherits the hardening; no separate work needed
- WebSocket-based JWT invalidation — out of scope; lazy compare is sufficient

---

## Open questions deferred to the implementation plan

- **NextAuth update-trigger mechanism in middleware.** Need to verify the exact API for forcing a JWT refresh from inside the proxy callback. NextAuth v5 may not support a per-request `trigger='update'` directly; might require setting a cookie that the next request's `auth()` callback observes.
- **Drizzle declarative partial unique index API.** Verify `sqliteIndex(...).where(...).unique()` syntax in current drizzle version. If unsupported declaratively, add the partial index as raw SQL in the migration file (drizzle-kit will accept hand-edited migrations).
- **JWT type augmentation.** `apps/web/types/next-auth.d.ts` will need `membershipsVersion?: number` on the JWT and session interfaces. Verify the augmentation pattern used today.
- **Test environment for owner-uniqueness.** Existing tests under `packages/db/__tests__` use what setup? In-memory SQLite via `better-sqlite3`? The test must apply migration 0009 to a fresh DB to exercise the constraint.

---

## Next step

After this spec is approved, invoke `superpowers:writing-plans` to produce the implementation plan. The plan turns the 5 phases into ordered, individually-verifiable subtasks following the same TDD + commit cadence as sub-spec B.
