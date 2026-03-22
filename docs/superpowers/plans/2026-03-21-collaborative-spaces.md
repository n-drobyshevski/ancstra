# Collaborative Spaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-user collaborative spaces where family members can share trees, claim their person node with a "(me)" label, and work together with role-based permissions.

**Architecture:** Database-per-space (Turso) with a central auth DB. Each space contains multiple trees. Central DB handles users/auth/memberships. Space DBs hold all genealogy data scoped by `tree_id`. Connection routing resolves the correct space DB per request.

**Tech Stack:** Next.js 16, NextAuth.js v5, Drizzle ORM, Turso (@libsql/client), better-sqlite3 (local), bcrypt, jose (JWT), Zod, Vitest, React Query, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-21-collaborative-spaces-design.md`

**Prerequisites:** Phase 1 must be complete. All tables already have `tree_id` columns. NextAuth.js v5 is set up with credentials provider. The `trees` table exists with a single default tree per space. The Hono worker (`apps/worker`) should be deployed (see [Backend Architecture Spec](../specs/2026-03-21-backend-architecture-design.md) and [Worker Phase 2 Plan](2026-03-21-hono-worker-phase2.md)) — real-time collaboration features (WebSocket presence, live edits) route through the worker's `/ws/collab/:treeId` endpoint, not Next.js API routes.

---

## File Structure

### packages/db/ (database layer)

| File | Responsibility |
|------|---------------|
| `packages/db/schema/central/users.ts` | Drizzle schema for `users` table |
| `packages/db/schema/central/spaces.ts` | Drizzle schema for `spaces` table |
| `packages/db/schema/central/space-members.ts` | Drizzle schema for `space_members` table |
| `packages/db/schema/central/invitations.ts` | Drizzle schema for `invitations` table |
| `packages/db/schema/central/user-person-map.ts` | Drizzle schema for `user_person_map` table |
| `packages/db/schema/central/index.ts` | Re-exports all central schemas |
| `packages/db/schema/space/trees.ts` | Drizzle schema for `trees` table |
| `packages/db/schema/space/person-links.ts` | Drizzle schema for `person_links` table |
| `packages/db/schema/space/activity-feed.ts` | Drizzle schema for `activity_feed` table |
| `packages/db/schema/space/index.ts` | Re-exports all space schemas |
| `packages/db/central.ts` | Central DB connection (singleton, cached) |
| `packages/db/space-connection.ts` | Space DB connection routing + cache |
| `packages/db/provisioning.ts` | Space DB provisioning (Turso API + local SQLite) |
| `packages/db/queries/spaces.ts` | Space CRUD query builders |
| `packages/db/queries/invitations.ts` | Invitation query builders |
| `packages/db/queries/user-person-map.ts` | User-person mapping query builders |
| `packages/db/queries/activity-feed.ts` | Activity feed query builders |
| `packages/db/queries/trees.ts` | Tree CRUD query builders |
| `packages/db/queries/person-links.ts` | Cross-tree person link query builders |

### apps/web/lib/ (server utilities)

| File | Responsibility |
|------|---------------|
| `apps/web/lib/auth/rbac.ts` | Permission checking: `requireRole()`, `canDo()` |
| `apps/web/lib/auth/privacy.ts` | `filterForPrivacy()` with "(me)" override |
| `apps/web/lib/auth/invite-token.ts` | JWT invite token generation + verification |
| `apps/web/lib/auth/space-context.ts` | Request-scoped space resolution middleware |

### apps/web/app/ (routes)

| File | Responsibility |
|------|---------------|
| `apps/web/app/api/spaces/route.ts` | `POST /api/spaces` (create), `GET /api/spaces` (list user's spaces) |
| `apps/web/app/api/spaces/[spaceId]/route.ts` | `GET`, `PUT`, `DELETE` single space |
| `apps/web/app/api/spaces/[spaceId]/members/route.ts` | `GET` members, `PUT` update role, `DELETE` remove member |
| `apps/web/app/api/spaces/[spaceId]/invitations/route.ts` | `POST` create invite, `GET` list pending invites |
| `apps/web/app/api/spaces/[spaceId]/invitations/[id]/route.ts` | `DELETE` revoke invite |
| `apps/web/app/api/spaces/[spaceId]/trees/route.ts` | `POST` create tree, `GET` list trees |
| `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/route.ts` | `GET`, `PUT`, `DELETE` single tree |
| `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/person-links/route.ts` | `POST` create link, `GET` list links |
| `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/person-links/[id]/sync/route.ts` | `POST` trigger sync |
| `apps/web/app/api/spaces/[spaceId]/me-claim/route.ts` | `POST` claim, `GET` current mapping |
| `apps/web/app/api/spaces/[spaceId]/me-claim/[id]/route.ts` | `PUT` approve/reject claim |
| `apps/web/app/api/spaces/[spaceId]/activity/route.ts` | `GET` activity feed (paginated) |
| `apps/web/app/(auth)/join/page.tsx` | Invite acceptance + signup page |
| `apps/web/app/(auth)/spaces/page.tsx` | Space list (dashboard) |
| `apps/web/app/(auth)/spaces/new/page.tsx` | Create space form |
| `apps/web/app/(auth)/spaces/[spaceId]/settings/page.tsx` | Space settings (members, invites, roles) |

### apps/web/components/ (UI)

| File | Responsibility |
|------|---------------|
| `apps/web/components/spaces/space-card.tsx` | Space card for dashboard list |
| `apps/web/components/spaces/create-space-form.tsx` | Create space form |
| `apps/web/components/spaces/invite-dialog.tsx` | Invite member dialog with person picker |
| `apps/web/components/spaces/member-list.tsx` | Member list with role management |
| `apps/web/components/spaces/activity-feed.tsx` | Activity feed component |
| `apps/web/components/spaces/tree-switcher.tsx` | Tree selector dropdown |
| `apps/web/components/tree/me-badge.tsx` | "(me)" badge overlay on person nodes |
| `apps/web/components/tree/me-claim-prompt.tsx` | First-visit "Which person are you?" prompt |
| `apps/web/components/tree/person-link-indicator.tsx` | Cross-tree link badge + sync status |
| `apps/web/components/tree/person-link-sync-dialog.tsx` | Per-field diff review for sync |

### tests/

| File | Responsibility |
|------|---------------|
| `packages/db/__tests__/central-schema.test.ts` | Central DB schema constraints |
| `packages/db/__tests__/space-connection.test.ts` | Connection routing + caching |
| `packages/db/__tests__/provisioning.test.ts` | Space provisioning flow |
| `apps/web/__tests__/api/spaces.test.ts` | Space CRUD API routes |
| `apps/web/__tests__/api/invitations.test.ts` | Invitation API routes |
| `apps/web/__tests__/api/me-claim.test.ts` | "(me)" claim API routes |
| `apps/web/__tests__/api/person-links.test.ts` | Cross-tree link API routes |
| `apps/web/__tests__/api/activity.test.ts` | Activity feed API routes |
| `apps/web/__tests__/api/join.test.ts` | Join/invite acceptance integration tests |
| `apps/web/__tests__/api/trees.test.ts` | Tree CRUD API routes |
| `apps/web/__tests__/lib/rbac.test.ts` | RBAC permission checks |
| `apps/web/__tests__/lib/privacy.test.ts` | Privacy filter with "(me)" override |
| `apps/web/__tests__/lib/invite-token.test.ts` | JWT invite token gen/verify |

---

## Task 1: Central Database Schema

**Files:**
- Create: `packages/db/schema/central/users.ts`
- Create: `packages/db/schema/central/spaces.ts`
- Create: `packages/db/schema/central/space-members.ts`
- Create: `packages/db/schema/central/invitations.ts`
- Create: `packages/db/schema/central/user-person-map.ts`
- Create: `packages/db/schema/central/index.ts`
- Create: `packages/db/central.ts`
- Test: `packages/db/__tests__/central-schema.test.ts`

- [ ] **Step 1: Write failing test for central schema tables**

```typescript
// packages/db/__tests__/central-schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as centralSchema from '../schema/central';

