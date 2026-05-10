# Research Threads — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the research-threads vision — bring the journey overlay onto the tree canvas, give the AI agent tools for narrating and proposing next steps, and ship the full-page thread route. After Phase 3, the spec is fully delivered modulo explicitly post-MVP items (privacy filter, multi-user, backfill, autonomous mode, cases-as-container alternative).

**Architecture:** Build on Phase 1 (schema + module + API) and Phase 2 (cascade UX + AI prompt block). Three concurrent surfaces:

1. **Backend completion** — `factsheet_promoted` event from `promote.ts` when an active thread is present; new event type `relationship_proposed` (additive enum); query helpers (`getPersonsTouchedByThread`, `getThreadsForPerson`); two new API routes.
2. **AI agent tools** — `summarize_thread` produces structured-markdown narrative; `suggest_next_step` returns 3 ranked options with rationale; both registered in the chat route. Client-side chat hook adds `threadId` to the request body (deferred Phase 2 plumbing).
3. **Tree-canvas overlay + thread page** — overlay highlight + dimming when an active thread is set, time-scrubber that filters nodes by event `occurredAt`, right-click "Show threads that touched this person" modal, `Threads` tab in the right sidebar, and the standalone `/research/threads/[id]` full-page route the Phase 2 header bar already links to.

**Tech Stack:** Drizzle ORM (libsql/SQLite), Vitest, Next.js App Router, React 19, Tailwind v4, shadcn/ui, React Flow (xyflow), ai-sdk v5/v6 dual versions, `@ai-sdk/react`.

**Spec:** [docs/superpowers/specs/2026-05-10-research-threads-overlay-design.md](../specs/2026-05-10-research-threads-overlay-design.md) §4-5
**Phase 1 plan (complete):** [2026-05-10-research-threads-phase1.md](./2026-05-10-research-threads-phase1.md)
**Phase 2 plan (complete):** [2026-05-10-research-threads-phase2.md](./2026-05-10-research-threads-phase2.md)

---

## Reference patterns (read once before starting)

