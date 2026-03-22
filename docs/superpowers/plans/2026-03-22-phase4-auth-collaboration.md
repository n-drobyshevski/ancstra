# Phase 4: Authentication & Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Ancstra from single-user to multi-user with RBAC, OAuth, invitations, moderation, activity feed, and multi-database architecture.

**Architecture:** New `packages/auth/` package owns all auth logic. Central `ancstra.sqlite` stores users/families/invitations/activity. Per-family `family-{id}.sqlite` files store tree data. Custom NextAuth v5 adapter maps to our schema. `proxy.ts` resolves family DB per-request.

**Tech Stack:** NextAuth v5, Drizzle ORM, better-sqlite3, bcryptjs, Google/Apple OAuth, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-phase4-auth-collaboration-design.md`

**Important:** This project uses Next.js 16 which has breaking changes. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Never use `.js` extensions in TS imports — Turbopack requires bare paths.

---

## File Map

### New files

```
packages/auth/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── nextauth-adapter.ts
│   ├── permissions.ts
│   ├── privacy.ts
│   ├── invitations.ts
│   ├── activity.ts
│   ├── moderation.ts
│   ├── families.ts
│   └── oauth-linking.ts
├── __tests__/
│   ├── permissions.test.ts
│   ├── privacy.test.ts
│   ├── invitations.test.ts
│   ├── activity.test.ts
│   ├── moderation.test.ts
│   ├── families.test.ts
│   └── oauth-linking.test.ts

packages/db/src/
├── central-schema.ts              (new)
├── migrations/split-to-multi-db.ts (new)

apps/web/
├── proxy.ts                       (new)
├── app/join/page.tsx              (new)
├── app/(auth)/settings/members/page.tsx  (new)
├── app/(auth)/activity/page.tsx         (new)
├── app/api/families/[id]/members/route.ts        (new)
├── app/api/families/[id]/members/[userId]/route.ts (new)
├── app/api/families/[id]/invitations/route.ts    (new)
├── app/api/families/[id]/activity/route.ts       (new)
├── app/api/families/[id]/contributions/route.ts  (new)
├── app/api/families/[id]/contributions/[id]/route.ts (new)
├── components/auth/oauth-buttons.tsx    (new)
├── components/auth/family-picker.tsx    (new)
├── components/auth/role-badge.tsx       (new)
├── components/members/member-list.tsx   (new)
├── components/members/invite-dialog.tsx (new)
├── components/members/pending-invites.tsx (new)
├── components/activity/activity-feed.tsx  (new)
├── components/activity/activity-entry.tsx (new)
├── components/moderation/contribution-queue.tsx  (new)
├── components/moderation/contribution-review.tsx (new)
├── lib/auth/context.ts            (new)
```

### Modified files

```
packages/db/src/schema.ts         → renamed to family-schema.ts, add version cols + new tables
packages/db/src/index.ts          → dual DB creation (central + family)
packages/db/src/research-schema.ts → update imports from ./schema to ./family-schema, drop users FK refs
packages/db/src/ai-schema.ts      → update imports from ./schema to ./family-schema, drop users FK refs
packages/db/src/matching-schema.ts → update imports from ./schema to ./family-schema, drop users FK refs
packages/db/src/seed.ts           → seed both DBs
packages/db/package.json          → add vitest

apps/web/auth.ts                  → add OAuth providers, custom adapter
apps/web/app/login/page.tsx       → add OAuth buttons
apps/web/app/signup/page.tsx      → add OAuth buttons
apps/web/app/actions/auth.ts      → family creation on signup
apps/web/app/(auth)/layout.tsx    → family DB context, family picker
apps/web/vitest.config.ts         → add @ancstra/auth alias
apps/web/package.json             → add @ancstra/auth dep

pnpm-workspace.yaml               → verify packages/auth is included (likely covered by packages/* glob)
```

### Deferred files (not in this plan)

```
packages/db/src/turso.ts          → Turso multi-tenant support deferred to web deployment phase
Hono worker updates               → Worker uses createDb() which will need updating; deferred to worker task
```

---

## Task 1: packages/auth/ scaffold and types

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/types.ts`
- Create: `packages/auth/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ancstra/auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ancstra/db": "workspace:*",
    "drizzle-orm": "^0.45.1"
  },
  "devDependencies": {
    "better-sqlite3": "^12.8.0",
    "@types/better-sqlite3": "^7.6.13",
    "vitest": "^3.2.3",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "__tests__/**/*.ts"]
}
```

- [ ] **Step 3: Create types.ts**

```typescript
// packages/auth/src/types.ts

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export type Permission =
  | 'tree:view' | 'tree:export' | 'tree:delete'
  | 'person:create' | 'person:edit' | 'person:delete'
  | 'family:create' | 'family:edit' | 'family:delete'
  | 'event:create' | 'event:edit' | 'event:delete'
  | 'source:create' | 'source:edit' | 'source:delete'
  | 'media:upload' | 'media:delete'
  | 'gedcom:import' | 'gedcom:export'
  | 'ai:research'
  | 'relationship:validate'
  | 'members:manage' | 'members:invite'
  | 'settings:manage'
  | 'contributions:review'
  | 'activity:view';

export type ActivityAction =
  | 'person_added' | 'person_edited' | 'person_deleted'
  | 'relationship_added'
  | 'media_uploaded'
  | 'gedcom_imported'
  | 'invite_sent' | 'invite_accepted'
  | 'role_changed' | 'member_removed'
  | 'contribution_submitted' | 'contribution_approved' | 'contribution_rejected'
  | 'owner_transferred';

export type ContributionOperation = 'create' | 'update' | 'delete';
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type ContributionEntityType = 'person' | 'family' | 'event' | 'source' | 'media';

export interface RequestContext {
  userId: string;
  familyId: string;
  role: Role;
  dbFilename: string;
}

