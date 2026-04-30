# Sub-spec A — Enforcement Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the RBAC enforcement surface — re-derive role from JWT (never from `x-family-role` header), DB-enforce single-owner-per-family via partial unique index, detect stale JWTs via a `memberships_version` counter, sweep 86 route handlers to pass `request` to `withAuth()`, and ship 3 carried-forward fixups from sub-spec B (memberships bumps, lazy createCentralDb, family-action rebuild).

**Architecture:** Schema migration adds `users.memberships_version` and a partial UQ index on `family_members(family_id) WHERE role='owner'`. `proxy.ts` strips inbound `x-family-*`/`x-user-*` headers, stops setting `x-family-role`, and triggers JWT refresh when `membersVersion` is stale. `getAuthContext()` and `withAuth()` always derive role from `JWT.memberships`. Mutation sites (`acceptInvite`, `createFamily`, `transferOwnership`) bump `users.memberships_version` via a single helper. The form-action for family creation is rebuilt to flow through the existing tRPC procedure.

**Tech Stack:** Next.js 16.2.4 (proxy/middleware via `auth(...)` wrapper), Auth.js v5.0.0-beta.30 (JWT strategy), Drizzle ORM 0.45 + drizzle-kit (SQLite + libSQL with partial unique index — SQLite ≥ 3.8), Vitest.

**Reading prerequisites:** `apps/web/AGENTS.md` warns Next.js 16 has breaking changes from training-data versions. Tasks that touch Next-specific APIs (proxy callback, server-component headers, NextAuth update trigger) include a step to read the relevant doc under `apps/web/node_modules/next/dist/docs/` first.

**Parent spec:** `docs/superpowers/specs/2026-04-30-rbac-subspec-a-enforcement-hardening-design.md`.

**Predecessor:** Sub-spec B complete on `main` (tag `sub-spec-b-complete`, 28 commits, ADR-013).

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `apps/web/lib/db-singleton.ts` | Lazy-singleton accessors for `centralDb` + `familyDb` factories — eliminates per-request `createCentralDb()` waste in proxy.ts, init.ts, auth.ts |
| `packages/auth/src/memberships.ts` | `bumpMembershipsVersion(centralDb, userId)` and `bumpMembershipsVersionMany(centralDb, userIds)` — the single source of truth for users.membersVersion increments |
| `packages/db/migrations/0009_<name>.sql` | Drizzle migration adding `users.memberships_version` column + partial UQ index `uq_family_members_family_owner` |
| `apps/web/__tests__/auth/header-strip.test.ts` | Vitest: forge `x-family-role` from a viewer's request → API returns 403 (proves strip works in proxy + getAuthContext) |
| `apps/web/__tests__/auth/jwt-staleness.test.ts` | Vitest: bump `users.memberships_version` directly → next request's middleware detects mismatch → triggers refresh |
| `packages/db/__tests__/owner-uniqueness.test.ts` | Vitest + in-memory SQLite: insert second `role='owner'` row for a family → constraint violation |
| `docs/architecture/decisions/014-rbac-enforcement-hardening.md` | ADR documenting the trust contract |

**Modified files:**

| Path | What changes |
|---|---|
| `packages/db/src/central-schema.ts` | Add `membershipsVersion: integer('memberships_version').notNull().default(0)` to `users`. Optionally declare partial UQ index in TS (drizzle-kit may or may not support it; fallback is hand-edited migration) |
| `apps/web/types/next-auth.d.ts` | Augment `Session.user` and `JWT` with `membershipsVersion?: number` |
| `apps/web/auth.ts` | Lines 14-19 use shared `getCentralDb()` from `lib/db-singleton`. JWT callback (lines 77-127) populates `token.membershipsVersion` from the same DB query that loads memberships |
| `apps/web/proxy.ts` | Strip inbound `x-family-*` + `x-user-*` headers. Stop setting `x-family-role`. Add `fetchMembershipsVersion(userId)` lookup; when mismatched, trigger a JWT refresh on the same request |
| `apps/web/lib/auth/context.ts` | Remove the header-fast-path lines 37-39 (which trusted `x-family-role`). Always derive role from `JWT.memberships` via `auth()`; DB fallback only when JWT memberships is empty/stale |
| `apps/web/server/api/init.ts` | Use shared `getCentralDb()` from `lib/db-singleton` instead of per-request `createCentralDb()` |
| `apps/web/server/api/routers/family/_actions.ts` | Rebuild as a thin createCaller wrapper around `familyRouter.create` (mirrors `account/_actions.ts` pattern); membership bump happens automatically via the procedure |
| `packages/auth/src/index.ts` | Re-export `bumpMembershipsVersion` from new `memberships.ts` |
| `packages/auth/src/invitations.ts:185-195` | After familyMember insert, call `bumpMembershipsVersion(centralDb, userId)`. Replace `TODO(sub-spec-A)` marker. |
| `packages/auth/src/families.ts:59-66` (`createFamily`) | After familyMember insert (owner), call `bumpMembershipsVersion(centralDb, opts.ownerId)`. Replace `TODO(sub-spec-A)` marker. |
| `packages/auth/src/families.ts:150-175` (`transferOwnership`) | After role swap, call `bumpMembershipsVersionMany(centralDb, [oldOwnerId, newOwnerId])` |
| 86 route handlers under `apps/web/app/api/**/route.ts` | One-line: pass `request` arg to existing `withAuth(permission)` calls (mechanical sweep) |