- **Module pattern**: `(db: Database, …)` signature, raw `BEGIN/COMMIT/ROLLBACK` for transactions (Drizzle's `db.transaction(async tx)` breaks on better-sqlite3 — see project memory `feedback_drizzle_transactions.md`).
- **Test fixture**: `createTestCentralDb()` from `@ancstra/db/test-fixtures` — bootstrap research tables with raw SQL via `(db.$client as unknown as { ['exec']: ... })['exec'](DDL)` (see `packages/research/src/__tests__/threads-cascade.test.ts`).
- **API route pattern**: `withAuth('ai:research', request)` returns `{ familyDb, ctx }`; `params: Promise<{id: string}>`; nested try / `handleAuthError` / 500. `revalidateTag(name, 'max')` after mutations.
- **Research components convention** (Phase 2 confirmed): literal English strings, **no next-intl** for the research namespace; toasts via `import { toast } from 'sonner'`.
- **Chat panel**: `apps/web/components/research/chat-panel.tsx` uses `useChat` from `@ai-sdk/react` and passes `focusPersonId` via the `body` field on each `sendMessage` invocation. Phase 2 made the chat route accept `threadId`; the panel still needs to send it.
- **Active-thread cookie + hook**: `apps/web/lib/research/active-thread.ts` exports `useActiveThread()` returning `{ thread, loading, setActive }` (Phase 1).
- **AI tool registration**: `apps/web/app/api/ai/chat/route.ts` builds the `tools` map. New tools must be registered there. Existing tool factories live at `packages/ai/src/tools/`.
- **Tree canvas**: `apps/web/components/tree/tree-canvas.tsx` (~1760 lines); `nodeTypes = { person, draftPerson, draftFactsheet }`. Nodes carry `data` props consumed by `PersonNode`. Adding overlay state means pushing `data.threadHighlight: 'highlighted' | 'dimmed' | undefined` into nodes/edges.
- **No `.js` extensions in TS imports** (Turbopack constraint).
- **JWT staleness post-mutation nav**: prefer `window.location.reload()` for now (see project memory `feedback_jwt_stale_recovery.md`).

---

## Locked Decisions (rationale included)

1. **"Person added by thread" definition** — UNION of (a) persons promoted from a factsheet whose `factsheets.created_thread_id = ?` AND (b) persons referenced in any `research_thread_events.person_id = ?`. *Why:* casts a wider net so the user sees the full reach of a thread, not just the strict creation lineage. Phase 4 can tighten if needed.

2. **Time-scrubber driver** — **thread events**, not factsheet timestamps. Each event's `occurredAt` is the moment a node/edge "appeared" in the user's mental model. Time = max(scrubber, eventOccurred). *Why:* events ARE the journey — already captured in Phase 1, no new derived state.

3. **Time-scrubber UX** — slider only (no auto-play in v1). Position 100% = "now"; dragging back hides nodes/edges whose first associated event > current scrubber time. *Why:* keeps surface tight, animated playback is polish not core.

4. **`summarize_thread` output** — structured markdown: `## Investigation`, `## Key findings`, `## Open questions`, `## Suggested next steps`. *Why:* matches Claude's natural medium and is easy to embed into the thread's `summary` field via a one-click "Save as summary" action.

5. **`suggest_next_step` shape** — array of 3 options, each `{ title, rationale, suggestedTool, suggestedArgs }`. *Why:* PMs prefer ranked options + reasoning over a single answer; the structured `suggestedTool` field lets the chat UI render quick-action buttons.

6. **`/research/threads/[id]` page scope** — viewer + summary editor + add-note form + related-factsheets list + related-persons list. **No** lifecycle controls (header bar handles them). *Why:* avoid two sources of truth for status transitions; the page is "deep dive" not "control center".

7. **Schema event-type enum extension** — add `relationship_proposed` and `mention_extracted`. Pure TS change (CHECK constraint isn't enforced by drizzle-kit on SQLite, confirmed by Phase 2). *Why:* cleans up Phase 2's pragmatic `note_added` for AI proposals (called out in Phase 2 final review). Drives more meaningful timeline labels.

8. **`factsheet_promoted` event emission** — wire into `promoteSingleFactsheet` and `promoteFactsheetCluster` in `packages/research/src/factsheets/promote.ts`. Threading: pass `threadId` (from API caller) through promotion options; emit event after the existing transaction settles. *Why:* the time-scrubber needs promotion timestamps; the tree overlay needs to know which thread a tree-visible person came from.

9. **Tree-context-menu "Start research thread" entry** — include now (Phase 2 deferred). User's tree work is committed (commits `1ee2067`, `c83767c`); risk is acceptable. *Why:* completes the spec's three-entry-point story.

10. **Inbox thread-start entry** — STILL DEFERRED. The inbox UI is unevenly built; entry point can be added when the inbox UX matures. *Why:* not worth the surface area in Phase 3 if it ships incomplete.

11. **Backfill tool** — DEFERRED to a small standalone plan. The user has no legacy factsheets needing backfill (Phase 1 only just shipped). *Why:* premature.

12. **Privacy filter (`filterForPrivacy`) on AI thread context** — DEFERRED. Spec §9 calls it out; it's its own design surface (per-person living-status check, name redaction). Add a small task to ensure event `reason` text doesn't include AI-fetched person names — the cascade `reason` format ("spouse mentioned in <source title>") is already minimal-name-leakage. *Why:* full privacy redaction is its own design problem; Phase 3 adopts a "don't make it worse" posture.

13. **Client-side chat hook plumbing** — Phase 2 server route accepts `threadId`; Phase 3 finishes by having `chat-panel.tsx` read `useActiveThread()` and send `threadId` in the request body across all three `sendMessage` call sites. *Why:* completes the AI integration loop.

---

## Open / explicitly out-of-scope

- Privacy filter on AI thread context (separate design)
- Multi-user collaboration UX (who's in this thread now)
- Backfill tool for legacy factsheets
- Background autonomous research mode
- `cases-as-container` alternative (architectural pivot, not deferred)
- Inbox thread-start entry point

---

## Task 1 — Extend event-type enum (`relationship_proposed`, `mention_extracted`)

**Files:**
- Modify: `packages/db/src/research-schema.ts` — extend the `eventType` enum array
- Modify: `packages/research/src/threads/types.ts` — extend `ThreadEventType` union

**Why:** Phase 2 final review flagged that the AI's proposal events file as `note_added`, which is misleading in the timeline. New types unblock cleaner labels and future filtering.

This is a pure TS change. SQLite CHECK constraints aren't generated by drizzle-kit (confirmed Phase 2), so no migration is required. Existing rows with `note_added` for proposals stay valid.

- [ ] **Step 1: Modify `packages/db/src/research-schema.ts`** — find the `researchThreadEvents` table (around line ~199), extend the `eventType` enum:

```ts
eventType: text('event_type', {
  enum: [
    'thread_started', 'item_attached', 'fact_extracted',
    'factsheet_created', 'factsheet_linked', 'mention_followed',
    'mention_extracted',                                          // NEW
    'conflict_resolved', 'duplicate_resolved', 'factsheet_promoted',
    'relationship_proposed',                                      // NEW
    'note_added', 'thread_paused', 'thread_resolved', 'thread_abandoned',
  ],
}).notNull(),
```

- [ ] **Step 2: Modify `packages/research/src/threads/types.ts`** — extend `ThreadEventType`:

```ts
export type ThreadEventType =
  | 'thread_started' | 'item_attached' | 'fact_extracted'
  | 'factsheet_created' | 'factsheet_linked' | 'mention_followed'
  | 'mention_extracted'
  | 'conflict_resolved' | 'duplicate_resolved' | 'factsheet_promoted'
  | 'relationship_proposed'
  | 'note_added' | 'thread_paused' | 'thread_resolved' | 'thread_abandoned';
```

- [ ] **Step 3: Typecheck across affected packages**

```bash
cd D:/projects/ancstra && pnpm --filter @ancstra/db typecheck && pnpm --filter @ancstra/research typecheck && pnpm --filter @ancstra/ai typecheck
```

Expected: PASS (no callers reference the new values yet, so nothing breaks).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/research-schema.ts packages/research/src/threads/types.ts
git commit -m "feat(db): extend thread event types with relationship_proposed + mention_extracted"
```

---

## Task 2 — Backfill `propose-relationship` to use `relationship_proposed`

**Files:**
- Modify: `packages/ai/src/tools/propose-relationship.ts`

- [ ] **Step 1: Read the current implementation.** Phase 2 emits `eventType: 'note_added'` with a reason like `"AI proposed parent_child between A and B: <evidence>"`.

- [ ] **Step 2: Change to `eventType: 'relationship_proposed'`.** Keep the reason text and payload unchanged (the structured `proposalId` etc. is still useful).

- [ ] **Step 3: Verify tests still pass**

```bash
cd D:/projects/ancstra && pnpm --filter @ancstra/ai test -- propose-relationship
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/tools/propose-relationship.ts
git commit -m "fix(ai): use relationship_proposed event type for AI proposals"
```

---

## Task 3 — Wire `factsheet_promoted` event into `promote.ts`

**Files:**
- Modify: `packages/research/src/factsheets/promote.ts`
- Modify: existing tests in `packages/research/src/__tests__/` if needed
- Add: `packages/research/src/__tests__/promote-thread-events.test.ts`

**Why:** The tree overlay's time-scrubber and "person added by thread" query both depend on knowing when a factsheet became a tree person. Without this event, promotions are invisible to the thread.

- [ ] **Step 1: Read `promote.ts`** to find `promoteSingleFactsheet(db, input)` and `promoteFactsheetCluster(db, input)`. Note the existing input shapes — they don't accept `threadId`.

- [ ] **Step 2: Extend input types**

```ts
export interface PromoteSingleInput {
  factsheetId: string;
  mode: 'create' | 'merge';
  mergeTargetPersonId?: string;
  userId: string;
  skipValidation?: boolean;
  /** When set, emits a 'factsheet_promoted' thread event after success. */
  threadId?: string | null;
}
```

(Apply the same `threadId?: string | null` extension to `PromoteClusterInput` if it exists.)

- [ ] **Step 3: Emit the event after success**

After the existing transaction's COMMIT (or after `refreshSummary`), add:

```ts
import { addEvent } from '../threads/events';
// ...

if (input.threadId) {
  try {
    await addEvent(db, {
      threadId: input.threadId,
      eventType: 'factsheet_promoted',
      actorId: input.userId,
      factsheetId: input.factsheetId,
      personId: result.personId,
      reason: `Promoted "${factsheetTitle}" to person`,
    });
  } catch (err) {
    console.warn('[promoteSingleFactsheet] thread event emission failed:', err);
  }
}
```

(Look up `factsheetTitle` from the factsheet row; the existing code likely already has it.)

- [ ] **Step 4: Update the API route** at `apps/web/app/api/research/factsheets/[id]/promote/route.ts` to read the active-thread cookie (or accept `threadId` in body) and pass it through.

The cleanest move: read the cookie via the same helper that `apps/web/app/api/research/threads/active/route.ts` GET uses (the `act-thread-${familyId}` cookie). Extract that cookie-read into a small helper at `apps/web/lib/research/active-thread-server.ts`:

```ts
import { cookies } from 'next/headers';

const COOKIE_PREFIX = 'act-thread-';

/** Read the active-thread id from cookies (server-side). Returns null if none. */
export async function getActiveThreadIdFromCookies(familyId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(`${COOKIE_PREFIX}${familyId}`);
  return c?.value ?? null;
}
```

Then in the promote route:

```ts
const threadId = await getActiveThreadIdFromCookies(ctx.familyId);
const result = await promoteSingleFactsheet(familyDb, {
  factsheetId, mode, mergeTargetPersonId, userId: ctx.userId, threadId,
});
```

- [ ] **Step 5: Write a focused test** at `packages/research/src/__tests__/promote-thread-events.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread, getThreadTimeline } from '../threads';
// import promoteSingleFactsheet — note: full DDL for a promotion is heavy
//   (persons, person_names, events, sources, source_citations, person_summary).
// If the existing factsheet promote tests already bootstrap that DDL, REUSE
// their helpers. Otherwise, narrow this test to verify only the event emission
// path by stubbing/mocking the parts of promotion that aren't event-relevant.

// Implementation strategy: write the test that calls promoteSingleFactsheet
// with a real seed factsheet + minimum required tables. After the call,
// `getThreadTimeline(db, threadId)` should contain exactly one
// 'factsheet_promoted' event whose factsheetId + personId match the result.
```

(If the test ends up too heavyweight given the existing promotion DDL surface, REPORT and we'll restructure — possibly extract event emission into a `promoteAndEmitEvent` wrapper that's testable in isolation.)

- [ ] **Step 6: Run tests + commit**

```bash
cd D:/projects/ancstra && pnpm --filter @ancstra/research test
```

```bash
git add packages/research/src/factsheets/promote.ts \
        packages/research/src/__tests__/promote-thread-events.test.ts \
        apps/web/app/api/research/factsheets/[id]/promote/route.ts \
        apps/web/lib/research/active-thread-server.ts
git commit -m "feat(research): emit factsheet_promoted event when active thread"
```

---

## Task 4 — Server query helpers (`getPersonsTouchedByThread`, `getThreadsForPerson`)

**Files:**
- Modify: `packages/research/src/threads/queries.ts` — add the two new functions
- Modify: `packages/research/src/threads/index.ts` — export them
- Modify: `packages/research/src/index.ts` — re-export
- Add: `packages/research/src/__tests__/threads-overlay-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread, addEvent } from '../threads';
import { getPersonsTouchedByThread, getThreadsForPerson } from '../threads/queries';

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
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT, promoted_person_id TEXT, promoted_at TEXT,
    created_thread_id TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

async function seedFactsheet(d: TestCentralDb, id: string, threadId: string | null, promotedPersonId: string | null) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, promoted_person_id, created_by, created_at, updated_at)
    VALUES (${id}, ${'fs ' + id}, 'person', ${promotedPersonId ? 'promoted' : 'draft'}, ${threadId}, ${promotedPersonId}, 'u1', ${now}, ${now})
  `);
}

describe('getPersonsTouchedByThread', () => {
  it('returns union of (a) promoted persons from thread-created factsheets and (b) event-referenced persons', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await seedFactsheet(db, 'fs-a', t.id, 'p-a');   // (a) thread-created + promoted
    await seedFactsheet(db, 'fs-b', t.id, null);     // (a) thread-created but not promoted (excluded)
    await seedFactsheet(db, 'fs-c', null, 'p-c');    // not thread-created (excluded)
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', personId: 'p-d' });  // (b)

    const ids = await getPersonsTouchedByThread(db as any, t.id);
    expect(ids.sort()).toEqual(['p-a', 'p-d'].sort());
  });

  it('returns empty array for unknown thread', async () => {
    const ids = await getPersonsTouchedByThread(db as any, 'missing');
    expect(ids).toEqual([]);
  });
});

describe('getThreadsForPerson', () => {
  it('returns all threads referenced via promoted factsheet or event personId, with last-touched timestamp', async () => {
    const t1 = await createThread(db as any, { title: 'T1', createdBy: 'u1' });
    const t2 = await createThread(db as any, { title: 'T2', createdBy: 'u1' });
    await seedFactsheet(db, 'fs-a', t1.id, 'p-shared');
    await addEvent(db as any, { threadId: t2.id, eventType: 'note_added', actorId: 'u1', personId: 'p-shared' });

    const threads = await getThreadsForPerson(db as any, 'p-shared');
    expect(threads.map(t => t.id).sort()).toEqual([t1.id, t2.id].sort());
    threads.forEach(t => expect(t.lastTouchedAt).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm --filter @ancstra/research test -- threads-overlay-queries
```

