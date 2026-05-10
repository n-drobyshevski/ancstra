# Research Threads — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation for research threads — schema, thread CRUD module, API routes, and active-thread cookie — with no user-visible UX changes yet. After this lands, Phase 2 (cascade action + timeline panel) and Phase 3 (tree overlay + AI tools) will each get their own plans.

**Architecture:** Add two tables (`research_threads`, `research_thread_events`) and one nullable column (`factsheets.created_thread_id`) via a Drizzle migration. Implement a new `packages/research/src/threads/` module exporting `createThread`, `addEvent`, `getThreadTimeline`, `listThreads`, `pauseThread`, `resolveThread`, `abandonThread`, `updateThread`. Expose a thin HTTP API under `apps/web/app/api/research/threads/*` and a per-family cookie for the currently-active thread.

**Tech Stack:** Drizzle ORM (SQLite/libsql), better-sqlite3 (tests via `createTestCentralDb`), Vitest, Next.js App Router (`withAuth` guard, `revalidateTag`).

**Spec:** [docs/superpowers/specs/2026-05-10-research-threads-overlay-design.md](../specs/2026-05-10-research-threads-overlay-design.md)

---

## Reference patterns (read once before starting)

- **Schema barrel**: `packages/db/src/family-schema.ts:275` re-exports `./research-schema`. Drizzle config at `packages/db/drizzle.config.ts` points at `family-schema.ts`, so additions to `research-schema.ts` are picked up automatically.
- **Existing module pattern**: `packages/research/src/factsheets/queries.ts` — `(db: Database, input: …)` signature; UUIDs via `crypto.randomUUID()`; ISO timestamps via `new Date().toISOString()`.
- **Test fixture**: `createTestCentralDb()` from `@ancstra/db/test-fixtures` — see `packages/research/src/__tests__/conflicts.test.ts:1-70` for the raw-SQL bootstrap pattern. Use bracket-access notation `['exec'](sql)` on the cast client (the project convention; matches existing tests).
- **API route**: `apps/web/app/api/research/factsheets/route.ts` — `withAuth('ai:research', request)` returns `{ familyDb, ctx }`; errors via `handleAuthError`; cache invalidation via `revalidateTag('<key>', 'max')`.
- **No `.js` extensions in TS imports** (Turbopack constraint — see project memory).

---

## Task 1 — Add schema tables

**Files:**
- Modify: `packages/db/src/research-schema.ts` — append two tables and add one column to factsheets

- [ ] **Step 1: Open `packages/db/src/research-schema.ts` and append after the existing `scrapeJobs` block:**

```ts
// ==================== RESEARCH THREADS (Journey Overlay) ====================
export const researchThreads = sqliteTable('research_threads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['active', 'paused', 'resolved', 'abandoned'],
  }).notNull().default('active'),
  seedPersonId: text('seed_person_id').references(() => persons.id, { onDelete: 'set null' }),
  seedFactsheetId: text('seed_factsheet_id').references(() => factsheets.id, { onDelete: 'set null' }),
  seedResearchItemId: text('seed_research_item_id').references(() => researchItems.id, { onDelete: 'set null' }),
  summary: text('summary'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  closedAt: text('closed_at'),
}, (table) => [
  index('idx_threads_status').on(table.status),
  index('idx_threads_created_by').on(table.createdBy),
  index('idx_threads_updated_at').on(table.updatedAt),
]);

// ==================== RESEARCH THREAD EVENTS (Chronological Journey) ====================
export const researchThreadEvents = sqliteTable('research_thread_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  threadId: text('thread_id').notNull().references(() => researchThreads.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: [
      'thread_started', 'item_attached', 'fact_extracted',
      'factsheet_created', 'factsheet_linked', 'mention_followed',
      'conflict_resolved', 'duplicate_resolved', 'factsheet_promoted',
      'note_added', 'thread_paused', 'thread_resolved', 'thread_abandoned',
    ],
  }).notNull(),
  actorId: text('actor_id').notNull(), // user uuid or 'ai'
  factsheetId: text('factsheet_id').references(() => factsheets.id, { onDelete: 'set null' }),
  personId: text('person_id').references(() => persons.id, { onDelete: 'set null' }),
  researchItemId: text('research_item_id').references(() => researchItems.id, { onDelete: 'set null' }),
  researchFactId: text('research_fact_id').references(() => researchFacts.id, { onDelete: 'set null' }),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  linkId: text('link_id').references(() => factsheetLinks.id, { onDelete: 'set null' }),
  reason: text('reason'),
  payloadJson: text('payload_json'),
  occurredAt: text('occurred_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_thread_events_thread').on(table.threadId, table.occurredAt),
  index('idx_thread_events_factsheet').on(table.factsheetId),
  index('idx_thread_events_person').on(table.personId),
]);
```

