# RBAC Sub-spec C — Share/Invite UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close RBAC sub-spec C with a tight finishing pass — add the `members:transfer-ownership` permission, harden `transferOwnership` (transaction + UQ-violation→409 guard), wire up the per-row "Transfer ownership" UI with type-to-confirm, surface `lastSeenAt`, and polish `InviteDialog`'s admin-role gating. End state: ADR-017 committed, drafts promoted to `docs/rbac/c-share-invite/`, `sub-spec-c-complete` tag.

**Architecture:** REST stays (no tRPC migration). Single new endpoint `POST /api/families/[id]/members/[userId]/transfer-ownership` on top of existing REST surface. Backend hardened via `centralDb.transaction(async (tx) => …)` (Drizzle, driver-agnostic). UQ partial index `uq_family_members_family_owner` is the concurrency guard; its violation is caught and surfaced as 409. Client uses existing shadcn `<DropdownMenu>` + `<AlertDialog>` primitives. JWT refresh leans on D1's existing `JwtRefreshObserver` + `force-jwt-refresh` cookie middleware behavior.

**Tech Stack:** TypeScript + Drizzle ORM + libsql/better-sqlite3 + Next.js 16 App Router + React 19 + shadcn/ui + Tailwind v4 + vitest + sonner. Workspace: pnpm + Turborepo.

**Spec source:** `docs/superpowers/specs/2026-05-07-rbac-subspec-c-design.md`

**Spec corrections (small drift from spec → code reality):**
- Spec said `ActivityAction = 'ownership_transferred'` — code already has `'owner_transferred'` in `packages/auth/src/types.ts:36`. Plan uses **`owner_transferred`**.
- Spec said `ConcurrentTransferError` lives in `errors.ts` — no such file exists. Plan puts it in **`types.ts`** alongside `ForbiddenError`.

---

## File map

```
packages/auth/src/types.ts                                            (M — Permission union, ConcurrentTransferError)
packages/auth/src/permissions.ts                                      (M — matrix updates)
packages/auth/src/families.ts                                         (M — transaction wrap, UQ-violation catch)
packages/auth/__tests__/permissions.test.ts                           (M — extend)
packages/auth/__tests__/transfer-ownership.test.ts                    (N)

apps/web/app/api/families/[id]/members/route.ts                       (M — return lastSeenAt)
apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts  (N)
apps/web/__tests__/api/transfer-ownership.test.ts                     (N)

apps/web/app/(auth)/settings/members/page.tsx                         (M — pass currentRole + familyName)
apps/web/components/members/member-list.tsx                           (M — dropdown, lastSeenAt column)
apps/web/components/members/transfer-ownership-dialog.tsx             (N)
apps/web/components/members/invite-dialog.tsx                         (M — admin-role gating)
apps/web/__tests__/members/transfer-ownership-dialog.test.tsx         (N)
apps/web/__tests__/members/member-list.test.tsx                       (N or M — extend if exists)
apps/web/__tests__/members/invite-dialog.test.tsx                     (N or M — extend if exists)

docs/architecture/decisions/017-rbac-share-invite-ux.md               (N)
docs/rbac/c-share-invite/design.md                                    (N — promote)
docs/rbac/c-share-invite/plan.md                                      (N — promote)
docs/rbac/d2-ux/design.md                                             (N — D2 housekeeping)
docs/rbac/d2-ux/plan.md                                               (N — D2 housekeeping)
docs/RBAC_ROADMAP.md                                                  (M — C row → ✅ Shipped)
```

**Branch convention** (matches B/A/D1/D2): `feature/rbac-subspec-c-share-invite`. Recommend executing this plan in a worktree — see superpowers:using-git-worktrees.

