# Spec — Research Threads (Journey-as-First-Class Overlay)

> **Status:** approved (2026-05-10)
> **Phase:** 2 (depends on Research → Tree Pipeline + Factsheet UI Components)
> **Supersedes:** none — additive layer on top of `2026-03-26-research-to-tree-pipeline-design.md`

## Context

The current research → factsheet → tree pipeline tracks **destinations** (entities) but loses the **journey** (the cascading investigation that produced them). Real research pivots: "researching John reveals an unknown wife Maria, whose death cert reveals a father Stefan." Today, each pivot requires the user to stop, name a new factsheet, manually link it, and resume — high ceremony for a natural research move.

This spec adds **research threads** as a chronological narrative overlay that:

1. Captures *why* and *when* each entity, fact, link, or promotion was added.
2. Reduces the per-pivot friction to a single click via a *cascade contextual action*.
3. Makes AI's contributions visible in-thread alongside human actions.

Schema-additive, no breakage of the existing factsheet/person model. Three-phase rollout. Backwards-compatible.

## Locked decisions

1. **Cascade mode** — hybrid: user-triggered cascades create factsheets immediately; AI-detected mentions stage as candidate chips for confirmation.
2. **Thread logging** — explicit-when-active: events tag only when a thread is the currently-active one. A backfill tool exists for grouping legacy factsheets retroactively.
3. **Multi-thread membership** — M2M via the events table: a factsheet has one *creator* thread but can be touched by events from any number of threads.

## 1. Data Model

### New tables

```sql
CREATE TABLE research_threads (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'resolved', 'abandoned')),
  -- Optional seeds: where the thread started
  seed_person_id        TEXT REFERENCES persons(id) ON DELETE SET NULL,
  seed_factsheet_id     TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
  seed_research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
  summary         TEXT,           -- user-curated narrative
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT
);

CREATE INDEX idx_threads_status      ON research_threads(status) WHERE status = 'active';
CREATE INDEX idx_threads_created_by  ON research_threads(created_by);

CREATE TABLE research_thread_events (
  id                TEXT PRIMARY KEY,
  thread_id         TEXT NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL CHECK (event_type IN (
    'thread_started', 'item_attached', 'fact_extracted',
    'factsheet_created', 'factsheet_linked', 'mention_followed',
    'conflict_resolved', 'duplicate_resolved', 'factsheet_promoted',
    'note_added', 'thread_paused', 'thread_resolved', 'thread_abandoned'
  )),
  actor_id          TEXT NOT NULL,                  -- user uuid or 'ai'
  -- Polymorphic refs (any subset, depending on event_type)
  factsheet_id      TEXT REFERENCES factsheets(id)         ON DELETE SET NULL,
  person_id         TEXT REFERENCES persons(id)            ON DELETE SET NULL,
  research_item_id  TEXT REFERENCES research_items(id)     ON DELETE SET NULL,
  research_fact_id  TEXT REFERENCES research_facts(id)     ON DELETE SET NULL,
  source_id         TEXT REFERENCES sources(id)            ON DELETE SET NULL,
  link_id           TEXT REFERENCES factsheet_links(id)    ON DELETE SET NULL,
  reason            TEXT,                                   -- "wife mentioned in marriage cert"
  payload_json      TEXT,                                   -- structured detail
  occurred_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_thread_events_thread     ON research_thread_events(thread_id, occurred_at);
CREATE INDEX idx_thread_events_factsheet  ON research_thread_events(factsheet_id) WHERE factsheet_id IS NOT NULL;
CREATE INDEX idx_thread_events_person     ON research_thread_events(person_id)    WHERE person_id IS NOT NULL;
```

### Additive column

```sql
ALTER TABLE factsheets ADD COLUMN created_thread_id TEXT REFERENCES research_threads(id) ON DELETE SET NULL;
CREATE INDEX idx_factsheets_thread ON factsheets(created_thread_id) WHERE created_thread_id IS NOT NULL;
```

`created_thread_id` powers the tree-overlay highlight (which thread originated this person). Not `NOT NULL` — pre-existing factsheets stay valid; backfill tool can populate.