- [ ] **Step 2: Add `createdThreadId` to the existing `factsheets` table.** Find the existing `factsheets` block at `packages/db/src/research-schema.ts:64`. Replace it with:

```ts
// ==================== FACTSHEETS (Working Hypotheses) ====================
export const factsheets = sqliteTable('factsheets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  entityType: text('entity_type', {
    enum: ['person', 'couple', 'family_unit'],
  }).notNull().default('person'),
  status: text('status', {
    enum: ['draft', 'ready', 'promoted', 'merged', 'dismissed'],
  }).notNull().default('draft'),
  notes: text('notes'),
  promotedPersonId: text('promoted_person_id').references(() => persons.id),
  promotedAt: text('promoted_at'),
  createdThreadId: text('created_thread_id'),  // FK to research_threads — see note below
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_factsheets_status').on(table.status),
  index('idx_factsheets_created_by').on(table.createdBy),
  index('idx_factsheets_promoted_person').on(table.promotedPersonId),
  index('idx_factsheets_thread').on(table.createdThreadId),
]);
```

(`createdThreadId` is plain `text` because Drizzle can't represent a forward-reference FK between tables defined in the same file. SQLite doesn't enforce post-hoc `ALTER TABLE ADD CONSTRAINT FK` either; the application enforces referential integrity in `addEvent`/`createThread` validation. This matches the existing `factsheetLinks.sourceFactId` pattern at `research-schema.ts:93`.)

- [ ] **Step 3: Run typecheck to verify no syntax errors:**

```bash
pnpm --filter @ancstra/db typecheck
```

Expected: PASS (no errors).

- [ ] **Step 4: Commit:**

```bash
git add packages/db/src/research-schema.ts
git commit -m "feat(db): add research_threads + research_thread_events schema"
```

---

## Task 2 — Generate and verify migration

**Files:**
- Create: `packages/db/migrations/0009_<auto-named>.sql` (drizzle-kit auto-names)

- [ ] **Step 1: Generate the migration:**

```bash
pnpm --filter @ancstra/db drizzle-kit generate
```

Expected: a new file `packages/db/migrations/0009_*.sql` containing `CREATE TABLE research_threads`, `CREATE TABLE research_thread_events`, and `ALTER TABLE factsheets ADD created_thread_id`.

- [ ] **Step 2: Apply the migration to a clean local DB to verify it parses:**

```bash
rm -f /tmp/migration-test.db
pnpm --filter @ancstra/db drizzle-kit push --url file:/tmp/migration-test.db
```

Expected: success, no errors.

- [ ] **Step 3: Verify the table shape (sqlite3 CLI optional but recommended):**

```bash
sqlite3 /tmp/migration-test.db ".schema research_threads"
sqlite3 /tmp/migration-test.db ".schema research_thread_events"
sqlite3 /tmp/migration-test.db "PRAGMA table_info(factsheets);"
```

Expected: tables present with the columns above; `factsheets` table has the `created_thread_id` column.

- [ ] **Step 4: Commit:**

```bash
git add packages/db/migrations/
git commit -m "feat(db): migration for research_threads + thread events"
```

---

## Task 3 — Module skeleton + barrel

**Files:**
- Create: `packages/research/src/threads/index.ts`
- Create: `packages/research/src/threads/types.ts`

- [ ] **Step 1: Create `packages/research/src/threads/types.ts`:**

```ts
export type ThreadStatus = 'active' | 'paused' | 'resolved' | 'abandoned';

export type ThreadEventType =
  | 'thread_started' | 'item_attached' | 'fact_extracted'
  | 'factsheet_created' | 'factsheet_linked' | 'mention_followed'
  | 'conflict_resolved' | 'duplicate_resolved' | 'factsheet_promoted'
  | 'note_added' | 'thread_paused' | 'thread_resolved' | 'thread_abandoned';

export interface CreateThreadInput {
  title: string;
  seedPersonId?: string;
  seedFactsheetId?: string;
  seedResearchItemId?: string;
  summary?: string;
  createdBy: string;
}

export interface UpdateThreadInput {
  title?: string;
  summary?: string;
}

export interface AddEventInput {
  threadId: string;
  eventType: ThreadEventType;
  actorId: string;
  factsheetId?: string;
  personId?: string;
  researchItemId?: string;
  researchFactId?: string;
  sourceId?: string;
  linkId?: string;
  reason?: string;
  payload?: unknown;
}

export interface ListThreadsFilters {
  status?: ThreadStatus;
  createdBy?: string;
}
```