- [ ] **Step 3: Implement in `packages/research/src/threads/queries.ts`** (append to existing file):

```ts
export async function getPersonsTouchedByThread(db: Database, threadId: string): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT promoted_person_id AS id
      FROM factsheets
     WHERE created_thread_id = ${threadId}
       AND promoted_person_id IS NOT NULL
    UNION
    SELECT DISTINCT person_id AS id
      FROM research_thread_events
     WHERE thread_id = ${threadId}
       AND person_id IS NOT NULL
  `);
  return rows.map(r => r.id);
}

export interface ThreadTouchSummary {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
}

export async function getThreadsForPerson(db: Database, personId: string): Promise<ThreadTouchSummary[]> {
  return db.all<ThreadTouchSummary>(sql`
    WITH touch_threads AS (
      SELECT DISTINCT t.id AS id
        FROM research_threads t
        INNER JOIN factsheets f ON f.created_thread_id = t.id
       WHERE f.promoted_person_id = ${personId}
      UNION
      SELECT DISTINCT thread_id AS id
        FROM research_thread_events
       WHERE person_id = ${personId}
    )
    SELECT t.id, t.title, t.status,
           COALESCE(
             (SELECT MAX(occurred_at) FROM research_thread_events e WHERE e.thread_id = t.id AND e.person_id = ${personId}),
             t.updated_at
           ) AS lastTouchedAt
      FROM research_threads t
     INNER JOIN touch_threads tt ON tt.id = t.id
     ORDER BY lastTouchedAt DESC
  `);
}
```

- [ ] **Step 4: Export from barrels** (`packages/research/src/threads/index.ts` and `packages/research/src/index.ts`):

```ts
export { listThreads, getThread, getPersonsTouchedByThread, getThreadsForPerson } from './queries';
export type { ThreadTouchSummary } from './queries';
```

- [ ] **Step 5: Run, expect PASS (3 tests). Commit.**

```bash
git add packages/research/src/threads/queries.ts \
        packages/research/src/threads/index.ts \
        packages/research/src/index.ts \
        packages/research/src/__tests__/threads-overlay-queries.test.ts