### Soft-delete behaviour

Deleting a referenced entity sets the polymorphic FK to `NULL` but preserves the event row + reason text. The timeline shows e.g. *"Factsheet deleted (was 'Maria...')"* — the journey is preserved even when its destinations are pruned.

## 2. Cascade Contextual Action

### Trigger

A fact such as `factType='spouse_name'`, `factValue='Maria'` on John's factsheet renders Maria as a clickable chip in the fact row. Same for `parent_name`, `child_name`, `sibling_name`, `marriage_partner`, etc.

### User-triggered cascade (immediate)

One click → server transaction in `packages/research/src/threads/cascade.ts`:

1. `INSERT factsheets` — title `"<Name> (<role> of <subject>)"`, entity_type=`person`, status=`draft`, `created_thread_id`=active thread.
2. `INSERT factsheet_links` — `from_factsheet_id`=John, `to_factsheet_id`=Maria, `relationship_type`=spouse|parent_child|sibling, `source_fact_id`=this fact, `confidence` inherited from fact's confidence.
3. Emit thread events (one transaction): `factsheet_created`, `factsheet_linked`, `mention_followed`, all with `reason="spouse mentioned in <source_title>"`, `actor_id`=current user.
4. Right-pane navigates to Maria; John in breadcrumb.

If transaction fails, all rows + events roll back.

### AI-detected mentions (staged)

When fact extraction (`packages/research/src/facts/extract.ts`) is AI-driven, the extractor also returns a `mentions` array — names + relationship hints from prose. These don't auto-create factsheets; instead they surface as candidate chips in a "discovered mentions" tray on the source factsheet. User taps a chip → confirms title/relationship → cascade fires (same path as user-triggered, with `actor_id='ai'` on the chip-source attribution).

### What happens when no thread is active

The cascade still works (factsheet + link created), but no thread events emit. UI shows a non-blocking nudge: *"Want to track this research? Start a thread"* with a one-click start that names itself from the seed factsheet.

## 3. Thread Lifecycle & UX Shell

### Three ways a thread starts

| Trigger | Seed | Outcome |
|---|---|---|
| Person on tree → context menu *"Start research thread"* | `seed_person_id` | Thread active, opens `/research` workspace |
| Research-hub search bar → *"Start thread: <q>"* | none, title=query | Thread active, no entity yet |
| Inbox item → *"Promote item to thread"* | `seed_research_item_id` | Thread active, item attached |

### Active-thread state

- **Server**: `active_thread` cookie keyed by `family_id` — keeps central schema unchanged, works with the per-family-DB architecture.
- **Client**: `useActiveThread()` hook in `apps/web/lib/research/active-thread.ts` reads the cookie + tRPC query for thread metadata.
- **UI**: a sticky bar at the top of any `/research/*` route — *"Working on: <title>"* + pause / resolve / switch dropdown.

### Thread view

Side panel (toggled in the research workspace) and a full-page route `/research/threads/[id]`:

```
"John Smith — find his parents"  · active · 12 events · 4d
─────────────────────────────────────────────────────────
• Day 1, 14:02  Attached marriage cert (NARA #12345)
• Day 1, 14:05  Created factsheet "Maria (wife)"
                 spouse mentioned in marriage cert
• Day 1, 14:10  Linked Maria → John as spouse
• Day 2, 09:30  AI extracted 3 facts from cert
• Day 2, 10:15  Resolved birth-date conflict (1872 ✓ vs 1875)
• Day 3, 19:50  Promoted "Maria" → person on tree
• Day 4, 11:00  Note: "Need death cert; check FindAGrave"
─────────────────────────────────────────────────────────
[ + Add note ]  [ Pause ]  [ Resolve ]  [ Abandon ]
```

Events are clickable: jumping back to that fact / factsheet / source.

### Lifecycle states

`active → paused | resolved | abandoned`. `paused` keeps timeline frozen but doesn't auto-tag new events. `resolved` is a positive close (target answered). `abandoned` is a negative close. Both `resolved`/`abandoned` set `closed_at`.