describe('Central DB Schema', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema: centralSchema });
    // Push schema to in-memory DB
    // (use drizzle-kit push or raw SQL for tests)
  });

  afterAll(() => sqlite.close());

  it('creates a user with credentials', async () => {
    const [user] = await db.insert(centralSchema.users).values({
      email: 'test@example.com',
      passwordHash: '$2b$10$hash',
      displayName: 'Test User',
    }).returning();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.authProvider).toBe('credentials');
  });

  it('rejects duplicate emails', async () => {
    await db.insert(centralSchema.users).values({
      email: 'dupe@example.com',
      displayName: 'User 1',
    });
    await expect(
      db.insert(centralSchema.users).values({
        email: 'dupe@example.com',
        displayName: 'User 2',
      })
    ).rejects.toThrow(/UNIQUE/);
  });

  it('creates a space with owner', async () => {
    const [user] = await db.insert(centralSchema.users).values({
      email: 'owner@example.com',
      displayName: 'Owner',
    }).returning();

    const [space] = await db.insert(centralSchema.spaces).values({
      name: 'Smith Family',
      ownerId: user.id,
      tursoDbUrl: 'file:test.sqlite',
      tursoDbToken: 'test-token',
    }).returning();
    expect(space.status).toBe('provisioning');
  });

  it('enforces unique space membership', async () => {
    // Create user + space, add member twice → should fail
    const [user] = await db.insert(centralSchema.users).values({
      email: 'member@example.com',
      displayName: 'Member',
    }).returning();
    const [owner] = await db.insert(centralSchema.users).values({
      email: 'owner2@example.com',
      displayName: 'Owner2',
    }).returning();
    const [space] = await db.insert(centralSchema.spaces).values({
      name: 'Test Space',
      ownerId: owner.id,
      tursoDbUrl: 'file:test2.sqlite',
      tursoDbToken: 'token2',
    }).returning();

    await db.insert(centralSchema.spaceMembers).values({
      spaceId: space.id,
      userId: user.id,
      role: 'editor',
    });
    await expect(
      db.insert(centralSchema.spaceMembers).values({
        spaceId: space.id,
        userId: user.id,
        role: 'viewer',
      })
    ).rejects.toThrow(/UNIQUE/);
  });

  it('enforces valid roles on space_members', async () => {
    const [user] = await db.insert(centralSchema.users).values({
      email: 'roletest@example.com',
      displayName: 'Role Test',
    }).returning();
    const [owner] = await db.insert(centralSchema.users).values({
      email: 'roleowner@example.com',
      displayName: 'Role Owner',
    }).returning();
    const [space] = await db.insert(centralSchema.spaces).values({
      name: 'Role Test Space',
      ownerId: owner.id,
      tursoDbUrl: 'file:roletest.sqlite',
      tursoDbToken: 'token',
    }).returning();

    // Valid role succeeds
    await db.insert(centralSchema.spaceMembers).values({
      spaceId: space.id,
      userId: user.id,
      role: 'editor',
    });

    // Invalid role fails CHECK constraint
    await expect(
      db.insert(centralSchema.spaceMembers).values({
        spaceId: space.id,
        userId: owner.id,
        role: 'superadmin' as any,
      })
    ).rejects.toThrow(/CHECK/);
  });

  it('cascades space deletion to members and invitations', async () => {
    const [owner] = await db.insert(centralSchema.users).values({
      email: 'cascade-owner@example.com',
      displayName: 'Cascade Owner',
    }).returning();
    const [space] = await db.insert(centralSchema.spaces).values({
      name: 'Cascade Space',
      ownerId: owner.id,
      tursoDbUrl: 'file:cascade.sqlite',
      tursoDbToken: 'token',
    }).returning();
    await db.insert(centralSchema.spaceMembers).values({
      spaceId: space.id,
      userId: owner.id,
      role: 'owner',
    });

    // Delete space
    await db.delete(centralSchema.spaces).where(eq(centralSchema.spaces.id, space.id));

    // Members should be gone
    const members = await db.select().from(centralSchema.spaceMembers)
      .where(eq(centralSchema.spaceMembers.spaceId, space.id));
    expect(members).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/db test -- central-schema`
Expected: FAIL — modules not found

- [ ] **Step 3: Write Drizzle schema definitions**

```typescript
// packages/db/schema/central/users.ts
import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: text('auth_provider').default('credentials'),
  authProviderId: text('auth_provider_id'),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
```

```typescript
// packages/db/schema/central/spaces.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  tursoDbUrl: text('turso_db_url').notNull(),
  tursoDbToken: text('turso_db_token').notNull(),
  status: text('status', { enum: ['active', 'provisioning', 'provisioning_failed'] }).notNull().default('provisioning'),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
```

```typescript
// packages/db/schema/central/space-members.ts
import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { spaces } from './spaces';
import { users } from './users';

export const spaceMembers = sqliteTable('space_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'editor', 'viewer'] }).notNull(),
  joinedAt: text('joined_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
  unique().on(table.spaceId, table.userId),
  index('idx_space_members_space').on(table.spaceId),
  index('idx_space_members_user').on(table.userId),
]);
```

```typescript
// packages/db/schema/central/invitations.ts
import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { spaces } from './spaces';
import { users } from './users';

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull(),
  token: text('token').notNull().unique(),
  // Logical refs to space DB — no FK enforcement
  personId: text('person_id'),
  treeId: text('tree_id'),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
}, (table) => [
  unique().on(table.spaceId, table.email),
]);
```

```typescript
// packages/db/schema/central/user-person-map.ts
import { sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { spaces } from './spaces';

export const userPersonMap = sqliteTable('user_person_map', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  spaceId: text('space_id').notNull().references(() => spaces.id, { onDelete: 'cascade' }),
  treeId: text('tree_id').notNull(),
  personId: text('person_id').notNull(),
  status: text('status', { enum: ['confirmed', 'pending_claim', 'rejected'] }).notNull().default('pending_claim'),
  confirmedBy: text('confirmed_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
  unique().on(table.userId, table.spaceId, table.treeId),
  index('idx_user_person_map_user').on(table.userId, table.spaceId),
]);
```

```typescript
// packages/db/schema/central/index.ts
export { users } from './users';
export { spaces } from './spaces';
export { spaceMembers } from './space-members';
export { invitations } from './invitations';
export { userPersonMap } from './user-person-map';
```

```typescript
// packages/db/central.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import * as schema from './schema/central';

let _centralDb: ReturnType<typeof drizzle> | ReturnType<typeof drizzleLibsql> | null = null;

/**
 * Returns a singleton central DB connection.
 * Cached across requests to avoid creating a new connection per call.
 */
export function getCentralDb() {
  if (_centralDb) return _centralDb;

  const isLocal = !process.env.TURSO_CENTRAL_DB_URL;
  if (isLocal) {
    const Database = require('better-sqlite3');
    const sqlite = new Database(process.env.LOCAL_CENTRAL_DB_PATH || 'data/central.sqlite');
    sqlite.pragma('journal_mode = WAL');
    _centralDb = drizzle(sqlite, { schema });
  } else {
    const client = createClient({
      url: process.env.TURSO_CENTRAL_DB_URL!,
      authToken: process.env.TURSO_CENTRAL_DB_TOKEN!,
    });
    _centralDb = drizzleLibsql(client, { schema });
  }
  return _centralDb;
}

/** Reset singleton — for testing only */
export function _resetCentralDb() { _centralDb = null; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ancstra/db test -- central-schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/schema/central/ packages/db/central.ts packages/db/__tests__/central-schema.test.ts
git commit -m "feat(db): add central database schema for collaborative spaces

Tables: users, spaces, space_members, invitations, user_person_map
with indexes and constraints per spec."
```

---

## Task 2: Space Database Schema Extensions

**Files:**
- Create: `packages/db/schema/space/trees.ts`
- Create: `packages/db/schema/space/person-links.ts`
- Create: `packages/db/schema/space/activity-feed.ts`
- Create: `packages/db/schema/space/index.ts`
- Test: `packages/db/__tests__/space-schema.test.ts`

- [ ] **Step 1: Write failing test for space schema tables**

```typescript
// packages/db/__tests__/space-schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as spaceSchema from '../schema/space';

describe('Space DB Schema', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema: spaceSchema });
    // Push space schema to in-memory DB
  });

  afterAll(() => sqlite.close());

  it('creates a tree', async () => {
    const [tree] = await db.insert(spaceSchema.trees).values({
      name: 'Paternal Line',
      createdBy: 'user-123',
    }).returning();
    expect(tree.name).toBe('Paternal Line');
  });

  it('creates a person link between trees', async () => {
    // Create two trees, then link persons across them
    const [tree1] = await db.insert(spaceSchema.trees).values({
      name: 'Smith',
      createdBy: 'user-123',
    }).returning();
    const [tree2] = await db.insert(spaceSchema.trees).values({
      name: 'Johnson',
      createdBy: 'user-123',
    }).returning();

    const [link] = await db.insert(spaceSchema.personLinks).values({
      sourceTreeId: tree1.id,
      sourcePersonId: 'person-abc',
      targetTreeId: tree2.id,
      targetPersonId: 'person-xyz',
      syncMode: 'manual',
    }).returning();
    expect(link.syncMode).toBe('manual');
  });

  it('enforces unique person link constraint', async () => {
    const [tree1] = await db.insert(spaceSchema.trees).values({
      name: 'UniqueTest1',
      createdBy: 'user-123',
    }).returning();
    const [tree2] = await db.insert(spaceSchema.trees).values({
      name: 'UniqueTest2',
      createdBy: 'user-123',
    }).returning();

    await db.insert(spaceSchema.personLinks).values({
      sourceTreeId: tree1.id,
      sourcePersonId: 'person-1',
      targetTreeId: tree2.id,
      targetPersonId: 'person-2',
    });

    // Same combination should fail
    await expect(
      db.insert(spaceSchema.personLinks).values({
        sourceTreeId: tree1.id,
        sourcePersonId: 'person-1',
        targetTreeId: tree2.id,
        targetPersonId: 'person-2',
      })
    ).rejects.toThrow(/UNIQUE/);
  });

  it('records activity feed entry', async () => {
    const [entry] = await db.insert(spaceSchema.activityFeed).values({
      treeId: 'tree-1',
      userId: 'user-123',
      action: 'person_created',
      entityType: 'person',
      entityId: 'person-456',
      summary: 'Mary added John Smith to Paternal Line',
    }).returning();
    expect(entry.action).toBe('person_created');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/db test -- space-schema`
Expected: FAIL

- [ ] **Step 3: Write Drizzle schema definitions**

```typescript
// packages/db/schema/space/trees.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const trees = sqliteTable('trees', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull(), // Logical ref to central.users
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
```

```typescript
// packages/db/schema/space/person-links.ts
import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { trees } from './trees';

export const personLinks = sqliteTable('person_links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceTreeId: text('source_tree_id').notNull().references(() => trees.id),
  sourcePersonId: text('source_person_id').notNull(),
  targetTreeId: text('target_tree_id').notNull().references(() => trees.id),
  targetPersonId: text('target_person_id').notNull(),
  syncMode: text('sync_mode', { enum: ['manual', 'auto'] }).default('manual'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
  unique().on(table.sourceTreeId, table.sourcePersonId, table.targetTreeId, table.targetPersonId),
]);
```

```typescript
// packages/db/schema/space/activity-feed.ts
import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { trees } from './trees';

export const activityFeed = sqliteTable('activity_feed', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  treeId: text('tree_id').references(() => trees.id),
  userId: text('user_id').notNull(), // Logical ref to central.users
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  summary: text('summary').notNull(),
  metadata: text('metadata'), // JSON
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (table) => [
  index('idx_activity_feed_date').on(table.createdAt),
  index('idx_activity_feed_tree').on(table.treeId),
  index('idx_activity_feed_user').on(table.userId),
]);
```

```typescript
// packages/db/schema/space/index.ts
export { trees } from './trees';
export { personLinks } from './person-links';
export { activityFeed } from './activity-feed';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ancstra/db test -- space-schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/schema/space/ packages/db/__tests__/space-schema.test.ts
git commit -m "feat(db): add space database schema extensions

Tables: trees, person_links, activity_feed with indexes."
```

---

## Task 3: Space DB Connection Routing

**Files:**
- Create: `packages/db/space-connection.ts`
- Create: `packages/db/provisioning.ts`
- Test: `packages/db/__tests__/space-connection.test.ts`
- Test: `packages/db/__tests__/provisioning.test.ts`

- [ ] **Step 1: Write failing test for connection routing**

```typescript
// packages/db/__tests__/space-connection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceConnectionManager } from '../space-connection';

describe('SpaceConnectionManager', () => {
  let manager: SpaceConnectionManager;

  beforeEach(() => {
    manager = new SpaceConnectionManager({ cacheTtlMs: 1000 });
  });

  it('creates a connection for a space', async () => {
    const db = await manager.getSpaceDb('space-1', {
      tursoDbUrl: 'file::memory:',
      tursoDbToken: '',
    });
    expect(db).toBeDefined();
  });

  it('returns cached connection on second call', async () => {
    const config = { tursoDbUrl: 'file::memory:', tursoDbToken: '' };
    const db1 = await manager.getSpaceDb('space-1', config);
    const db2 = await manager.getSpaceDb('space-1', config);
    expect(db1).toBe(db2);
  });

  it('evicts stale connections after TTL', async () => {
    const config = { tursoDbUrl: 'file::memory:', tursoDbToken: '' };
    await manager.getSpaceDb('space-1', config);
    vi.advanceTimersByTime(2000);
    manager.evictStale();
    // Next call creates a new connection (different reference)
  });

  it('creates different connections for different space IDs', async () => {
    const db1 = await manager.getSpaceDb('space-1', {
      tursoDbUrl: 'file::memory:',
      tursoDbToken: '',
    });
    const db2 = await manager.getSpaceDb('space-2', {
      tursoDbUrl: 'file::memory:',
      tursoDbToken: '',
    });
    expect(db1).not.toBe(db2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/db test -- space-connection`
Expected: FAIL

- [ ] **Step 3: Write SpaceConnectionManager**

```typescript
// packages/db/space-connection.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import * as spaceSchema from './schema/space';

interface SpaceDbConfig {
  tursoDbUrl: string;
  tursoDbToken: string;
}

interface CachedConnection {
  db: ReturnType<typeof drizzleLibsql>;
  lastAccess: number;
}

export class SpaceConnectionManager {
  private cache = new Map<string, CachedConnection>();
  private cacheTtlMs: number;

  constructor(opts: { cacheTtlMs?: number } = {}) {
    this.cacheTtlMs = opts.cacheTtlMs ?? 5 * 60 * 1000;
  }

  async getSpaceDb(spaceId: string, config: SpaceDbConfig) {
    const key = spaceId;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.lastAccess < this.cacheTtlMs) {
      cached.lastAccess = Date.now();
      return cached.db;
    }

    const isLocal = config.tursoDbUrl.startsWith('file:');
    let db;

    if (isLocal) {
      const Database = require('better-sqlite3');
      const sqlite = new Database(config.tursoDbUrl.replace('file:', ''));
      sqlite.pragma('journal_mode = WAL');
      db = drizzle(sqlite, { schema: spaceSchema });
    } else {
      const client = createClient({
        url: config.tursoDbUrl,
        authToken: config.tursoDbToken,
      });
      db = drizzleLibsql(client, { schema: spaceSchema });
    }

    this.cache.set(key, { db, lastAccess: Date.now() });
    return db;
  }

  evictStale() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.lastAccess > this.cacheTtlMs) {
        this.cache.delete(key);
      }
    }
  }
}

export const spaceConnections = new SpaceConnectionManager();
```

- [ ] **Step 4: Write failing test for provisioning**

```typescript
// packages/db/__tests__/provisioning.test.ts
import { describe, it, expect } from 'vitest';
import { provisionLocalSpaceDatabase } from '../provisioning';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Local Space Provisioning', () => {
  it('creates a SQLite file with schema', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancstra-test-'));
    const result = await provisionLocalSpaceDatabase('test-space', tmpDir);
    expect(fs.existsSync(result.dbPath)).toBe(true);
    // Verify trees table exists
  });

  it('creates default tree on provision', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancstra-test-'));
    const result = await provisionLocalSpaceDatabase('test-space', tmpDir);
    // Query trees table — should have one default tree
  });
});
```

- [ ] **Step 5: Write provisioning module**

```typescript
// packages/db/provisioning.ts
import Database from 'better-sqlite3';
import path from 'path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import * as spaceSchema from './schema/space';