export class ForbiddenError extends Error {
  public readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Forbidden: missing permission '${permission}'`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}
```

- [ ] **Step 4: Create index.ts (barrel export)**

```typescript
// packages/auth/src/index.ts
export * from './types';
export * from './permissions';
```

- [ ] **Step 5: Verify pnpm-workspace.yaml includes packages/auth**

Check if `pnpm-workspace.yaml` has a `packages/*` glob or explicit `packages/auth` entry. If not, add it.

- [ ] **Step 6: Install deps and verify**

Run: `pnpm install`
Expected: No errors, packages/auth linked in workspace

- [ ] **Step 7: Commit**

```bash
git add packages/auth/ pnpm-workspace.yaml
git commit -m "feat(auth): scaffold packages/auth with types and permissions types"
```

---

## Task 2: RBAC permissions module

**Files:**
- Create: `packages/auth/src/permissions.ts`
- Create: `packages/auth/__tests__/permissions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/auth/__tests__/permissions.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission, requirePermission, shouldModerate } from '../src/permissions';
import { ForbiddenError } from '../src/types';

describe('hasPermission', () => {
  it('owner has all permissions', () => {
    expect(hasPermission('owner', 'settings:manage')).toBe(true);
    expect(hasPermission('owner', 'tree:delete')).toBe(true);
    expect(hasPermission('owner', 'person:delete')).toBe(true);
  });

  it('admin has all except settings:manage and tree:delete', () => {
    expect(hasPermission('admin', 'person:delete')).toBe(true);
    expect(hasPermission('admin', 'members:manage')).toBe(true);
    expect(hasPermission('admin', 'settings:manage')).toBe(false);
    expect(hasPermission('admin', 'tree:delete')).toBe(false);
  });

  it('editor can create/edit but not delete or manage', () => {
    expect(hasPermission('editor', 'person:create')).toBe(true);
    expect(hasPermission('editor', 'person:edit')).toBe(true);
    expect(hasPermission('editor', 'person:delete')).toBe(false);
    expect(hasPermission('editor', 'members:manage')).toBe(false);
    expect(hasPermission('editor', 'gedcom:import')).toBe(false);
  });

  it('viewer can only view tree and activity', () => {
    expect(hasPermission('viewer', 'tree:view')).toBe(true);
    expect(hasPermission('viewer', 'activity:view')).toBe(true);
    expect(hasPermission('viewer', 'person:create')).toBe(false);
    expect(hasPermission('viewer', 'tree:export')).toBe(false);
  });
});

describe('requirePermission', () => {
  it('throws ForbiddenError when permission missing', () => {
    expect(() => requirePermission('viewer', 'person:edit')).toThrow(ForbiddenError);
  });

  it('does not throw when permission exists', () => {
    expect(() => requirePermission('owner', 'person:edit')).not.toThrow();
  });
});

describe('shouldModerate', () => {
  it('returns true for editor when moderation enabled', () => {
    expect(shouldModerate('editor', true)).toBe(true);
  });

  it('returns false for editor when moderation disabled', () => {
    expect(shouldModerate('editor', false)).toBe(false);
  });

  it('returns false for owner even when moderation enabled', () => {
    expect(shouldModerate('owner', true)).toBe(false);
  });

  it('returns false for admin even when moderation enabled', () => {
    expect(shouldModerate('admin', true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth && npx vitest run __tests__/permissions.test.ts`
Expected: FAIL — cannot find module '../src/permissions'

- [ ] **Step 3: Write implementation**

```typescript
// packages/auth/src/permissions.ts
import { type Role, type Permission, ForbiddenError } from './types';

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
  'members:manage', 'members:invite',
  'settings:manage',
  'contributions:review',
  'activity:view',
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p => p !== 'settings:manage' && p !== 'tree:delete'),
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

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(permission);
  }
}

export function shouldModerate(role: Role, moderationEnabled: boolean): boolean {
  return role === 'editor' && moderationEnabled;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/permissions.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Update index.ts exports**

Add to `packages/auth/src/index.ts`:
```typescript
export * from './permissions';
```

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): RBAC permissions with hasPermission, requirePermission, shouldModerate"
```

---

## Task 3: Central database schema (Drizzle)

**Files:**
- Create: `packages/db/src/central-schema.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create central-schema.ts**

Define all central DB tables using Drizzle ORM: `users`, `oauthAccounts`, `verificationTokens`, `familyRegistry`, `familyMembers`, `invitations`, `activityFeed`. Match the SQL in the spec exactly. Include all indexes.

Key details:
- `users.passwordHash` is nullable (no `.notNull()`)
- `familyRegistry.maxMembers` defaults to 50
- `familyMembers` has `invitedRole` for audit
- `invitations` has `revokedBy`
- Composite unique on `(familyId, userId)` for `familyMembers`
- Composite unique on `(provider, providerAccountId)` for `oauthAccounts`

- [ ] **Step 2: Update packages/db/src/index.ts**

Add `createCentralDb()` alongside existing `createDb()`. Import central schema. The central DB path defaults to `~/.ancstra/ancstra.sqlite` (use `os.homedir()`). Keep existing `createDb()` working for backward compat during migration.

```typescript
import * as centralSchema from './central-schema';

export function createCentralDb(url?: string) {
  const defaultPath = path.join(os.homedir(), '.ancstra', 'ancstra.sqlite');
  return drizzle({
    connection: { source: url || process.env.CENTRAL_DATABASE_URL || defaultPath },
    schema: centralSchema,
  });
}

export function createFamilyDb(dbFilename: string) {
  const familiesDir = path.join(os.homedir(), '.ancstra', 'families');
  return drizzle({
    connection: { source: path.join(familiesDir, dbFilename) },
    schema,
  });
}
```

- [ ] **Step 3: Export central schema from package**

Update `packages/db/src/index.ts` to also export:
```typescript
export * as centralSchema from './central-schema';
```

- [ ] **Step 4: Verify build**

Run: `pnpm build` (or `pnpm typecheck` if available)
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/central-schema.ts packages/db/src/index.ts
git commit -m "feat(db): central database schema for multi-user auth"
```

---

## Task 4: Family schema changes (version columns, new tables)

**Files:**
- Modify: `packages/db/src/schema.ts` (rename to `family-schema.ts`)

- [ ] **Step 1: Rename schema.ts to family-schema.ts**

```bash
git mv packages/db/src/schema.ts packages/db/src/family-schema.ts
```

- [ ] **Step 2: Add version columns to all mutable tables that exist**

Add `version: integer('version').notNull().default(1)` to: `persons`, `personNames`, `families`, `children`, `events`, `sources`, `sourceCitations`. Also add to `proposedRelationships` (in `ai-schema.ts`).

**Note:** The `media` and `proposed_persons` tables are defined in the data model doc but NOT yet implemented in Drizzle schema. Do NOT add version columns for them — they will get version columns when they are created in their respective phases. Skip them here.

- [ ] **Step 3: Add family_user_cache table**

```typescript
export const familyUserCache = sqliteTable('family_user_cache', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 4: Add pending_contributions table**

```typescript
export const pendingContributions = sqliteTable('pending_contributions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  operation: text('operation', { enum: ['create', 'update', 'delete'] }).notNull(),
  entityType: text('entity_type', { enum: ['person', 'family', 'event', 'source', 'media'] }).notNull(),
  entityId: text('entity_id'),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'revision_requested'] }).notNull().default('pending'),
  reviewerId: text('reviewer_id'),
  reviewComment: text('review_comment'),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_pending_status').on(table.status),
]);
```

- [ ] **Step 5: Remove `users` table from family-schema.ts**

After rename, the family schema still exports `users`. Remove the `users` table definition from `family-schema.ts` entirely — it now lives in `central-schema.ts` only. New family DBs should not include a `users` table.

- [ ] **Step 6: Drop ALL user-referencing FK constraints in family schemas**

These columns reference `users.id` which now lives in a different database. Convert each to plain `text()` columns (drop `.references()`):

In `family-schema.ts`:
- `persons.createdBy`: `.references(() => users.id)` → just `text('created_by')`

In `research-schema.ts`:
- `researchItems.createdBy`: `.references(() => users.id)` → just `text('created_by')`
- Remove `users` from the import statement

In `ai-schema.ts`:
- `aiUsage.userId`: `.references(() => users.id)` → just `text('user_id').notNull()`
- `proposedRelationships.validatedBy` (if it references users): drop FK
- Remove `users` from the import statement

In `matching-schema.ts`:
- `relationshipJustifications.authorId`: drop FK if it references users
- Remove `users` from the import statement

- [ ] **Step 7: Update all imports from './schema' to './family-schema'**

Update these files to import from `'./family-schema'` instead of `'./schema'`:
- `packages/db/src/research-schema.ts` (line 2)
- `packages/db/src/ai-schema.ts` (line 2)
- `packages/db/src/matching-schema.ts` (line 2)
- `packages/db/src/index.ts`
- `packages/db/src/seed.ts`

Verify that no file still imports `users` from `family-schema` — it should only be imported from `central-schema`.

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: No errors. All existing imports still resolve.

- [ ] **Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat(db): family schema with version columns, pending_contributions, family_user_cache"
```