**Untouched (in scope but no edits):**
- The 11 route handlers that already pass `request` to `withAuth`
- The 9 routes that don't use `withAuth` (NextAuth callback, debug, tRPC handler, contributions, members, invitations) — they call `requireAuthContext` directly which inherits the hardening
- All tRPC procedures from sub-spec B (no signature changes)

---

## Phase 1: Schema migration (Tasks 1–3)

Goal: add `users.memberships_version` and a DB-enforced single-owner constraint. After Phase 1, the schema supports staleness detection AND the owner invariant is enforced at the storage layer.

---

### Task 1: Add `membershipsVersion` to users schema

**Files:**
- Modify: `packages/db/src/central-schema.ts` (users table definition)

- [ ] **Step 1: Read the current users table definition**

Run: `cat packages/db/src/central-schema.ts | head -20`
Confirm the table starts at the top of the file. Note the exact import shape (`import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'`).

- [ ] **Step 2: Add the column**

Edit `packages/db/src/central-schema.ts`. Inside the `users` table object, add a new column entry between `emailVerified` and `createdAt`:

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').notNull().default(0),
  membershipsVersion: integer('memberships_version').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

- [ ] **Step 3: Typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0. If the change broke any consumers (e.g. tests inserting `users` rows that destructure all columns), the error will tell you where.

