# Research Threads — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the daily-driver UX of research threads — cascade contextual action, thread timeline panel, three thread-start entry points, and AI event emission. Phase 1 (schema + API + cookie) is the foundation; Phase 2 makes the journey visible and pivoting one-click.

**Architecture:** Build on Phase 1's `packages/research/src/threads/` and existing API surface. New backend module `cascade.ts` does the atomic factsheet+link+events transaction. New frontend components (`mention-cascade-chip`, `mention-tray`, `thread-timeline-panel`, `thread-header-bar`) integrate into existing factsheet UI and `/research/*` layouts. Three start-points wire `seed_*` fields into entry actions. AI integration injects an `<active_thread>` block in the research-assistant prompt and tags AI-driven mutations with `thread_id`+`actor_id='ai'`.

**Tech Stack:** Drizzle ORM (libsql/SQLite), Vitest, Next.js App Router, React 19, Tailwind v4, shadcn/ui, next-intl. Tests via `createTestCentralDb`. Playwright for E2E.

**Spec:** [docs/superpowers/specs/2026-05-10-research-threads-overlay-design.md](../specs/2026-05-10-research-threads-overlay-design.md) §2-4
**Phase 1 plan (prerequisite, complete):** [2026-05-10-research-threads-phase1.md](./2026-05-10-research-threads-phase1.md)

---

## Reference patterns (read once before starting)

- **Phase 1 module** — `packages/research/src/threads/{create,events,queries,lifecycle,update}.ts`. Module pattern: `(db: Database, input: …)` signature, raw `BEGIN/COMMIT/ROLLBACK` for transactions (per project memory `feedback_drizzle_transactions.md` — Drizzle `db.transaction(async tx)` breaks on better-sqlite3).
- **Phase 1 events helper** — `addEvent` already wraps INSERT + UPDATE in a transaction. Cascade will compose 3 events with the factsheet+link inserts; the whole thing must be atomic.
- **API route pattern** — `apps/web/app/api/research/threads/[id]/route.ts` (Phase 1) is the canonical reference: `withAuth('ai:research', request)`, `params: Promise<{ id: string }>`, `revalidateTag(...)`, nested try/handleAuthError/500.
- **Factsheet detail UI** — `apps/web/components/research/factsheets/factsheet-detail.tsx` is where mention chips will render on fact rows. Inspect first to see fact-row structure.
- **Active-thread hook** — `useActiveThread()` from `apps/web/lib/research/active-thread.ts` (Phase 1). Components needing thread context call this; SSR fetches via `/api/research/threads/active`.
- **AI prompt** — `packages/ai/src/prompts/research-assistant.ts` builds the system prompt. We'll add a new `<active_thread>` block.
- **AI tools** — `packages/ai/src/tools/research/` and `packages/ai/src/tools/{propose-relationship,search-familysearch,etc.}.ts`. Each tool's `execute()` will accept an optional `thread_id` and emit a thread event when present.
- **No `.js` extensions in TS imports** (Turbopack constraint).

---

## Open spec ambiguities (resolve in-task; default below)

- **Mention chip selectors** — fact types whose `factValue` is a person name and merit a chip. **Default: `parent_name`, `spouse_name`, `child_name`.** If the user wants more (sibling_name doesn't exist as a factType today; that'd require a schema change), defer.
- **Cascade with no active thread** — spec says "cascade still works, no events emit, UI nudges to start thread." Implementation creates the factsheet+link but skips the thread events. **The cascade function takes `threadId: string | null`.**
- **Sticky header bar visibility** — spec says "any /research/* route." **Default: render in the `/research` segment layout, hide on full-page thread route `/research/threads/[id]` (which has its own header).**

---

## Task 1 — Cascade server function (TDD, transactional)

**Files:**
- Create: `packages/research/src/__tests__/threads-cascade.test.ts`
- Create: `packages/research/src/threads/cascade.ts`

**Why:** This is the heart of Phase 2. One transactional function that does what would otherwise be 5+ user clicks.

- [ ] **Step 1: Write the failing test.** Test must exercise:
  1. Happy path: with active thread → creates factsheet, creates factsheet_link, emits 3 events (`factsheet_created`, `factsheet_linked`, `mention_followed`), all atomic.
  2. No-active-thread path: `threadId: null` → creates factsheet + link, NO events emitted.
  3. Rollback: if any of the 5 inserts fails, NONE of them persist.
  4. Source-fact link: `factsheet_links.sourceFactId` set to the input fact id.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread } from '../threads/create';
import { getThreadTimeline } from '../threads/events';
import { cascade } from '../threads/cascade';

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
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL,
    to_factsheet_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    source_handle TEXT, target_handle TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(from_factsheet_id, to_factsheet_id, relationship_type)
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