---

## Task 5: Privacy/redaction module

**Files:**
- Create: `packages/auth/src/privacy.ts`
- Create: `packages/auth/__tests__/privacy.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/auth/__tests__/privacy.test.ts
import { describe, it, expect } from 'vitest';
import { isPresumablyLiving, redactForViewer } from '../src/privacy';

describe('isPresumablyLiving', () => {
  it('returns false if isLiving flag is false', () => {
    expect(isPresumablyLiving({ isLiving: false, birthDateSort: 19900101 })).toBe(false);
  });

  it('returns false if death date exists', () => {
    expect(isPresumablyLiving({ isLiving: true, deathDateSort: 20200101 })).toBe(false);
  });

  it('returns true if no birth date (conservative)', () => {
    expect(isPresumablyLiving({ isLiving: true })).toBe(true);
  });

  it('returns true if born within 100 years', () => {
    const recentYear = (new Date().getFullYear() - 50) * 10000 + 101;
    expect(isPresumablyLiving({ isLiving: true, birthDateSort: recentYear })).toBe(true);
  });

  it('returns false if born more than 100 years ago with no death', () => {
    expect(isPresumablyLiving({ isLiving: true, birthDateSort: 19000101 })).toBe(false);
  });
});

describe('redactForViewer', () => {
  const livingPerson = {
    id: '123',
    givenName: 'John',
    surname: 'Doe',
    sex: 'M' as const,
    isLiving: true,
    birthDateSort: (new Date().getFullYear() - 30) * 10000 + 101,
    notes: 'Some private notes',
    events: [{ id: 'e1', eventType: 'birth' }],
    mediaIds: ['m1'],
  };

  const deceasedPerson = {
    id: '456',
    givenName: 'Jane',
    surname: 'Doe',
    sex: 'F' as const,
    isLiving: false,
    deathDateSort: 19500101,
    notes: 'Historical notes',
    events: [{ id: 'e2', eventType: 'death' }],
    mediaIds: ['m2'],
  };

  it('redacts living person completely', () => {
    const redacted = redactForViewer(livingPerson);
    expect(redacted.givenName).toBe('Living');
    expect(redacted.surname).toBe('');
    expect(redacted.notes).toBeNull();
    expect(redacted.events).toEqual([]);
    expect(redacted.mediaIds).toEqual([]);
    expect(redacted.id).toBe('123');
    expect(redacted.sex).toBe('M');
  });

  it('does not redact deceased person', () => {
    const redacted = redactForViewer(deceasedPerson);
    expect(redacted.givenName).toBe('Jane');
    expect(redacted.surname).toBe('Doe');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth && npx vitest run __tests__/privacy.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// packages/auth/src/privacy.ts

const LIVING_THRESHOLD_YEARS = 100;

interface LivingCheckInput {
  isLiving: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
}

export function isPresumablyLiving(person: LivingCheckInput): boolean {
  if (!person.isLiving) return false;
  if (person.deathDateSort && person.deathDateSort > 0) return false;
  if (!person.birthDateSort || person.birthDateSort === 0) return true;

  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birthDateSort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
}

interface RedactablePersonInput {
  id: string;
  givenName: string;
  surname: string;
  sex: string;
  isLiving: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
  notes?: string | null;
  events?: unknown[];
  mediaIds?: string[];
  [key: string]: unknown;
}

export function redactForViewer<T extends RedactablePersonInput>(person: T): T {
  if (!isPresumablyLiving(person)) return person;

  return {
    ...person,
    givenName: 'Living',
    surname: '',
    prefix: null,
    suffix: null,
    nickname: null,
    notes: null,
    events: [],
    mediaIds: [],
    birthDateSort: undefined,
    deathDateSort: undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/privacy.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './privacy';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): living person redaction with isPresumablyLiving and redactForViewer"
```