git commit -m "feat(research): getPersonsTouchedByThread + getThreadsForPerson query helpers"
```

---

## Task 5 — API endpoints for overlay queries

**Files:**
- Create: `apps/web/app/api/research/threads/[id]/persons/route.ts`
- Create: `apps/web/app/api/persons/[id]/threads/route.ts`

- [ ] **Step 1: Create the threads-touched route**

```ts
// apps/web/app/api/research/threads/[id]/persons/route.ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getPersonsTouchedByThread } from '@ancstra/research';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const personIds = await getPersonsTouchedByThread(familyDb, id);
    return NextResponse.json({ personIds });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread persons GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the person-threads route**

```ts
// apps/web/app/api/persons/[id]/threads/route.ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThreadsForPerson } from '@ancstra/research';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const threads = await getThreadsForPerson(familyDb, id);
    return NextResponse.json({ threads });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[person threads GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/research/threads/[id]/persons/route.ts" \
        "apps/web/app/api/persons/[id]/threads/route.ts"
git commit -m "feat(api): overlay query routes (thread→persons, person→threads)"
```

---

## Task 6 — `summarize_thread` AI tool

**Files:**
- Create: `packages/ai/src/tools/research/summarize-thread.ts`
- Add: `packages/ai/src/__tests__/summarize-thread.test.ts`

**Why:** Lets Claude write structured-markdown narratives for export, sharing, or saving back into the thread's `summary` field.

- [ ] **Step 1: Implement the tool**

```ts
// packages/ai/src/tools/research/summarize-thread.ts
import { tool } from 'ai';
import { z } from 'zod/v3';
import { getThread, getThreadTimeline } from '@ancstra/research';
import type { Database } from '@ancstra/db';

export interface SummarizeThreadResult {
  threadId: string;
  threadTitle: string;
  status: string;
  eventCount: number;
  /** Compact, structured payload Claude will format into markdown. */
  context: {
    title: string;
    status: string;
    summary: string | null;
    events: Array<{ eventType: string; reason: string | null; occurredAt: string }>;
  };
  /** The instruction Claude follows when emitting the markdown narrative. */
  instruction: string;
}

const INSTRUCTION = `Write a structured markdown narrative of this research thread. Use exactly these sections:

## Investigation
1-3 sentences: what's being investigated, who/what is the seed, what's the current state.

## Key findings
Bulleted list of confirmed/likely facts established by the thread (cite the event type or factsheet that established each, e.g., "[factsheet_promoted]" or "[mention_followed]").

## Open questions
Bulleted list of unresolved questions or gaps the thread has surfaced.

## Suggested next steps
2-4 bulleted next moves with brief rationale.

Keep total length under 300 words. Use the user's voice: matter-of-fact, citing evidence.`;

export function createSummarizeThreadTool(db: Database) {
  return tool({
    description: 'Generate a structured markdown summary of a research thread',
    inputSchema: z.object({
      threadId: z.string().describe('The thread to summarize'),
    }),
    execute: async ({ threadId }) => {
      const thread = await getThread(db, threadId);
      if (!thread) {
        return { error: `Thread ${threadId} not found` };
      }
      const events = await getThreadTimeline(db, threadId, { limit: 50 });
      const result: SummarizeThreadResult = {
        threadId,
        threadTitle: thread.title,
        status: thread.status,
        eventCount: thread.eventCount ?? events.length,
        context: {
          title: thread.title,
          status: thread.status,
          summary: thread.summary,
          events: events.map(e => ({
            eventType: e.eventType,
            reason: e.reason,
            occurredAt: e.occurredAt,
          })),
        },
        instruction: INSTRUCTION,
      };
      return result;
    },
  });
}
```

- [ ] **Step 2: Write a unit test**

```ts
// packages/ai/src/__tests__/summarize-thread.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread, addEvent } from '@ancstra/research';
import { createSummarizeThreadTool } from '../tools/research/summarize-thread';

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