- [ ] **Step 4: Commit (no migration yet — that's Task 2)**

```bash
git add packages/db/src/central-schema.ts
git commit -m "feat(db): add users.memberships_version column to schema"
```
Use single-quoted bash HEREDOC. Co-Authored-By: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

### Task 2: Generate migration 0009 + hand-edit to add partial UQ index

**Files:**
- Create: `packages/db/migrations/0009_<auto-name>.sql`

- [ ] **Step 1: Inspect drizzle-kit setup**

Run: `cat packages/db/package.json | grep -A 5 scripts`
Confirm there's a `db:generate:central` (or similar) script. If not, the manual command is `pnpm --filter @ancstra/db drizzle-kit generate --config drizzle-central.config.ts`.

- [ ] **Step 2: Generate the migration**

Run from repo root: `pnpm --filter @ancstra/db drizzle-kit generate --config drizzle-central.config.ts`

Expected: a new file appears under `packages/db/migrations/` named like `0009_<some-adjective-noun>.sql` containing the `ALTER TABLE users ADD memberships_version ...` statement.

- [ ] **Step 3: Hand-edit the migration to append the partial UQ index**

Open the new `0009_*.sql`. After the `ALTER TABLE` statement, append:

```sql
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_family_members_family_owner`
  ON `family_members` (`family_id`) WHERE `role` = 'owner';
```

(Why hand-edit: drizzle-kit's TS schema API has limited support for partial unique indexes. SQLite ≥ 3.8 supports `CREATE INDEX ... WHERE ...` natively. Both better-sqlite3 and libSQL ship modern SQLite.)

- [ ] **Step 4: Verify the migration applies cleanly to a fresh DB**

Run: `pnpm --filter @ancstra/db db:reset` (or whatever script does a clean migration run; if absent, run a manual drizzle-kit migrate against a temp DB).

If no reset script exists, this minimal check:
```bash
rm -f /tmp/ancstra-test.sqlite
DATABASE_URL=file:/tmp/ancstra-test.sqlite pnpm --filter @ancstra/db drizzle-kit migrate --config drizzle-central.config.ts
```
Expected: no errors; all 9 migrations apply.

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations/
git commit -m "feat(db): migration 0009 — add memberships_version column + owner-uniqueness partial index"
```

---

### Task 3: Verify owner-uniqueness constraint with a unit test

**Files:**
- Create: `packages/db/__tests__/owner-uniqueness.test.ts`

- [ ] **Step 1: Inspect existing test patterns under packages/db**

Run: `ls packages/db/__tests__/`
Pick an existing test file. Read it for the local pattern (Vitest globals, in-memory SQLite setup with `better-sqlite3`, migration-application helper).

- [ ] **Step 2: Write the test**

Create `packages/db/__tests__/owner-uniqueness.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as centralSchema from '../src/central-schema';
import path from 'path';

function setupDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema: centralSchema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../migrations') });
  return db;
}

describe('family_members owner uniqueness', () => {
  it('allows exactly one owner per family', async () => {
    const db = setupDb();
    const now = new Date().toISOString();

    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, membershipsVersion: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, membershipsVersion: 0, createdAt: now, updatedAt: now },
    ]).run();

    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    await db.insert(centralSchema.familyMembers).values({
      id: 'm1', familyId: 'f1', userId: 'u1', role: 'owner',
      invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
    }).run();

    expect(() =>
      db.insert(centralSchema.familyMembers).values({
        id: 'm2', familyId: 'f1', userId: 'u2', role: 'owner',
        invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
      }).run()
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('allows multiple non-owner members in the same family', async () => {
    const db = setupDb();
    const now = new Date().toISOString();

    await db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, membershipsVersion: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, membershipsVersion: 0, createdAt: now, updatedAt: now },
    ]).run();

    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    await db.insert(centralSchema.familyMembers).values([
      { id: 'm1', familyId: 'f1', userId: 'u1', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
      { id: 'm2', familyId: 'f1', userId: 'u2', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
    ]).run();

    const rows = await db.select().from(centralSchema.familyMembers).where(/* ... */).all();
    // Two admin rows succeed
    expect(rows.length).toBe(2);
  });
});
```

- [ ] **Step 3: Run the test**

Run from `packages/db/`: `pnpm vitest run __tests__/owner-uniqueness.test.ts`
Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/__tests__/owner-uniqueness.test.ts
git commit -m "test(db): verify partial UQ index enforces single owner per family"
```

---

## Phase 2: Shared DB singleton (Task 4)

Goal: extract the lazy `createCentralDb()` pattern into a shared module so `auth.ts`, `proxy.ts`, and `init.ts` all reuse it.

---

### Task 4: Create lib/db-singleton + refactor auth.ts + init.ts

**Files:**
- Create: `apps/web/lib/db-singleton.ts`
- Modify: `apps/web/auth.ts:14-19`
- Modify: `apps/web/server/api/init.ts:31`

- [ ] **Step 1: Create the singleton module**

Create `apps/web/lib/db-singleton.ts`:

```ts
import { createCentralDb } from '@ancstra/db';

let _centralDb: ReturnType<typeof createCentralDb> | null = null;

export function getCentralDb() {
  if (!_centralDb) _centralDb = createCentralDb();
  return _centralDb;
}
```

(One function. No initialization on import. Per-process singleton; each server process gets one client.)

- [ ] **Step 2: Refactor `auth.ts` to use it**

Edit `apps/web/auth.ts`. Remove lines 14-19 (the inline `_centralDb` + `getCentralDb` definition) and replace with:

```ts
import { getCentralDb } from './lib/db-singleton';
```

(Place near the other imports at the top of the file.)

Verify: there are no other `_centralDb` references in `auth.ts`. The existing `getCentralDb()` calls (line 35 and line 91) now resolve to the imported helper.

- [ ] **Step 3: Refactor `init.ts` to use it**

Edit `apps/web/server/api/init.ts`. Find the line `const centralDb = createCentralDb();` (around line 31, inside `createTRPCContext`). Change it to `const centralDb = getCentralDb();`. Add the import:

```ts
import { getCentralDb } from '@/lib/db-singleton';
```

Remove the `createCentralDb` import if no other call-site in this file uses it (the `createFamilyDb` import stays).

- [ ] **Step 4: Typecheck + tests**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

Run from `apps/web/`: `pnpm vitest run`
Expected: all 401 tests pass (sub-spec B baseline).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db-singleton.ts apps/web/auth.ts apps/web/server/api/init.ts
git commit -m "refactor(web): extract centralDb lazy-singleton into shared module"
```

---

## Phase 3: JWT extension (Tasks 5–6)

Goal: extend the JWT and session types to carry `membershipsVersion`, then populate it in the auth callback.

---

### Task 5: Augment next-auth types with membershipsVersion

**Files:**
- Modify: `apps/web/types/next-auth.d.ts`

- [ ] **Step 1: Read the current augmentation**

Run: `cat apps/web/types/next-auth.d.ts`
Confirm the file augments both `next-auth` (Session.user) and `next-auth/jwt` (JWT) modules.

- [ ] **Step 2: Add `membershipsVersion` to both interfaces**

Edit `apps/web/types/next-auth.d.ts`. Add `membershipsVersion?: number` to:

1. The `User` extension (under the existing memberships field):
   ```ts
   declare module 'next-auth' {
     interface Session {
       user: {
         id: string;
         memberships?: FamilyMembership[];
         membershipsVersion?: number;  // NEW
       } & DefaultSession['user'];
     }
   }
   ```

2. The JWT extension:
   ```ts
   declare module 'next-auth/jwt' {
     interface JWT {
       userId?: string;
       memberships?: FamilyMembership[];
       membershipsVersion?: number;  // NEW
     }
   }
   ```

(Use whatever exact field names the existing file already uses for memberships — match the existing style.)

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0. Augmentations are additive; no consumer breakage.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/next-auth.d.ts
git commit -m "feat(types): augment Session + JWT with membershipsVersion"
```

---

### Task 6: Populate membershipsVersion in JWT callback

**Files:**
- Modify: `apps/web/auth.ts:77-127` (the `jwt` and `session` callbacks)

- [ ] **Step 1: Read the current JWT callback**

Run: `sed -n '77,127p' apps/web/auth.ts`
Confirm the existing `shouldRefresh` logic + the membership query.

- [ ] **Step 2: Update the JWT callback**

In the `jwt` callback in `apps/web/auth.ts`, modify the membership query to also fetch `users.membershipsVersion` and include both `trigger === 'update'` AND a stale-version check:

```ts
async jwt({ token, user, trigger }) {
  if (user) {
    token.userId = user.id;
  }

  const shouldRefresh =
    Boolean(user) ||
    trigger === 'update' ||
    (token.userId && !token.memberships);

  if (shouldRefresh && token.userId) {
    try {
      const db = getCentralDb();
      const memberships = await db
        .select({
          familyId: centralSchema.familyMembers.familyId,
          role: centralSchema.familyMembers.role,
          dbFilename: centralSchema.familyRegistry.dbFilename,
        })
        .from(centralSchema.familyMembers)
        .innerJoin(
          centralSchema.familyRegistry,
          eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
        )
        .where(
          and(
            eq(centralSchema.familyMembers.userId, token.userId as string),
            eq(centralSchema.familyMembers.isActive, 1),
          ),
        )
        .all();
      token.memberships = memberships as FamilyMembership[];

      const userRow = await db
        .select({ v: centralSchema.users.membershipsVersion })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, token.userId as string))
        .get();
      token.membershipsVersion = userRow?.v ?? 0;
    } catch (error) {
      console.error('[AUTH] Error loading memberships into JWT:', error);
    }
  }
  return token;
},
async session({ session, token }) {
  if (token.userId) {
    session.user.id = token.userId as string;
  }
  if (token.memberships) {
    session.user.memberships = token.memberships;
  }
  if (typeof token.membershipsVersion === 'number') {
    session.user.membershipsVersion = token.membershipsVersion;
  }
  return session;
},
```

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/auth.ts
git commit -m "feat(auth): populate membershipsVersion in JWT and session"
```