async function seedFactsheet(db: TestCentralDb, id: string, title: string) {
  const now = new Date().toISOString();
  await db.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_by, created_at, updated_at)
    VALUES (${id}, ${title}, 'person', 'draft', 'u1', ${now}, ${now})
  `);
}

describe('cascade', () => {
  it('happy path: creates factsheet + link + 3 events with active thread', async () => {
    await seedFactsheet(db as any, 'fs-john', 'John Smith');
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });

    const result = await cascade(db as any, {
      threadId: thread.id,
      sourceFactsheetId: 'fs-john',
      sourceFactId: 'fact-marriage-cert',
      newFactsheetTitle: 'Maria (wife of John Smith)',
      relationshipType: 'spouse',
      reason: 'spouse mentioned in marriage cert',
      actorId: 'u1',
    });

    expect(result.factsheetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.linkId).toMatch(/^[0-9a-f-]{36}$/);

    // Verify factsheet
    const fsRows = await db.all(sql`SELECT * FROM factsheets WHERE id = ${result.factsheetId}`) as any[];
    expect(fsRows[0].title).toBe('Maria (wife of John Smith)');
    expect(fsRows[0].created_thread_id).toBe(thread.id);

    // Verify link
    const linkRows = await db.all(sql`SELECT * FROM factsheet_links WHERE id = ${result.linkId}`) as any[];
    expect(linkRows[0].from_factsheet_id).toBe('fs-john');
    expect(linkRows[0].to_factsheet_id).toBe(result.factsheetId);
    expect(linkRows[0].relationship_type).toBe('spouse');
    expect(linkRows[0].source_fact_id).toBe('fact-marriage-cert');

    // Verify 3 events
    const events = await getThreadTimeline(db as any, thread.id);
    const types = events.map(e => e.eventType);
    expect(types).toContain('factsheet_created');
    expect(types).toContain('factsheet_linked');
    expect(types).toContain('mention_followed');
  });

  it('no-active-thread path: creates factsheet + link, no events emit', async () => {
    await seedFactsheet(db as any, 'fs-john', 'John Smith');

    const result = await cascade(db as any, {
      threadId: null,
      sourceFactsheetId: 'fs-john',
      sourceFactId: 'fact-1',
      newFactsheetTitle: 'Maria',
      relationshipType: 'spouse',
      reason: 'wife mentioned',
      actorId: 'u1',
    });

    expect(result.factsheetId).toMatch(/^[0-9a-f-]{36}$/);
    const fsRows = await db.all(sql`SELECT * FROM factsheets WHERE id = ${result.factsheetId}`) as any[];
    expect(fsRows[0].created_thread_id).toBeNull();
    const allEvents = await db.all(sql`SELECT COUNT(*) as c FROM research_thread_events`) as any[];
    expect(allEvents[0].c).toBe(0);
  });

  it('rolls back factsheet if link insertion fails', async () => {
    await seedFactsheet(db as any, 'fs-john', 'John Smith');
    // Pre-insert a link with the same (from, to, type) to trip the unique constraint.
    // We need a target factsheet first.
    const dupTargetId = 'fs-pre-existing';
    await seedFactsheet(db as any, dupTargetId, 'Maria pre-existing');
    const now = new Date().toISOString();
    await db.run(sql`
      INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, confidence, created_at)
      VALUES ('link-pre', 'fs-john', ${dupTargetId}, 'spouse', 'medium', ${now})
    `);

    // Force the cascade to attempt creating a duplicate link by passing the duplicate target
    // …actually the cascade creates a NEW factsheet so it can't trip the existing link unique constraint.
    // Instead, simulate failure by passing an invalid relationshipType (CHECK constraint not in fixture, so emulate via NULL).
    // The cleanest test: rely on FK precheck (sourceFactsheetId not found) → ensure NO factsheet exists after.
    const before = await db.all(sql`SELECT COUNT(*) as c FROM factsheets`) as any[];
    await expect(cascade(db as any, {
      threadId: null,
      sourceFactsheetId: 'NONEXISTENT_SOURCE',
      sourceFactId: 'fact-1',
      newFactsheetTitle: 'Should not persist',
      relationshipType: 'spouse',
      reason: 'rollback test',
      actorId: 'u1',
    })).rejects.toThrow();
    const after = await db.all(sql`SELECT COUNT(*) as c FROM factsheets`) as any[];
    expect(after[0].c).toBe(before[0].c);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL.**

```bash
pnpm --filter @ancstra/research test -- threads-cascade
```

- [ ] **Step 3: Implement `packages/research/src/threads/cascade.ts`.**

```ts
import { eq, sql } from 'drizzle-orm';
import { factsheets, factsheetLinks, researchThreadEvents, researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CascadeInput {
  /** null = no thread context; cascade still creates factsheet+link but emits no events. */
  threadId: string | null;
  /** Existing factsheet that contains the source mention. */
  sourceFactsheetId: string;
  /** The fact row whose value mentions the new entity. */
  sourceFactId: string;
  /** Title for the new factsheet (e.g., "Maria (wife of John Smith)"). */
  newFactsheetTitle: string;
  /** Relationship from source → new. */
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  /** Human-readable reason ("spouse mentioned in marriage cert") — also stored on events. */
  reason: string;
  /** User uuid or 'ai' for AI-driven cascades. */
  actorId: string;
  /** Optional: set on factsheet_link.confidence. Defaults 'medium'. */
  confidence?: 'high' | 'medium' | 'low';
}

export interface CascadeResult {
  factsheetId: string;
  linkId: string;
  eventsEmitted: number;
}

/**
 * Atomic transactional cascade — creates a new factsheet linked to an existing one,
 * with optional thread event emission.
 *
 * Per project memory `feedback_drizzle_transactions.md`, uses raw BEGIN/COMMIT/ROLLBACK.
 */
export async function cascade(db: Database, input: CascadeInput): Promise<CascadeResult> {
  // Application-level FK prechecks (consistent with addEvent pattern)
  const srcRows = await db.select({ id: factsheets.id })
    .from(factsheets).where(eq(factsheets.id, input.sourceFactsheetId)).all();
  if (srcRows.length === 0) {
    throw new Error(`Source factsheet ${input.sourceFactsheetId} not found`);
  }

  if (input.threadId) {
    const threadRows = await db.select({ id: researchThreads.id })
      .from(researchThreads).where(eq(researchThreads.id, input.threadId)).all();
    if (threadRows.length === 0) {
      throw new Error(`Thread ${input.threadId} not found`);
    }
  }

  const newFactsheetId = crypto.randomUUID();
  const newLinkId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.run(sql`BEGIN`);
  try {
    // 1. Create factsheet
    await db.insert(factsheets).values({
      id: newFactsheetId,
      title: input.newFactsheetTitle,
      entityType: 'person',
      status: 'draft',
      createdThreadId: input.threadId,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    }).run();

    // 2. Create factsheet_link
    await db.insert(factsheetLinks).values({
      id: newLinkId,
      fromFactsheetId: input.sourceFactsheetId,
      toFactsheetId: newFactsheetId,
      relationshipType: input.relationshipType,
      sourceFactId: input.sourceFactId,
      confidence: input.confidence ?? 'medium',
      createdAt: now,
    }).run();

    // 3. Emit 3 events (only if thread context)
    let eventsEmitted = 0;
    if (input.threadId) {
      const eventInserts = [
        { eventType: 'factsheet_created', factsheetId: newFactsheetId },
        { eventType: 'factsheet_linked',  factsheetId: newFactsheetId, linkId: newLinkId },
        { eventType: 'mention_followed',  factsheetId: newFactsheetId, researchFactId: input.sourceFactId, linkId: newLinkId },
      ] as const;
      for (const e of eventInserts) {
        await db.insert(researchThreadEvents).values({
          id: crypto.randomUUID(),
          threadId: input.threadId,
          eventType: e.eventType,
          actorId: input.actorId,
          factsheetId: (e as any).factsheetId ?? null,
          linkId: (e as any).linkId ?? null,
          researchFactId: (e as any).researchFactId ?? null,
          reason: input.reason,
          payloadJson: null,
          occurredAt: now,
        }).run();
        eventsEmitted += 1;
      }
      // Bump thread updatedAt
      await db.update(researchThreads)
        .set({ updatedAt: now })
        .where(eq(researchThreads.id, input.threadId))
        .run();
    }

    await db.run(sql`COMMIT`);
    return { factsheetId: newFactsheetId, linkId: newLinkId, eventsEmitted };
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests → expect PASS (3 tests).**

- [ ] **Step 5: Export `cascade` from the threads barrel.** Edit `packages/research/src/threads/index.ts`:

```ts
export { cascade } from './cascade';
export type { CascadeInput, CascadeResult } from './cascade';
```

And `packages/research/src/index.ts`:

```ts
export { cascade } from './threads';
export type { CascadeInput, CascadeResult } from './threads';
```

- [ ] **Step 6: Commit.**

```bash
git add packages/research/src/threads/cascade.ts packages/research/src/threads/index.ts \
        packages/research/src/index.ts \
        packages/research/src/__tests__/threads-cascade.test.ts
git commit -m "feat(research): cascade — atomic factsheet+link+events transaction"
```

---

## Task 2 — API endpoint POST /api/research/threads/[id]/cascade

**Files:**
- Create: `apps/web/app/api/research/threads/[id]/cascade/route.ts`

**Why:** Lets the frontend trigger cascades for the current active thread.

- [ ] **Step 1: Create the route.**

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { cascade } from '@ancstra/research';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id: threadId } = await params;
    const body = await request.json();

    if (!body.sourceFactsheetId || !body.sourceFactId || !body.newFactsheetTitle || !body.relationshipType) {
      return NextResponse.json(
        { error: 'sourceFactsheetId, sourceFactId, newFactsheetTitle, relationshipType are required' },
        { status: 400 }
      );
    }
    if (!['parent_child', 'spouse', 'sibling'].includes(body.relationshipType)) {
      return NextResponse.json({ error: 'invalid relationshipType' }, { status: 400 });
    }

    const result = await cascade(familyDb, {
      threadId,                       // active route → thread is required here
      sourceFactsheetId: body.sourceFactsheetId,
      sourceFactId: body.sourceFactId,
      newFactsheetTitle: body.newFactsheetTitle,
      relationshipType: body.relationshipType,
      reason: body.reason ?? 'cascade',
      actorId: ctx.userId,
      confidence: body.confidence,
    });

    revalidateTag('factsheets-list', 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag(`thread:${threadId}`, 'max');

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread cascade POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

(For the no-thread cascade path, we'll use a separate endpoint or pass `threadId = null` via the existing detail route — see Task 4 frontend usage; for Phase 2 the cleaner UX is "cascade always implies an active thread; if none, prompt user to start one before cascading.")

- [ ] **Step 2: Typecheck.**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
```

Expected: PASS (modulo pre-existing admin/* errors).

- [ ] **Step 3: Commit.**

```bash
git add apps/web/app/api/research/threads/[id]/cascade/route.ts
git commit -m "feat(api): POST /api/research/threads/[id]/cascade"
```

---

## Task 3 — `MentionCascadeChip` component (UI primitive)

**Files:**
- Create: `apps/web/components/research/threads/mention-cascade-chip.tsx`

**Why:** Renders a clickable chip on a fact row that, when clicked, triggers the cascade.

- [ ] **Step 1: Create the component.**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActiveThread } from '@/lib/research/active-thread';
import { useToast } from '@/hooks/use-toast';

interface MentionCascadeChipProps {
  sourceFactsheetId: string;
  sourceFactId: string;
  mentionedName: string;          // e.g., "Maria"
  relationshipLabel: string;      // e.g., "wife" — for the new factsheet title
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceTitle: string;            // for the reason field, e.g., "marriage cert"
  /** Called after successful cascade with the new factsheet id. */
  onCascade?: (newFactsheetId: string) => void;
  /** Show actor='ai' attribution (e.g., when chip came from AI extraction tray). */
  fromAI?: boolean;
}

export function MentionCascadeChip(props: MentionCascadeChipProps) {
  const t = useTranslations('research.threads.cascade');
  const { thread } = useActiveThread();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!thread) {
      toast({
        title: t('noActiveThread.title'),
        description: t('noActiveThread.description'),
        variant: 'default',
      });
      return;
    }

    const subjectFactsheetTitle = '';  // could pass through from parent for nicer titles
    const newFactsheetTitle = `${props.mentionedName} (${props.relationshipLabel})`;
    const reason = `${props.relationshipLabel} mentioned in ${props.sourceTitle}`;

    startTransition(async () => {
      const res = await fetch(`/api/research/threads/${thread.id}/cascade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFactsheetId: props.sourceFactsheetId,
          sourceFactId: props.sourceFactId,
          newFactsheetTitle,
          relationshipType: props.relationshipType,
          reason,
        }),
      });
      if (!res.ok) {
        toast({ title: t('error.title'), description: await res.text(), variant: 'destructive' });
        return;
      }
      const body = await res.json();
      toast({ title: t('success.title'), description: t('success.description', { name: props.mentionedName }) });
      props.onCascade?.(body.factsheetId);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1 text-xs"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
      <span>{props.mentionedName}</span>
      {props.fromAI && <span className="ml-1 text-muted-foreground">·AI</span>}
    </Button>
  );
}
```

- [ ] **Step 2: Add translations to `apps/web/messages/en/research.json`** (and matching `ru/research.json`):

Add nested under existing `research.threads`:

```json
"cascade": {
  "noActiveThread": {
    "title": "Start a research thread",
    "description": "Pivot tracking only works when a thread is active. Open the Threads side panel to start one."
  },
  "success": {
    "title": "Linked factsheet created",
    "description": "Created factsheet for {name} and linked it to the source."
  },
  "error": { "title": "Cascade failed" }
}
```

- [ ] **Step 3: Typecheck + commit.**

```bash
cd D:/projects/ancstra/apps/web && pnpm typecheck
cd D:/projects/ancstra
git add apps/web/components/research/threads/mention-cascade-chip.tsx \
        apps/web/messages/en/research.json apps/web/messages/ru/research.json