// --- Local provisioning ---

export async function provisionLocalSpaceDatabase(
  spaceId: string,
  dataDir: string,
  userId: string = 'system'
): Promise<{ dbPath: string; tursoDbUrl: string }> {
  const dbPath = path.join(dataDir, `space-${spaceId}.sqlite`);
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  // Create all space tables via Drizzle push or raw SQL
  const db = drizzle(sqlite, { schema: spaceSchema });

  // Create default tree
  await db.insert(spaceSchema.trees).values({
    id: 'default',
    name: 'My Family Tree',
    createdBy: userId,
  });

  sqlite.close();
  return { dbPath, tursoDbUrl: `file:${dbPath}` };
}

// --- Turso provisioning ---

interface TursoPlatformConfig {
  apiToken: string;   // TURSO_PLATFORM_TOKEN
  orgName: string;    // TURSO_ORG_NAME
}

export async function provisionTursoSpaceDatabase(
  spaceId: string,
  userId: string,
  config: TursoPlatformConfig,
): Promise<{ url: string; token: string }> {
  const dbName = `ancstra-space-${spaceId}`;

  // 1. Create database via Turso Platform API
  const createRes = await fetch(
    `https://api.turso.tech/v1/organizations/${config.orgName}/databases`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: dbName, group: 'default' }),
    },
  );
  if (!createRes.ok) {
    throw new Error(`Turso DB creation failed: ${createRes.status} ${await createRes.text()}`);
  }
  const { database } = await createRes.json();
  const url = `libsql://${database.Hostname}`;

  // 2. Create auth token for the new database
  const tokenRes = await fetch(
    `https://api.turso.tech/v1/organizations/${config.orgName}/databases/${dbName}/auth/tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiration: 'none', authorization: 'full-access' }),
    },
  );
  if (!tokenRes.ok) {
    throw new Error(`Turso token creation failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { jwt: token } = await tokenRes.json();

  // 3. Run schema migrations on the new database
  const client = createClient({ url, authToken: token });
  const db = drizzleLibsql(client, { schema: spaceSchema });

  // Create default tree
  await db.insert(spaceSchema.trees).values({
    id: 'default',
    name: 'My Family Tree',
    createdBy: userId,
  });

  return { url, token };
}