describe('summarize_thread tool', () => {
  it('returns structured context + instruction for Claude', async () => {
    const t = await createThread(db as any, { title: 'Find John', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: 'starting' });

    const tool = createSummarizeThreadTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: t.id }, {} as any);

    expect(res.threadTitle).toBe('Find John');
    expect(res.context.events).toHaveLength(1);
    expect(res.context.events[0].eventType).toBe('note_added');
    expect(res.instruction).toContain('## Investigation');
    expect(res.instruction).toContain('## Suggested next steps');
  });

  it('returns error for unknown thread', async () => {
    const tool = createSummarizeThreadTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: 'missing' }, {} as any);
    expect(res.error).toContain('not found');
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @ancstra/ai test -- summarize-thread
git add packages/ai/src/tools/research/summarize-thread.ts \
        packages/ai/src/__tests__/summarize-thread.test.ts
git commit -m "feat(ai): summarize_thread tool"
```

---

## Task 7 — `suggest_next_step` AI tool

**Files:**
- Create: `packages/ai/src/tools/research/suggest-next-step.ts`
- Add: `packages/ai/src/__tests__/suggest-next-step.test.ts`

**Why:** Reads the thread's timeline + tree gaps for the seed person and proposes 3 ranked next moves with rationale.

- [ ] **Step 1: Implement the tool**

```ts
// packages/ai/src/tools/research/suggest-next-step.ts
import { tool } from 'ai';
import { z } from 'zod/v3';
import { getThread, getThreadTimeline } from '@ancstra/research';
import type { Database } from '@ancstra/db';

const INSTRUCTION = `Based on the thread context above, propose exactly 3 ranked next steps. Format as JSON:

{
  "options": [
    {
      "title": "Short title (≤ 60 chars)",
      "rationale": "1-2 sentences explaining why this is the next move",
      "suggestedTool": "searchFamilySearch" | "searchNARA" | "searchNewspapers" | "extractFacts" | "proposeRelationship" | null,
      "suggestedArgs": {} | null
    }
  ]
}

Rank by likelihood of producing useful evidence. Be specific: name actual record types, providers, queries.`;

export function createSuggestNextStepTool(db: Database) {
  return tool({
    description: 'Suggest the next 3 research moves for a thread, ranked',
    inputSchema: z.object({
      threadId: z.string().describe('The thread to suggest next steps for'),
    }),
    execute: async ({ threadId }) => {
      const thread = await getThread(db, threadId);
      if (!thread) {
        return { error: `Thread ${threadId} not found` };
      }
      const events = await getThreadTimeline(db, threadId, { limit: 30 });
      return {
        threadId,
        threadTitle: thread.title,
        status: thread.status,
        seedPersonId: (thread as any).seedPersonId ?? null,
        eventCount: events.length,
        recentEvents: events.slice(-15).map(e => ({
          eventType: e.eventType,
          reason: e.reason,
          occurredAt: e.occurredAt,
        })),
        instruction: INSTRUCTION,
      };
    },
  });
}
```

- [ ] **Step 2: Test** — modeled on summarize-thread test, asserts the result includes `instruction`, `recentEvents`, and rejects unknown thread.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @ancstra/ai test -- suggest-next-step
git add packages/ai/src/tools/research/suggest-next-step.ts \
        packages/ai/src/__tests__/suggest-next-step.test.ts
git commit -m "feat(ai): suggest_next_step tool"
```

---

## Task 8 — Register new tools in chat route + system prompt

**Files:**
- Modify: `apps/web/app/api/ai/chat/route.ts`
- Modify: `packages/ai/src/prompts/research-assistant.ts` — extend "Available Tools" section

- [ ] **Step 1: Register tools** in the `tools` map of the chat route. Pass `familyDb` to both factories — they don't need `threadId` because the tool input includes it.

```ts
import { createSummarizeThreadTool } from '@ancstra/ai/tools/research/summarize-thread';
import { createSuggestNextStepTool } from '@ancstra/ai/tools/research/suggest-next-step';
// (verify the actual @ancstra/ai barrel re-exports — may need to add)
// ...
const tools = {
  // ...existing tools...
  summarizeThread: createSummarizeThreadTool(familyDb),
  suggestNextStep: createSuggestNextStepTool(familyDb),
};
```

- [ ] **Step 2: Extend the system prompt's "Available Tools" section** in `research-assistant.ts`:

```
## Available Tools
You have access to tools for searching the local tree database, external record providers (FamilySearch, NARA, newspapers), web search, URL scraping, fact extraction, conflict detection, and relationship analysis. Use them proactively to answer questions with real data.

When a research thread is active, you can also:
- Use **summarizeThread** to write a structured markdown narrative of the journey so far.
- Use **suggestNextStep** to propose ranked next-move options when the user asks "what should I do next?"
```

- [ ] **Step 3: Typecheck + test, commit**

```bash
cd D:/projects/ancstra && pnpm --filter @ancstra/ai test && pnpm --filter @ancstra/web typecheck
git add apps/web/app/api/ai/chat/route.ts packages/ai/src/prompts/research-assistant.ts
git commit -m "feat(ai): register summarize_thread + suggest_next_step in chat route"
```

---

## Task 9 — Client chat hook sends `threadId` in body

**Files:**
- Modify: `apps/web/components/research/chat-panel.tsx`

**Why:** Server route was wired in Phase 2, but the client never sends `threadId`, so the AI never sees the active-thread block.