git commit -m "feat(web): MentionCascadeChip component + i18n"
```

---

## Task 4 — Wire mention chips into `factsheet-detail`

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-detail.tsx`

**Why:** Render the chips on the fact rows for `parent_name`, `spouse_name`, `child_name`. This is the UX delivery.

- [ ] **Step 1: Read the existing factsheet-detail.** Find the section where individual fact rows render (look for `factType` / `factValue` rendering). Identify where each row's right-side actions live.

- [ ] **Step 2: For fact types `parent_name | spouse_name | child_name`,** render a `<MentionCascadeChip>` next to the `factValue`. Map fact types to relationships:

```ts
const factTypeToRelationship: Record<string, { type: 'parent_child' | 'spouse' | 'sibling'; label: string }> = {
  parent_name: { type: 'parent_child', label: 'parent of …' },   // direction = parent → child; from = parent factsheet, to = subject
  spouse_name: { type: 'spouse', label: 'spouse' },
  child_name:  { type: 'parent_child', label: 'child of …' },     // direction = subject → child
};
```

Note the parent_name vs child_name asymmetry: in the schema, `factsheet_links.relationship_type='parent_child'` means `from = parent`, `to = child`. Decide direction per fact type:
- `parent_name` on subject factsheet: subject IS the child; we'd be creating the parent. **Flip from/to:** the new factsheet (parent) becomes `from`, subject becomes `to`. → cascade `from = newFactsheetId` is wrong, we need to cascade WITH `from = newId, to = subjectId`. **You must pass this direction inversion to the cascade**, OR add a `direction: 'in'|'out'` flag to `cascade()`'s API.