// --- Unified provisioning entry point ---

export async function provisionSpaceDatabase(
  spaceId: string,
  userId: string,
): Promise<{ tursoDbUrl: string; tursoDbToken: string }> {
  const isLocal = !process.env.TURSO_PLATFORM_TOKEN;

  if (isLocal) {
    const dataDir = process.env.LOCAL_SPACE_DB_DIR || 'data';
    const { tursoDbUrl } = await provisionLocalSpaceDatabase(spaceId, dataDir, userId);
    return { tursoDbUrl, tursoDbToken: '' };
  }

  const config: TursoPlatformConfig = {
    apiToken: process.env.TURSO_PLATFORM_TOKEN!,
    orgName: process.env.TURSO_ORG_NAME!,
  };
  const { url, token } = await provisionTursoSpaceDatabase(spaceId, userId, config);
  return { tursoDbUrl: url, tursoDbToken: token };
}
```

- [ ] **Step 6: Run all tests**

Run: `pnpm --filter @ancstra/db test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/db/space-connection.ts packages/db/provisioning.ts packages/db/__tests__/space-connection.test.ts packages/db/__tests__/provisioning.test.ts
git commit -m "feat(db): add space connection routing and provisioning

SpaceConnectionManager with TTL cache. Local provisioning creates
SQLite files with schema and default tree."
```

---

## Task 4: RBAC Permission Layer

**Files:**
- Create: `apps/web/lib/auth/rbac.ts`
- Create: `apps/web/lib/auth/privacy.ts`
- Test: `apps/web/__tests__/lib/rbac.test.ts`
- Test: `apps/web/__tests__/lib/privacy.test.ts`

- [ ] **Step 1: Write failing tests for RBAC**

```typescript
// apps/web/__tests__/lib/rbac.test.ts
import { describe, it, expect } from 'vitest';
import { canDo, Permission } from '../../lib/auth/rbac';