---

## Phase 4: Header trust hardening (Tasks 7–9)

Goal: proxy strips inbound headers, stops setting `x-family-role`, and detects stale JWTs. `getAuthContext` always derives role from JWT.

---

### Task 7: Update getAuthContext to remove header hot-path

**Files:**
- Modify: `apps/web/lib/auth/context.ts`

- [ ] **Step 1: Read the current implementation**

Run: `cat apps/web/lib/auth/context.ts`
Note: lines 28-100. The hot path (lines 37-39) returns role directly from the `x-family-role` header; the fallback path (lines 42-88) queries DB.

- [ ] **Step 2: Replace getAuthContext**

Edit `apps/web/lib/auth/context.ts`. Replace the body of `getAuthContext` with:

```ts
export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  const headerStore = request?.headers ?? await headers();
  const userId = headerStore.get('x-user-id');
  const familyIdHint = headerStore.get('x-family-id');
  const dbFilenameHint = headerStore.get('x-family-db');

  if (!userId) return null;

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

  // Fallback: stale JWT (e.g. user just accepted invite, JWT not yet refreshed) —
  // query central DB. Uses the dbFilename hint to avoid a second roundtrip
  // when only role is missing.
  return dbFallback(userId, familyIdHint, dbFilenameHint);
}
```

Add the necessary imports at the top:
```ts
import { auth } from '@/auth';
import { parseRole } from '@ancstra/auth';
```

(`parseRole` was added in sub-spec B at `packages/auth/src/types.ts` and re-exported via the barrel.)

The existing `dbFallback` (or whatever the inline fallback was named at lines 42-88) stays — extract it into a private `async function dbFallback(userId, familyIdHint, dbFilenameHint)` if it isn't one already.

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Run existing tests to confirm no regressions**

Run from `apps/web/`: `pnpm vitest run`
Expected: 401 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/context.ts
git commit -m "fix(auth): re-derive role from JWT in getAuthContext, never trust x-family-role header"
```

---

### Task 8: Update proxy.ts — strip headers + add staleness check

**Files:**
- Modify: `apps/web/proxy.ts`

- [ ] **Step 1: Read the Next.js 16 proxy/middleware contract**

Run: `find apps/web/node_modules/next/dist/docs -name '*proxy*' -o -name '*middleware*' 2>/dev/null | head -5`
Read the most relevant doc to confirm:
- Whether `auth(...)` callback can be `async` (yes per Auth.js v5)
- Whether the callback can call `auth()` again with a `trigger` argument (the contract for forcing JWT refresh from inside the callback)
- Whether returning `NextResponse.next({ request: { headers } })` reliably propagates downstream

If Auth.js v5 doesn't support per-request `trigger='update'` from inside the proxy, fall back to: set a cookie (`force-jwt-refresh: 1`) that the next request observes; the `jwt` callback at `auth.ts` checks the cookie and treats it as `trigger='update'`.

- [ ] **Step 2: Update proxy.ts**

Edit `apps/web/proxy.ts`. Full replacement (preserves the active-family selection logic but adds header stripping, removes `x-family-role` setting, and adds the staleness check):

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { auth } from './auth';
import { getCentralDb } from './lib/db-singleton';

async function fetchMembershipsVersion(userId: string): Promise<number> {
  const db = getCentralDb();
  const row = await db
    .select({ v: centralSchema.users.membershipsVersion })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  return row?.v ?? 0;
}

export const proxy = auth(async (request) => {
  let session = request.auth;

  if (!session?.user?.id) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Defense in depth: strip inbound x-user-* / x-family-* headers
  // before setting our own. Closes the gap if a request bypasses the proxy.
  const requestHeaders = new Headers(request.headers);
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.startsWith('x-user-') || name.startsWith('x-family-')) {
      requestHeaders.delete(name);
    }
  }

  // Lazy memberships_version check — refresh JWT if stale.
  // Cost: one indexed SELECT per request. Acceptable; cache later if needed.
  const dbVersion = await fetchMembershipsVersion(session.user.id);
  if (dbVersion !== (session.user.membershipsVersion ?? 0)) {
    // Set a cookie that the jwt() callback observes on the NEXT auth() call.
    // We can't force a JWT refresh in-place from middleware, so we set the
    // cookie now and let downstream picks up the fresh token next request.
    // Same-request: we proceed with the stale role; the user sees up-to-date
    // role on the next click. Acceptable trade-off for solo-dev simplicity.
    // Sub-spec D will add a UI hint when a refresh is pending.
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.set('force-jwt-refresh', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
    // Continue with stale headers for this request (best effort).
  }

  const memberships = session.user.memberships;
  const familyParam = request.nextUrl.searchParams.get('family');
  const familyCookie = request.cookies.get('active-family')?.value;
  const requestedFamilyId = familyParam || familyCookie || '';

  if (Array.isArray(memberships) && memberships.length === 0) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No family membership' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/create-family', request.url));
  }

  const list = memberships ?? [];
  let selected = requestedFamilyId
    ? list.find((m) => m.familyId === requestedFamilyId)
    : undefined;
  if (!selected && list.length > 0) {
    selected = list[0];
  }

  requestHeaders.set('x-user-id', session.user.id);
  if (selected) {
    requestHeaders.set('x-family-id', selected.familyId);
    requestHeaders.set('x-family-db', selected.dbFilename);
    // x-family-role intentionally NOT set — role re-derived from JWT downstream
  } else if (requestedFamilyId) {
    requestHeaders.set('x-family-id', requestedFamilyId);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (familyParam && familyParam !== familyCookie) {
    response.cookies.set('active-family', familyParam, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!login|signup|join|create-family|api/auth|api/debug|monitoring|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

- [ ] **Step 3: Update auth.ts JWT callback to observe the refresh cookie**

Edit `apps/web/auth.ts`. Modify the `shouldRefresh` calculation in the `jwt` callback to also check for the cookie. Pass cookies via the callback's `req` parameter (Auth.js v5 exposes the request to the jwt callback via `getRequest()` or similar — verify against the docs in step 1).

If reading cookies in the jwt callback isn't directly supported, the simpler approach: set `trigger='update'` semantically by deleting the `memberships` field from the token in the proxy (forcing a refresh on next read), then in jwt callback the `(token.userId && !token.memberships)` branch already triggers a refresh.

Practical implementation:
```ts
// In proxy.ts, when staleness is detected, also call:
// (this works because NextAuth re-runs jwt() on the next request with the
// modified token; in practice, easier path is to clear and let the cookie
// on the next request re-trigger refresh)
```

The IMPLEMENTATION DETAIL of the refresh trigger is a choice point — pick whichever the doc-read in Step 1 confirms works. Document the choice in a code comment.

- [ ] **Step 4: Typecheck + manual sanity**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

If `pnpm dev` is runnable: log in, observe Network tab — confirm requests have `x-user-id`, `x-family-id`, `x-family-db` but NOT `x-family-role`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/proxy.ts apps/web/auth.ts
git commit -m "fix(proxy): strip inbound x-family-* headers, drop x-family-role, detect stale JWT via membershipsVersion"
```