---

## Task 6: Invitation module

**Files:**
- Create: `packages/auth/src/invitations.ts`
- Create: `packages/auth/__tests__/invitations.test.ts`

- [ ] **Step 1: Write failing tests**

Test `generateInviteToken()` returns 64-char hex string. Test `validateInviteToken()` with scenarios: valid token, expired token, revoked token, already accepted token, email mismatch, family at max members. Test `acceptInvite()` creates family_members row and marks invitation accepted.

Use an in-memory SQLite DB for these tests: create central schema tables, insert test data, run the functions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run __tests__/invitations.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

`generateInviteToken()`: uses `crypto.randomBytes(32).toString('hex')`.

`createInvitation(centralDb, opts)`: checks active invite count < 20, checks role constraints (only owner can invite admin), inserts into invitations table, returns token + invite URL.

`validateInviteToken(centralDb, token, userEmail?)`: queries invitation, checks not expired/revoked/accepted, checks email match if set, checks family not at max_members. Returns `{ valid: true, invitation }` or `{ valid: false, reason: string }`.

`acceptInvite(centralDb, familyDb, token, userId)`: validates token, creates family_members row with invited role, populates family_user_cache, marks invitation accepted. Returns the new membership.

`revokeInvite(centralDb, invitationId, revokedByUserId)`: sets revoked_at and revoked_by.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/invitations.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './invitations';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): invitation system with token generation, validation, acceptance, revocation"
```

---

## Task 7: Activity feed module

**Files:**
- Create: `packages/auth/src/activity.ts`
- Create: `packages/auth/__tests__/activity.test.ts`

- [ ] **Step 1: Write failing tests**

Test `logActivity()` inserts a row into activity_feed. Test `getActivityFeed()` returns cursor-paginated results, ordered by created_at desc. Test filtering by action and userId. Test that `redactActivityForViewer()` replaces living person names in summaries.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run __tests__/activity.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

`logActivity(centralDb, entry)`: inserts into activity_feed table with generated UUID and current timestamp.

`getActivityFeed(centralDb, opts)`: queries activity_feed for familyId, supports cursor pagination using composite cursor `(created_at, id)` for stable ordering (WHERE `(created_at, id) < (cursor_created_at, cursor_id)`), limit (default 50), optional action/userId filters. Returns `{ items, nextCursor }`. The cursor is the `id` of the last item (resolve its `created_at` for the comparison).

`redactActivityForViewer(entries, livingPersonIds)`: replaces person names in summary text with "A family member" for any entity_id that matches a living person.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/activity.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './activity';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): activity feed with logging, pagination, and viewer redaction"
```

---

## Task 8: Moderation module

**Files:**
- Create: `packages/auth/src/moderation.ts`
- Create: `packages/auth/__tests__/moderation.test.ts`

- [ ] **Step 1: Write failing tests**

Test `submitContribution()` creates a pending_contributions row. Test `reviewContribution()` with approve (applies payload to target table, bumps version) and reject (sets status, adds comment). Test double-review guard: reviewing an already-reviewed contribution returns "already reviewed". Test that non-pending contributions can't be re-reviewed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run __tests__/moderation.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

`submitContribution(familyDb, opts)`: inserts into pending_contributions. Returns the contribution ID.

`getPendingContributions(familyDb)`: returns all pending_contributions WHERE status = 'pending', ordered by created_at.

`reviewContribution(familyDb, opts)`: uses `UPDATE ... WHERE id = ? AND status = 'pending'`. If 0 rows affected, return `{ alreadyReviewed: true }`. On approve: parse payload, apply to target table with optimistic locking (version check), bump version. On reject: update status and comment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/moderation.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './moderation';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): moderation queue with submit, review, and double-review guard"
```

---

## Task 9: Families module

**Files:**
- Create: `packages/auth/src/families.ts`
- Create: `packages/auth/__tests__/families.test.ts`

- [ ] **Step 1: Write failing tests**

Test `createFamily()`: creates family_registry row, creates family DB file, creates family_members row with owner role. Test `getFamiliesForUser()`: returns all families a user belongs to with their roles. Test `switchFamily()`: returns the family DB connection for a given familyId (after checking membership). Test `transferOwnership()`: swaps owner/admin roles atomically, updates family_registry.owner_id.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run __tests__/families.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

`createFamily(centralDb, opts)`: generates UUID, creates `families/family-{id}.sqlite`, runs family schema creation (all tables), inserts family_registry row, inserts family_members row (owner), populates family_user_cache. Returns family ID.

`getFamiliesForUser(centralDb, userId)`: joins family_registry + family_members WHERE user_id = userId AND is_active = 1.

`getFamilyMembership(centralDb, userId, familyId)`: returns the family_members row (or null if not a member).

`transferOwnership(centralDb, familyId, currentOwnerId, newOwnerId)`: verifies current owner, verifies new owner is admin, swaps roles in transaction, updates family_registry.owner_id.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/families.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './families';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): family management with create, list, switch, transfer ownership"
```

---

## Task 10: Custom NextAuth adapter

**Files:**
- Create: `packages/auth/src/nextauth-adapter.ts`

- [ ] **Step 1: Write the adapter**

Implement NextAuth v5's `Adapter` interface against the central DB schema. Methods needed:

- `createUser(user)`: insert into `users`, return user object
- `getUser(id)`: select from `users` by id
- `getUserByEmail(email)`: select from `users` by email
- `getUserByAccount({ provider, providerAccountId })`: join `oauth_accounts` + `users`
- `linkAccount(account)`: insert into `oauth_accounts`
- `createVerificationToken(token)`: insert into `verification_tokens`
- `useVerificationToken({ identifier, token })`: select + delete from `verification_tokens`

No `createSession`/`getSessionAndUser`/`updateSession`/`deleteSession` needed (JWT strategy).

- [ ] **Step 2: Write adapter tests**

```typescript
// packages/auth/__tests__/nextauth-adapter.test.ts
```