describe('RBAC', () => {
  it('owner can do everything', () => {
    expect(canDo('owner', 'create_space')).toBe(true);
    expect(canDo('owner', 'delete_tree')).toBe(true);
    expect(canDo('owner', 'edit_person')).toBe(true);
    expect(canDo('owner', 'invite_member')).toBe(true);
  });

  it('admin cannot create/delete spaces', () => {
    expect(canDo('admin', 'create_space')).toBe(false);
    expect(canDo('admin', 'delete_space')).toBe(false);
    expect(canDo('admin', 'edit_person')).toBe(true);
    expect(canDo('admin', 'invite_member')).toBe(true);
  });

  it('editor can edit and export but not manage', () => {
    expect(canDo('editor', 'edit_person')).toBe(true);
    expect(canDo('editor', 'export_gedcom')).toBe(true);
    expect(canDo('editor', 'invite_member')).toBe(false);
    expect(canDo('editor', 'create_tree')).toBe(false);
    expect(canDo('editor', 'approve_claim')).toBe(false);
  });

  it('viewer can only view and see activity', () => {
    expect(canDo('viewer', 'view_tree')).toBe(true);
    expect(canDo('viewer', 'view_activity')).toBe(true);
    expect(canDo('viewer', 'edit_person')).toBe(false);
    expect(canDo('viewer', 'export_gedcom')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/web test -- rbac`
Expected: FAIL

- [ ] **Step 3: Implement RBAC module**

```typescript
// apps/web/lib/auth/rbac.ts
export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export type Permission =
  | 'create_space' | 'delete_space'
  | 'create_tree' | 'delete_tree'
  | 'edit_person' | 'view_tree'
  | 'invite_member' | 'manage_roles'
  | 'approve_claim'
  | 'import_gedcom' | 'export_gedcom'
  | 'view_activity'
  | 'manage_person_links';

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set([
    'create_space', 'delete_space', 'create_tree', 'delete_tree',
    'edit_person', 'view_tree', 'invite_member', 'manage_roles',
    'approve_claim', 'import_gedcom', 'export_gedcom', 'view_activity',
    'manage_person_links',
  ]),
  admin: new Set([
    'create_tree', 'delete_tree', 'edit_person', 'view_tree',
    'invite_member', 'manage_roles', 'approve_claim',
    'import_gedcom', 'export_gedcom', 'view_activity', 'manage_person_links',
  ]),
  editor: new Set([
    'edit_person', 'view_tree', 'export_gedcom', 'view_activity',
    'manage_person_links',
  ]),
  viewer: new Set([
    'view_tree', 'view_activity',
  ]),
};

export function canDo(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function requireRole(...roles: Role[]) {
  return (userRole: Role) => {
    if (!roles.includes(userRole)) {
      throw new Error(`Insufficient permissions. Required: ${roles.join('|')}, got: ${userRole}`);
    }
  };
}
```

- [ ] **Step 4: Write failing tests for privacy filter**

```typescript
// apps/web/__tests__/lib/privacy.test.ts
import { describe, it, expect } from 'vitest';
import { filterForPrivacy } from '../../lib/auth/privacy';

const makePerson = (id: string, birthYear: number, hasDeath = false) => ({
  id,
  given_name: `Person ${id}`,
  surname: 'Test',
  notes: 'some notes',
  is_living: !hasDeath,
  birthDateSort: birthYear * 10000 + 101,
  deathDateSort: hasDeath ? 20200101 : 0,
});

describe('filterForPrivacy', () => {
  const livingPerson = makePerson('living-1', 1990);
  const deceasedPerson = makePerson('deceased-1', 1900, true);
  const persons = [livingPerson, deceasedPerson];

  it('owner sees all persons unredacted', () => {
    const result = filterForPrivacy(persons, 'owner', 'user-1', {});
    expect(result[0].given_name).toBe('Person living-1');
  });

  it('editor sees all persons unredacted', () => {
    const result = filterForPrivacy(persons, 'editor', 'user-1', {});
    expect(result[0].given_name).toBe('Person living-1');
  });

  it('viewer sees living persons redacted', () => {
    const result = filterForPrivacy(persons, 'viewer', 'user-1', {});
    expect(result[0].given_name).toBe('Living');
    expect(result[0].surname).toBe('');
    expect(result[0].notes).toBeNull();
    // Deceased person is visible
    expect(result[1].given_name).toBe('Person deceased-1');
  });

  it('viewer sees own "(me)" node unredacted when confirmed', () => {
    const meMap = {
      'user-1': { personId: 'living-1', status: 'confirmed' as const },
    };
    const result = filterForPrivacy(persons, 'viewer', 'user-1', meMap);
    expect(result[0].given_name).toBe('Person living-1');
  });

  it('viewer does NOT see own node unredacted when pending_claim', () => {
    const meMap = {
      'user-1': { personId: 'living-1', status: 'pending_claim' as const },
    };
    const result = filterForPrivacy(persons, 'viewer', 'user-1', meMap);
    expect(result[0].given_name).toBe('Living');
  });
});
```

- [ ] **Step 5: Implement privacy filter**

```typescript
// apps/web/lib/auth/privacy.ts
import { type Role } from './rbac';

interface PersonForPrivacy {
  id: string;
  given_name: string;
  surname: string;
  notes: string | null;
  is_living: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
}

interface MeMapping {
  personId: string;
  status: 'confirmed' | 'pending_claim' | 'rejected';
}

const LIVING_THRESHOLD_YEARS = 100;

function isPresumablyLiving(person: PersonForPrivacy): boolean {
  if (!person.is_living) return false;
  if (person.deathDateSort && person.deathDateSort > 0) return false;
  if (!person.birthDateSort || person.birthDateSort === 0) return true;
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birthDateSort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
}

export function filterForPrivacy<T extends PersonForPrivacy>(
  persons: T[],
  viewerRole: Role,
  userId: string,
  userPersonMap: Record<string, MeMapping>,
): T[] {
  if (viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'editor') {
    return persons;
  }

  return persons.map(p => {
    const mapping = userPersonMap[userId];
    if (mapping?.personId === p.id && mapping?.status === 'confirmed') {
      return p;
    }
    if (isPresumablyLiving(p)) {
      return { ...p, given_name: 'Living', surname: '', notes: null };
    }
    return p;
  });
}
```

- [ ] **Step 6: Run all tests**

Run: `pnpm --filter @ancstra/web test -- rbac privacy`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth/rbac.ts apps/web/lib/auth/privacy.ts apps/web/__tests__/lib/rbac.test.ts apps/web/__tests__/lib/privacy.test.ts
git commit -m "feat(auth): add RBAC permission layer and privacy filter

Permission matrix for owner/admin/editor/viewer.
Privacy filter with '(me)' override for confirmed mappings only."
```

---

## Task 5: Invite Token System

**Files:**
- Create: `apps/web/lib/auth/invite-token.ts`
- Test: `apps/web/__tests__/lib/invite-token.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/__tests__/lib/invite-token.test.ts
import { describe, it, expect } from 'vitest';
import { generateInviteToken, verifyInviteToken } from '../../lib/auth/invite-token';

describe('Invite Tokens', () => {
  const secret = 'test-secret-at-least-32-characters-long!!';

  it('generates and verifies a valid token', async () => {
    const payload = {
      invitationId: 'inv-123',
      spaceId: 'space-456',
      email: 'test@example.com',
      role: 'editor' as const,
      createdBy: 'user-789',
    };
    const token = await generateInviteToken(payload, secret);
    expect(typeof token).toBe('string');

    const verified = await verifyInviteToken(token, secret);
    expect(verified.spaceId).toBe('space-456');
    expect(verified.email).toBe('test@example.com');
    expect(verified.role).toBe('editor');
  });

  it('rejects expired tokens', async () => {
    const payload = {
      invitationId: 'inv-123',
      spaceId: 'space-456',
      email: 'test@example.com',
      role: 'viewer' as const,
      createdBy: 'user-789',
      expiresInDays: 0, // Expire immediately
    };
    const token = await generateInviteToken(payload, secret);
    await expect(verifyInviteToken(token, secret)).rejects.toThrow(/expired/i);
  });

  it('rejects tampered tokens', async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.tampered.invalid';
    await expect(verifyInviteToken(token, secret)).rejects.toThrow();
  });

  it('includes optional personId and treeId', async () => {
    const payload = {
      invitationId: 'inv-123',
      spaceId: 'space-456',
      email: 'test@example.com',
      role: 'editor' as const,
      createdBy: 'user-789',
      personId: 'person-abc',
      treeId: 'tree-def',
    };
    const token = await generateInviteToken(payload, secret);
    const verified = await verifyInviteToken(token, secret);
    expect(verified.personId).toBe('person-abc');
    expect(verified.treeId).toBe('tree-def');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ancstra/web test -- invite-token`
Expected: FAIL

- [ ] **Step 3: Implement invite token module**

```typescript
// apps/web/lib/auth/invite-token.ts
import { SignJWT, jwtVerify } from 'jose';

export interface InviteTokenPayload {
  invitationId: string;
  spaceId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdBy: string;
  personId?: string;
  treeId?: string;
  expiresInDays?: number;
}

export interface VerifiedInvite {
  invitationId: string;
  spaceId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdBy: string;
  personId?: string;
  treeId?: string;
}

export async function generateInviteToken(
  payload: InviteTokenPayload,
  secret: string,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const expiresInDays = payload.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  return new SignJWT({
    invitationId: payload.invitationId,
    spaceId: payload.spaceId,
    email: payload.email,
    role: payload.role,
    createdBy: payload.createdBy,
    ...(payload.personId && { personId: payload.personId }),
    ...(payload.treeId && { treeId: payload.treeId }),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(secretKey);
}

export async function verifyInviteToken(
  token: string,
  secret: string,
): Promise<VerifiedInvite> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey);

  return {
    invitationId: payload.invitationId as string,
    spaceId: payload.spaceId as string,
    email: payload.email as string,
    role: payload.role as 'admin' | 'editor' | 'viewer',
    createdBy: payload.createdBy as string,
    personId: payload.personId as string | undefined,
    treeId: payload.treeId as string | undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ancstra/web test -- invite-token`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/invite-token.ts apps/web/__tests__/lib/invite-token.test.ts
git commit -m "feat(auth): add JWT invite token generation and verification

7-day expiry, HS256 signed, supports optional person pre-assignment."
```

---

## Task 6: Space CRUD API Routes

**Files:**
- Create: `apps/web/lib/auth/space-context.ts`
- Create: `apps/web/app/api/spaces/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/route.ts`
- Create: `packages/db/queries/spaces.ts`
- Test: `apps/web/__tests__/api/spaces.test.ts`

- [ ] **Step 1: Write failing tests for space API**

```typescript
// apps/web/__tests__/api/spaces.test.ts
import { describe, it, expect } from 'vitest';
// Test space CRUD:
// POST /api/spaces → creates space + provisions DB + adds owner as member
// GET /api/spaces → lists user's spaces
// GET /api/spaces/:id → single space with member count
// PUT /api/spaces/:id → update name/description (owner only)
// DELETE /api/spaces/:id → delete space (owner only)
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement space-context middleware**

```typescript
// apps/web/lib/auth/space-context.ts
import { auth } from '@/auth';
import { getCentralDb } from '@ancstra/db/central';
import { spaceConnections } from '@ancstra/db/space-connection';
import { spaceMembers, spaces } from '@ancstra/db/schema/central';
import { eq, and } from 'drizzle-orm';

export interface SpaceContext {
  userId: string;
  spaceId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  spaceDb: Awaited<ReturnType<typeof spaceConnections.getSpaceDb>>;
}

export async function resolveSpaceContext(spaceId: string): Promise<SpaceContext> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const centralDb = getCentralDb();

  const membership = await centralDb
    .select()
    .from(spaceMembers)
    .where(and(
      eq(spaceMembers.spaceId, spaceId),
      eq(spaceMembers.userId, session.user.id),
    ))
    .get();

  if (!membership) throw new Error('Forbidden');

  const space = await centralDb
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .get();

  if (!space || space.status !== 'active') throw new Error('Space not available');

  const spaceDb = await spaceConnections.getSpaceDb({
    tursoDbUrl: space.tursoDbUrl,
    tursoDbToken: space.tursoDbToken,
  });

  return {
    userId: session.user.id,
    spaceId,
    role: membership.role as SpaceContext['role'],
    spaceDb,
  };
}
```

- [ ] **Step 4: Implement space query builders**

```typescript
// packages/db/queries/spaces.ts
import { eq } from 'drizzle-orm';
import { spaces, spaceMembers } from '../schema/central';

export function findUserSpaces(db: any, userId: string) {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      status: spaces.status,
      role: spaceMembers.role,
      joinedAt: spaceMembers.joinedAt,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(eq(spaceMembers.userId, userId));
}

export function findSpaceById(db: any, spaceId: string) {
  return db.select().from(spaces).where(eq(spaces.id, spaceId)).get();
}
```

- [ ] **Step 5: Implement API routes**

```typescript
// apps/web/app/api/spaces/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCentralDb } from '@ancstra/db/central';
import { spaces, spaceMembers } from '@ancstra/db/schema/central';
import { findUserSpaces } from '@ancstra/db/queries/spaces';
import { provisionSpaceDatabase } from '@ancstra/db/provisioning';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

const createSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// POST /api/spaces — create a new space
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSpaceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const centralDb = getCentralDb();
  const spaceId = crypto.randomUUID();

  // 1. Create space record (status: provisioning)
  const [space] = await centralDb.insert(spaces).values({
    id: spaceId,
    name: parsed.data.name,
    description: parsed.data.description,
    ownerId: session.user.id,
    tursoDbUrl: '',   // Placeholder until provisioned
    tursoDbToken: '',
    status: 'provisioning',
  }).returning();

  try {
    // 2. Provision space database
    const { tursoDbUrl, tursoDbToken } = await provisionSpaceDatabase(spaceId, session.user.id);

    // 3. Update space with DB credentials and mark active
    await centralDb.update(spaces)
      .set({ tursoDbUrl, tursoDbToken, status: 'active' })
      .where(eq(spaces.id, spaceId));

    // 4. Add creator as owner in space_members
    await centralDb.insert(spaceMembers).values({
      spaceId,
      userId: session.user.id,
      role: 'owner',
    });

    return NextResponse.json({ ...space, status: 'active' }, { status: 201 });
  } catch (err) {
    // Mark provisioning as failed
    await centralDb.update(spaces)
      .set({ status: 'provisioning_failed' })
      .where(eq(spaces.id, spaceId));
    return NextResponse.json({ error: 'Space provisioning failed' }, { status: 500 });
  }
}

// GET /api/spaces — list user's spaces
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const centralDb = getCentralDb();
  const userSpaces = await findUserSpaces(centralDb, session.user.id);
  return NextResponse.json(userSpaces);
}
```

```typescript
// apps/web/app/api/spaces/[spaceId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveSpaceContext } from '@/lib/auth/space-context';
import { getCentralDb } from '@ancstra/db/central';
import { spaces } from '@ancstra/db/schema/central';
import { canDo } from '@/lib/auth/rbac';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/spaces/:id
export async function GET(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  const centralDb = getCentralDb();
  const space = await centralDb.select().from(spaces).where(eq(spaces.id, params.spaceId)).get();
  return NextResponse.json(space);
}

// PUT /api/spaces/:id — update name/description (owner/admin)
export async function PUT(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  if (!canDo(ctx.role, 'create_space')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const centralDb = getCentralDb();
  const [updated] = await centralDb.update(spaces)
    .set({ name: body.name, description: body.description })
    .where(eq(spaces.id, params.spaceId))
    .returning();
  return NextResponse.json(updated);
}

// DELETE /api/spaces/:id — owner only
export async function DELETE(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only owner can delete spaces' }, { status: 403 });
  }
  const centralDb = getCentralDb();
  await centralDb.delete(spaces).where(eq(spaces.id, params.spaceId));
  // Note: Turso DB deletion via Platform API would happen here too
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @ancstra/web test -- spaces`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth/space-context.ts apps/web/app/api/spaces/ packages/db/queries/spaces.ts apps/web/__tests__/api/spaces.test.ts
git commit -m "feat(api): add space CRUD routes with provisioning

POST/GET /api/spaces, GET/PUT/DELETE /api/spaces/:id.
Space context middleware resolves DB connection per request."
```

---

## Task 7: Tree CRUD API Routes

**Files:**
- Create: `apps/web/app/api/spaces/[spaceId]/trees/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/route.ts`
- Create: `packages/db/queries/trees.ts`
- Test: `apps/web/__tests__/api/trees.test.ts`

- [ ] **Step 1: Write failing tests for tree API**

```typescript
// apps/web/__tests__/api/trees.test.ts
import { describe, it, expect } from 'vitest';

describe('Tree API', () => {
  it('POST /api/spaces/:id/trees creates a tree (admin+)', async () => {
    // Setup: authenticated admin user, active space
    // POST with { name: 'Maternal Line', description: 'Mom side' }
    // Expect: 201, tree object with id, name
  });

  it('POST /api/spaces/:id/trees rejects editor', async () => {
    // Setup: authenticated editor user
    // Expect: 403
  });

  it('GET /api/spaces/:id/trees lists all trees', async () => {
    // Setup: space with 2 trees (default + created)
    // Expect: array of 2 trees
  });

  it('PUT /api/spaces/:id/trees/:treeId updates tree name', async () => {
    // Setup: admin, existing tree
    // Expect: 200, updated name
  });

  it('DELETE /api/spaces/:id/trees/:treeId deletes tree (admin+)', async () => {
    // Setup: admin, non-default tree
    // Expect: 200
    // Verify: tree gone, persons in tree gone (cascade)
  });

  it('DELETE refuses to delete the default tree', async () => {
    // The default tree cannot be deleted
    // Expect: 400, error message
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement tree query builders**

```typescript
// packages/db/queries/trees.ts
import { eq } from 'drizzle-orm';
import { trees } from '../schema/space';

export function findTreesInSpace(spaceDb: any) {
  return spaceDb.select().from(trees);
}

export function findTreeById(spaceDb: any, treeId: string) {
  return spaceDb.select().from(trees).where(eq(trees.id, treeId)).get();
}
```

- [ ] **Step 4: Implement tree routes**

```typescript
// apps/web/app/api/spaces/[spaceId]/trees/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveSpaceContext } from '@/lib/auth/space-context';
import { canDo } from '@/lib/auth/rbac';
import { trees } from '@ancstra/db/schema/space';
import { logActivity } from '@ancstra/db/queries/activity-feed';
import { z } from 'zod';

const createTreeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  if (!canDo(ctx.role, 'create_tree')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTreeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [tree] = await ctx.spaceDb.insert(trees).values({
    name: parsed.data.name,
    description: parsed.data.description,
    createdBy: ctx.userId,
  }).returning();

  await logActivity(ctx.spaceDb, {
    treeId: tree.id,
    userId: ctx.userId,
    action: 'tree_created',
    entityType: 'tree',
    entityId: tree.id,
    summary: `Created tree "${tree.name}"`,
  });

  return NextResponse.json(tree, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: { spaceId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  const allTrees = await ctx.spaceDb.select().from(trees);
  return NextResponse.json(allTrees);
}
```

```typescript
// apps/web/app/api/spaces/[spaceId]/trees/[treeId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveSpaceContext } from '@/lib/auth/space-context';
import { canDo } from '@/lib/auth/rbac';
import { trees } from '@ancstra/db/schema/space';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: { spaceId: string; treeId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  const tree = await ctx.spaceDb.select().from(trees).where(eq(trees.id, params.treeId)).get();
  if (!tree) return NextResponse.json({ error: 'Tree not found' }, { status: 404 });
  return NextResponse.json(tree);
}

export async function PUT(req: NextRequest, { params }: { params: { spaceId: string; treeId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  if (!canDo(ctx.role, 'create_tree')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const [updated] = await ctx.spaceDb.update(trees)
    .set({ name: body.name, description: body.description })
    .where(eq(trees.id, params.treeId))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { spaceId: string; treeId: string } }) {
  const ctx = await resolveSpaceContext(params.spaceId);
  if (!canDo(ctx.role, 'delete_tree')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (params.treeId === 'default') {
    return NextResponse.json({ error: 'Cannot delete the default tree' }, { status: 400 });
  }
  await ctx.spaceDb.delete(trees).where(eq(trees.id, params.treeId));
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ancstra/web test -- trees`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/spaces/*/trees/ packages/db/queries/trees.ts apps/web/__tests__/api/trees.test.ts
git commit -m "feat(api): add tree CRUD routes

POST/GET /api/spaces/:id/trees, GET/PUT/DELETE /api/spaces/:id/trees/:treeId.
Default tree cannot be deleted. Activity logged on creation."
```

---

## Task 8: Member Management & Invitation API

**Files:**
- Create: `apps/web/app/api/spaces/[spaceId]/members/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/invitations/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/invitations/[id]/route.ts`
- Create: `packages/db/queries/invitations.ts`
- Test: `apps/web/__tests__/api/invitations.test.ts`

- [ ] **Step 1: Write failing tests for invitation flow**

```typescript
// apps/web/__tests__/api/invitations.test.ts
// Test:
// POST /api/spaces/:id/invitations → creates invite + token
// GET /api/spaces/:id/invitations → lists pending invites (admin+)
// DELETE /api/spaces/:id/invitations/:id → revoke invite
// GET /api/spaces/:id/members → lists members with roles
// PUT /api/spaces/:id/members → update member role (admin+)
// DELETE /api/spaces/:id/members → remove member (admin+)
// Edge cases: duplicate email, expired invite, already accepted
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement invitation query builders**

```typescript
// packages/db/queries/invitations.ts
import { eq, and, isNull } from 'drizzle-orm';
import { invitations } from '../schema/central';

export function findPendingInvites(db: any, spaceId: string) {
  return db.select().from(invitations)
    .where(and(
      eq(invitations.spaceId, spaceId),
      isNull(invitations.acceptedAt),
    ));
}

export function findInviteByToken(db: any, token: string) {
  return db.select().from(invitations)
    .where(eq(invitations.token, token))
    .get();
}
```

- [ ] **Step 4: Implement member and invitation routes**

Implement the API routes following the patterns in Task 6. Each route:
1. Resolves space context via `resolveSpaceContext()`
2. Checks RBAC via `canDo(ctx.role, permission)`
3. Performs DB operation
4. Returns JSON response

The invitation POST route generates a JWT token via `generateInviteToken()` and stores the record in the central DB.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @ancstra/web test -- invitations`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/spaces/*/members/ apps/web/app/api/spaces/*/invitations/ packages/db/queries/invitations.ts apps/web/__tests__/api/invitations.test.ts
git commit -m "feat(api): add member management and invitation routes

Invite flow with JWT tokens, 7-day expiry.
Member CRUD with role management for admin+."
```

---

## Task 9: Join Page (Invite Acceptance)

**Files:**
- Create: `apps/web/app/(auth)/join/page.tsx`
- Modify: NextAuth config to handle invite flow

- [ ] **Step 1: Implement join page**

The join page at `/join?token=...`:

1. Verifies the invite token
2. Shows space name, inviter, assigned role
3. If user is already logged in: "Join Space" button
4. If not: signup form (email/password) + OAuth buttons
5. On submit: creates account (if needed) → creates `space_members` entry → creates `user_person_map` if person was pre-assigned → redirects to space

```typescript
// apps/web/app/(auth)/join/page.tsx
// Server component that verifies token and renders join UI
// Uses server actions for the actual join logic
```

- [ ] **Step 2: Write server action for join**

```typescript
// apps/web/app/(auth)/join/actions.ts
'use server';

export async function acceptInvite(token: string, userId: string) {
  const centralDb = getCentralDb();
  const verified = await verifyInviteToken(token, process.env.NEXTAUTH_SECRET!);

  // 1. Check invite exists and not yet accepted
  const invite = await findInviteByToken(centralDb, token);
  if (!invite || invite.acceptedAt) throw new Error('Invalid or already used invite');

  // 2. Check not expired
  if (new Date(invite.expiresAt) < new Date()) throw new Error('Invite expired');

  // 3. Create space membership
  await centralDb.insert(spaceMembers).values({
    spaceId: verified.spaceId,
    userId,
    role: verified.role,
  });

  // 4. If person pre-assigned, create confirmed mapping
  if (verified.personId && verified.treeId) {
    await centralDb.insert(userPersonMap).values({
      userId,
      spaceId: verified.spaceId,
      treeId: verified.treeId,
      personId: verified.personId,
      status: 'confirmed',
      confirmedBy: verified.createdBy,
    });
  }

  // 5. Mark invite as accepted
  await centralDb.update(invitations)
    .set({ acceptedAt: new Date().toISOString() })
    .where(eq(invitations.id, invite.id));

  // 6. Log activity
  // ...

  return { spaceId: verified.spaceId };
}
```

- [ ] **Step 3: Write integration tests for acceptInvite**

```typescript
// apps/web/__tests__/api/join.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { acceptInvite } from '../../app/(auth)/join/actions';

describe('acceptInvite server action', () => {
  it('creates membership and marks invite accepted', async () => {
    // Setup: create user, space, invitation in central DB
    // Call acceptInvite(token, userId)
    // Assert: space_members has entry with correct role
    // Assert: invitations.accepted_at is set
  });

  it('rejects expired invite token', async () => {
    // Setup: invitation with expiresAt in the past
    // Expect: throws 'Invite expired'
  });

  it('rejects already-accepted invite', async () => {
    // Setup: invitation with acceptedAt already set
    // Expect: throws 'Invalid or already used invite'
  });

  it('creates confirmed user_person_map when person pre-assigned', async () => {
    // Setup: invitation with personId and treeId
    // Call acceptInvite
    // Assert: user_person_map entry with status 'confirmed'
  });

  it('works without person pre-assignment', async () => {
    // Setup: invitation without personId
    // Call acceptInvite
    // Assert: no user_person_map entry created
    // Assert: membership still created
  });
});
```

- [ ] **Step 4: Run join tests**

Run: `pnpm --filter @ancstra/web test -- join`
Expected: PASS

- [ ] **Step 5: Test join flow manually**

Run: `pnpm dev`
1. Create a space (as owner)
2. Create an invitation
3. Open the invite link in an incognito window
4. Sign up and join
5. Verify membership appears in the space

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(auth\)/join/
git commit -m "feat(ui): add invite join page with account creation

Token verification, OAuth + credentials signup, auto-join on accept.
Pre-assigned person mapping created as confirmed."
```

---

## Task 10: "(me)" Claim API & UI

**Files:**
- Create: `apps/web/app/api/spaces/[spaceId]/me-claim/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/me-claim/[id]/route.ts`
- Create: `packages/db/queries/user-person-map.ts`
- Create: `apps/web/components/tree/me-badge.tsx`
- Create: `apps/web/components/tree/me-claim-prompt.tsx`
- Test: `apps/web/__tests__/api/me-claim.test.ts`

- [ ] **Step 1: Write failing tests for claim API**

```typescript
// apps/web/__tests__/api/me-claim.test.ts
// Test:
// POST /api/spaces/:id/me-claim → create pending claim
// GET /api/spaces/:id/me-claim → get current user's mapping
// PUT /api/spaces/:id/me-claim/:id → approve/reject (admin+)
// Edge cases: already claimed, pending claim, rejected then retry
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement claim query builders**

```typescript
// packages/db/queries/user-person-map.ts
import { eq, and } from 'drizzle-orm';
import { userPersonMap } from '../schema/central';

export function findUserMapping(db: any, userId: string, spaceId: string, treeId: string) {
  return db.select().from(userPersonMap)
    .where(and(
      eq(userPersonMap.userId, userId),
      eq(userPersonMap.spaceId, spaceId),
      eq(userPersonMap.treeId, treeId),
    ))
    .get();
}

export function findPendingClaims(db: any, spaceId: string) {
  return db.select().from(userPersonMap)
    .where(and(
      eq(userPersonMap.spaceId, spaceId),
      eq(userPersonMap.status, 'pending_claim'),
    ));
}
```

- [ ] **Step 4: Implement claim API routes**

POST creates a `pending_claim` entry. PUT (admin+) updates status to `confirmed` or `rejected`.

- [ ] **Step 5: Implement "(me)" badge component**

```tsx
// apps/web/components/tree/me-badge.tsx
interface MeBadgeProps {
  isMe: boolean;
}

export function MeBadge({ isMe }: MeBadgeProps) {
  if (!isMe) return null;
  return (
    <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
      (me)
    </span>
  );
}
```

- [ ] **Step 6: Implement claim prompt component**

```tsx
// apps/web/components/tree/me-claim-prompt.tsx
// Shows "Which person are you?" dialog
// Person search input + results list
// Click to claim → POST /api/spaces/:id/me-claim
// Skip button to dismiss
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @ancstra/web test -- me-claim`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/api/spaces/*/me-claim/ packages/db/queries/user-person-map.ts apps/web/components/tree/me-badge.tsx apps/web/components/tree/me-claim-prompt.tsx apps/web/__tests__/api/me-claim.test.ts
git commit -m "feat: add (me) claim system with badge and prompt

Claim API with pending/confirmed/rejected states.
MeBadge component and first-visit claim prompt."
```

---

## Task 11: Cross-Tree Person Links

**Files:**
- Create: `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/person-links/route.ts`
- Create: `apps/web/app/api/spaces/[spaceId]/trees/[treeId]/person-links/[id]/sync/route.ts`
- Create: `packages/db/queries/person-links.ts`
- Create: `apps/web/components/tree/person-link-indicator.tsx`
- Create: `apps/web/components/tree/person-link-sync-dialog.tsx`
- Test: `apps/web/__tests__/api/person-links.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/__tests__/api/person-links.test.ts
// Test:
// POST create link between two trees
// GET list links for a person (bidirectional query)
// POST sync: copies changed fields from source to target
// Edge cases: self-link, link to non-existent person, conflict detection
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement person-links query builders**

```typescript
// packages/db/queries/person-links.ts
import { eq, or, and } from 'drizzle-orm';
import { personLinks } from '../schema/space';

export function findLinksForPerson(db: any, treeId: string, personId: string) {
  return db.select().from(personLinks)
    .where(or(
      and(eq(personLinks.sourceTreeId, treeId), eq(personLinks.sourcePersonId, personId)),
      and(eq(personLinks.targetTreeId, treeId), eq(personLinks.targetPersonId, personId)),
    ));
}
```

- [ ] **Step 4: Implement link API routes and sync logic**

The sync route:
1. Fetches both person records (source and target)
2. Compares syncable fields (names, sex, birth/death dates, places, notes)
3. For manual sync: returns the diff for UI review
4. For auto sync: applies changes directly

- [ ] **Step 5: Implement link indicator and sync dialog components**

```tsx
// apps/web/components/tree/person-link-indicator.tsx
// Small badge on linked person nodes showing link count
// Click opens sync dialog if changes pending

// apps/web/components/tree/person-link-sync-dialog.tsx
// Shows per-field diff (old vs new)
// Accept/reject per field
// Apply sync button
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @ancstra/web test -- person-links`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/spaces/*/trees/*/person-links/ packages/db/queries/person-links.ts apps/web/components/tree/person-link-indicator.tsx apps/web/components/tree/person-link-sync-dialog.tsx apps/web/__tests__/api/person-links.test.ts
git commit -m "feat: add cross-tree person links with manual/auto sync

Bidirectional link queries. Per-field diff sync dialog.
Link indicator badge on person nodes."
```

---

## Task 12: Activity Feed

**Files:**
- Create: `apps/web/app/api/spaces/[spaceId]/activity/route.ts`
- Create: `packages/db/queries/activity-feed.ts`
- Create: `apps/web/components/spaces/activity-feed.tsx`
- Test: `apps/web/__tests__/api/activity.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/__tests__/api/activity.test.ts
// Test:
// GET /api/spaces/:id/activity → paginated feed
// Feed entries are privacy-filtered for viewers
// Entries sorted by created_at DESC
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement activity feed query builders**

```typescript
// packages/db/queries/activity-feed.ts
import { desc, eq } from 'drizzle-orm';
import { activityFeed } from '../schema/space';

export function getSpaceActivity(db: any, opts: { limit?: number; offset?: number } = {}) {
  return db.select().from(activityFeed)
    .orderBy(desc(activityFeed.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export function logActivity(db: any, entry: {
  treeId?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: string;
}) {
  return db.insert(activityFeed).values(entry);
}
```

- [ ] **Step 4: Implement activity API route**

```typescript
// apps/web/app/api/spaces/[spaceId]/activity/route.ts
// GET — returns paginated activity feed
// Privacy: redact living person names for viewers
```

- [ ] **Step 5: Implement activity feed component**

```tsx
// apps/web/components/spaces/activity-feed.tsx
// Scrollable feed with infinite scroll or "load more"
// Each entry: avatar, summary text, timestamp
// Links to the relevant person/tree
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @ancstra/web test -- activity`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/spaces/*/activity/ packages/db/queries/activity-feed.ts apps/web/components/spaces/activity-feed.tsx apps/web/__tests__/api/activity.test.ts
git commit -m "feat: add space-level activity feed

Paginated feed with privacy filtering for viewers.
logActivity helper for recording actions."
```

---

## Task 13: Space Management UI

**Files:**
- Create: `apps/web/app/(auth)/spaces/page.tsx`
- Create: `apps/web/app/(auth)/spaces/new/page.tsx`
- Create: `apps/web/app/(auth)/spaces/[spaceId]/settings/page.tsx`
- Create: `apps/web/components/spaces/space-card.tsx`
- Create: `apps/web/components/spaces/create-space-form.tsx`
- Create: `apps/web/components/spaces/invite-dialog.tsx`
- Create: `apps/web/components/spaces/member-list.tsx`
- Create: `apps/web/components/spaces/tree-switcher.tsx`

- [ ] **Step 1: Implement space dashboard page**

```tsx
// apps/web/app/(auth)/spaces/page.tsx
// Server component — fetches user's spaces via GET /api/spaces
// Renders grid of SpaceCard components
// "Create Space" button → links to /spaces/new
```

- [ ] **Step 2: Implement create space form**

```tsx
// apps/web/app/(auth)/spaces/new/page.tsx
// Form: name, description
// On submit: POST /api/spaces → redirect to new space
```

- [ ] **Step 3: Implement space settings page**

```tsx
// apps/web/app/(auth)/spaces/[spaceId]/settings/page.tsx
// Tabs: General | Members | Invitations
// General: edit name/description, delete space (owner only)
// Members: MemberList component with role dropdown
// Invitations: InviteDialog trigger + pending invites list
```

- [ ] **Step 4: Implement invite dialog with person picker**

```tsx
// apps/web/components/spaces/invite-dialog.tsx
// shadcn Dialog with:
// - Email input
// - Role selector (viewer/editor/admin)
// - Optional: person search picker to pre-assign
// - Send button
```

- [ ] **Step 5: Implement tree switcher**

```tsx
// apps/web/components/spaces/tree-switcher.tsx
// Dropdown showing all trees in the space
// "Create Tree" option at bottom (admin+ only)
// Selecting a tree updates the URL and re-renders the tree view
```

- [ ] **Step 6: Manual test all UI flows**

Run: `pnpm dev`
Test: Create space → invite member → manage roles → switch trees

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(auth\)/spaces/ apps/web/components/spaces/
git commit -m "feat(ui): add space management pages

Dashboard, create form, settings with members/invites.
Tree switcher dropdown and invite dialog with person picker."
```

---

## Task 14: Integration Testing

**Files:**
- Test: `tests/e2e/collaborative-spaces.spec.ts`

- [ ] **Step 1: Write E2E test for complete flow**

```typescript
// tests/e2e/collaborative-spaces.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Collaborative Spaces', () => {
  test('owner creates space, invites member, member joins and claims person', async ({ page, context }) => {
    // 1. Owner logs in
    // 2. Creates a new space "Smith Family"
    // 3. Adds a person "Mary Smith" to the default tree
    // 4. Creates an invite for mary@example.com as editor, pre-assigns Mary
    // 5. Opens invite link in new page (incognito)
    // 6. Mary signs up and joins
    // 7. Mary sees the space with "(me)" on her node
    // 8. Verify activity feed shows join event
  });

  test('viewer sees living persons redacted except own node', async ({ page }) => {
    // 1. Setup: space with living + deceased persons
    // 2. Viewer logs in
    // 3. Living persons show as "Living" except the viewer's own node
  });

  test('cross-tree person link and sync', async ({ page }) => {
    // 1. Create space with two trees
    // 2. Add same person to both trees
    // 3. Link them
    // 4. Edit person in tree A
    // 5. Open tree B → see "sync available" indicator
    // 6. Review and accept sync
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `pnpm test:e2e -- collaborative-spaces`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/collaborative-spaces.spec.ts
git commit -m "test: add E2E tests for collaborative spaces

Owner flow, viewer privacy, cross-tree sync."
```

---

## Task 15: Documentation & Cleanup

**Files:**
- Modify: `docs/specs/collaboration.md` — mark as superseded
- Modify: `docs/INDEX.md` — update references
- Modify: `CLAUDE.md` — add spaces context if needed
- Modify: `.env.example` — add new env vars

- [ ] **Step 1: Update .env.example**

Add:
```
# Central database (Turso)
TURSO_CENTRAL_DB_URL=
TURSO_CENTRAL_DB_TOKEN=

# Local development
LOCAL_CENTRAL_DB_PATH=data/central.sqlite
LOCAL_SPACE_DB_DIR=data/

# Turso Platform API (for space provisioning)
TURSO_PLATFORM_TOKEN=
TURSO_ORG_NAME=
```

- [ ] **Step 2: Mark old collaboration spec as superseded**

Add to top of `docs/specs/collaboration.md`:
```
> **SUPERSEDED** by [Collaborative Spaces Design](../superpowers/specs/2026-03-21-collaborative-spaces-design.md)
```

- [ ] **Step 3: Update docs/INDEX.md**

Update the Collaboration row to point to the new spec.

- [ ] **Step 4: Commit**

```bash
git add docs/ .env.example CLAUDE.md
git commit -m "docs: update references for collaborative spaces

Mark old collaboration spec as superseded.
Add new env vars to .env.example."
```