- [ ] **Step 1: Read `chat-panel.tsx`** — three `sendMessage(..., { body: { focusPersonId, ... } })` call sites (~lines 65, 86, 110 per the survey).

- [ ] **Step 2: Add `useActiveThread` hook**

```ts
import { useActiveThread } from '@/lib/research/active-thread';
// inside the component:
const { thread } = useActiveThread();
```

- [ ] **Step 3: Add `threadId: thread?.id ?? null` to all three `body` objects.**

- [ ] **Step 4: Update `useCallback` dependency arrays** to include `thread?.id`.

- [ ] **Step 5: Typecheck + commit**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
git add apps/web/components/research/chat-panel.tsx
git commit -m "feat(web): chat panel sends threadId so AI sees active-thread context"
```

---

## Task 10 — `useTreeOverlay(threadId)` hook

**Files:**
- Create: `apps/web/lib/research/tree-overlay.ts`

**Why:** Centralizes overlay data fetching (touched person ids + per-person event timestamps for the scrubber) for use by canvas + sidebar.

- [ ] **Step 1: Create the hook**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export interface TreeOverlayData {
  /** Set of person ids the active thread has "touched". */
  touchedPersonIds: Set<string>;
  /** Earliest occurredAt per person id (for time-scrubber filtering). */
  firstSeenAt: Map<string, string>;
}

export function useTreeOverlay(threadId: string | null) {
  const isHydrated = useIsHydrated();
  const [data, setData] = useState<TreeOverlayData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated || !threadId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/research/threads/${threadId}/persons`).then(r => r.json()),
      fetch(`/api/research/threads/${threadId}/events?limit=1000`).then(r => r.json()),
    ]).then(([personsBody, eventsBody]) => {
      if (cancelled) return;
      const touchedPersonIds = new Set<string>(personsBody.personIds ?? []);
      const firstSeenAt = new Map<string, string>();
      for (const e of (eventsBody.events ?? []) as Array<{ personId: string | null; occurredAt: string }>) {
        if (!e.personId) continue;
        const prev = firstSeenAt.get(e.personId);
        if (!prev || e.occurredAt < prev) firstSeenAt.set(e.personId, e.occurredAt);
      }
      setData({ touchedPersonIds, firstSeenAt });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isHydrated, threadId]);

  return { data, loading };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
git add apps/web/lib/research/tree-overlay.ts
git commit -m "feat(web): useTreeOverlay hook for canvas overlay data"
```

---

## Task 11 — Tree-canvas overlay rendering (highlighted/dimmed)

**Files:**
- Modify: `apps/web/components/tree/tree-canvas.tsx`
- Modify: `apps/web/components/tree/person-node.tsx` (if it doesn't already accept a `data.dimmed` prop)

**Why:** When a thread is active, persons NOT in the touched-person set get dimmed; touched persons get a subtle ring.

- [ ] **Step 1: Import overlay hook + active-thread hook in `tree-canvas.tsx`**

```tsx
import { useActiveThread } from '@/lib/research/active-thread';
import { useTreeOverlay } from '@/lib/research/tree-overlay';
// ...

const { thread } = useActiveThread();
const { data: overlay } = useTreeOverlay(thread?.id ?? null);
```

- [ ] **Step 2: Compute per-node overlay style.** When `overlay !== null`, augment each node's `data` with:

```ts
nodes.map(n => ({
  ...n,
  data: {
    ...n.data,
    threadOverlay: overlay
      ? overlay.touchedPersonIds.has(n.id) ? 'highlighted' : 'dimmed'
      : undefined,
  },
}))
```

(Implement via the existing `useMemo`/`useEffect` that computes `nodes`.)

- [ ] **Step 3: Augment edges similarly.** An edge is "touched" if BOTH endpoints are in the touched set OR the edge corresponds to a `factsheet_linked`/`mention_followed` event the thread emitted (this requires fetching link ids — defer to Phase 4 polish; v1 just uses endpoints).

- [ ] **Step 4: Modify `person-node.tsx` to render overlay state.** Add a small ring + opacity tween:

```tsx
const overlay = data.threadOverlay;
const overlayClasses =
  overlay === 'highlighted' ? 'ring-2 ring-amber-400/70'
  : overlay === 'dimmed'    ? 'opacity-40'
  : '';
// apply to outer node container className
```

(If `data.threadOverlay` typing requires updating an interface, do so.)

- [ ] **Step 5: Manual smoke test**: start the dev server, open a tree with a thread active. Verify highlighting/dimming kicks in.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/tree/tree-canvas.tsx apps/web/components/tree/person-node.tsx
git commit -m "feat(web): tree-canvas overlay highlights/dims by active thread"
```

---

## Task 12 — Time-scrubber control in tree-toolbar

**Files:**
- Modify: `apps/web/components/tree/tree-toolbar.tsx`
- Modify: `apps/web/components/tree/tree-canvas.tsx` — apply scrubber filter to `data.threadOverlay`

**Why:** Replays the thread chronologically — drag back to see the tree as it was at any earlier event.

- [ ] **Step 1: Add a `<Slider>` in the toolbar** (only render when `overlay !== null`). Position 1.0 = "now", 0.0 = before any events.

```tsx
import { Slider } from '@/components/ui/slider';
// ...
{overlay && (
  <Slider
    value={[scrubberValue]}
    min={0} max={1} step={0.01}
    onValueChange={(v) => setScrubberValue(v[0])}
    className="w-32"
  />
)}
```

State (`scrubberValue` + setter) should live in tree-canvas (or a parent) since both toolbar and canvas need it.

- [ ] **Step 2: Compute the scrubber's effective timestamp**

```ts
const effectiveTs = useMemo(() => {
  if (!overlay) return null;
  const ts = Array.from(overlay.firstSeenAt.values()).sort();
  if (ts.length === 0) return null;
  const first = ts[0];
  const last = ts[ts.length - 1];
  // Linear interpolate between first and last by scrubberValue
  const firstMs = new Date(first).getTime();
  const lastMs = new Date(last).getTime();
  return new Date(firstMs + (lastMs - firstMs) * scrubberValue).toISOString();
}, [overlay, scrubberValue]);
```