Test with in-memory SQLite central DB:
- `createUser()`: inserts user, returns user object with id
- `getUser(id)`: returns user by id, null if not found
- `getUserByEmail(email)`: returns user by email, null if not found
- `getUserByAccount({ provider, providerAccountId })`: returns user linked to OAuth account
- `linkAccount()`: creates oauth_accounts row
- `createVerificationToken()`: inserts token
- `useVerificationToken()`: returns and deletes token (one-time use)

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/nextauth-adapter.test.ts`
Expected: All PASS

- [ ] **Step 4: Update index.ts**

Add: `export { AncstraAdapter } from './nextauth-adapter';`

- [ ] **Step 5: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): custom NextAuth v5 adapter for central DB"
```

---

## Task 11: OAuth linking module

**Files:**
- Create: `packages/auth/src/oauth-linking.ts`
- Create: `packages/auth/__tests__/oauth-linking.test.ts`

- [ ] **Step 1: Write failing tests**

Test `linkOrCreateUser()`: when email matches existing user, creates oauth_accounts row and returns existing user (with merged avatar/name). When email is new, creates user + oauth_accounts and returns new user. When Apple relay email is used, always creates new user.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/auth && npx vitest run __tests__/oauth-linking.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

`linkOrCreateUser(centralDb, profile)`: checks if user exists by email. If yes: insert oauth_accounts, update name/avatar if missing. If no: insert user (password_hash = null) + oauth_accounts. Return the user.

`isAppleRelay(email)`: returns true if email contains `@privaterelay.appleid.com`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && npx vitest run __tests__/oauth-linking.test.ts`
Expected: All PASS

- [ ] **Step 5: Update index.ts**

Add: `export * from './oauth-linking';`

- [ ] **Step 6: Commit**

```bash
git add packages/auth/
git commit -m "feat(auth): OAuth account linking with auto-link by email"
```

---

## Task 12: Update apps/web auth.ts with OAuth providers

**Files:**
- Modify: `apps/web/auth.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Read Next.js 16 auth docs**

Run: Check `node_modules/next/dist/docs/` for any auth-related docs. Also read the current `apps/web/auth.ts` again.

- [ ] **Step 2: Add @ancstra/auth dependency**

Add `"@ancstra/auth": "workspace:*"` to `apps/web/package.json` dependencies. Run `pnpm install`.

- [ ] **Step 3: Update auth.ts**

Replace the current NextAuth config with:
- Import `AncstraAdapter` from `@ancstra/auth`
- Import `createCentralDb` from `@ancstra/db`
- Add Google and Apple providers alongside Credentials
- Use the custom adapter
- Update JWT callback to include userId
- Update the `authorize` function to use central DB for credential lookup
- Keep `session: { strategy: 'jwt' }` and `pages: { signIn: '/login' }`

Key: Google provider uses `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Apple uses `APPLE_CLIENT_ID`/`APPLE_CLIENT_SECRET`. Both are optional (gracefully skipped if env vars missing).

- [ ] **Step 4: Verify app starts**

Run: `pnpm dev` (in apps/web)
Expected: App starts without errors. Login page loads.

- [ ] **Step 5: Commit**

```bash
git add apps/web/auth.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add Google + Apple OAuth providers with custom adapter"
```

---

## Task 13: Request context and proxy.ts

**Files:**
- Create: `apps/web/lib/auth/context.ts`
- Create: `apps/web/proxy.ts`

- [ ] **Step 1: Read Next.js 16 proxy.ts docs**

Check `node_modules/next/dist/docs/` for proxy.ts documentation. This replaces middleware.ts in Next.js 16.

- [ ] **Step 2: Create context.ts**

```typescript
// apps/web/lib/auth/context.ts
// Utilities for accessing request context (userId, role, familyDb, centralDb)
// set by proxy.ts on each request.
```

Exports: `getRequestContext()`, `withFamilyDb()`, `withCentralDb()`. These read from whatever mechanism Next.js 16 proxy.ts uses to pass data to route handlers (likely request headers or a context object — check the docs).

- [ ] **Step 3: Create proxy.ts**

Implement based on Next.js 16 docs. The proxy should:
- Skip auth for public routes: `/login`, `/signup`, `/join`, `/api/auth`
- Read JWT session via `auth()` from NextAuth
- Query central DB for user's active family membership
- Resolve family from: URL `?family=` param > `active-family` cookie > first family
- Attach context: userId, familyId, role, dbFilename
- Redirect to `/login` if no session on protected routes

- [ ] **Step 4: Verify protected routes redirect when not logged in**

Run: `pnpm dev`, visit `/dashboard` without login.
Expected: Redirects to `/login`

- [ ] **Step 5: Commit**

```bash
git add apps/web/proxy.ts apps/web/lib/auth/context.ts
git commit -m "feat(web): proxy.ts for route auth and family DB resolution"
```

---

## Task 14: Update (auth) layout for family context

**Files:**
- Modify: `apps/web/app/(auth)/layout.tsx`

- [ ] **Step 1: Read current layout**

Read `apps/web/app/(auth)/layout.tsx` to understand existing structure.

- [ ] **Step 2: Add family context**

Update the layout to:
- Get the request context (userId, familyId, role) from proxy.ts
- If user has no families, redirect to a "create family" flow
- Pass family context to child components via React context or props
- Keep existing sidebar/header structure

- [ ] **Step 3: Verify dashboard loads for logged-in user**

Run: `pnpm dev`, log in, visit `/dashboard`.
Expected: Dashboard loads. No errors in console.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(auth)/layout.tsx
git commit -m "feat(web): auth layout with family context resolution"
```

---

## Task 15: Members API routes

**Files:**
- Create: `apps/web/app/api/families/[id]/members/route.ts`
- Create: `apps/web/app/api/families/[id]/members/[userId]/route.ts`

- [ ] **Step 1: Create members list/add route**

`GET /api/families/[id]/members`: requires `members:manage` permission. Returns all family_members with user details (from central DB join).

`POST /api/families/[id]/members`: admin use only (for direct adds, not invite flow). Requires `members:manage`.

- [ ] **Step 2: Create member update/remove route**

`PATCH /api/families/[id]/members/[userId]`: update role. Requires `members:manage`. Owner can change anyone. Admin can only change editor/viewer. Cannot change own role. Cannot set role to owner (use transfer flow).

`DELETE /api/families/[id]/members/[userId]`: remove member. Requires `members:manage`. Cannot remove self if owner. Cleans up family_user_cache.

- [ ] **Step 3: Verify with manual API calls**