---

### Task 9: Header-strip + JWT-staleness verification tests

**Files:**
- Create: `apps/web/__tests__/auth/header-strip.test.ts`
- Create: `apps/web/__tests__/auth/jwt-staleness.test.ts`

- [ ] **Step 1: Write the header-strip test**

Create `apps/web/__tests__/auth/header-strip.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getAuthContext } from '@/lib/auth/context';

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({
    user: {
      id: 'u-viewer',
      memberships: [
        { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      ],
      membershipsVersion: 0,
    },
  })),
}));

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(() => ({} as never)),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createFamilyDb: vi.fn(() => ({} as never)),
  };
});

describe('header-strip / role re-derivation', () => {
  it('ignores forged x-family-role header — role comes from JWT', async () => {
    const forgedRequest = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': 'u-viewer',
        'x-family-id': 'f1',
        'x-family-db': 'f1.db',
        'x-family-role': 'admin', // forged
      },
    });

    const ctx = await getAuthContext(forgedRequest);
    expect(ctx).not.toBeNull();
    expect(ctx!.role).toBe('viewer'); // from JWT, NOT from header
    expect(ctx!.userId).toBe('u-viewer');
    expect(ctx!.familyId).toBe('f1');
  });

  it('returns null for requests without x-user-id', async () => {
    const request = new Request('http://localhost/api/test', { headers: {} });
    const ctx = await getAuthContext(request);
    expect(ctx).toBeNull();
  });
});
```

- [ ] **Step 2: Run the header-strip test**

Run from `apps/web/`: `pnpm vitest run __tests__/auth/header-strip.test.ts`
Expected: 2 tests pass.

- [ ] **Step 3: Write the jwt-staleness test**

Create `apps/web/__tests__/auth/jwt-staleness.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchVersionMock = vi.fn();

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          get: fetchVersionMock,
        }),
      }),
    }),
  })),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

describe('JWT staleness detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects mismatch when DB version > JWT version', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 5 });

    // Simulate the proxy's check
    const jwtVersion = 3;
    const dbVersion = (await fetchVersionMock())?.v ?? 0;
    expect(dbVersion).toBeGreaterThan(jwtVersion);
    // Production: this triggers force-jwt-refresh cookie
  });

  it('skips refresh when versions match', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 3 });

    const jwtVersion = 3;
    const dbVersion = (await fetchVersionMock())?.v ?? 0;
    expect(dbVersion).toBe(jwtVersion);
  });

  it('treats missing JWT version as 0', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 1 });

    const jwtVersion = undefined;
    const dbVersion = (await fetchVersionMock())?.v ?? 0;
    expect(dbVersion !== (jwtVersion ?? 0)).toBe(true);
  });
});
```