## 4. AI Integration

- **System prompt** (`packages/ai/src/prompts/research-assistant.ts`) gains an `<active_thread>` block with title, status, recent events. Lets Claude write *contextual* recommendations.
- **Existing tools** (`extract_facts`, `searchFamilySearch`, `searchNARA`, `proposeRelationship`, ...) attach `thread_id` to their effects and emit thread events with `actor_id='ai'` and a `reason` that quotes Claude's stated rationale.
- **New tools**:
  - `summarize_thread(thread_id)` — Claude writes a research narrative for export/sharing.
  - `suggest_next_step(thread_id)` — Claude reads the timeline + tree state, proposes the next investigation move with a justification.
- **Future hook (post-MVP)**: a "background research mode" that runs autonomously between user sessions. Already easy to plug in because thread events are the natural substrate.

## 5. Tree-Canvas Overlay

When a thread is active, the canvas in `apps/web/components/tree/tree-canvas.tsx` enters "thread overlay" mode:

- Persons + edges added by the active thread → highlighted ring + saturated color.
- Other persons/edges → dimmed.
- New control in `tree-toolbar.tsx`: a **time-scrubber** that replays the thread chronologically — nodes appear at their `occurred_at`. Built on the existing thread events; no new derived state.
- Right-click any node → *"Show threads that touched this person"* → modal listing thread chips with last-touched dates.

The right side panel of the tree workspace gains a `Threads` tab — list of active/paused/resolved threads, click to set active.

## 6. Files Affected

### Backend
- `packages/db/src/research-schema.ts` — add `researchThreads`, `researchThreadEvents`; nullable column on `factsheets`.
- `packages/db/migrations/` — new migration file (additive only).
- `packages/research/src/threads/` — **new module**:
  - `index.ts` — public surface
  - `create.ts` — `createThread`, `setActive`
  - `events.ts` — `addEvent` (transactional), `getThreadTimeline`
  - `cascade.ts` — the cascade contextual action transaction
  - `lifecycle.ts` — `pauseThread`, `resolveThread`, `abandonThread`
  - `backfill.ts` — group existing factsheets into a thread, back-date events from `change_log` + `factsheets.created_at`
  - `__tests__/` — unit tests
- `packages/research/src/factsheets/index.ts` — `createFactsheet` accepts optional `linkFromFactsheetId`, `linkRelationshipType`, `sourceFactId` and emits cascade events.
- `packages/research/src/facts/extract.ts` — emit `fact_extracted` events when active thread present; expose `mentions[]` from AI extraction.
- `packages/ai/src/prompts/research-assistant.ts` — inject active-thread context.
- `packages/ai/src/tools/research/` — new `summarize-thread.ts`, `suggest-next-step.ts`; existing tools accept `thread_id` for attribution.

### API
- `apps/web/app/api/research/threads/route.ts` — list, create
- `apps/web/app/api/research/threads/[id]/route.ts` — get, update (title/summary/status), delete
- `apps/web/app/api/research/threads/[id]/events/route.ts` — list timeline, add note
- `apps/web/app/api/research/threads/[id]/cascade/route.ts` — cascade transaction endpoint
- `apps/web/app/api/research/threads/active/route.ts` — get/set active thread (cookie)

### Frontend
- `apps/web/components/research/threads/` — **new**:
  - `thread-list.tsx`
  - `thread-timeline-panel.tsx`
  - `thread-header-bar.tsx` (sticky at top of `/research/*`)
  - `mention-cascade-chip.tsx`
  - `mention-tray.tsx` (AI-staged candidates)
  - `thread-time-scrubber.tsx`
- `apps/web/components/research/factsheets/factsheet-detail.tsx` — render mention chips on fact rows.
- `apps/web/components/tree/tree-canvas.tsx`, `tree-toolbar.tsx`, `tree-sidebar.tsx` — overlay mode + scrubber + Threads tab.
- `apps/web/lib/research/active-thread.ts` — **new**: cookie helpers + React hook.
- `apps/web/messages/en/tree.json`, `apps/web/messages/ru/tree.json` — translations.
- `apps/web/messages/en/research.json`, `apps/web/messages/ru/research.json` — translations.