- [ ] **Step 3: Apply scrubber to overlay computation**

For each touched person, hide it if its `firstSeenAt` is later than `effectiveTs`:

```ts
const visible = overlay.touchedPersonIds.has(n.id)
  && (overlay.firstSeenAt.get(n.id) ?? '') <= (effectiveTs ?? '');
```

Set `data.threadOverlay = visible ? 'highlighted' : 'dimmed'`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/tree/tree-toolbar.tsx apps/web/components/tree/tree-canvas.tsx
git commit -m "feat(web): time-scrubber on tree-canvas filters by event occurredAt"
```

---

## Task 13 — Right-click person → "Show threads that touched this person" modal

**Files:**
- Modify: `apps/web/components/tree/tree-context-menu.tsx` — add a new menu item
- Create: `apps/web/components/research/threads/person-threads-modal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useActiveThread } from '@/lib/research/active-thread';

interface ThreadTouch {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
}

interface PersonThreadsModalProps {
  personId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PersonThreadsModal({ personId, open, onOpenChange }: PersonThreadsModalProps) {
  const [threads, setThreads] = useState<ThreadTouch[] | null>(null);
  const { setActive } = useActiveThread();

  useEffect(() => {
    if (!open || !personId) return;
    setThreads(null);
    fetch(`/api/persons/${personId}/threads`)
      .then(r => r.json())
      .then(b => setThreads(b.threads ?? []));
  }, [open, personId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Threads that touched this person</DialogTitle>
        </DialogHeader>
        {threads === null ? (
          <div className="py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" /> Loading...
          </div>
        ) : threads.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">No threads have touched this person yet.</div>
        ) : (
          <ul className="space-y-2">
            {threads.map(t => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.status} · last touched {new Date(t.lastTouchedAt).toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  className="text-xs text-amber-700 hover:underline"
                  onClick={async () => {
                    await setActive(t.id);
                    onOpenChange(false);
                  }}
                >
                  Set active
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into `tree-context-menu.tsx`**

The tree-context-menu uses next-intl, so add a translation key in `apps/web/messages/{en,ru}/tree.json` under `tree.contextMenu` for the new item label, e.g. `"showThreadsTouching": "Show research threads that touched this person"`.

Add the menu item under the node-surface branch (where person-specific actions live). On click, store the personId in component state and open the modal.

- [ ] **Step 3: Render the modal once at the top of the tree-canvas tree (or wherever the context menu lives), bound to the same person-id state.**

- [ ] **Step 4: Typecheck + commit**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
git add apps/web/components/research/threads/person-threads-modal.tsx \
        apps/web/components/tree/tree-context-menu.tsx \
        apps/web/messages/en/tree.json apps/web/messages/ru/tree.json \
        apps/web/components/tree/tree-canvas.tsx
git commit -m "feat(web): right-click \"show threads that touched this person\" modal"
```

---

## Task 14 — `Threads` tab in tree right-sidebar

**Files:**
- Modify: `apps/web/components/tree/tree-sidebar.tsx`

**Why:** Spec §5: "right side panel of the tree workspace gains a `Threads` tab — list of active/paused/resolved threads, click to set active."

- [ ] **Step 1: Read `tree-sidebar.tsx`** (62 lines per the survey — small).

- [ ] **Step 2: Add a `Threads` tab.** Reuse a Tabs component if the sidebar already uses one; if not, add a vertical sub-section that fetches `GET /api/research/threads` and renders a list with click-to-set-active behavior. Each row shows title + status + last-updated.

- [ ] **Step 3: Typecheck + commit**

```bash
git add apps/web/components/tree/tree-sidebar.tsx
git commit -m "feat(web): Threads tab in tree right-sidebar"
```

---

## Task 15 — `/research/threads/[id]` full-page route

**Files:**
- Create: `apps/web/app/[locale]/(auth)/research/threads/[id]/page.tsx`

**Why:** Phase 2's header bar links here; it currently 404s. The page is a deep-dive view per Locked Decision 6.

- [ ] **Step 1: Create the page** — server component that fetches thread + factsheets + persons via Phase 1+3 APIs, then renders client-side panels:

```tsx
import { notFound } from 'next/navigation';
import { withAuth } from '@/lib/auth/api-guard';
import { getThread } from '@ancstra/research';
import { ThreadTimelinePanel } from '@/components/research/threads/thread-timeline-panel';
// + a new <ThreadSummaryEditor> component (small) for editing thread.summary

export default async function ThreadPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  // Fetch thread + related (server-side; family-DB resolved via withAuth — but that needs request, so use a server-action or fetch via route)
  // Since this is a server component without a Request, use the central server-side helper for getting familyDb — likely via a session helper. If unclear, fetch via the API route from the server using `fetch()` with cookies forwarded.

  // Pseudocode (adapt to actual server-side data layer):
  // const thread = await getThreadServerSide(id);
  // if (!thread) notFound();

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <header>
        {/* thread title + status badge */}
      </header>
      <section>
        {/* ThreadSummaryEditor — textarea + save button -> PATCH /threads/[id] */}
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium mb-2">Timeline</h2>
          <ThreadTimelinePanel threadId={id} />
        </div>
        <div>
          <h2 className="text-sm font-medium mb-2">Related</h2>
          {/* List of factsheets created by this thread + persons it touched (call the new APIs) */}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Note**: server components in Next.js 16 with `cacheComponents` need careful handling. Use a client-component shell that fetches via the JSON APIs (simpler than figuring out the server-side family-DB resolution path). The page can be a thin server component that does `await params` and renders a `<ThreadDetailClient threadId={id} />`.

- [ ] **Step 3: Typecheck**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/[locale]/(auth)/research/threads/[id]/page.tsx" \
        apps/web/components/research/threads/
git commit -m "feat(web): /research/threads/[id] full-page route"
```

---

## Task 16 — Tree-context-menu "Start research thread" entry

**Files:**
- Modify: `apps/web/components/tree/tree-context-menu.tsx`
- Modify: `apps/web/messages/{en,ru}/tree.json` — translation key for the menu item

**Why:** Spec §3 lists three thread-start entry points; Phase 2 only built the hub-search one. This finishes the set.

- [ ] **Step 1: Add a menu item under the node-surface branch** (where person-specific actions live). Label: "Start research thread" (translated).

- [ ] **Step 2: Implement the click handler:**

```ts
async function startThreadFromPerson(personId: string, personName: string) {
  const created = await fetch('/api/research/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${personName} — research`,
      seedPersonId: personId,
    }),
  }).then(r => r.json());
  await fetch('/api/research/threads/active', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: created.id }),
  });
  window.location.href = '/research';
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/tree/tree-context-menu.tsx \
        apps/web/messages/en/tree.json apps/web/messages/ru/tree.json
git commit -m "feat(web): \"Start research thread\" entry on tree context menu"
```

---

## Task 17 — End-to-end verification + tag

- [ ] **Step 1: Full test suites**

```bash
cd D:/projects/ancstra && pnpm --filter @ancstra/research test
pnpm --filter @ancstra/ai test
```

Expected: PASS. Counts: research ~150+, ai ~70+ (with new tools tested).

- [ ] **Step 2: Repo typecheck**

```bash
pnpm typecheck
```

Confirm only pre-existing errors (admin/* i18n, auth constants). Report BLOCKED if new errors appear in Phase 3 files.

- [ ] **Step 3: Migration drift**

```bash
pnpm --filter @ancstra/db exec drizzle-kit check
```

Expected: clean (Phase 3 added enum values to TS only; no migration changes).

- [ ] **Step 4: Manual UX walkthrough**
- Start dev server. Right-click a tree person → "Start research thread". Verify sticky header bar appears.
- Open a factsheet, click a mention chip on a `spouse_name` fact. Verify the timeline picks up `factsheet_created` + `factsheet_linked` + `mention_followed` events.
- In tree-toolbar, drag the time-scrubber back. Verify nodes hide/dim accordingly.
- Right-click another person → "Show threads that touched this person". Verify modal opens.
- Right sidebar Threads tab → click a paused thread → it becomes active.
- Click the header bar's thread title → land on `/research/threads/[id]`. Verify timeline + summary editor render.
- In chat panel, ask AI: "Summarize this thread." Verify the response uses the structured-markdown format.
- Ask AI: "What should I do next?" Verify 3 ranked options come back.

- [ ] **Step 5: Tag**

```bash
git tag -a research-threads-phase3 -m "Phase 3: tree overlay, AI agent tools, full thread page"
```

---

## Task 18 — Final code review

Dispatch one Opus reviewer with the full Phase 3 commit list (since `<phase2 head>..HEAD`). Same template as Phase 1/2 final reviews:

- Strengths
- Critical / Important / Minor issues
- Spec coverage assessment
- Forward-compatibility for Phase 4 (privacy filter, multi-user, autonomous mode)
- Final verdict: APPROVED FOR MERGE / NEEDS CHANGES

Apply any Critical fixes, re-tag, re-verify.

---

## Self-Review (done inline)

**Spec coverage:**
- Spec §4 New AI tools (`summarize_thread`, `suggest_next_step`) → Tasks 6, 7, 8 ✓
- Spec §5 Tree-canvas overlay (highlight + dim) → Tasks 10, 11 ✓
- Spec §5 Time-scrubber → Task 12 ✓
- Spec §5 Right-click "show threads that touched this person" → Task 13 ✓
- Spec §5 Right-sidebar `Threads` tab → Task 14 ✓
- Spec §3 Full-page `/research/threads/[id]` → Task 15 ✓
- Phase 2 deferral: chat panel sends `threadId` → Task 9 ✓
- Phase 2 deferral: tree context-menu thread-start → Task 16 ✓
- Phase 2 review follow-up: `relationship_proposed` event type → Tasks 1, 2 ✓
- Spec implicit: `factsheet_promoted` emission for time-scrubber correctness → Task 3 ✓

**Placeholder scan:** Task 3 has a defer-if-too-heavy branch for the test setup; that's a structural recovery option, not a placeholder. Task 15's server-side data-fetch shape is acknowledged-uncertain — implementer should choose API-fetch vs server-side helper based on what works cleanly under Next.js 16 + cacheComponents.

**Type consistency:** `ThreadOverlayData` shape used consistently across Tasks 10–12. `ThreadTouchSummary` shape used across Tasks 4–5–13. `relationship_proposed` enum value defined in Task 1 and used in Task 2 — no contradiction.

**Scope check:** Phase 3 closes the spec's Phase-2/3 scope cleanly. Out-of-scope items (privacy filter, multi-user, backfill, autonomous, cases-as-container) are explicitly listed.

---

## What's NOT in Phase 3

- **Privacy filter on AI thread context** — separate design (its own ~1-task plan).
- **Multi-user collaboration UX** — separate design.
- **Backfill tool** — small standalone plan when needed.
- **Background autonomous research mode** — post-MVP enhancement.
- **`cases-as-container` alternative** — architectural pivot, not deferred work.
- **Inbox thread-start entry point** — wait for inbox UX maturity.
- **`mention_extracted` event emission** — enum is added in Task 1, but the actual emission point (when AI extraction surfaces a name) isn't wired. Either add a small follow-up task or wire it lazily when AI extraction grows a separate raw-mentions channel.
- **Edge-level overlay refinement** — Task 11's edge highlighting uses endpoint membership; deeper refinement (highlight only edges the thread *created*) requires fetching link ids and is Phase 4 polish.