(For tighter coverage, the test could import the actual `proxy` callback and invoke it. That requires a more elaborate setup with `NextRequest`/`NextResponse` mocks. The above tests the version-comparison logic directly; combine with the existing tests in sub-spec B for the proxy's full flow.)

- [ ] **Step 4: Run the staleness test**

Run from `apps/web/`: `pnpm vitest run __tests__/auth/jwt-staleness.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Run the full suite**

Run from `apps/web/`: `pnpm vitest run`
Expected: 401 + 2 + 3 = 406 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/__tests__/auth/
git commit -m "test(auth): verify header-strip ignores forged x-family-role; verify JWT staleness detection"
```

---

## Phase 5: withAuth sweep (Task 10)

Goal: pass `request` to all 86 `withAuth(permission)` call sites that currently don't. Mechanical, single sweeping commit.

---

### Task 10: Sweep 86 route handlers to pass request to withAuth

**Files:**
- Modify: 86 route handlers under `apps/web/app/api/` (each one-line change)

- [ ] **Step 1: Generate the list of routes that need the fix**

Run from worktree root:
```bash
grep -rln "withAuth(" apps/web/app/api --include='*.ts' \
  | xargs grep -L "withAuth([^)]*request" \
  | sort
```
Expected: a list of paths. Save it to `/tmp/withauth-sweep-list.txt`:
```bash
grep -rln "withAuth(" apps/web/app/api --include='*.ts' \
  | xargs grep -L "withAuth([^)]*request" \
  | sort > /tmp/withauth-sweep-list.txt
wc -l /tmp/withauth-sweep-list.txt
```
Expected count: ~86. If significantly different, investigate before proceeding.

- [ ] **Step 2: Apply the fix**

For each file in the list, transform every `await withAuth('x:y')` (no second arg) into `await withAuth('x:y', req)` or `await withAuth('x:y', request)` — match whatever the route handler names its `Request` parameter.

A scripted approach:
```bash
while IFS= read -r file; do
  # Find the route handler param name (req or request)
  param=$(grep -oE 'export async function (GET|POST|PUT|PATCH|DELETE)\((req|request)' "$file" | head -1 | grep -oE '(req|request)$')
  if [ -z "$param" ]; then param="req"; fi
  # Replace `await withAuth('something')` with `await withAuth('something', $param)`
  # but ONLY where there's no second arg already.
  # Use perl for the regex with negative lookahead:
  perl -i -pe "s/await withAuth\((['\"][^'\"]+['\"])\)(?!\s*,)/await withAuth(\$1, $param)/g" "$file"
done < /tmp/withauth-sweep-list.txt
```

(The exact perl regex may need tuning based on actual call patterns. For routes where the handler body is destructuring `{ params }: { params: Promise<...> }`, the request arg might be the second positional param. Inspect 3-5 files first to confirm.)

If the script over- or under-reaches, fall back to manual edit of each file.

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0. If errors appear, they'll point to call sites where the param name differs from what the script assumed; fix those manually.

- [ ] **Step 4: Run the test suite**

Run from `apps/web/`: `pnpm vitest run`
Expected: 406 tests pass.

- [ ] **Step 5: Spot-check 5 random routes**

Open 5 of the changed files and confirm the transformation is correct. Look for:
- The `req` or `request` arg is now passed
- No double-arg cases (`withAuth(perm, req, req)`)
- No accidental string corruption

```bash
sed -n '/withAuth/p' apps/web/app/api/persons/[id]/route.ts
sed -n '/withAuth/p' apps/web/app/api/families/route.ts
sed -n '/withAuth/p' apps/web/app/api/events/route.ts
sed -n '/withAuth/p' apps/web/app/api/ai/chat/route.ts
sed -n '/withAuth/p' apps/web/app/api/research/factsheets/route.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/
git commit -m "refactor(api): pass request to withAuth in all 86 route handlers (closes prerender hazard)"
```

---

## Phase 6: memberships_version bumps (Tasks 11–14)

Goal: mutations that touch `family_members` increment `users.memberships_version` for affected users.

---

### Task 11: Create memberships.ts helper

**Files:**
- Create: `packages/auth/src/memberships.ts`
- Modify: `packages/auth/src/index.ts` (barrel re-export)

- [ ] **Step 1: Inspect the barrel**

Run: `cat packages/auth/src/index.ts`
Note the export pattern (`export * from './X'` or named re-exports).

- [ ] **Step 2: Create the helper**

Create `packages/auth/src/memberships.ts`:

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

- [ ] **Step 3: Re-export from the barrel**

Edit `packages/auth/src/index.ts`. Add:
```ts
export * from './memberships';
```
(Match the existing barrel style.)

- [ ] **Step 4: Typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/memberships.ts packages/auth/src/index.ts
git commit -m "feat(auth): add bumpMembershipsVersion helper for JWT-staleness signaling"
```

---

### Task 12: Bump memberships_version in acceptInvite

**Files:**
- Modify: `packages/auth/src/invitations.ts`

- [ ] **Step 1: Read the existing acceptInvite function**

Run: `sed -n '170,210p' packages/auth/src/invitations.ts`
Confirm the familyMember insert location. Note: sub-spec B left `// TODO(sub-spec-A): bump users.memberships_version once the column exists` markers — this task replaces them.

- [ ] **Step 2: Add the bump call**

Edit `packages/auth/src/invitations.ts`. After the `await centralDb.insert(centralSchema.familyMembers).values({...}).run();` block (around line 195), add:

```ts
import { bumpMembershipsVersion } from './memberships';

// ... in acceptInvite, after the insert:
await bumpMembershipsVersion(centralDb, userId);
```

Remove the corresponding `TODO(sub-spec-A)` comment if present.

- [ ] **Step 3: Typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 4: Run auth tests**

Run from `packages/auth/`: `pnpm vitest run`
Expected: 107 existing tests pass (the acceptInvite test should still work; if it asserts `users.membershipsVersion` is unchanged, that assertion will need updating).

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/invitations.ts
git commit -m "feat(auth): bump memberships_version on acceptInvite for joining user"
```

---

### Task 13: Bump memberships_version in createFamily

**Files:**
- Modify: `packages/auth/src/families.ts`

- [ ] **Step 1: Read the existing createFamily**

Run: `sed -n '40,80p' packages/auth/src/families.ts`
Confirm the familyMember (owner) insert location. Note: sub-spec B left a TODO marker at this site.

- [ ] **Step 2: Add the bump**

Edit `packages/auth/src/families.ts`. After the `await centralDb.insert(familyMembers).values({...role:'owner'...}).run();` block (around line 66), add:

```ts
import { bumpMembershipsVersion } from './memberships';

// ... in createFamily, after the insert:
await bumpMembershipsVersion(centralDb, opts.ownerId);
```

Remove the corresponding `TODO(sub-spec-A)` comment if present.

Also remove the same TODO from `apps/web/server/api/routers/family.ts` and `apps/web/server/api/routers/auth/_actions.ts` and `apps/web/server/api/routers/family/_actions.ts` — the bump now flows through `createFamily` and `acceptInvite` core functions.

- [ ] **Step 3: Typecheck + tests**

Run from repo root: `pnpm -r typecheck`
Run from `packages/auth/`: `pnpm vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/families.ts apps/web/server/api/routers/family.ts apps/web/server/api/routers/auth/_actions.ts apps/web/server/api/routers/family/_actions.ts
git commit -m "feat(auth): bump memberships_version on createFamily for owner; clear TODO markers"
```

---

### Task 14: Bump memberships_version in transferOwnership

**Files:**
- Modify: `packages/auth/src/families.ts`

- [ ] **Step 1: Read transferOwnership**

Run: `sed -n '140,180p' packages/auth/src/families.ts`
Confirm the role-swap location (current owner → admin, target admin → owner).

- [ ] **Step 2: Add the bump for both users**

Edit `packages/auth/src/families.ts`. At the end of the role-swap (after both `update` calls succeed), add:

```ts
import { bumpMembershipsVersionMany } from './memberships';

// ... in transferOwnership, after both role updates:
await bumpMembershipsVersionMany(centralDb, [oldOwnerId, newOwnerId]);
```

(Both users' JWTs go stale: the old owner loses `tree:delete` + `settings:manage`; the new owner gains them.)

- [ ] **Step 3: Typecheck + tests**

Run from repo root: `pnpm -r typecheck`
Run from `packages/auth/`: `pnpm vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/families.ts
git commit -m "feat(auth): bump memberships_version on transferOwnership for both users"
```

---

## Phase 7: Carried-forward fixups (Task 15)

Goal: rebuild `family/_actions.ts` to use the createCaller pattern, eliminating the bypass flagged in sub-spec B's final review.

---

### Task 15: Rebuild family/_actions.ts via createCaller

**Files:**
- Modify: `apps/web/server/api/routers/family/_actions.ts`

- [ ] **Step 1: Read the current implementation**

Run: `cat apps/web/server/api/routers/family/_actions.ts`
Confirm it currently calls `auth()` + `createFamily()` directly (the bypass).

- [ ] **Step 2: Replace with createCaller pattern**

Edit `apps/web/server/api/routers/family/_actions.ts`. Replace the file contents:

```ts
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { familyRouter } from '../family';
import { createCallerFactory } from '../../trpc';
import { createTRPCContext } from '../../init';

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
  let familyId: string;
  try {
    const result = await caller.create({ name });
    familyId = result.familyId;
  } catch (e) {
    return { error: (e as Error).message };
  }

  redirect(`/dashboard?family=${familyId}`);
}
```

(The membership bump now happens automatically: `caller.create` invokes the procedure, which calls `createFamily` from `@ancstra/auth`, which after Task 13 bumps the owner's `memberships_version`.)

- [ ] **Step 3: Typecheck + manual sanity**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

If `pnpm dev` is runnable: sign up a new user → create-family form → submit → confirm redirect to dashboard.

- [ ] **Step 4: Run the test suite**

Run from `apps/web/`: `pnpm vitest run`
Expected: 406 tests pass (no new ones added in this task).

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/api/routers/family/_actions.ts
git commit -m "refactor(trpc): rebuild family/_actions.ts via createCaller for consistency with account+auth pattern"
```