Run: `pnpm dev`, use curl/fetch to test endpoints.
Expected: Proper 200/403/404 responses.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/families/
git commit -m "feat(web): members API routes with RBAC"
```

---

## Task 16: Invitations API route

**Files:**
- Create: `apps/web/app/api/families/[id]/invitations/route.ts`

- [ ] **Step 1: Create invitations route**

`GET /api/families/[id]/invitations`: requires `members:manage`. Returns pending invitations.

`POST /api/families/[id]/invitations`: requires `members:manage`. Body: `{ email?, role }`. Validates role constraints (only owner invites admin). Checks limits (20 active, family not at max_members). Creates invitation, returns token + link.

`DELETE /api/families/[id]/invitations?id=xxx`: revoke invitation. Requires `members:manage`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/families/
git commit -m "feat(web): invitations API route with create, list, revoke"
```

---

## Task 17: Join page

**Files:**
- Create: `apps/web/app/join/page.tsx`

- [ ] **Step 1: Create join page**

Server component that:
- Reads `?token=` from searchParams
- Validates token via `validateInviteToken()`
- If invalid: shows error message with reason
- If valid and user logged in: shows "Join [Family] as [Role]" button with server action
- If valid and user not logged in: shows sign-up/sign-in form with OAuth buttons, redirect back after auth

The join action: calls `acceptInvite()`, logs activity, redirects to `/dashboard?family={id}`.

- [ ] **Step 2: Add rate limiting**

Implement rate limiting on the join page's server action / API call. Use an in-memory rate limiter (Map of IP → timestamps). Limit: 10 attempts per IP per minute. Failed validations count. Return 429 when exceeded. For production, this should eventually move to a Redis-backed limiter, but in-memory is fine for local-first.

- [ ] **Step 3: Test manually**

Create a test invitation via API, visit the join URL.
Expected: Join page shows family name and role.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/join/
git commit -m "feat(web): join page for invitation acceptance"
```

---

## Task 18: Activity feed API route

**Files:**
- Create: `apps/web/app/api/families/[id]/activity/route.ts`

- [ ] **Step 1: Create activity route**

`GET /api/families/[id]/activity`: requires `activity:view`. Query params: `cursor`, `limit` (default 50), `action`, `userId`. Returns `{ items, nextCursor }`. For viewers, redact living person summaries.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/families/
git commit -m "feat(web): activity feed API route with cursor pagination"
```

---

## Task 19: Contributions API routes

**Files:**
- Create: `apps/web/app/api/families/[id]/contributions/route.ts`
- Create: `apps/web/app/api/families/[id]/contributions/[id]/route.ts`

- [ ] **Step 1: Create contributions list route**

`GET /api/families/[id]/contributions`: requires `contributions:review`. Returns pending contributions.

- [ ] **Step 2: Create contribution review route**

`POST /api/families/[id]/contributions/[id]`: requires `contributions:review`. Body: `{ action: 'approve' | 'reject', comment? }`. Calls `reviewContribution()`. Logs activity.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/families/
git commit -m "feat(web): contributions API routes for moderation queue"
```

---

## Task 20: Shared API guard helper

**Files:**
- Create: `apps/web/lib/auth/api-guard.ts`

- [ ] **Step 1: Create api-guard.ts**

Helper that wraps API route handlers with:
- Gets request context (userId, role, familyDb, centralDb) from proxy.ts context
- `withPermission(permission, handler)`: checks permission, returns 403 if denied
- `withOptimisticLock(table, id, version, updateFn)`: uses version WHERE clause, returns 409 on conflict
- `withModeration(role, moderationEnabled, contribution, directFn)`: routes to `submitContribution()` or calls directly
- `withActivityLog(centralDb, entry, handler)`: logs activity after successful mutation
- Replaces all `createDb()` calls with the family DB from context

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/auth/api-guard.ts
git commit -m "feat(web): shared API guard helper for RBAC, locking, moderation"
```

---

## Task 20a: Retrofit core entity API routes

**Files:**
- Modify: `apps/web/app/api/persons/route.ts`
- Modify: `apps/web/app/api/persons/[id]/route.ts`
- Modify: `apps/web/app/api/persons/[id]/events/route.ts`
- Modify: `apps/web/app/api/families/route.ts`
- Modify: `apps/web/app/api/families/[id]/route.ts`
- Modify: `apps/web/app/api/families/[id]/children/route.ts`
- Modify: `apps/web/app/api/families/[id]/children/[personId]/route.ts`
- Modify: `apps/web/app/api/events/route.ts`
- Modify: `apps/web/app/api/events/[id]/route.ts`
- Modify: `apps/web/app/api/sources/route.ts`
- Modify: `apps/web/app/api/sources/[id]/route.ts`
- Modify: `apps/web/app/api/citations/route.ts`
- Modify: `apps/web/app/api/citations/[id]/route.ts`
- Modify: `apps/web/app/api/search/route.ts`

- [ ] **Step 1: Read all core entity routes**

Read each file to understand current structure. All currently use `createDb()` — each must switch to family DB from request context.

- [ ] **Step 2: Apply api-guard to person routes**

- `/api/persons` GET: `tree:view`, apply viewer redaction. POST: `person:create`, with moderation check.
- `/api/persons/[id]` GET: `tree:view`, redaction. PATCH: `person:edit`, optimistic lock. DELETE: `person:delete`.
- `/api/persons/[id]/events` GET: `tree:view`.

- [ ] **Step 3: Apply api-guard to family/children routes**

- `/api/families` GET: `tree:view`. POST: `family:create`.
- `/api/families/[id]` GET/PATCH/DELETE with appropriate permissions.
- `/api/families/[id]/children/**` with `family:edit` for mutations.

- [ ] **Step 4: Apply api-guard to event, source, citation, search routes**

Same pattern. Search route needs `tree:view` and viewer redaction.

- [ ] **Step 5: Verify CRUD operations still work**