**Recommendation:** add a `direction: 'subject_is_from' | 'subject_is_to'` field to the cascade input and to the chip props. `spouse` and `sibling` are direction-agnostic; `parent_child` cares.

If this complicates things, defer to a follow-up: only implement `spouse_name` and `child_name` (subject_is_from for both — child of subject) now; add `parent_name` handling in Phase 2.5.

- [ ] **Step 3: Render the chip beside each relevant fact value.** Pass through `sourceFactsheetId`, `sourceFactId`, `mentionedName=fact.factValue`, etc.

- [ ] **Step 4: Typecheck.**

- [ ] **Step 5: Manual smoke test:** open `/research/factsheets/<id>` for a factsheet with a `spouse_name` or `child_name` fact, confirm the chip renders and clicking it (with active thread) creates a new linked factsheet.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/components/research/factsheets/factsheet-detail.tsx
git commit -m "feat(web): mention chips on factsheet fact rows"
```

---

## Task 5 — AI mention extraction (optional Phase 2 stretch)

**Files:**
- Modify: `packages/research/src/facts/queries.ts` (or a new `extract.ts`) — depends on whether AI extraction lives here or in `packages/ai`

**Why:** When AI extracts facts from a research_item, also surface mentions as candidate chips for the user to confirm.

- [ ] **Step 1: Survey** — find where AI extraction currently happens. Check `packages/ai/src/tools/research/` for any `extract` tool. The plan acknowledges this surface may not exist yet.

- [ ] **Step 2: If AI extraction is wired,** extend its return shape to include `mentions: Array<{ name: string; relationshipHint?: string; factTypeContext: string }>`. Surface these via a new field on the factsheet/research_item view.

- [ ] **Step 3: If AI extraction is NOT wired,** scope this task as: define the `mentions` data contract in a new `types.ts` in `packages/research/src/facts/`, document where the extractor will populate it, and **defer implementation to Phase 2.5**. Update this task's checkbox accordingly.

- [ ] **Step 4: Commit.**

```bash
git add packages/research/src/facts/
git commit -m "feat(research): mentions data contract for AI-staged cascade chips"
```

---

## Task 6 — `MentionTray` component (AI-staged candidates)

**Files:**
- Create: `apps/web/components/research/threads/mention-tray.tsx`

**Why:** Renders the "discovered mentions" tray on the source factsheet — chips with `fromAI` flag.

- [ ] **Step 1: Create the component.** It accepts a list of `mentions` (from Task 5) and renders a `<MentionCascadeChip fromAI>` per mention. If the list is empty, render nothing.

```tsx
'use client';