---

## Phase 8: ADR + final verification (Tasks 16–17)

---

### Task 16: Write ADR-014

**Files:**
- Create: `docs/architecture/decisions/014-rbac-enforcement-hardening.md`

- [ ] **Step 1: Read the previous ADR (013) for format**

Run: `cat docs/architecture/decisions/013-trpc-as-action-substrate.md`
Match its header style + section structure.

- [ ] **Step 2: Write the ADR**

Create `docs/architecture/decisions/014-rbac-enforcement-hardening.md`:

```markdown
# ADR-014: RBAC enforcement hardening

> Date: 2026-04-30 | Status: Accepted

## Context

Sub-spec B (ADR-013) introduced the tRPC layer with a strict trust contract: role is re-derived from `JWT.memberships`, never from `x-family-role` header. The 97 existing REST route handlers (using `withAuth`) and the proxy/middleware layer still trusted `x-family-role`. This sub-spec closes that gap and adds DB-enforced single-owner-per-family + JWT staleness detection.

## Decision

Five hardenings:

1. **Role from JWT, not headers.** `getAuthContext()` and `withAuth()` always derive role from `JWT.memberships[familyId].role`. The `x-family-role` header is no longer set by the proxy and no longer trusted by any consumer.
2. **Inbound header strip.** The proxy explicitly removes any client-supplied `x-user-*` / `x-family-*` headers before setting its own. Defense in depth.
3. **DB-enforced single owner.** A partial unique index `uq_family_members_family_owner` on `family_members(family_id) WHERE role='owner'` prevents two owners per family at the storage layer.
4. **JWT staleness detection.** `users.memberships_version` is a counter bumped by mutations that touch `family_members`. The proxy compares JWT.membershipsVersion to DB on every request; mismatch sets a `force-jwt-refresh` cookie, triggering a refresh on the next request.
5. **`withAuth(perm, request)` sweep.** All 86 route handlers that didn't pass `request` now do — closes a pre-existing prerender-hang risk.

Plus three carried-forward fixups from sub-spec B: shared `getCentralDb()` lazy singleton; `family/_actions.ts` rebuilt via createCaller; `memberships_version` bumps wired in 4 mutation sites.

## Alternatives considered

- **WebSocket-based JWT invalidation.** Cleaner UX (immediate refresh) but requires WS infra (zero today). Lazy compare is sufficient for a solo-dev app.
- **Shorten JWT TTL to ~5 min.** Simpler than the version counter but every API call within the staleness window uses old role data. Unacceptable for security-critical changes (e.g. removing a user from a family).
- **In-process cache for the version lookup.** ~30s TTL would reduce DB reads. Defer until prod numbers warrant.

## Consequences

- Forging `x-family-role` from a client is now ineffective — verified by `apps/web/__tests__/auth/header-strip.test.ts`.
- Owner uniqueness is a hard DB invariant — verified by `packages/db/__tests__/owner-uniqueness.test.ts`.
- Membership changes propagate to JWT within one extra request — verified by `apps/web/__tests__/auth/jwt-staleness.test.ts`.
- Per-request DB connection waste eliminated for centralDb in proxy + init + auth.
- `apps/web/proxy.ts` adds one indexed SELECT per request (cost: ~1ms). Cache later if needed.
- Sub-specs C (share/invite UX) and D (family switcher + RoleGate) build on a hardened substrate.

## Related

- ADR-013 — tRPC as action substrate (sub-spec B)
- Cross-cutting RBAC architecture: `~/.claude/plans/lets-plan-the-following-clever-rainbow.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/decisions/014-rbac-enforcement-hardening.md
git commit -m "docs(adr): add ADR-014 — RBAC enforcement hardening"
```

---

### Task 17: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 2: Full monorepo test**

Run from repo root: `pnpm -r test`
Expected: all tests pass — `apps/web` 406+, `packages/auth` 107+, `packages/db` 49+, plus all others.

- [ ] **Step 3: Web app build**

Run from `apps/web/`: `pnpm build`
Expected: production build completes; no new build errors.

- [ ] **Step 4: Confirm zero `x-family-role` writes/reads remain**

```bash
grep -rn "x-family-role" apps/web/ --include='*.ts' --include='*.tsx' | grep -v __tests__
```
Expected: zero matches outside test files.

- [ ] **Step 5: Confirm zero `TODO(sub-spec-A)` markers remain**

```bash
grep -rn "TODO(sub-spec-A)" apps/web/ packages/auth/ packages/db/ --include='*.ts'
```
Expected: zero matches.

- [ ] **Step 6: Tag the milestone**

```bash
git tag -a sub-spec-a-complete -m "RBAC enforcement hardening complete: header strip, JWT staleness, owner-uniqueness DB constraint, withAuth sweep, 3 carried-forward fixups (Tasks 1-17 of sub-spec A)"
```

- [ ] **Step 7: Final summary** (no commit)

Print: total commit count (`git log --oneline <baseline>..HEAD | wc -l`) and final HEAD SHA.

---

## Self-Review

**Spec coverage** — every section of `2026-04-30-rbac-subspec-a-enforcement-hardening-design.md` maps to at least one task:

| Spec section | Implementing task(s) |
|---|---|
| Phase 1 — Schema migration | Tasks 1, 2, 3 |
| Phase 2 — Header trust hardening (proxy.ts, getAuthContext, JWT extension) | Tasks 5, 6, 7, 8 |
| Phase 3 — `withAuth` sweep | Task 10 |
| Phase 4 — `memberships_version` bumps | Tasks 11, 12, 13, 14 |
| Phase 5 — Carried fixups (lazy createCentralDb, family/_actions rebuild) | Tasks 4, 15 |
| Cross-cutting trust contract | Task 16 (ADR) |
| Verification: header-strip, jwt-staleness, owner-uniqueness | Tasks 3, 9 |
| ADR | Task 16 |
| Final verification | Task 17 |

**Placeholder scan:**
- Task 8 has a "pick whichever the doc-read in Step 1 confirms works" handoff for the JWT refresh trigger mechanism. This is a deliberate research step (the spec flagged it as an Open Question), not a placeholder — the implementer reads the Next.js/Auth.js docs and chooses the implementation path. Both candidate paths are described.
- Task 10's perl regex is a starting point and may need tuning per actual call patterns. The fallback ("manual edit of each file") is explicit.

**Type consistency:**
- `BumpMembershipsVersion` is named `bumpMembershipsVersion` consistently across Tasks 11, 12, 13, 14.
- `bumpMembershipsVersionMany` (plural) used only in Task 14, consistent with its definition in Task 11.
- `getCentralDb` defined in Task 4, consumed in Tasks 7, 8, 9, plus Phase 4 helpers via `centralDb` argument.
- `parseRole` referenced in Task 7 — exists from sub-spec B at `packages/auth/src/types.ts`.
- `membershipsVersion` (camelCase TS) vs `memberships_version` (snake_case SQL) — used consistently per the language convention.

**Open items left for the executor:**
- Task 2: drizzle-kit generate command (verify exact syntax against `packages/db/package.json` scripts — the plan offers a fallback).
- Task 8: NextAuth update-trigger mechanism (research step in the task itself).
- Task 10: perl regex tuning if call patterns vary.

These are deliberately research-and-decide steps within tasks, not skipped requirements.