Run: `pnpm dev`, log in as owner, test person/event/source CRUD.
Expected: All existing features still work.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/persons/ apps/web/app/api/families/ apps/web/app/api/events/ apps/web/app/api/sources/ apps/web/app/api/citations/ apps/web/app/api/search/
git commit -m "feat(web): retrofit core entity routes with RBAC and optimistic locking"
```

---

## Task 20b: Retrofit research and AI API routes

**Files:**
- Modify: `apps/web/app/api/research/**/*.ts` (11 route files)
- Modify: `apps/web/app/api/ai/**/*.ts` (2 route files)
- Modify: `apps/web/app/api/matching/**/*.ts` (2 route files)

- [ ] **Step 1: Read all research/AI/matching routes**

Read each file. All use `createDb()` — switch to family DB from context.

- [ ] **Step 2: Apply api-guard to research routes**

Research routes require `ai:research` permission (except read-only views which need `tree:view`). Apply to all 11 routes under `/api/research/`.

- [ ] **Step 3: Apply api-guard to AI and matching routes**

- `/api/ai/chat`: `ai:research`
- `/api/ai/usage`: `tree:view` (read-only)
- `/api/matching/hints/**`: `relationship:validate`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/research/ apps/web/app/api/ai/ apps/web/app/api/matching/
git commit -m "feat(web): retrofit research, AI, and matching routes with RBAC"
```

---

## Task 20c: Retrofit settings and layout API routes

**Files:**
- Modify: `apps/web/app/api/settings/**/*.ts` (7 route files)
- Modify: `apps/web/app/api/layouts/**/*.ts` (3 route files)

- [ ] **Step 1: Read all settings and layout routes**

Read each file.

- [ ] **Step 2: Apply api-guard to settings routes**

Settings routes require `settings:manage` (owner-only). Exception: provider config may need `ai:research` for non-owner access to view providers.

- [ ] **Step 3: Apply api-guard to layout routes**

Layout routes (tree positions) require `tree:view` for GET and `person:edit` for mutations.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/settings/ apps/web/app/api/layouts/
git commit -m "feat(web): retrofit settings and layout routes with RBAC"
```

---

## Task 21: OAuth buttons component

**Files:**
- Create: `apps/web/components/auth/oauth-buttons.tsx`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/signup/page.tsx`

- [ ] **Step 1: Create OAuthButtons component**

Client component with "Sign in with Google" and "Sign in with Apple" buttons. Uses `signIn('google')` and `signIn('apple')` from `next-auth/react`. Apple button hidden when `NODE_ENV=development`. Divider text: "or continue with".

- [ ] **Step 2: Add to login page**

Add `<OAuthButtons />` below the existing email/password form with a separator.

- [ ] **Step 3: Add to signup page**

Same treatment for signup page.

- [ ] **Step 4: Verify visually**

Run: `pnpm dev`, visit `/login`.
Expected: OAuth buttons visible below the form.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/auth/ apps/web/app/login/ apps/web/app/signup/
git commit -m "feat(web): OAuth buttons on login and signup pages"
```

---

## Task 22: Family picker component

**Files:**
- Create: `apps/web/components/auth/family-picker.tsx`
- Create: `apps/web/components/auth/role-badge.tsx`

- [ ] **Step 1: Create RoleBadge component**

Simple badge that displays the role with color coding: owner=purple, admin=blue, editor=green, viewer=gray. Uses shadcn Badge.

- [ ] **Step 2: Create FamilyPicker component**

Dropdown in the header that shows user's families. Selected family highlighted. Each entry shows family name + user's role badge. Switching sets `active-family` cookie and reloads. Only visible when user belongs to 2+ families.

- [ ] **Step 3: Add to AppHeader**

Integrate FamilyPicker into the existing `apps/web/components/app-header.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/auth/ apps/web/components/app-header.tsx
git commit -m "feat(web): family picker and role badge components"
```

---

## Task 23: Members settings page

**Files:**
- Create: `apps/web/app/(auth)/settings/members/page.tsx`
- Create: `apps/web/components/members/member-list.tsx`
- Create: `apps/web/components/members/invite-dialog.tsx`
- Create: `apps/web/components/members/pending-invites.tsx`

- [ ] **Step 1: Create MemberList component**

Table showing: name, email, role (editable dropdown for owner/admin), joined date, remove button. Uses shadcn Table, Select, Button.

- [ ] **Step 2: Create InviteDialog component**

Dialog with: optional email input, role select (admin/editor/viewer — admin only shown to owner), submit button. On success, shows copyable invite link. Uses shadcn Dialog, Input, Select.

- [ ] **Step 3: Create PendingInvites component**

List of pending invitations: email (or "Anyone with link"), role, expires, copy link button, revoke button. Uses shadcn Card.

- [ ] **Step 4: Create members settings page**

Server component that checks `members:manage` permission. Renders MemberList + InviteDialog + PendingInvites. Include "Transfer Ownership" button (visible only to owner, opens confirmation dialog targeting an admin).

- [ ] **Step 5: Verify visually**

Run: `pnpm dev`, navigate to Settings > Members.
Expected: Members page renders with current user as owner.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(auth)/settings/members/ apps/web/components/members/
git commit -m "feat(web): members settings page with invite and role management"
```

---

## Task 24: Activity feed page

**Files:**
- Create: `apps/web/app/(auth)/activity/page.tsx`
- Create: `apps/web/components/activity/activity-feed.tsx`
- Create: `apps/web/components/activity/activity-entry.tsx`

- [ ] **Step 1: Create ActivityEntry component**

Single feed entry: user avatar, summary text, relative timestamp (e.g., "2 hours ago"). Uses shadcn Avatar.

- [ ] **Step 2: Create ActivityFeed component**

Client component. Fetches from `/api/families/{id}/activity`. Infinite scroll with cursor pagination. Filter buttons for action types.

- [ ] **Step 3: Create activity page**

Server component wrapping ActivityFeed. Page title: "Activity".

- [ ] **Step 4: Add to sidebar navigation**

Add "Activity" link to `apps/web/components/app-sidebar.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(auth)/activity/ apps/web/components/activity/ apps/web/components/app-sidebar.tsx
git commit -m "feat(web): activity feed page with infinite scroll"
```

---

## Task 25: Moderation queue UI

**Files:**
- Create: `apps/web/components/moderation/contribution-queue.tsx`
- Create: `apps/web/components/moderation/contribution-review.tsx`

- [ ] **Step 1: Create ContributionQueue component**

List of pending contributions. Shows: submitter name, operation type, entity type, submitted time. Click opens review panel. Only visible to users with `contributions:review` permission.

- [ ] **Step 2: Create ContributionReview component**

Detail view for a single contribution. Shows: diff (for updates), full data (for creates), entity being deleted (for deletes). Approve/Reject buttons with optional comment field.

- [ ] **Step 3: Add moderation to dashboard or settings**

Add a "Pending Reviews" section to the dashboard page (or as a badge count in the sidebar). Only shown when moderation is enabled and there are pending contributions.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/moderation/ apps/web/app/(auth)/dashboard/
git commit -m "feat(web): moderation queue and review UI"
```