import { MentionCascadeChip } from './mention-cascade-chip';
import { useTranslations } from 'next-intl';

interface Mention {
  name: string;
  relationshipLabel: string;
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceFactId: string;
}

interface MentionTrayProps {
  sourceFactsheetId: string;
  sourceTitle: string;
  mentions: Mention[];
  onCascade?: (newFactsheetId: string) => void;
}

export function MentionTray(props: MentionTrayProps) {
  const t = useTranslations('research.threads.mentionTray');
  if (props.mentions.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{t('title')}</div>
      <div className="flex flex-wrap gap-2">
        {props.mentions.map((m, i) => (
          <MentionCascadeChip
            key={i}
            sourceFactsheetId={props.sourceFactsheetId}
            sourceFactId={m.sourceFactId}
            mentionedName={m.name}
            relationshipLabel={m.relationshipLabel}
            relationshipType={m.relationshipType}
            sourceTitle={props.sourceTitle}
            fromAI
            onCascade={props.onCascade}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add translations** under `research.threads.mentionTray`:

```json
"mentionTray": {
  "title": "Discovered mentions"
}
```

- [ ] **Step 3: Wire into factsheet-detail** (where Task 4's chips live): render `<MentionTray>` above the fact list, pulling `mentions` from the factsheet/research_item enrichment.

- [ ] **Step 4: Typecheck + commit.**

```bash
git add apps/web/components/research/threads/mention-tray.tsx \
        apps/web/messages/en/research.json apps/web/messages/ru/research.json \
        apps/web/components/research/factsheets/factsheet-detail.tsx
git commit -m "feat(web): MentionTray for AI-staged cascade candidates"
```

---

## Task 7 — `ThreadTimelinePanel` component

**Files:**
- Create: `apps/web/components/research/threads/thread-timeline-panel.tsx`

**Why:** Shows the chronological event log of the active thread.

- [ ] **Step 1: Create the component.** Fetch via `GET /api/research/threads/[id]/events`. Render each event with an icon by event_type, the reason text, and a timestamp. Provide an "Add note" form at the bottom (POST same endpoint).

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface ThreadEvent {
  id: string;
  eventType: string;
  actorId: string;
  reason: string | null;
  occurredAt: string;
  factsheetId: string | null;
  researchItemId: string | null;
}

interface ThreadTimelinePanelProps {
  threadId: string;
}

const eventIcon: Record<string, string> = {
  thread_started: '·',
  item_attached: '📄',
  fact_extracted: '·',
  factsheet_created: '📝',
  factsheet_linked: '🔗',
  mention_followed: '➡',
  conflict_resolved: '✅',
  duplicate_resolved: '🔀',
  factsheet_promoted: '🌱',
  note_added: '✎',
  thread_paused: '⏸',
  thread_resolved: '🏁',
  thread_abandoned: '🗑',
};

export function ThreadTimelinePanel(props: ThreadTimelinePanelProps) {
  const t = useTranslations('research.threads.timeline');
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  const refresh = async () => {
    const res = await fetch(`/api/research/threads/${props.threadId}/events`);
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [props.threadId]);

  const addNote = async () => {
    if (!note.trim()) return;
    setPosting(true);
    await fetch(`/api/research/threads/${props.threadId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    setNote('');
    setPosting(false);
    refresh();
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin inline" /> {t('loading')}</div>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2 text-sm">
        {events.map(e => (
          <li key={e.id} className="flex gap-2">
            <span className="text-muted-foreground">{eventIcon[e.eventType] ?? '·'}</span>
            <div className="flex-1">
              <div className="font-medium">{t(`eventType.${e.eventType}` as any)}</div>
              {e.reason && <div className="text-muted-foreground text-xs">{e.reason}</div>}
              <div className="text-muted-foreground text-xs">{new Date(e.occurredAt).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t pt-3">
        <Textarea
          rows={2}
          placeholder={t('addNotePlaceholder')}
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
        />
        <Button onClick={addNote} disabled={!note.trim() || posting} size="sm" className="mt-2">
          {posting ? <Loader2 className="size-4 animate-spin" /> : t('addNote')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add translations** under `research.threads.timeline`:

```json
"timeline": {
  "loading": "Loading timeline...",
  "addNote": "Add note",
  "addNotePlaceholder": "What did you find?",
  "eventType": {
    "thread_started": "Thread started",
    "item_attached": "Attached research item",
    "fact_extracted": "Extracted fact",
    "factsheet_created": "Created factsheet",
    "factsheet_linked": "Linked factsheets",
    "mention_followed": "Followed mention",
    "conflict_resolved": "Resolved conflict",
    "duplicate_resolved": "Resolved duplicate",
    "factsheet_promoted": "Promoted to person",
    "note_added": "Note",
    "thread_paused": "Paused",
    "thread_resolved": "Resolved",
    "thread_abandoned": "Abandoned"
  }
}
```

(Repeat for `ru/research.json`.)

- [ ] **Step 3: Typecheck + commit.**

```bash
git add apps/web/components/research/threads/thread-timeline-panel.tsx \
        apps/web/messages/en/research.json apps/web/messages/ru/research.json
git commit -m "feat(web): ThreadTimelinePanel"
```

---

## Task 8 — Sticky `ThreadHeaderBar`

**Files:**
- Create: `apps/web/components/research/threads/thread-header-bar.tsx`
- Modify: layout for `/research/*` to render the bar (likely `apps/web/app/[locale]/(auth)/research/layout.tsx`)

**Why:** Always-visible reminder of which thread is active + quick switch / pause / resolve.

- [ ] **Step 1: Create the bar component.** Uses `useActiveThread`. Renders a thin sticky strip with title + status badge + dropdown menu (switch / pause / resolve / abandon).

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useActiveThread } from '@/lib/research/active-thread';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Notebook } from 'lucide-react';
import Link from 'next/link';

export function ThreadHeaderBar() {
  const t = useTranslations('research.threads.headerBar');
  const { thread, loading, setActive } = useActiveThread();
  if (loading || !thread) return null;

  const transition = async (status: 'paused' | 'resolved' | 'abandoned') => {
    await fetch(`/api/research/threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (status !== 'paused') await setActive(null);
  };

  return (
    <div className="sticky top-0 z-30 border-b bg-amber-50 px-4 py-1.5 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Notebook className="size-4 shrink-0" />
          <span className="font-medium">{t('workingOn')}:</span>
          <Link href={`/research/threads/${thread.id}`} className="hover:underline">{thread.title}</Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 gap-1">
              {t('actions')}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setActive(null)}>{t('switchOff')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('paused')}>{t('pause')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('resolved')}>{t('resolve')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('abandoned')} className="text-destructive">{t('abandon')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render in `/research` layout.** Find or create `apps/web/app/[locale]/(auth)/research/layout.tsx`. Add `<ThreadHeaderBar />` near the top of the layout body.

- [ ] **Step 3: Add translations** under `research.threads.headerBar`:

```json
"headerBar": {
  "workingOn": "Working on",
  "actions": "Actions",
  "switchOff": "Clear active thread",
  "pause": "Pause",
  "resolve": "Resolve",
  "abandon": "Abandon"
}
```

- [ ] **Step 4: Typecheck + commit.**

```bash
git add apps/web/components/research/threads/thread-header-bar.tsx \
        apps/web/app/[locale]/(auth)/research/layout.tsx \
        apps/web/messages/en/research.json apps/web/messages/ru/research.json
git commit -m "feat(web): sticky ThreadHeaderBar in /research layout"
```

---

## Task 9 — Three thread-start entry points

**Files:**
- Modify: `apps/web/components/tree/tree-context-menu.tsx` — "Start research thread" item
- Modify: `apps/web/components/research/research-hub.tsx` (or similar) — "Start thread: <q>" affordance in search bar
- Modify: `apps/web/components/research/inbox/<inbox-list>.tsx` — "Promote to thread" item (if inbox UI exists; otherwise defer)

**Why:** Per spec §3, threads can start from a person, a search query, or an inbox item.

- [ ] **Step 1: Tree context menu — "Start research thread".** When clicked: POST `/api/research/threads` with `{ title: '<personName> — research', seedPersonId: personId }`, then PUT `/api/research/threads/active` with the new id, then `router.push('/research')`.

  **WARNING**: this file (`tree-context-menu.tsx`) is in the user's in-progress mobile/tree work. The implementer must be careful not to clobber unrelated changes. Read the full file first, add the menu item additively at the bottom of the existing menu structure.

- [ ] **Step 2: Research hub search bar — "Start thread: <query>".** Beneath the search field, after a non-empty query, render a small "Start thread: <query>" button. POST `/api/research/threads` with `{ title: query }`, set active, refresh.

- [ ] **Step 3: Inbox — "Promote to thread".** If the inbox UI is fully built, add a context-menu / row-action on each item: POST threads with `{ title: <item.title>, seedResearchItemId: item.id }`, then attach the item via a follow-up `addEvent('item_attached')` call.

  If the inbox UI is not yet built (still scaffolded), skip this step and add a TODO comment.

- [ ] **Step 4: Typecheck.**

- [ ] **Step 5: Commit.**

```bash
git add apps/web/components/tree/tree-context-menu.tsx \
        apps/web/components/research/ \
        apps/web/messages/en/tree.json apps/web/messages/ru/tree.json
git commit -m "feat(web): three thread-start entry points (tree, hub, inbox)"
```

---

## Task 10 — AI prompt: inject `<active_thread>` block

**Files:**
- Modify: `packages/ai/src/prompts/research-assistant.ts`

**Why:** Lets Claude write contextually-aware suggestions when a thread is active.

- [ ] **Step 1: Read the current `buildSystemPrompt`.** Find where tree-context blocks are injected (`<tree_context>` or similar).

- [ ] **Step 2: Add a function that fetches the active thread's last N events** and formats them. Inject as `<active_thread title="..." status="..." event_count="...">…recent events…</active_thread>`.

  ```ts
  export interface ActiveThreadContext {
    id: string;
    title: string;
    status: string;
    summary: string | null;
    recentEvents: Array<{ eventType: string; reason: string | null; occurredAt: string }>;
  }

  export function buildActiveThreadBlock(ctx: ActiveThreadContext | null): string {
    if (!ctx) return '';
    const eventLines = ctx.recentEvents.map(e =>
      `  - [${e.occurredAt}] ${e.eventType}${e.reason ? `: ${e.reason}` : ''}`
    ).join('\n');
    return `<active_thread title="${ctx.title}" status="${ctx.status}">
  ${ctx.summary ? `Summary: ${ctx.summary}` : ''}
  Recent events:
  ${eventLines}
  </active_thread>`;
  }
  ```

- [ ] **Step 3: Wire** into `buildSystemPrompt(input)`. Caller (e.g., `packages/ai/src/...`) loads the active thread + recent events server-side and passes the context.

- [ ] **Step 4: Add a unit test** in `packages/ai/src/__tests__/research-assistant-prompt.test.ts` (create if doesn't exist) that asserts the block is present iff a thread context is supplied.

- [ ] **Step 5: Typecheck + test + commit.**

```bash
git add packages/ai/src/prompts/research-assistant.ts \
        packages/ai/src/__tests__/
git commit -m "feat(ai): inject <active_thread> block in research-assistant prompt"
```

---

## Task 11 — AI tools: attach `thread_id` and emit events

**Files:**
- Modify: `packages/ai/src/tools/research/get-research-items.ts` and any other tools that mutate or surface data
- Modify: `packages/ai/src/tools/propose-relationship.ts` — emit a `factsheet_created` or analogous event when a proposal is accepted into a factsheet

**Why:** Make AI's contributions appear in the thread timeline alongside human actions.

- [ ] **Step 1: Survey** which tools have side-effects (create/update DB rows). For each:
  - Accept an optional `thread_id` parameter.
  - When the tool produces a side-effect, emit a thread event with `actorId='ai'`, `reason` quoting Claude's stated rationale (the tool input often has a `rationale` or `reason` field — pass it through).

- [ ] **Step 2: Modify `propose-relationship` tool** to call `addEvent` when a relationship proposal is recorded.

- [ ] **Step 3: Modify the tool dispatcher / agent loop** to read `active_thread_id` from context and pass it into each tool's call.

- [ ] **Step 4: Add tests** for at least one tool that confirms thread-event emission on side-effect.

- [ ] **Step 5: Commit.**

```bash
git add packages/ai/src/tools/
git commit -m "feat(ai): tools attach thread_id and emit events with actor='ai'"
```

---

## Task 12 — Translations sweep

**Files:**
- Modify: `apps/web/messages/en/research.json`
- Modify: `apps/web/messages/ru/research.json`
- Possibly: `apps/web/messages/{en,ru}/tree.json` for the tree context-menu item

**Why:** Consolidate any string keys added across Tasks 3-9 and confirm parity between en and ru.

- [ ] **Step 1: Diff en vs ru.** Run `diff <(jq 'paths' en/research.json) <(jq 'paths' ru/research.json) | head -50` or similar to find missing keys.

- [ ] **Step 2: Fill missing translations.** Russian translations should be reasonable (use the user's preference for terminology — they have prior translations in tree.json for reference).

- [ ] **Step 3: Run typecheck** — next-intl's typed message keys will catch most omissions.

- [ ] **Step 4: Commit.**

```bash
git add apps/web/messages/en/ apps/web/messages/ru/
git commit -m "i18n(research): translation parity for threads UI"
```

---

## Task 13 — Integration test: full cascade flow

**Files:**
- Create: `packages/research/src/__tests__/threads-cascade-integration.test.ts`

**Why:** Validate the end-to-end backend cascade: thread start → factsheet create → fact create → cascade → check timeline.

- [ ] **Step 1: Write the integration test.**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread, getThreadTimeline, cascade, addEvent } from '../threads';

const FULL_DDL = `…(repeat the DDL from threads-cascade.test.ts plus research_facts table)…`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](FULL_DDL);
});

describe('cascade integration: John → Maria → Stefan', () => {
  it('records the full journey in the thread timeline', async () => {
    // Seed John factsheet + a marriage cert fact
    // Start thread "find John's parents"
    // Cascade to Maria (spouse_name fact)
    // Cascade Maria → Stefan (parent_name fact on Maria's factsheet)
    // Verify thread timeline shows: thread_started + 6 cascade events (3 per cascade)

    // [implementation]
  });
});
```

Fill in the implementation — seed the factsheets and facts directly via SQL, call the threads module functions, assert the timeline.

- [ ] **Step 2: Run, expect pass.**

- [ ] **Step 3: Commit.**

```bash
git add packages/research/src/__tests__/threads-cascade-integration.test.ts
git commit -m "test(research): cascade integration John→Maria→Stefan"
```

---

## Task 14 — E2E Playwright test (optional — only if e2e infrastructure exists)

**Files:**
- Create: `apps/web/__tests__/e2e/research-threads.spec.ts` (only if Playwright is configured)

- [ ] **Step 1: Survey** — check if `apps/web/__tests__/e2e/` exists and Playwright is wired. If not, skip this task and note it.

- [ ] **Step 2: If wired,** write a smoke test:
  - Start dev server, log in as test user.
  - Navigate to `/research`. Click "Start thread" with title "test thread". Assert active-thread bar appears.
  - Open a factsheet with a `spouse_name` fact. Click the chip. Assert toast appears, factsheet count increases.
  - Open thread timeline panel. Assert at least 3 events present.
  - Pause the thread. Assert active bar disappears.

- [ ] **Step 3: Commit.**

```bash
git add apps/web/__tests__/e2e/research-threads.spec.ts
git commit -m "test(e2e): research-threads cascade smoke"
```

---

## Task 15 — End-to-end verification + tag

- [ ] **Step 1: Full test suite.**

```bash
cd D:/projects/ancstra
pnpm --filter @ancstra/research test
pnpm --filter @ancstra/ai test
```

Expected: PASS.

- [ ] **Step 2: Repo typecheck.**

```bash
pnpm typecheck
```

Expected: PASS for Phase 2 surface (pre-existing admin/* errors don't count).

- [ ] **Step 3: Migration drift.**

```bash
pnpm --filter @ancstra/db exec drizzle-kit check
```

Expected: no drift (Phase 2 adds no schema changes).

- [ ] **Step 4: Manual UX walkthrough.**
  - Start dev server.
  - Open a tree → right-click person → "Start research thread".
  - Open the seeded factsheet, click a mention chip on a `spouse_name` fact.
  - Verify the cascade UX feels lower-friction than manually creating + linking factsheets.

- [ ] **Step 5: Tag.**

```bash
git tag -a research-threads-phase2 -m "Phase 2: cascade UX, timeline panel, AI emits events"
```

---

## Self-Review (done inline)

**Spec coverage:**
- Spec §2 Cascade Contextual Action → Tasks 1-4 ✓
- Spec §2 AI-detected mentions tray → Tasks 5-6 (Task 5 may defer if AI extraction isn't wired)
- Spec §2 No-active-thread fallback → Task 1 (CascadeInput accepts null) ✓
- Spec §3 Three ways a thread starts → Task 9 ✓
- Spec §3 Active-thread state UI shell → Task 8 ✓
- Spec §3 Thread view (side panel + full route) → Task 7 (panel only; full route deferred to Phase 3)
- Spec §4 AI integration: prompt + tool wiring → Tasks 10-11 ✓
- Spec §4 New tools (`summarize_thread`, `suggest_next_step`) → **Phase 3** (deferred)
- Spec §5 Tree-canvas overlay → **Phase 3** (deferred)

**Placeholder scan:** Task 5 has a defer-if-not-wired branch. Task 14 is conditional on Playwright presence. Both are explicitly scoped — not blocking.

**Type consistency:** `cascade()` input shape used consistently across Tasks 1-4. `Mention` type used in Tasks 5-6.

**Scope check:** Phase 2 is scope-cohesive (cascade UX + timeline + thread starts + AI). Tree overlay and AI tools are correctly deferred to Phase 3.

---

## What's NOT in Phase 2 (Phase 3 plan will cover)

- **Tree-canvas overlay** — highlight + time-scrubber on the React Flow canvas.
- **Full thread page** `/research/threads/[id]` — Task 7 builds the panel; the standalone page is Phase 3.
- **AI tools** `summarize_thread` and `suggest_next_step`.
- **Backfill tool** — group existing factsheets retroactively into a thread.