**Test fixture note.** Several tasks below add tests in `packages/auth/__tests__/transfer-ownership.test.ts`. The existing pattern across the auth package is an in-memory SQLite fixture defined per file (helper `createTestCentralDb()` at `packages/auth/__tests__/families.test.ts:12-57`). Copy that helper verbatim into the new test file, then add the partial UQ index `uq_family_members_family_owner` and an `activity_feed` table (the families.test.ts copy doesn't have either). Sub-spec E will consolidate these copies into a shared fixture; don't fix it here.

---

## Task 1: Add `members:transfer-ownership` permission to the matrix

**Files:**
- Modify: `packages/auth/src/types.ts`
- Modify: `packages/auth/src/permissions.ts:13-21`
- Modify: `packages/auth/__tests__/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `packages/auth/__tests__/permissions.test.ts` and append (inside the existing `describe`):

```ts
describe('members:transfer-ownership', () => {
  it('owner has it', () => {
    expect(hasPermission('owner', 'members:transfer-ownership')).toBe(true);
  });
  it('admin does not have it', () => {
    expect(hasPermission('admin', 'members:transfer-ownership')).toBe(false);
  });
  it('editor does not have it', () => {
    expect(hasPermission('editor', 'members:transfer-ownership')).toBe(false);
  });
  it('viewer does not have it', () => {
    expect(hasPermission('viewer', 'members:transfer-ownership')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ancstra/auth test -- permissions`
Expected: FAIL — `'members:transfer-ownership'` is not assignable to type `Permission`.

- [ ] **Step 3: Add the permission to the type union**

In `packages/auth/src/types.ts`, change the `members:` line of the `Permission` union to:

```ts
  | 'members:manage' | 'members:invite' | 'members:transfer-ownership'
```

- [ ] **Step 4: Add the permission to the matrix**

In `packages/auth/src/permissions.ts`:

```ts
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

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p =>
    p !== 'settings:manage' &&
    p !== 'tree:delete' &&
    p !== 'members:transfer-ownership'
  ),
  editor: [
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
  ],
  viewer: ['tree:view', 'activity:view'],
};
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ancstra/auth test -- permissions`
Expected: PASS — all four new tests + existing pass.

- [ ] **Step 6: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: PASS — no callers reference the new permission yet, so no breakage.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/permissions.ts packages/auth/__tests__/permissions.test.ts
git commit -m "feat(auth): add members:transfer-ownership permission (owner-only)"
```

---

## Task 2: Add `ConcurrentTransferError` class

**Files:**
- Modify: `packages/auth/src/types.ts`
- Create: `packages/auth/__tests__/transfer-ownership.test.ts`

- [ ] **Step 1: Create the test file with a stub-throw test**

Create `packages/auth/__tests__/transfer-ownership.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ConcurrentTransferError } from '../src/types';

describe('ConcurrentTransferError', () => {
  it('is an Error with name=ConcurrentTransferError', () => {
    const err = new ConcurrentTransferError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConcurrentTransferError);
    expect(err.name).toBe('ConcurrentTransferError');
    expect(err.message).toBe('test');
  });

  it('defaults message when none given', () => {
    const err = new ConcurrentTransferError();
    expect(err.message).toBe('Concurrent transfer detected. Please retry.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: FAIL — `ConcurrentTransferError` not exported from types.

- [ ] **Step 3: Add the class to types.ts**

Append to `packages/auth/src/types.ts` (after `ForbiddenError`):

```ts
export class ConcurrentTransferError extends Error {
  constructor(message = 'Concurrent transfer detected. Please retry.') {
    super(message);
    this.name = 'ConcurrentTransferError';
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/__tests__/transfer-ownership.test.ts
git commit -m "feat(auth): add ConcurrentTransferError class"
```

---

## Task 3: Wrap `transferOwnership` in a transaction (atomicity test)

**Files:**
- Modify: `packages/auth/src/families.ts:130-183`
- Modify: `packages/auth/__tests__/transfer-ownership.test.ts`

- [ ] **Step 1: Set up the in-memory fixture**

Append to `packages/auth/__tests__/transfer-ownership.test.ts` (above the existing `describe`):

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as centralSchema from '@ancstra/db/central-schema';
import { eq, and } from 'drizzle-orm';
import { transferOwnership } from '../src/families';
import * as memberships from '../src/memberships';
import { vi, beforeEach } from 'vitest';
```

Then add this helper. **Copy `createTestCentralDb` from `packages/auth/__tests__/families.test.ts:12-57` verbatim**, rename it `createTestDb`, and inside its multiline SQL string add these two extras after the `family_members` table — the partial UQ index and the activity feed table:

```
CREATE UNIQUE INDEX uq_family_members_family_owner
  ON family_members (family_id) WHERE role = 'owner';
CREATE TABLE activity_feed (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
```

Also change the helper's return signature to just return `drizzle(sqlite, { schema: centralSchema })` (drop the `{ db, sqlite }` tuple — we don't need raw sqlite access here).

Then add a seed helper:

```ts
async function seed(db: ReturnType<typeof createTestDb>) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-owner', email: 'o@t', name: 'Owner', createdAt: now, updatedAt: now },
    { id: 'u-admin', email: 'a@t', name: 'Admin', createdAt: now, updatedAt: now },
    { id: 'u-editor', email: 'e@t', name: 'Editor', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyRegistry).values({
    id: 'fam-1', name: 'Test Family', ownerId: 'u-owner', dbFilename: 't.db',
    createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-1', familyId: 'fam-1', userId: 'u-owner', role: 'owner', joinedAt: now },
    { id: 'm-2', familyId: 'fam-1', userId: 'u-admin', role: 'admin', joinedAt: now },
    { id: 'm-3', familyId: 'fam-1', userId: 'u-editor', role: 'editor', joinedAt: now },
  ]).run();
}
```

- [ ] **Step 2: Append the atomicity tests**

Append a new `describe` block:

```ts
describe('transferOwnership atomicity', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    db = createTestDb();
    await seed(db);
    vi.restoreAllMocks();
  });

  it('happy path: swaps roles, bumps versions, updates registry', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-admin',
    });

    expect(result.success).toBe(true);

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-owner'),
      )).get();
    const admin = await db.select().from(centralSchema.familyMembers)
      .where(and(
        eq(centralSchema.familyMembers.familyId, 'fam-1'),
        eq(centralSchema.familyMembers.userId, 'u-admin'),
      )).get();
    expect(owner?.role).toBe('admin');
    expect(admin?.role).toBe('owner');

    const fam = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    expect(fam?.ownerId).toBe('u-admin');

    const ownerUser = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-owner')).get();
    const adminUser = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-admin')).get();
    expect(ownerUser?.membershipsVersion).toBe(1);
    expect(adminUser?.membershipsVersion).toBe(1);
  });

  it('rejects when target is not admin (editor)', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-editor',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/admin/i);

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-owner')).get();
    expect(owner?.role).toBe('owner');
  });

  it('rejects when target is not a member', async () => {
    const result = await transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-nobody',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a member/i);
  });

  it('rolls back on mid-transaction failure', async () => {
    vi.spyOn(memberships, 'bumpMembershipsVersionMany').mockRejectedValue(
      new Error('simulated failure'),
    );

    await expect(transferOwnership(db, {
      familyId: 'fam-1',
      currentOwnerId: 'u-owner',
      newOwnerId: 'u-admin',
    })).rejects.toThrow('simulated failure');

    const owner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-owner')).get();
    const admin = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.userId, 'u-admin')).get();
    expect(owner?.role).toBe('owner');
    expect(admin?.role).toBe('admin');

    const fam = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'fam-1')).get();
    expect(fam?.ownerId).toBe('u-owner');
  });
});
```

- [ ] **Step 3: Run tests to verify rollback test fails**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: happy + reject tests pass; rollback test FAILS — current implementation isn't transactional, so on failure the demote/promote partial writes persist.

- [ ] **Step 4: Wrap the function body in a transaction**

In `packages/auth/src/families.ts`, replace the `transferOwnership` function body (currently lines 130-183) with:

```ts
/**
 * Transfer family ownership from current owner to new owner (must be admin).
 * Wrapped in a transaction so demote/promote/version-bump/registry-update
 * either all commit or all roll back. The partial unique index
 * `uq_family_members_family_owner` is the concurrency guard for parallel
 * transfers — its violation is caught and surfaced as ConcurrentTransferError.
 */
export async function transferOwnership(
  centralDb: CentralDatabase,
  opts: {
    familyId: string;
    currentOwnerId: string;
    newOwnerId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const newOwnerMembership = await getFamilyMembership(centralDb, opts.newOwnerId, opts.familyId);

  if (!newOwnerMembership) {
    return { success: false, error: 'Target user is not a member of this family' };
  }
  if (newOwnerMembership.role !== 'admin') {
    return { success: false, error: 'Target user must be an admin to receive ownership' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (centralDb as any).transaction(async (tx: any) => {
    await tx.update(familyMembers)
      .set({ role: 'admin' })
      .where(and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.currentOwnerId),
      ))
      .run();

    await tx.update(familyMembers)
      .set({ role: 'owner' })
      .where(and(
        eq(familyMembers.familyId, opts.familyId),
        eq(familyMembers.userId, opts.newOwnerId),
      ))
      .run();

    await bumpMembershipsVersionMany(tx, [opts.currentOwnerId, opts.newOwnerId]);

    await tx.update(familyRegistry)
      .set({ ownerId: opts.newOwnerId, updatedAt: new Date().toISOString() })
      .where(eq(familyRegistry.id, opts.familyId))
      .run();
  });

  return { success: true };
}
```

(Keep imports unchanged. The `(centralDb as any).transaction` cast matches the existing pattern in `packages/research/src/factsheets/promote.ts:101,271`.)

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: ALL PASS — happy path, both rejects, rollback all green.

- [ ] **Step 6: Run the full auth suite to catch any regression**

Run: `pnpm --filter @ancstra/auth test`
Expected: PASS — no other test references transferOwnership semantics directly.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/families.ts packages/auth/__tests__/transfer-ownership.test.ts
git commit -m "fix(auth): wrap transferOwnership in transaction for atomicity"
```

---

## Task 4: Catch UQ-violation as `ConcurrentTransferError`

**Files:**
- Modify: `packages/auth/src/families.ts`
- Modify: `packages/auth/__tests__/transfer-ownership.test.ts`

- [ ] **Step 1: Append the concurrent-transfer test**

Append to the same `describe('transferOwnership atomicity', ...)` block:

```ts
  it('throws ConcurrentTransferError when UQ partial-index fires', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u-admin2', email: 'a2@t', name: 'Admin2', createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-4', familyId: 'fam-1', userId: 'u-admin2', role: 'admin', joinedAt: now,
    }).run();

    // Simulate a concurrent transfer winning: directly demote the original owner
    // and promote u-admin out-of-band, leaving the partial UQ index occupied.
    await db.update(centralSchema.familyMembers)
      .set({ role: 'admin' })
      .where(eq(centralSchema.familyMembers.userId, 'u-owner'))
      .run();
    await db.update(centralSchema.familyMembers)
      .set({ role: 'owner' })
      .where(eq(centralSchema.familyMembers.userId, 'u-admin'))
      .run();

    // Now attempt to transfer to u-admin2 — the promote step will violate
    // the partial UQ index because u-admin already holds owner.
    const { ConcurrentTransferError } = await import('../src/types');
    await expect(
      transferOwnership(db, {
        familyId: 'fam-1',
        currentOwnerId: 'u-owner',
        newOwnerId: 'u-admin2',
      })
    ).rejects.toBeInstanceOf(ConcurrentTransferError);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: FAIL — current code lets the raw SQLite constraint error propagate, not a `ConcurrentTransferError`.

- [ ] **Step 3: Map UQ violation to `ConcurrentTransferError` inside the existing rollback path**

T3 implemented atomicity via explicit `BEGIN/COMMIT/ROLLBACK` (not `.transaction(async tx => ...)`) because `better-sqlite3` rejects async callbacks. T4 builds on that. In `packages/auth/src/families.ts`, update the existing catch block to map UQ violations:

```ts
  await centralDb.run(sql`BEGIN`);
  try {
    // ... existing demote / promote / bump / registry update writes (unchanged) ...

    await centralDb.run(sql`COMMIT`);
  } catch (err) {
    await centralDb.run(sql`ROLLBACK`);
    if (isOwnerUqViolation(err)) {
      throw new ConcurrentTransferError();
    }
    throw err;
  }

  return { success: true };
}

/**
 * Detect violation of the partial UQ index on family_members(family_id) WHERE role='owner'.
 * Both better-sqlite3 and libsql surface the index name in the error message.
 */
function isOwnerUqViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('uq_family_members_family_owner') ||
    (msg.includes('unique constraint') && msg.includes('family_members'))
  );
}
```

Update imports at top of `families.ts` to include `ConcurrentTransferError`:

```ts
import { ConcurrentTransferError } from './types';
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ancstra/auth test -- transfer-ownership`
Expected: PASS — all tests including the UQ-violation test.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/families.ts packages/auth/__tests__/transfer-ownership.test.ts
git commit -m "feat(auth): surface owner-UQ violation as ConcurrentTransferError"
```

---

## Task 5: Extend GET /api/families/[id]/members to return `lastSeenAt`

**Files:**
- Modify: `apps/web/app/api/families/[id]/members/route.ts:30-50`

- [ ] **Step 1: Add `lastSeenAt` to the projection**

In `apps/web/app/api/families/[id]/members/route.ts`, update the `select(...)` block in the `GET` handler to include `lastSeenAt`:

```ts
    const members = await centralDb
      .select({
        id: centralSchema.familyMembers.id,
        userId: centralSchema.familyMembers.userId,
        role: centralSchema.familyMembers.role,
        joinedAt: centralSchema.familyMembers.joinedAt,
        lastSeenAt: centralSchema.familyMembers.lastSeenAt,
        name: centralSchema.users.name,
        email: centralSchema.users.email,
      })
      .from(centralSchema.familyMembers)
      .innerJoin(
        centralSchema.users,
        eq(centralSchema.familyMembers.userId, centralSchema.users.id)
      )
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, familyId),
          eq(centralSchema.familyMembers.isActive, 1)
        )
      )
      .all();
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS — the column exists in the schema and the response type widens.

- [ ] **Step 3: Sanity-run existing tests for the route**

Run: `pnpm --filter web test -- api/families`
Expected: PASS (no existing tests assert against the projection shape; new shape is additive).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/families/[id]/members/route.ts
git commit -m "feat(api): return lastSeenAt from GET /api/families/[id]/members"
```

---

## Task 6: Create POST /transfer-ownership endpoint

**Files:**
- Create: `apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts`
- Create: `apps/web/__tests__/api/transfer-ownership.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/__tests__/api/transfer-ownership.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/context', () => ({
  requireAuthContext: vi.fn(),
}));
vi.mock('@ancstra/db', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/db')>('@ancstra/db');
  return {
    ...actual,
    createCentralDb: vi.fn(),
  };
});
vi.mock('@ancstra/auth', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/auth')>('@ancstra/auth');
  return {
    ...actual,
    transferOwnership: vi.fn(),
    logActivity: vi.fn(),
  };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { POST } from '@/app/api/families/[id]/members/[userId]/transfer-ownership/route';
import { requireAuthContext } from '@/lib/auth/context';
import { transferOwnership, ConcurrentTransferError } from '@ancstra/auth';
import { revalidateTag } from 'next/cache';

const params = Promise.resolve({ id: 'fam-1', userId: 'u-target' });

function ownerCtx() {
  return {
    userId: 'u-owner',
    familyId: 'fam-1',
    role: 'owner' as const,
    dbFilename: 'fam.db',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/families/[id]/members/[userId]/transfer-ownership', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireAuthContext).mockRejectedValue(new Error('Not authenticated'));
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(401);
  });

  it('403 when caller is not owner', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), role: 'admin' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(403);
  });

  it('403 when caller is not member of the family in URL', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), familyId: 'fam-2' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(403);
  });

  it('400 when caller transfers to self', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), userId: 'u-target' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(400);
  });

  it('400 when target is not currently admin', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({
      success: false,
      error: 'Target user must be an admin to receive ownership',
    });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(400);
  });

  it('404 when target is not a member', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({
      success: false,
      error: 'Target user is not a member of this family',
    });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(404);
  });

  it('200 happy path; revalidates activity tag', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({ success: true });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('activity', 'max');
  });

  it('409 on ConcurrentTransferError', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockRejectedValue(new ConcurrentTransferError());
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONCURRENT_TRANSFER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- transfer-ownership`
Expected: FAIL — route module does not exist yet.

- [ ] **Step 3: Create the route handler**

Create `apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAuthContext } from '@/lib/auth/context';
import {
  requirePermission,
  transferOwnership,
  logActivity,
  ConcurrentTransferError,
  ForbiddenError,
  type ActivityAction,
} from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * POST /api/families/[id]/members/[userId]/transfer-ownership
 * Transfers family ownership from the calling user to the target user.
 * Body: none. Caller must be the current owner of the family in the URL,
 * and the target must currently be an admin in the same family.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: familyId, userId: targetUserId } = await params;
    const ctx = await requireAuthContext(request);
    requirePermission(ctx.role, 'members:transfer-ownership');

    if (ctx.familyId !== familyId) {
      return NextResponse.json(
        { error: 'Forbidden: not a member of this family' },
        { status: 403 }
      );
    }

    if (ctx.userId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot transfer ownership to yourself' },
        { status: 400 }
      );
    }

    const centralDb = createCentralDb();
    const result = await transferOwnership(centralDb, {
      familyId,
      currentOwnerId: ctx.userId,
      newOwnerId: targetUserId,
    });

    if (!result.success) {
      const err = result.error ?? '';
      if (err.toLowerCase().includes('not a member')) {
        return NextResponse.json({ error: err }, { status: 404 });
      }
      return NextResponse.json({ error: err || 'Transfer failed' }, { status: 400 });
    }

    await logActivity(centralDb, {
      familyId,
      userId: ctx.userId,
      action: 'owner_transferred' as ActivityAction,
      summary: `Transferred ownership to a new owner`,
      metadata: { previousOwnerId: ctx.userId, newOwnerId: targetUserId },
    });
    revalidateTag('activity', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ConcurrentTransferError) {
      return NextResponse.json(
        { code: 'CONCURRENT_TRANSFER', error: error.message },
        { status: 409 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- transfer-ownership`
Expected: PASS — all 8 cases.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts apps/web/__tests__/api/transfer-ownership.test.ts
git commit -m "feat(api): add POST /transfer-ownership endpoint"
```

---

## Task 7: Build `<TransferOwnershipDialog>` component

**Files:**
- Create: `apps/web/components/members/transfer-ownership-dialog.tsx`
- Create: `apps/web/__tests__/members/transfer-ownership-dialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/members/transfer-ownership-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferOwnershipDialog } from '@/components/members/transfer-ownership-dialog';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from 'sonner';

const member = {
  id: 'm-2',
  userId: 'u-admin',
  role: 'admin' as const,
  joinedAt: '2026-01-01',
  name: 'Admin Person',
  email: 'admin@test',
  lastSeenAt: null,
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  member,
  familyId: 'fam-1',
  familyName: 'My Family',
  onTransferred: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('<TransferOwnershipDialog>', () => {
  it('confirm button is disabled until family name typed exactly', () => {
    render(<TransferOwnershipDialog {...baseProps} />);
    const button = screen.getByRole('button', { name: /transfer ownership/i });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText(/type the family name/i);
    fireEvent.change(input, { target: { value: 'wrong' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'My Family' } });
    expect(button).not.toBeDisabled();
  });

  it('whitespace-trimmed match enables button', () => {
    render(<TransferOwnershipDialog {...baseProps} />);
    const input = screen.getByLabelText(/type the family name/i);
    fireEvent.change(input, { target: { value: '  My Family  ' } });
    expect(screen.getByRole('button', { name: /transfer ownership/i })).not.toBeDisabled();
  });

  it('200: success toast + onTransferred + onOpenChange(false)', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/families/fam-1/members/u-admin/transfer-ownership',
        expect.objectContaining({ method: 'POST' })
      );
      expect(toast.success).toHaveBeenCalled();
      expect(baseProps.onTransferred).toHaveBeenCalled();
      expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('409: concurrent-transfer toast; dialog stays open', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'CONCURRENT_TRANSFER', error: 'Concurrent transfer detected. Please retry.' }),
        { status: 409 }
      )
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/concurrent transfer/i)
      );
      expect(baseProps.onOpenChange).not.toHaveBeenCalledWith(false);
      expect(baseProps.onTransferred).not.toHaveBeenCalled();
    });
  });

  it('other error: surfaces server message', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Target user must be an admin to receive ownership' }), { status: 400 })
    );
    render(<TransferOwnershipDialog {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/type the family name/i), {
      target: { value: 'My Family' },
    });
    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/must be an admin/i)
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- transfer-ownership-dialog`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Build the component**

Create `apps/web/components/members/transfer-ownership-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Role } from '@ancstra/auth';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  name: string | null;
  email: string;
  lastSeenAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  familyId: string;
  familyName: string;
  onTransferred: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  member,
  familyId,
  familyName,
  onTransferred,
}: Props) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const enabled = typed.trim() === familyName && !submitting;
  const memberLabel = member.name ?? member.email;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/families/${familyId}/members/${member.userId}/transfer-ownership`,
        { method: 'POST' }
      );

      if (res.status === 200) {
        toast.success(`Ownership transferred to ${memberLabel}`);
        onTransferred();
        onOpenChange(false);
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.code === 'CONCURRENT_TRANSFER') {
        toast.error('Concurrent transfer detected. Please retry.');
        return;
      }
      toast.error(body.error ?? 'Failed to transfer ownership');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setTyped('');
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer ownership to {memberLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be demoted to admin and lose owner-only permissions
            (deleting the tree, managing family settings). This cannot be
            undone except by the new owner transferring back to you.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-family-name">
            Type the family name <strong>{familyName}</strong> to confirm
          </Label>
          <Input
            id="confirm-family-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={familyName}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!enabled}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
            Transfer ownership
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- transfer-ownership-dialog`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/members/transfer-ownership-dialog.tsx apps/web/__tests__/members/transfer-ownership-dialog.test.tsx
git commit -m "feat(members): add TransferOwnershipDialog with type-to-confirm"
```

---

## Task 8: Update `<MemberList>` — DropdownMenu + lastSeenAt column

**Files:**
- Modify: `apps/web/app/(auth)/settings/members/page.tsx`
- Modify: `apps/web/components/members/member-list.tsx`

- [ ] **Step 1: Add `familyName` resolution to the page**

Update `apps/web/app/(auth)/settings/members/page.tsx`:

```tsx
import { requireAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@ancstra/auth';
import { redirect } from 'next/navigation';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { MemberList } from '@/components/members/member-list';
import { InviteDialog } from '@/components/members/invite-dialog';
import { PendingInvites } from '@/components/members/pending-invites';

export default async function MembersPage() {
  const ctx = await requireAuthContext();
  if (!hasPermission(ctx.role, 'members:manage')) {
    redirect('/dashboard');
  }

  const centralDb = createCentralDb();
  const family = await centralDb
    .select({ name: centralSchema.familyRegistry.name })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();
  const familyName = family?.name ?? 'this family';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Family Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to your family tree and their permissions.
          </p>
        </div>
        <InviteDialog familyId={ctx.familyId} currentRole={ctx.role} />
      </div>
      <MemberList
        familyId={ctx.familyId}
        familyName={familyName}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
      />
      <PendingInvites familyId={ctx.familyId} />
    </div>
  );
}
```

- [ ] **Step 2: Update `<MemberList>` to use DropdownMenu + lastSeenAt column**

Replace `apps/web/components/members/member-list.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@ancstra/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/auth/role-badge';
import { RoleGate } from '@/components/auth/role-gate';
import { Loader2, MoreHorizontal, Crown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { TransferOwnershipDialog } from '@/components/members/transfer-ownership-dialog';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  lastSeenAt: string | null;
  name: string | null;
  email: string;
}

interface MemberListProps {
  familyId: string;
  familyName: string;
  currentUserId: string;
  currentRole: Role;
}

const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;

function formatLastSeen(value: string | null): string {
  if (!value) return '—';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function MemberList({
  familyId,
  familyName,
  currentUserId,
  currentRole,
}: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/families/${familyId}/members`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to load members');
      }
      const data: Member[] = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const canEditRole = (member: Member) => {
    if (member.userId === currentUserId) return false;
    if (member.role === 'owner') return false;
    if (currentRole === 'admin' && member.role === 'admin') return false;
    return true;
  };

  const canRemove = (member: Member) => {
    if (member.role === 'owner') return false;
    if (member.userId === currentUserId) return false;
    if (currentRole === 'admin' && member.role === 'admin') return false;
    return true;
  };

  const canTransferTo = (member: Member) => {
    if (currentRole !== 'owner') return false;
    if (member.role !== 'admin') return false;
    if (member.userId === currentUserId) return false;
    return true;
  };

  async function handleRoleChange(targetUserId: string, newRole: string) {
    setUpdatingRole(targetUserId);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to update role');
      }
      const updated: Member = await res.json();
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? updated : m))
      );
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    const targetUserId = removeTarget.userId;
    const memberName = removeTarget.name;
    setRemovingMember(targetUserId);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to remove member');
      }
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      toast.success(`${memberName ?? 'Member'} has been removed`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchMembers}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const showMenu = canRemove(member) || canTransferTo(member);
              return (
                <TableRow key={member.userId}>
                  <TableCell className="font-medium">
                    {member.name ?? 'Unknown'}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    {canEditRole(member) ? (
                      <RoleGate
                        permission="members:manage"
                        fallback={<RoleBadge role={member.role} />}
                      >
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.userId, value)}
                          disabled={updatingRole === member.userId}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </RoleGate>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatLastSeen(member.lastSeenAt)}
                  </TableCell>
                  <TableCell>
                    {showMenu && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Member actions"
                            disabled={removingMember === member.userId}
                          >
                            {removingMember === member.userId ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canTransferTo(member) && (
                            <RoleGate permission="members:transfer-ownership">
                              <DropdownMenuItem
                                onClick={() => setTransferTarget(member)}
                              >
                                <Crown className="size-4 mr-2" />
                                Transfer ownership
                              </DropdownMenuItem>
                            </RoleGate>
                          )}
                          {canTransferTo(member) && canRemove(member) && (
                            <DropdownMenuSeparator />
                          )}
                          {canRemove(member) && (
                            <RoleGate permission="members:manage">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <Trash2 className="size-4 mr-2" />
                                Remove member
                              </DropdownMenuItem>
                            </RoleGate>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {transferTarget && (
        <TransferOwnershipDialog
          open={!!transferTarget}
          onOpenChange={(o) => !o && setTransferTarget(null)}
          member={transferTarget}
          familyId={familyId}
          familyName={familyName}
          onTransferred={() => {
            fetchMembers();
            setTransferTarget(null);
          }}
        />
      )}

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{removeTarget?.name ?? removeTarget?.email}</strong> from
              this family? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 3: Write tests for the new behavior**

Create or extend `apps/web/__tests__/members/member-list.test.tsx` (create if absent):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberList } from '@/components/members/member-list';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockMembers = [
  {
    id: 'm-1', userId: 'u-owner', role: 'owner', joinedAt: '2026-01-01',
    lastSeenAt: '2026-05-07T10:00:00Z', name: 'Owner', email: 'o@t',
  },
  {
    id: 'm-2', userId: 'u-admin', role: 'admin', joinedAt: '2026-02-01',
    lastSeenAt: null, name: 'Admin', email: 'a@t',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(mockMembers), { status: 200 })
  );
});