---

## Task 26: Migration script (single-DB to multi-DB)

**Files:**
- Create: `packages/db/src/migrations/split-to-multi-db.ts`

- [ ] **Step 1: Write the migration script**

The script should:
1. Detect if already migrated (check if `~/.ancstra/ancstra.sqlite` exists)
2. Create `~/.ancstra/` directory structure
3. Create central DB with full schema
4. Copy users from old DB to central
5. Generate family ID, create family_registry entry
6. Copy old DB file to `families/family-{id}.sqlite`
7. In the family DB: drop users table, convert `created_by` FKs to plain text, add version columns, create `pending_contributions` and `family_user_cache` tables
8. Create family_members row (existing user as owner)
9. Populate family_user_cache from central users

- [ ] **Step 2: Write test for migration**

Create `packages/db/__tests__/split-to-multi-db.test.ts`. Test with a temp DB containing sample data. Verify: central DB has users + family_registry, family DB has tree data without users table, family_user_cache populated, version columns present.

- [ ] **Step 3: Run test**

Run: `cd packages/db && npx vitest run __tests__/split-to-multi-db.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/db/
git commit -m "feat(db): single-DB to multi-DB migration script"
```

---

## Task 27: Seed script update

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Update seed script**

Update to create both central + family DBs. Seed central with: 1 owner user, 1 admin user, 1 editor user, 1 viewer user. Create a family with all 4 members. Seed family DB with existing sample tree data. Generate some activity feed entries and a couple pending contributions.

- [ ] **Step 2: Run seed**

Run: `pnpm --filter @ancstra/db db:seed`
Expected: Both databases created and populated.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat(db): update seed script for multi-DB with sample users and roles"
```

---

## Task 28: Update signup flow for family creation

**Files:**
- Modify: `apps/web/app/actions/auth.ts`

- [ ] **Step 1: Update signUp action**

After creating the user in central DB (instead of old DB), prompt for family name. On first login, if user has no families, redirect to a "Create your first family tree" page. The create action calls `createFamily()` from `@ancstra/auth`.

- [ ] **Step 2: Create family creation page/dialog**

Simple page at `/create-family` (or a dialog in the layout). Input: family name. Submit creates family + redirects to dashboard.

- [ ] **Step 3: Test signup flow end-to-end**

Run: `pnpm dev`, sign up as new user.
Expected: After signup, prompted to create family. After creating family, redirected to dashboard.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/actions/auth.ts apps/web/app/
git commit -m "feat(web): signup flow with family creation"
```

---

## Task 29: Integration tests

**Files:**
- Create: `apps/web/__tests__/auth-integration.test.ts`

- [ ] **Step 1: Write RBAC integration tests**

Test all 4 roles against key API endpoints:
- Owner can access everything
- Admin can't access settings:manage
- Editor can create but not delete
- Viewer can only read (and sees redacted data)
- Editor with moderation ON gets contribution queued instead of applied

- [ ] **Step 2: Write invitation integration tests**

Test full flow: create invitation -> validate token -> accept invite -> verify membership. Test expired/revoked/max-members scenarios.

- [ ] **Step 3: Write optimistic locking integration test**

Test: read person (version 1), update with version 1 (succeeds, version 2), update with stale version 1 (409 conflict).

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/__tests__/
git commit -m "test: integration tests for RBAC, invitations, and optimistic locking"
```

---

## Task 30: Vitest config updates

**Files:**
- Modify: `apps/web/vitest.config.ts`
- Create: `packages/auth/vitest.config.ts`

- [ ] **Step 1: Create packages/auth/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@ancstra/db': path.resolve(__dirname, '../db/src'),
    },
  },
});
```

- [ ] **Step 2: Update apps/web/vitest.config.ts**

Add alias: `'@ancstra/auth': path.resolve(__dirname, '../../packages/auth/src')`

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/vitest.config.ts apps/web/vitest.config.ts
git commit -m "chore: vitest config for packages/auth and web alias"
```

---

## Task Dependency Order

```
Task 1 (scaffold)
  → Task 2 (permissions)
  → Task 3 (central schema) → Task 4 (family schema — depends on 3 for index.ts)
  → Task 5 (privacy)
  → Task 30 (vitest config)

Task 2 + 3 + 4 → Task 6 (invitations)
               → Task 7 (activity)
               → Task 8 (moderation)
               → Task 9 (families)
               → Task 10 (adapter)
               → Task 11 (oauth-linking)

Task 9 + 10 + 11 → Task 12 (auth.ts update)
Task 12 → Task 13 (proxy.ts)
Task 13 → Task 14 (layout update)

Task 6 + 13 → Task 15 (members API)
            → Task 16 (invitations API)
            → Task 17 (join page)
            → Task 18 (activity API)
            → Task 19 (contributions API)

Task 13 → Task 20 (api-guard helper)
Task 20 + 5 + 8 → Task 20a (retrofit core routes)
                 → Task 20b (retrofit research/AI routes)
                 → Task 20c (retrofit settings/layout routes)

Task 12 → Task 21 (OAuth buttons)
Task 9 → Task 22 (family picker)
Task 15 + 16 → Task 23 (members page)
Task 18 → Task 24 (activity page)
Task 19 → Task 25 (moderation UI)

Task 3 + 4 → Task 26 (migration script)
Task 26 → Task 27 (seed update)
Task 9 + 12 → Task 28 (signup flow)

All → Task 29 (integration tests)
```

**Parallelizable groups:**
- Tasks 2, 3, 5, 30 can run in parallel after Task 1 (Task 4 waits for Task 3)
- Tasks 6, 7, 8, 9, 10, 11 can run in parallel after Tasks 2-4
- Tasks 15-19 can run in parallel after Task 13
- Tasks 20a, 20b, 20c can run in parallel after Task 20
- Tasks 21-25 can run in parallel after their API route dependencies