### Reuse (don't reinvent)
- `packages/db/queries/closure-table.ts` — for tree overlay's "ancestors of person added by thread" queries.
- `packages/research/src/factsheets/duplicate-check.ts` — the cascade should use existing duplicate detection on the new factsheet to warn before commit.
- `change_log` table — the backfill tool reads it to reconstruct retro events.

## 7. Migration & Rollout

| Phase | Scope | Risk | Verification |
|---|---|---|---|
| **1** | Schema, thread CRUD APIs, active-thread cookie | None — additive only | Migration runs cleanly; existing tests pass |
| **2** | Cascade action (user-immediate + AI-staged), timeline panel, AI emits events | Low — old factsheet flow keeps working untouched | Integration test of full cascade flow |
| **3** | Tree overlay highlight, time-scrubber, `summarize_thread` / `suggest_next_step` AI tools | Low — opt-in views | E2E walkthrough; visual regression on canvas |

Each phase is independently shippable. A user with no active thread sees zero change. A user starting a thread gets phased UX as features land.

## 8. Verification Plan

1. **Schema migration**: `pnpm --filter @ancstra/db migrate` produces no errors; existing factsheet fixtures load + render unchanged.
2. **Unit tests** in `packages/research/src/threads/__tests__/`:
   - `addEvent` is transactional; rollback if any FK invalid.
   - `getThreadTimeline` paginates correctly; M2M case works (factsheet visible in two threads).
   - `cascade` creates factsheet + link + 3 events atomically.
   - `backfill` populates `created_thread_id` and back-dates events from `change_log`.
3. **Integration test** (Vitest, real SQLite): full cascade flow — start thread → attach research_item → extract fact with mention → cascade-create linked factsheet → assert thread events match expected sequence and ordering.
4. **AI integration test**: invoke research-assistant with a fact-extraction prompt against a stubbed Claude client → assert `fact_extracted` events emitted with `actor_id='ai'` and the AI's reason.
5. **E2E (Playwright)** in `apps/web/__tests__/e2e/research-threads.spec.ts`:
   - Start thread → 3-step cascade (John → Maria → Stefan) → verify timeline panel + tree overlay reflect events.
   - Pause + resume thread.
   - Promote a factsheet from a thread → verify `factsheet_promoted` event.
6. **Backfill tool** test: fixture family DB with 5 existing factsheets → run backfill grouping 3 of them → verify retro events back-dated to factsheet `created_at`, fourth/fifth untouched.
7. **Manual UX walkthrough**: solo dev runs through the cascade UX with a real research session; confirms it feels lower-friction than current path.

## 9. Open / Deferred

- **Privacy & living persons in AI prompts**: not solved here. The active-thread context block in the prompt should run through `filterForPrivacy` before injection. Tracked separately.
- **Thread sharing across family-members**: M2M model supports it implicitly (multiple users can emit events into the same thread), but the *active thread* state is per-user. Multi-user collaboration UX (who's currently in this thread?) is out of scope.
- **AI agent loops**: naturally enabled by this design — a future "background research mode" simply runs Claude as an autonomous emitter into a designated thread. Not built now; design leaves the door open.
- **Cases-as-container** (alternative): if threads-as-overlay prove insufficient long-term, escalating to a `research_cases` parent of `research_threads` is a feasible next step. Not closing that door, only deferring it.
- **Thread merging / splitting**: defer until users demand it. The events table makes it tractable (re-parent events to a new thread_id).

## Related

- [Research → Tree Pipeline](./2026-03-26-research-to-tree-pipeline-design.md)
- [Factsheet UI Components](./2026-03-27-factsheet-ui-components-design.md)
- [Research Workspace](./2026-03-22-research-workspace-design.md)
- [Data Model](../../architecture/data-model.md)
- [AI Strategy](../../architecture/ai-strategy.md)