describe('<MemberList>', () => {
  it('renders Last seen column header', async () => {
    render(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getByText('Owner')).toBeInTheDocument());
    expect(screen.getByText('Last seen')).toBeInTheDocument();
  });

  it('renders em-dash for null lastSeenAt', async () => {
    render(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('owner sees Transfer ownership in dropdown for admin row', async () => {
    const user = userEvent.setup();
    render(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());

    const triggers = screen.getAllByLabelText('Member actions');
    const adminMenuTrigger = triggers[0];
    await user.click(adminMenuTrigger);

    expect(screen.getByText(/transfer ownership/i)).toBeInTheDocument();
    expect(screen.getByText(/remove member/i)).toBeInTheDocument();
  });

  it('admin caller does not see Transfer ownership', async () => {
    const user = userEvent.setup();
    render(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-admin" currentRole="admin" />);
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument());

    const triggers = screen.queryAllByLabelText('Member actions');
    for (const t of triggers) await user.click(t);
    expect(screen.queryByText(/transfer ownership/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- member-list`
Expected: PASS — 4 cases.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(auth)/settings/members/page.tsx apps/web/components/members/member-list.tsx apps/web/__tests__/members/member-list.test.tsx
git commit -m "feat(members): per-row dropdown menu, Transfer ownership integration, lastSeenAt column"
```

---

## Task 9: Polish `<InviteDialog>` admin-role gating

**Files:**
- Modify: `apps/web/components/members/invite-dialog.tsx`
- Create or extend: `apps/web/__tests__/members/invite-dialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create or extend `apps/web/__tests__/members/invite-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteDialog } from '@/components/members/invite-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<InviteDialog> role gating', () => {
  it('owner inviter sees admin role option', async () => {
    const user = userEvent.setup();
    render(<InviteDialog familyId="fam-1" currentRole="owner" />);
    await user.click(screen.getByRole('button', { name: /invite member/i }));
    await user.click(screen.getByLabelText('Role'));
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('admin inviter does NOT see admin role option', async () => {
    const user = userEvent.setup();
    render(<InviteDialog familyId="fam-1" currentRole="admin" />);
    await user.click(screen.getByRole('button', { name: /invite member/i }));
    await user.click(screen.getByLabelText('Role'));
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- invite-dialog`
Expected: FAIL on the second test (admin currently sees the option).

- [ ] **Step 3: Update the component**

In `apps/web/components/members/invite-dialog.tsx`:

1. Update the imports to include `Role`:

```ts
import type { Role } from '@ancstra/auth';
```

2. Update the props interface:

```ts
interface InviteDialogProps {
  familyId: string;
  currentRole: Role;
}
```

3. Update the function signature:

```ts
export function InviteDialog({ familyId, currentRole }: InviteDialogProps) {
```

4. Replace the `<SelectContent>` block (currently around lines 167-172) with:

```tsx
                <SelectContent>
                  {currentRole === 'owner' && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
```

(No other changes — the default state `'viewer'` is already valid for both roles.)

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test -- invite-dialog`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS — `MembersPage` already passes `currentRole` to `<InviteDialog>` (set up in Task 8).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/members/invite-dialog.tsx apps/web/__tests__/members/invite-dialog.test.tsx
git commit -m "feat(members): hide admin role option in InviteDialog for non-owner inviters"
```

---

## Task 10: Manual sanity check + full test sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS across all packages. Note any pre-existing failures (e.g., the Windows `sharp` issue called out in the roadmap is unrelated).

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Manual sanity check (dev server)**

Start: `pnpm --filter web dev`

In a browser (signed in as a family owner with at least one admin member):

1. Open `/settings/members`. Confirm "Last seen" column renders with relative times for active members and `—` for inactive.
2. Click the `…` button on the admin row. Confirm both "Transfer ownership" and "Remove member" items appear.
3. Click "Transfer ownership". Confirm the dialog body names the target and warns about losing owner-only perms.
4. Type a wrong family name → button stays disabled.
5. Type the correct family name (with surrounding whitespace) → button enables.
6. Click "Transfer ownership" → success toast; dialog closes; the previously-owner row's role changes to admin; the target's role changes to owner.
7. Within ~1s: D1's "Session refreshed — please retry" toast appears.
8. Try to access `/settings` (the family settings page): the former owner should no longer see edit affordances (lost `settings:manage`).
9. Sign out and sign back in as the new owner. Confirm owner-only `RoleGate`s are visible.
10. Open `<InviteDialog>` as the new owner — confirm "Admin" option is present in role select.
11. Sign in as an admin (not owner) and open `<InviteDialog>` — confirm "Admin" option is NOT present.
12. Optional concurrent-transfer probe: in two browser tabs as the owner, click Transfer to A in one tab, Transfer to B in the other in rapid succession. Expect one to succeed, the other to show "Concurrent transfer detected. Please retry."

- [ ] **Step 4: Note any deviations**

Common gotchas:
- Tab-aware refresh: D1's `JwtRefreshObserver` runs on mount + nav, not every render. If the owner is in another tab when the transfer happens, that tab won't update until next nav.
- The MemberList refetch is what triggers proxy.ts to set `force-jwt-refresh` on the response. If the cookie isn't being set, verify the proxy's stale-version detection is firing on the `/members` GET response.

- [ ] **Step 5: No commit yet**

This task verifies; the next tasks produce the sign-off artifacts that get committed.

---

## Task 11: Write ADR-017 — RBAC share/invite UX

**Files:**
- Create: `docs/architecture/decisions/017-rbac-share-invite-ux.md`

- [ ] **Step 1: Write the ADR**

Create `docs/architecture/decisions/017-rbac-share-invite-ux.md`:

```markdown
# ADR-017: RBAC Share/Invite UX (Sub-spec C)

**Status:** Accepted
**Date:** 2026-05-XX (replace with merge date)
**Cross-cutting:** `docs/rbac/architecture.md`
**Spec:** `docs/rbac/c-share-invite/design.md`
**Plan:** `docs/rbac/c-share-invite/plan.md`

## Context

RBAC sub-spec C closes the share/invite UX layer of the cross-cutting roadmap.
Most of the surface (member list, role inline-edit, remove, invite-by-link,
pending-invites) was built incrementally during D2's RoleGate sweep. C adds
the missing transfer-ownership flow end-to-end and hardens the underlying
function for atomicity and concurrent-transfer safety.

## Decision

1. **New permission** `members:transfer-ownership` (owner-only). Added to
   `packages/auth/src/permissions.ts` matrix. Excluded from admin's filter.

2. **Atomicity.** `transferOwnership` in `packages/auth/src/families.ts`
   wraps demote / promote / version-bump / registry-update in
   `centralDb.transaction(async (tx) => …)` (Drizzle, driver-agnostic).
   Process death between writes can no longer leave the family in a
   no-owner state.

3. **Concurrency guard.** The partial UQ index
   `uq_family_members_family_owner ON family_members(family_id) WHERE
   role='owner'` (added in sub-spec A) is the actual guard. C catches its
   violation and surfaces it as `ConcurrentTransferError`, mapped to HTTP
   409 with body `{ code: 'CONCURRENT_TRANSFER', error: ... }`.

4. **REST endpoint** `POST /api/families/[id]/members/[userId]/transfer-ownership`.
   Nested under the existing `members/[userId]` resource. No request body —
   target is the URL, source is `ctx.userId`. The caller can only transfer
   *their own* ownership.

5. **REST stays for C.** Per the canonical roadmap, REST routes already
   cover member mutations and bump `memberships_version`; C surfaces them
   via UI rather than duplicate as tRPC procedures. tRPC is reserved for
   future writes that need typed RSC integration (per ADR-013).

6. **Per-row `<DropdownMenu>` UX convention.** Replaces the standalone
   trash button with a `…` overflow menu that hosts "Transfer ownership"
   (owner-only) + "Remove member". Scales to future actions.

7. **Type-to-confirm AlertDialog** for destructive transfer. User must
   type the family name (whitespace-trimmed, case-sensitive) to enable the
   confirm button. Matches GitHub/Linear repo-delete pattern.

## Consequences

- The "transferOwnership non-atomic" carry-forward from sub-spec D1 is
  closed.
- The "transferOwnership has no UI" gap from the canonical roadmap is
  closed.
- `lastSeenAt` (written by D2's proxy on every family-switch) now has a
  consumer in the members table.
- One open question deferred to later: tab-aware JWT refresh for the
  initiating tab (D1's observer runs on mount + nav, acceptable for now).
- Email delivery and bulk-invite remain explicitly out of scope; they
  defer to a separate sub-spec when there's user demand.

## Files

See `docs/rbac/c-share-invite/plan.md` for the full file list.
```

(Update the date placeholder at merge time.)

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/decisions/017-rbac-share-invite-ux.md
git commit -m "docs(adr): add ADR-017 — RBAC share/invite UX (sub-spec C)"
```

---

## Task 12: Promote drafts to canonical `docs/rbac/`

**Files:**
- Create: `docs/rbac/c-share-invite/design.md` (copy of spec)
- Create: `docs/rbac/c-share-invite/plan.md` (copy of this plan)
- Create: `docs/rbac/d2-ux/design.md` (copy of D2 spec from gitignored area)
- Create: `docs/rbac/d2-ux/plan.md` (copy of D2 plan from gitignored area)

- [ ] **Step 1: Promote C drafts**

```bash
mkdir -p docs/rbac/c-share-invite
cp docs/superpowers/specs/2026-05-07-rbac-subspec-c-design.md docs/rbac/c-share-invite/design.md
cp docs/superpowers/plans/2026-05-07-rbac-subspec-c-share-invite.md docs/rbac/c-share-invite/plan.md
```

- [ ] **Step 2: Promote D2 drafts (housekeeping carry-forward)**

First, check whether `docs/rbac/d2-ux/` already exists with content:

```bash
ls docs/rbac/d2-ux/ 2>/dev/null
```

If it exists and has files, skip this step. Otherwise, find and copy the D2 drafts:

```bash
mkdir -p docs/rbac/d2-ux
ls docs/superpowers/specs/ | grep -i d2
ls docs/superpowers/plans/ | grep -i d2
```

Use the actual filenames returned by the `ls` commands above and copy:

```bash
cp docs/superpowers/specs/<actual-d2-spec-filename>.md docs/rbac/d2-ux/design.md
cp docs/superpowers/plans/<actual-d2-plan-filename>.md docs/rbac/d2-ux/plan.md
```

- [ ] **Step 3: Commit**

```bash
git add docs/rbac/c-share-invite/ docs/rbac/d2-ux/
git commit -m "docs(rbac): promote sub-spec C + D2 drafts to canonical docs/rbac/"
```

---

## Task 13: Update `docs/RBAC_ROADMAP.md`

**Files:**
- Modify: `docs/RBAC_ROADMAP.md`

- [ ] **Step 1: Update the status table**

In `docs/RBAC_ROADMAP.md`, update the C row of the status table from:

```
| **C** | Share / invite UX (settings/members page) | ⏳ Pending | — | — |
```

to:

```
| **C** | Share / invite UX (settings/members page) | ✅ Shipped 2026-05-XX | `sub-spec-c-complete` | [ADR-017](architecture/decisions/017-rbac-share-invite-ux.md) |
```

(Replace `2026-05-XX` with the actual ship date when this PR merges.)

- [ ] **Step 2: Move the "What shipped" content**

Move the current "Sub-spec C — Share / invite UX" pending block out of "What's pending" and into "What shipped" (after the D2 block). Replace its body with:

```markdown
**Sub-spec C — Share / invite UX** ([design](rbac/c-share-invite/design.md) · [plan](rbac/c-share-invite/plan.md))
- New permission `members:transfer-ownership` (owner-only) added to matrix
- `transferOwnership` wrapped in `centralDb.transaction(...)` for atomicity
- UQ partial-index violation surfaced as `ConcurrentTransferError` → HTTP 409
- New `POST /api/families/[id]/members/[userId]/transfer-ownership` endpoint
- `<TransferOwnershipDialog>` — type-to-confirm with family name
- Per-row `<DropdownMenu>` in `<MemberList>` (Transfer ownership + Remove member)
- New "Last seen" column in members table; GET `/members` returns `lastSeenAt`
- `<InviteDialog>` hides "admin" role option for non-owner inviters
- ADR-017; `sub-spec-c-complete` tag
```

- [ ] **Step 3: Update "Suggested execution order"**

Change:

```
Updated post-D2: B → A → ~~D1~~ → ~~D2~~ → **C** → E.
```

to:

```
Updated post-C: B → A → ~~D1~~ → ~~D2~~ → ~~C~~ → **E**.
```

And update the surrounding prose to point at E as the next sub-spec.

- [ ] **Step 4: Update the "Bucket of follow-ups" table**

Strike through the `transferOwnership` non-atomic row (now closed by C):

```
| ~~`transferOwnership` non-atomic across role swap + version bumps + registry update~~ | sub-spec A final review (I4) | ✅ Folded into C plan (Tasks 3-4) |
```

- [ ] **Step 5: Commit**

```bash
git add docs/RBAC_ROADMAP.md
git commit -m "docs(rbac): C shipped — promote, update roadmap status"
```

---

## Task 14: Open PR and merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/rbac-subspec-c-share-invite
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(rbac): sub-spec C — share/invite UX (transfer-ownership flow + atomicity + lastSeenAt column)" --body "$(cat <<'EOF'
## Summary

Closes RBAC sub-spec C. End-to-end transfer-ownership flow + atomicity hardening + UQ-violation→409 guard + `lastSeenAt` surfacing + `InviteDialog` polish.

- New permission `members:transfer-ownership` (owner-only)
- `transferOwnership` wrapped in transaction; UQ violation → `ConcurrentTransferError`
- New endpoint `POST /api/families/[id]/members/[userId]/transfer-ownership`
- `<TransferOwnershipDialog>` (type-to-confirm)
- `<MemberList>` per-row `<DropdownMenu>` + "Last seen" column
- `<InviteDialog>` admin-role hidden for non-owner inviters

ADR-017 added. Drafts promoted to `docs/rbac/c-share-invite/`. D2 drafts promoted to `docs/rbac/d2-ux/`.

## Test plan

- [ ] `pnpm test` — all packages green
- [ ] `pnpm typecheck` — clean
- [ ] `pnpm lint` — clean
- [ ] Manual sanity check (Task 10 of plan)
EOF
)"
```

- [ ] **Step 3: Merge after review**

Merge via GitHub UI (squash or merge-commit per project convention; sub-specs B/A/D1/D2 used merge-commit).

- [ ] **Step 4: Tag the merge commit**

```bash
git checkout main
git pull
git tag sub-spec-c-complete
git push origin sub-spec-c-complete
```

- [ ] **Step 5: Update RBAC_ROADMAP.md ship date**

If the date placeholder `2026-05-XX` is still in the merged ADR-017 and `RBAC_ROADMAP.md` C row, open a tiny follow-up PR to replace with the actual merge date. (Or fix in this PR before merge if the merge date is known.)

---

## Self-review

**Spec coverage** (skimmed `docs/superpowers/specs/2026-05-07-rbac-subspec-c-design.md`):

- §"In scope > Permission matrix" → Task 1 ✓
- §"Backend hardening" → Tasks 3-4 ✓
- §"REST endpoint" → Task 6 ✓
- §"Activity log" — mostly covered in Task 6 (`logActivity` with action + metadata). The spec said summary `"Transferred ownership to ${newOwnerName}"`. Task 6 uses generic copy `"Transferred ownership to a new owner"` because resolving the new owner name inside the route requires a second DB query. Acceptable simplification — the activity feed UI has access to the actor's name + the metadata's `newOwnerId` to render full prose at read time.
- §"Client — MemberList" → Task 8 ✓ (DropdownMenu, Last seen column, integrate dialog)
- §"Client — TransferOwnershipDialog" → Task 7 ✓
- §"Server — GET /members" → Task 5 ✓
- §"Client — InviteDialog polish" → Task 9 ✓
- §"Sign-off artifacts" → Tasks 11-13 ✓
- §"Testing" all five test files → covered ✓
- §"Manual sanity check" → Task 10 ✓

**Placeholder scan:** No "TBD" / "TODO" / "implement later" anywhere. The two date placeholders (`2026-05-XX`) are intentional — replace at merge time. The `<actual-d2-spec-filename>.md` placeholder in Task 12 Step 2 is intentional — the filename is data-driven and listed by the included `ls` command above it.

**Type consistency:**
- `Member` interface in `member-list.tsx` adds `lastSeenAt: string | null` (Task 8). `<TransferOwnershipDialog>` defines an identical `Member` interface (Task 7) — both have the same fields. ✓
- `currentRole: Role` prop wired through `page.tsx` → `<InviteDialog>` (Tasks 8 + 9). ✓
- `ConcurrentTransferError` exported from `@ancstra/auth` via `types.ts` (Task 2) → re-exported through `packages/auth/src/index.ts:2` (`export * from './types'`) → imported in route handler (Task 6) and in test (Task 4). ✓
- `'owner_transferred'` ActivityAction used in route (Task 6) — already exists in `types.ts:36`, no changes needed. ✓

**Scope check:** This plan is one sub-spec (C). Task count is 14 — well-bounded. Each task ships independent, testable changes. No decomposition needed.

**Ambiguity check:** None caught after re-read.