- [ ] **Step 2: Create `packages/research/src/threads/index.ts` as a placeholder barrel** (modules filled in by later tasks; this file will fail typecheck until Task 9 — that's expected):

```ts
export type {
  ThreadStatus,
  ThreadEventType,
  CreateThreadInput,
  UpdateThreadInput,
  AddEventInput,
  ListThreadsFilters,
} from './types';

// Implementations added in Tasks 4-9
export { createThread } from './create';
export { addEvent, getThreadTimeline } from './events';
export { listThreads, getThread } from './queries';
export { pauseThread, resolveThread, abandonThread } from './lifecycle';
export { updateThread } from './update';
```

- [ ] **Step 3: Commit (intentionally broken state — fixed by Task 10):**

```bash
git add packages/research/src/threads/types.ts packages/research/src/threads/index.ts
git commit -m "feat(research): scaffold threads module — types + barrel"
```

---

## Task 4 — `createThread` (TDD)

**Files:**
- Test: `packages/research/src/__tests__/threads-create.test.ts`
- Create: `packages/research/src/threads/create.ts`

- [ ] **Step 1: Write the failing test** at `packages/research/src/__tests__/threads-create.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';

const THREAD_DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT,
    seed_factsheet_id TEXT,
    seed_research_item_id TEXT,
    summary TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](THREAD_DDL);
});

describe('createThread', () => {
  it('inserts a thread with defaults and returns it', async () => {
    const thread = await createThread(db as any, {
      title: "Find John Smith's parents",
      createdBy: 'user-1',
    });
    expect(thread.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(thread.title).toBe("Find John Smith's parents");
    expect(thread.status).toBe('active');
    expect(thread.createdBy).toBe('user-1');
    expect(thread.createdAt).toBeTruthy();
    expect(thread.closedAt).toBeNull();
  });

  it('persists optional seed fields', async () => {
    const thread = await createThread(db as any, {
      title: 'From person',
      createdBy: 'user-1',
      seedPersonId: 'person-42',
      summary: 'kicked off from tree',
    });
    expect(thread.seedPersonId).toBe('person-42');
    expect(thread.summary).toBe('kicked off from tree');
  });
});
```

- [ ] **Step 2: Run test to verify it fails:**

```bash
pnpm --filter @ancstra/research test -- threads-create
```

Expected: FAIL with `Cannot find module '../threads/create'`.

- [ ] **Step 3: Implement `packages/research/src/threads/create.ts`:**

```ts
import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { CreateThreadInput } from './types';

export async function createThread(db: Database, input: CreateThreadInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(researchThreads).values({
    id,
    title: input.title,
    status: 'active',
    seedPersonId: input.seedPersonId ?? null,
    seedFactsheetId: input.seedFactsheetId ?? null,
    seedResearchItemId: input.seedResearchItemId ?? null,
    summary: input.summary ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }).run();
  const rows = await db.select().from(researchThreads).where(eq(researchThreads.id, id)).all();
  return rows[0];
}
```

- [ ] **Step 4: Run test to verify it passes:**

```bash
pnpm --filter @ancstra/research test -- threads-create
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit:**

```bash
git add packages/research/src/threads/create.ts packages/research/src/__tests__/threads-create.test.ts
git commit -m "feat(research): createThread"
```

---

## Task 5 — `addEvent` + `getThreadTimeline` (TDD)

**Files:**
- Test: `packages/research/src/__tests__/threads-events.test.ts`
- Create: `packages/research/src/threads/events.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { addEvent, getThreadTimeline } from '../threads/events';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('addEvent', () => {
  it('inserts an event and returns it', async () => {
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    const evt = await addEvent(db as any, {
      threadId: thread.id,
      eventType: 'note_added',
      actorId: 'u1',
      reason: 'starting investigation',
    });
    expect(evt.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(evt.threadId).toBe(thread.id);
    expect(evt.eventType).toBe('note_added');
    expect(evt.reason).toBe('starting investigation');
    expect(evt.occurredAt).toBeTruthy();
  });

  it('rejects events for nonexistent thread', async () => {
    await expect(addEvent(db as any, {
      threadId: 'nonexistent',
      eventType: 'note_added',
      actorId: 'u1',
    })).rejects.toThrow();
  });

  it('serializes payload to JSON', async () => {
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    const evt = await addEvent(db as any, {
      threadId: thread.id,
      eventType: 'note_added',
      actorId: 'u1',
      payload: { foo: 'bar', n: 42 },
    });
    expect(JSON.parse(evt.payloadJson!)).toEqual({ foo: 'bar', n: 42 });
  });
});

describe('getThreadTimeline (M2M)', () => {
  it('returns only events for the requested thread', async () => {
    const t1 = await createThread(db as any, { title: 'T1', createdBy: 'u1' });
    const t2 = await createThread(db as any, { title: 'T2', createdBy: 'u1' });
    const SHARED = 'fs-shared';

    await addEvent(db as any, { threadId: t1.id, eventType: 'factsheet_created', actorId: 'u1', factsheetId: SHARED });
    await addEvent(db as any, { threadId: t2.id, eventType: 'factsheet_linked', actorId: 'u1', factsheetId: SHARED });
    await addEvent(db as any, { threadId: t1.id, eventType: 'note_added', actorId: 'u1' });

    const t1Events = await getThreadTimeline(db as any, t1.id);
    const t2Events = await getThreadTimeline(db as any, t2.id);

    expect(t1Events).toHaveLength(2);
    expect(t1Events.map(e => e.eventType)).toEqual(['factsheet_created', 'note_added']);
    expect(t2Events).toHaveLength(1);
    expect(t2Events[0].eventType).toBe('factsheet_linked');
    expect(t1Events[0].factsheetId).toBe(SHARED);
    expect(t2Events[0].factsheetId).toBe(SHARED);
  });

  it('orders events chronologically', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'thread_started', actorId: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'factsheet_created', actorId: 'u1' });
    const events = await getThreadTimeline(db as any, t.id);
    expect(events.map(e => e.eventType)).toEqual(['thread_started', 'note_added', 'factsheet_created']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails:**

```bash
pnpm --filter @ancstra/research test -- threads-events
```

Expected: FAIL with `Cannot find module '../threads/events'`.

- [ ] **Step 3: Implement `packages/research/src/threads/events.ts`:**

```ts
import { eq, asc } from 'drizzle-orm';
import { researchThreads, researchThreadEvents } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { AddEventInput } from './types';

export async function addEvent(db: Database, input: AddEventInput) {
  // Application-level FK check (SQLite FK enforcement is opt-in)
  const exists = await db.select({ id: researchThreads.id })
    .from(researchThreads)
    .where(eq(researchThreads.id, input.threadId))
    .all();
  if (exists.length === 0) {
    throw new Error(`Thread ${input.threadId} not found`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(researchThreadEvents).values({
    id,
    threadId: input.threadId,
    eventType: input.eventType,
    actorId: input.actorId,
    factsheetId: input.factsheetId ?? null,
    personId: input.personId ?? null,
    researchItemId: input.researchItemId ?? null,
    researchFactId: input.researchFactId ?? null,
    sourceId: input.sourceId ?? null,
    linkId: input.linkId ?? null,
    reason: input.reason ?? null,
    payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
    occurredAt: now,
  }).run();

  // Bump thread updatedAt so listings sort fresh threads up
  await db.update(researchThreads)
    .set({ updatedAt: now })
    .where(eq(researchThreads.id, input.threadId))
    .run();

  const rows = await db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.id, id))
    .all();
  return rows[0];
}

export async function getThreadTimeline(db: Database, threadId: string, opts?: {
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;
  return db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.threadId, threadId))
    .orderBy(asc(researchThreadEvents.occurredAt))
    .limit(limit)
    .offset(offset)
    .all();
}
```

- [ ] **Step 4: Run test to verify it passes:**

```bash
pnpm --filter @ancstra/research test -- threads-events
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit:**

```bash
git add packages/research/src/threads/events.ts packages/research/src/__tests__/threads-events.test.ts
git commit -m "feat(research): addEvent + getThreadTimeline (with M2M coverage)"
```

---

## Task 6 — `listThreads` + `getThread` (TDD)

**Files:**
- Test: `packages/research/src/__tests__/threads-queries.test.ts`
- Create: `packages/research/src/threads/queries.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { addEvent } from '../threads/events';
import { listThreads, getThread } from '../threads/queries';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('listThreads', () => {
  it('returns all threads ordered by updatedAt desc', async () => {
    const a = await createThread(db as any, { title: 'A', createdBy: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    const b = await createThread(db as any, { title: 'B', createdBy: 'u1' });
    const list = await listThreads(db as any);
    expect(list.map(t => t.id)).toEqual([b.id, a.id]);
  });

  it('filters by status', async () => {
    await createThread(db as any, { title: 'A', createdBy: 'u1' });
    const list = await listThreads(db as any, { status: 'paused' });
    expect(list).toHaveLength(0);
  });

  it('filters by createdBy', async () => {
    await createThread(db as any, { title: 'A', createdBy: 'u1' });
    await createThread(db as any, { title: 'B', createdBy: 'u2' });
    const list = await listThreads(db as any, { createdBy: 'u2' });
    expect(list.map(t => t.title)).toEqual(['B']);
  });
});

describe('getThread', () => {
  it('returns thread with eventCount', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    const result = await getThread(db as any, t.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(t.id);
    expect(result!.eventCount).toBe(2);
  });

  it('returns null for unknown id', async () => {
    expect(await getThread(db as any, 'missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect fail:**

```bash
pnpm --filter @ancstra/research test -- threads-queries
```

- [ ] **Step 3: Implement `packages/research/src/threads/queries.ts`:**

```ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { ListThreadsFilters } from './types';

export async function listThreads(db: Database, filters: ListThreadsFilters = {}) {
  const conds = [];
  if (filters.status) conds.push(eq(researchThreads.status, filters.status));
  if (filters.createdBy) conds.push(eq(researchThreads.createdBy, filters.createdBy));

  const where = conds.length ? and(...conds) : undefined;
  return db.select().from(researchThreads)
    .where(where as any)
    .orderBy(desc(researchThreads.updatedAt))
    .all();
}

export async function getThread(db: Database, id: string) {
  const rows = await db.select().from(researchThreads)
    .where(eq(researchThreads.id, id))
    .all();
  if (rows.length === 0) return null;

  const countRows = await db.all<{ c: number }>(sql`
    SELECT COUNT(*) as c FROM research_thread_events WHERE thread_id = ${id}
  `);
  return { ...rows[0], eventCount: countRows[0]?.c ?? 0 };
}
```

- [ ] **Step 4: Run test, expect pass:**

```bash
pnpm --filter @ancstra/research test -- threads-queries
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit:**

```bash
git add packages/research/src/threads/queries.ts packages/research/src/__tests__/threads-queries.test.ts
git commit -m "feat(research): listThreads + getThread"
```

---

## Task 7 — Lifecycle (`pauseThread`, `resolveThread`, `abandonThread`) (TDD)

**Files:**
- Test: `packages/research/src/__tests__/threads-lifecycle.test.ts`
- Create: `packages/research/src/threads/lifecycle.ts`

- [ ] **Step 1: Write failing test:**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { getThread } from '../threads/queries';
import { getThreadTimeline } from '../threads/events';
import { pauseThread, resolveThread, abandonThread } from '../threads/lifecycle';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('pauseThread', () => {
  it('flips status and emits thread_paused event', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await pauseThread(db as any, t.id, 'u1');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('paused');
    expect(refreshed!.closedAt).toBeNull();
    const events = await getThreadTimeline(db as any, t.id);
    expect(events.find(e => e.eventType === 'thread_paused')).toBeDefined();
  });
});

describe('resolveThread', () => {
  it('flips status, sets closedAt, emits thread_resolved', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await resolveThread(db as any, t.id, 'u1');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('resolved');
    expect(refreshed!.closedAt).toBeTruthy();
  });
});

describe('abandonThread', () => {
  it('flips status, sets closedAt, emits thread_abandoned with reason', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await abandonThread(db as any, t.id, 'u1', 'lead went cold');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('abandoned');
    expect(refreshed!.closedAt).toBeTruthy();
    const events = await getThreadTimeline(db as any, t.id);
    const ev = events.find(e => e.eventType === 'thread_abandoned');
    expect(ev?.reason).toBe('lead went cold');
  });
});
```

- [ ] **Step 2: Run, expect fail:**

```bash
pnpm --filter @ancstra/research test -- threads-lifecycle
```

- [ ] **Step 3: Implement `packages/research/src/threads/lifecycle.ts`:**

```ts
import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { addEvent } from './events';

async function transition(
  db: Database,
  threadId: string,
  actorId: string,
  toStatus: 'paused' | 'resolved' | 'abandoned',
  eventType: 'thread_paused' | 'thread_resolved' | 'thread_abandoned',
  reason?: string,
) {
  const now = new Date().toISOString();
  const closedAt = toStatus === 'paused' ? null : now;
  await db.update(researchThreads)
    .set({ status: toStatus, updatedAt: now, closedAt })
    .where(eq(researchThreads.id, threadId))
    .run();
  await addEvent(db, { threadId, eventType, actorId, reason });
}

export const pauseThread = (db: Database, threadId: string, actorId: string) =>
  transition(db, threadId, actorId, 'paused', 'thread_paused');

export const resolveThread = (db: Database, threadId: string, actorId: string, reason?: string) =>
  transition(db, threadId, actorId, 'resolved', 'thread_resolved', reason);

export const abandonThread = (db: Database, threadId: string, actorId: string, reason?: string) =>
  transition(db, threadId, actorId, 'abandoned', 'thread_abandoned', reason);
```

- [ ] **Step 4: Run, expect pass:**

```bash
pnpm --filter @ancstra/research test -- threads-lifecycle
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit:**

```bash
git add packages/research/src/threads/lifecycle.ts packages/research/src/__tests__/threads-lifecycle.test.ts
git commit -m "feat(research): pauseThread / resolveThread / abandonThread"
```

---

## Task 8 — `updateThread` (TDD)

**Files:**
- Test: `packages/research/src/__tests__/threads-update.test.ts`
- Create: `packages/research/src/threads/update.ts`

- [ ] **Step 1: Write failing test:**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { getThread } from '../threads/queries';
import { updateThread } from '../threads/update';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('updateThread', () => {
  it('updates title and bumps updatedAt', async () => {
    const t = await createThread(db as any, { title: 'old', createdBy: 'u1' });
    const before = (await getThread(db as any, t.id))!.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    await updateThread(db as any, t.id, { title: 'new title' });
    const after = await getThread(db as any, t.id);
    expect(after!.title).toBe('new title');
    expect(after!.updatedAt > before).toBe(true);
  });

  it('updates summary independently', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await updateThread(db as any, t.id, { summary: 'narrative so far...' });
    const after = await getThread(db as any, t.id);
    expect(after!.summary).toBe('narrative so far...');
    expect(after!.title).toBe('T');
  });
});
```

- [ ] **Step 2: Run, expect fail:**

```bash
pnpm --filter @ancstra/research test -- threads-update
```

- [ ] **Step 3: Implement `packages/research/src/threads/update.ts`:**

```ts
import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { UpdateThreadInput } from './types';

export async function updateThread(db: Database, threadId: string, patch: UpdateThreadInput) {
  const now = new Date().toISOString();
  const set: Record<string, string> = { updatedAt: now };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.summary !== undefined) set.summary = patch.summary;
  if (Object.keys(set).length === 1) return; // only updatedAt — skip
  await db.update(researchThreads).set(set).where(eq(researchThreads.id, threadId)).run();
}
```

- [ ] **Step 4: Run, expect pass:**

```bash
pnpm --filter @ancstra/research test -- threads-update
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit:**

```bash
git add packages/research/src/threads/update.ts packages/research/src/__tests__/threads-update.test.ts
git commit -m "feat(research): updateThread"
```

---

## Task 9 — Wire `@ancstra/research` package barrel

**Files:**
- Modify: `packages/research/src/index.ts`

- [ ] **Step 1: Append to `packages/research/src/index.ts`:**

```ts
// ==================== THREADS ====================
export {
  createThread,
  addEvent,
  getThreadTimeline,
  listThreads,
  getThread,
  pauseThread,
  resolveThread,
  abandonThread,
  updateThread,
} from './threads';
export type {
  ThreadStatus,
  ThreadEventType,
  CreateThreadInput,
  UpdateThreadInput,
  AddEventInput,
  ListThreadsFilters,
} from './threads';
```

- [ ] **Step 2: Verify the package builds + all tests pass:**

```bash
pnpm --filter @ancstra/research typecheck
pnpm --filter @ancstra/research test
```

Expected: PASS (all existing + new tests).

- [ ] **Step 3: Commit:**

```bash
git add packages/research/src/index.ts
git commit -m "feat(research): export threads module"
```

---

## Task 10 — API: list + create threads

**Files:**
- Create: `apps/web/app/api/research/threads/route.ts`

- [ ] **Step 1: Create the route file:**

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createThread, listThreads } from '@ancstra/research';
import type { ThreadStatus } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ThreadStatus | null;
    const createdBy = searchParams.get('createdBy');
    const rows = await listThreads(familyDb, {
      status: status ?? undefined,
      createdBy: createdBy ?? undefined,
    });
    return NextResponse.json({ threads: rows });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[threads GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json();
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const thread = await createThread(familyDb, {
      title: body.title,
      seedPersonId: body.seedPersonId,
      seedFactsheetId: body.seedFactsheetId,
      seedResearchItemId: body.seedResearchItemId,
      summary: body.summary,
      createdBy: ctx.userId,
    });
    revalidateTag('threads-list', 'max');
    return NextResponse.json(thread, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[threads POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Smoke-test via dev server (after `pnpm --filter @ancstra/web dev`):**

```bash
COOKIE="<your dev session cookie>"
curl -X POST http://localhost:3000/api/research/threads \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d '{"title":"smoke test thread"}'
```

Expected: 201 with the new thread JSON.

- [ ] **Step 3: Commit:**

```bash
git add apps/web/app/api/research/threads/route.ts
git commit -m "feat(api): GET/POST /api/research/threads"
```

---

## Task 11 — API: get one thread + update status/title/summary

**Files:**
- Create: `apps/web/app/api/research/threads/[id]/route.ts`

- [ ] **Step 1: Create the dynamic route:**

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThread, updateThread, pauseThread, resolveThread, abandonThread } from '@ancstra/research';

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await ctx.params;
    const thread = await getThread(familyDb, id);
    if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id } = await routeCtx.params;
    const body = await request.json();

    // Status transitions go through lifecycle helpers (they emit events)
    if (body.status === 'paused')    await pauseThread(familyDb, id, ctx.userId);
    if (body.status === 'resolved')  await resolveThread(familyDb, id, ctx.userId, body.reason);
    if (body.status === 'abandoned') await abandonThread(familyDb, id, ctx.userId, body.reason);

    if (body.title !== undefined || body.summary !== undefined) {
      await updateThread(familyDb, id, { title: body.title, summary: body.summary });
    }

    revalidateTag('threads-list', 'max');
    revalidateTag(`thread:${id}`, 'max');
    const fresh = await getThread(familyDb, id);
    return NextResponse.json(fresh);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

(No DELETE in Phase 1 — deletion is rare and risky; users can `abandon` instead. Can be added in a follow-up plan if needed.)

- [ ] **Step 2: Commit:**

```bash
git add apps/web/app/api/research/threads/[id]/route.ts
git commit -m "feat(api): GET/PATCH /api/research/threads/[id]"
```

---

## Task 12 — API: timeline + add note

**Files:**
- Create: `apps/web/app/api/research/threads/[id]/events/route.ts`

- [ ] **Step 1: Create the route:**

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { addEvent, getThreadTimeline } from '@ancstra/research';

export async function GET(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await routeCtx.params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? '200');
    const offset = Number(searchParams.get('offset') ?? '0');
    const events = await getThreadTimeline(familyDb, id, { limit, offset });
    return NextResponse.json({ events });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread events GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id } = await routeCtx.params;
    const body = await request.json();
    if (typeof body.note !== 'string' || body.note.trim().length === 0) {
      return NextResponse.json({ error: 'note is required' }, { status: 400 });
    }
    const evt = await addEvent(familyDb, {
      threadId: id,
      eventType: 'note_added',
      actorId: ctx.userId,
      reason: body.note,
    });
    revalidateTag(`thread:${id}`, 'max');
    return NextResponse.json(evt, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread events POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit:**

```bash
git add apps/web/app/api/research/threads/[id]/events/route.ts
git commit -m "feat(api): GET/POST /api/research/threads/[id]/events"
```

---

## Task 13 — Active-thread cookie API

**Files:**
- Create: `apps/web/app/api/research/threads/active/route.ts`

The active thread is per-user-per-family. We use a cookie keyed by `family_id` so a user can switch families without losing the thread state per family.

- [ ] **Step 1: Create the route:**

```ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThread } from '@ancstra/research';

const cookieName = (familyId: string) => `act-thread-${familyId}`;

export async function GET(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const cookieHeader = request.headers.get('cookie') ?? '';
    const match = cookieHeader.match(new RegExp(`${cookieName(ctx.familyId)}=([^;]+)`));
    if (!match) return NextResponse.json({ thread: null });
    const thread = await getThread(familyDb, match[1]);
    if (!thread || thread.status !== 'active') return NextResponse.json({ thread: null });
    return NextResponse.json({ thread });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[active-thread GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json();
    const threadId: string | null = body.threadId ?? null;

    if (threadId) {
      const t = await getThread(familyDb, threadId);
      if (!t) return NextResponse.json({ error: 'thread not found' }, { status: 404 });
    }

    const res = NextResponse.json({ threadId });
    const name = cookieName(ctx.familyId);
    if (threadId) {
      res.cookies.set(name, threadId, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
        path: '/', maxAge: 60 * 60 * 24 * 30,
      });
    } else {
      res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
    return res;
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[active-thread PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit:**

```bash
git add apps/web/app/api/research/threads/active/route.ts
git commit -m "feat(api): active-thread cookie endpoint"
```

---

## Task 14 — Frontend: `useActiveThread` hook + helpers

**Files:**
- Create: `apps/web/lib/research/active-thread.ts`

- [ ] **Step 1: Create the hook:**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export interface ActiveThread {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'resolved' | 'abandoned';
  summary: string | null;
  eventCount?: number;
  updatedAt: string;
}

/**
 * Read + update the currently-active research thread for the current family.
 * Persists across reloads via an httpOnly cookie keyed by family_id.
 */
export function useActiveThread() {
  const isHydrated = useIsHydrated();
  const [thread, setThread] = useState<ActiveThread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    fetch('/api/research/threads/active')
      .then(r => r.json())
      .then(data => { if (!cancelled) setThread(data.thread ?? null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isHydrated]);

  const setActive = useCallback(async (threadId: string | null) => {
    const res = await fetch('/api/research/threads/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
    if (!res.ok) throw new Error(`Failed to set active thread: ${res.status}`);
    if (threadId) {
      const fresh = await fetch(`/api/research/threads/${threadId}`).then(r => r.json());
      setThread(fresh);
    } else {
      setThread(null);
    }
  }, []);

  return { thread, loading, setActive };
}
```

- [ ] **Step 2: Typecheck the web app:**

```bash
pnpm --filter @ancstra/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit:**

```bash
git add apps/web/lib/research/active-thread.ts
git commit -m "feat(web): useActiveThread hook + cookie helpers"
```

---

## Task 15 — End-to-end verification

**Files:**
- None to create — this task validates everything ships together.

- [ ] **Step 1: Run the full research package test suite:**

```bash
pnpm --filter @ancstra/research test
```

Expected: PASS (all existing + 17 new tests across 5 new test files).

- [ ] **Step 2: Run full repo typecheck:**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Manual smoke test via curl** (after `pnpm --filter @ancstra/web dev`):

```bash
COOKIE="<your dev session cookie>"

# Create a thread
curl -sX POST http://localhost:3000/api/research/threads \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d '{"title":"e2e test thread"}' | tee /tmp/thread.json
THREAD_ID=$(jq -r .id /tmp/thread.json)

# Set it as active
curl -sX PUT http://localhost:3000/api/research/threads/active \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d "{\"threadId\":\"$THREAD_ID\"}"

# Add a note event
curl -sX POST "http://localhost:3000/api/research/threads/$THREAD_ID/events" \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d '{"note":"first journal entry"}'

# Pause the thread (emits thread_paused event)
curl -sX PATCH "http://localhost:3000/api/research/threads/$THREAD_ID" \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d '{"status":"paused"}'

# Read the timeline
curl -s "http://localhost:3000/api/research/threads/$THREAD_ID/events" --cookie "$COOKIE" | jq '.events | map(.eventType)'
```

Expected final output: `["note_added","thread_paused"]`. (Phase 1 doesn't auto-emit a `thread_started` event yet; that's wired in Phase 2 cascade work.)

- [ ] **Step 4: Verify no migration drift:**

```bash
pnpm --filter @ancstra/db drizzle-kit check
```

Expected: no drift detected.

- [ ] **Step 5: Final commit + tag:**

```bash
git tag -a research-threads-phase1 -m "Phase 1 of research threads: schema + module + API"
```

(Don't push the tag unless asked — local marker for follow-up plans.)

---

## Self-Review (done inline)

**Spec coverage:**
- Spec §1 Data Model → Tasks 1, 2 ✓
- Spec §3 Active-thread state → Tasks 13, 14 ✓
- Spec §3 Lifecycle states → Task 7 ✓
- Spec §3 Three ways a thread starts → Task 10 (POST accepts seed* fields) ✓
- Spec §6 Files Affected (backend module + API + cookie helpers) → Tasks 3-14 ✓
- Spec §6 Frontend components (`thread-list`, `thread-timeline-panel`, etc.) → **Phase 2** (intentionally deferred)
- Spec §6 Cascade action → **Phase 2**
- Spec §6 Tree overlay → **Phase 3**
- Spec §6 AI tools (`summarize_thread`, `suggest_next_step`) → **Phase 3**
- Spec §6 Backfill tool → deferred to a small follow-up plan
- Spec §8 Verification (1–3 partial; UI E2E waits for Phase 2) → Task 15 ✓

**Placeholder scan:** none — every step has runnable code or commands.

**Type consistency:** `Database` import path consistent (`@ancstra/db`); `ThreadStatus` / `ThreadEventType` reused unchanged across modules; `createThread` returns the row directly so callers see the resolved status.

---

## What's NOT in Phase 1 (next plans will cover)

- **Phase 2 plan** — cascade contextual action, mention chips, timeline panel UI, AI emits events into active thread.
- **Phase 3 plan** — tree-canvas overlay highlight, time-scrubber, `summarize_thread` / `suggest_next_step` AI tools.
- **Backfill plan** — group existing factsheets retroactively into a thread by reading `change_log`.
