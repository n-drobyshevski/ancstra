# Plan B: Evidence Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-person evidence analysis workspace with fact extraction, conflict detection, Board/Conflicts/Timeline tabs, and source promotion workflow.

**Architecture:** Tabbed workspace (Hybrid 3) at /research/person/[id]. Board tab is default with 3-column layout. All tabs share research_items + research_facts data. Fact extraction uses AI (Claude via Vercel AI SDK). Source promotion wraps in a transaction.

**Tech Stack:** React, shadcn/ui, Drizzle ORM, Vercel AI SDK (fact extraction), Vitest

**Spec:** [Research Workspace Design](../../superpowers/specs/2026-03-22-research-workspace-design.md)
**Depends on:** [Plan A](2026-03-22-plan-a-search-foundation.md) (research schema, items CRUD, packages/research)

---

## File Structure

### New Files

```
packages/research/src/
  facts/
    queries.ts                          # Research facts CRUD queries
    conflicts.ts                        # Conflict detection query + resolver
    extract.ts                          # AI fact extraction (Vercel AI SDK)
    promote.ts                          # Source promotion workflow (transaction)
  __tests__/
    facts-queries.test.ts
    conflicts.test.ts
    promote.test.ts

apps/web/
  app/
    (auth)/research/person/[id]/
      page.tsx                          # Evidence workspace shell
      loading.tsx                       # Suspense fallback
    api/research/
      facts/route.ts                    # Facts list + create
      facts/[id]/route.ts              # Fact get/update/delete
      facts/extract/route.ts           # AI fact extraction endpoint
      conflicts/route.ts               # Conflict detection endpoint
      conflicts/resolve/route.ts       # Conflict resolution endpoint
      promote/route.ts                 # Source promotion endpoint
  components/research/
    workspace/
      workspace-shell.tsx              # Tab container + data provider
      workspace-tabs.tsx               # Tab navigation (Board, Conflicts, Timeline)
    board/
      board-tab.tsx                     # 3-column board layout
      source-list-panel.tsx            # Left column: sources + research items
      source-list-item.tsx             # Individual item in source list
      fact-matrix.tsx                   # Center column: fact matrix table
      fact-matrix-row.tsx              # Single fact row in the matrix
      detail-panel.tsx                 # Right column: source detail
      detail-panel-facts.tsx           # Extracted facts section in detail
      detail-panel-actions.tsx         # Action buttons (Promote, Dismiss, etc.)
    conflicts/
      conflicts-tab.tsx                # Conflicts tab container
      conflict-card.tsx                # Single conflict display with resolution
    timeline/
      timeline-tab.tsx                 # Timeline tab container
      timeline-event.tsx               # Single timeline event
  lib/research/
    evidence-client.ts                 # React hooks for facts, conflicts, promotion
```

### Modified Files

```
packages/research/src/index.ts         # Export facts/, conflicts, promote
apps/web/components/app-sidebar.tsx     # Add "Evidence" sub-link under Research
```

---

## Task 1: Research Facts CRUD Queries + Tests

**Files:**
- Create: `packages/research/src/facts/queries.ts`
- Test: `packages/research/src/__tests__/facts-queries.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/facts-queries.test.ts` with in-memory SQLite. Set up tables: `persons`, `users`, `research_items`, `research_facts`, `sources`, `source_citations`. Seed a test user + person + research item.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@ancstra/db';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });
  // Create all required tables (persons, users, research_items,
  // research_facts, sources, source_citations) with raw SQL
  // Seed: test user, test person, test research item
});

afterEach(() => { sqlite.close(); });
```

- [ ] **Step 2:** Write tests: `createFact` inserts a fact and returns it with generated ID; `getFactsByPerson` returns all facts for a person ordered by `fact_date_sort`; `getFactsByResearchItem` returns facts linked to a specific research item; `updateFact` changes confidence/value; `deleteFact` removes a fact.

- [ ] **Step 3:** Run: `cd packages/research && pnpm test -- facts-queries` — Expected: FAIL (module not found)

- [ ] **Step 4:** Implement `packages/research/src/facts/queries.ts`:

```typescript
import { eq, and, asc } from 'drizzle-orm';
import { researchFacts } from '@ancstra/db';

export function createFact(db, data: {
  personId: string;
  factType: string;
  factValue: string;
  factDateSort?: number | null;
  researchItemId?: string | null;
  sourceCitationId?: string | null;
  confidence?: string;
  extractionMethod?: string;
}) { /* INSERT INTO research_facts ... RETURNING */ }

export function getFactsByPerson(db, personId: string) {
  /* SELECT ... WHERE person_id = ? ORDER BY fact_date_sort ASC */ }

export function getFactsByResearchItem(db, researchItemId: string) { /* ... */ }
export function updateFact(db, factId: string, data: Partial<...>) { /* ... */ }
export function deleteFact(db, factId: string) { /* ... */ }
```

- [ ] **Step 5:** Run: `cd packages/research && pnpm test -- facts-queries` — Expected: PASS

- [ ] **Step 6:** Create API route `apps/web/app/api/research/facts/route.ts` — GET (list by ?personId, ?researchItemId) + POST (create fact). Validate with Zod. Follow pattern from `apps/web/app/api/research/items/route.ts` (Plan A).

- [ ] **Step 7:** Create API route `apps/web/app/api/research/facts/[id]/route.ts` — GET (single fact) + PATCH (update confidence, value) + DELETE.

- [ ] **Step 8:** Create `apps/web/app/api/research/facts/extract/route.ts` — POST endpoint for AI fact extraction. Accepts `{ text: string, personContext?: string, documentType?: string }`. Uses Vercel AI SDK `generateObject` with Claude to extract structured facts:

```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const factSchema = z.object({
  facts: z.array(z.object({
    factType: z.enum(['name', 'birth_date', 'birth_place', /* ... */]),
    factValue: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
});

export async function POST(request: Request) {
  const { text, personContext, documentType } = await request.json();
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: factSchema,
    prompt: `Extract genealogical facts from the following document.
Person context: ${personContext ?? 'none'}
Document type: ${documentType ?? 'unknown'}

Document text:
${text}`,
  });
  return Response.json(object);
}
```

- [ ] **Step 9:** Export facts queries from `packages/research/src/index.ts`.

- [ ] **Step 10:** Commit: `feat(research): research facts CRUD queries, API routes, and AI extraction endpoint`

---

## Task 2: Conflict Detection Query + Resolver

**Files:**
- Create: `packages/research/src/facts/conflicts.ts`
- Create: `apps/web/app/api/research/conflicts/route.ts`, `apps/web/app/api/research/conflicts/resolve/route.ts`
- Test: `packages/research/src/__tests__/conflicts.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/conflicts.test.ts`. Seed facts: two research items with conflicting birth dates for the same person, two items with matching birth places (no conflict), and a multi-valued fact type (residence) with different values (should NOT be flagged).

```typescript
describe('Conflict detection', () => {
  it('detects conflicting birth dates from different sources', () => {
    // Fact 1: birth_date = "15 Mar 1845" from item A
    // Fact 2: birth_date = "16 Mar 1845" from item B
    const conflicts = detectConflicts(db, personId);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].factType).toBe('birth_date');
  });

  it('does not flag matching values as conflicts', () => { /* ... */ });

  it('excludes multi-valued fact types (residence, occupation, child_name)', () => {
    // Two different residences should NOT conflict
    const conflicts = detectConflicts(db, personId);
    expect(conflicts.filter(c => c.factType === 'residence')).toHaveLength(0);
  });

  it('includes source info for each conflicting fact', () => { /* ... */ });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/facts/conflicts.ts`:

```typescript
import { sql } from 'drizzle-orm';

export interface ConflictPair {
  factType: string;
  valueA: string;
  valueB: string;
  confidenceA: string;
  confidenceB: string;
  factAId: string;
  factBId: string;
}

const MULTI_VALUED_TYPES = ['residence', 'occupation', 'child_name', 'other'];

export function detectConflicts(db, personId: string): ConflictPair[] {
  return db.all(sql`
    SELECT
      f1.fact_type AS factType,
      f1.fact_value AS valueA,
      f2.fact_value AS valueB,
      f1.confidence AS confidenceA,
      f2.confidence AS confidenceB,
      f1.id AS factAId,
      f2.id AS factBId
    FROM research_facts f1
    JOIN research_facts f2
      ON f1.person_id = f2.person_id
      AND f1.fact_type = f2.fact_type
      AND f1.id < f2.id
      AND f1.fact_value != f2.fact_value
    WHERE f1.person_id = ${personId}
      AND f1.fact_type NOT IN (${sql.join(MULTI_VALUED_TYPES.map(t => sql`${t}`), sql`, `)})
  `);
}

export function resolveConflict(db, winnerFactId: string, loserFactId: string) {
  // Set winner confidence to 'high', loser to 'disputed'
  db.run(sql`UPDATE research_facts SET confidence = 'high' WHERE id = ${winnerFactId}`);
  db.run(sql`UPDATE research_facts SET confidence = 'disputed' WHERE id = ${loserFactId}`);
}
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Create `apps/web/app/api/research/conflicts/route.ts` — GET `?personId=` returns all conflict pairs for a person. Joins research_items to include source titles.

- [ ] **Step 6:** Create `apps/web/app/api/research/conflicts/resolve/route.ts` — POST `{ winnerFactId, loserFactId }`. Calls `resolveConflict()`. Returns updated facts.

- [ ] **Step 7:** Export from `packages/research/src/index.ts`.

- [ ] **Step 8:** Commit: `feat(research): conflict detection query and resolution endpoint`

---

## Task 3: Evidence Workspace Page Shell + Tab Navigation

**Files:**
- Create: `apps/web/app/(auth)/research/person/[id]/page.tsx`, `apps/web/app/(auth)/research/person/[id]/loading.tsx`
- Create: `apps/web/components/research/workspace/workspace-shell.tsx`, `apps/web/components/research/workspace/workspace-tabs.tsx`
- Create: `apps/web/lib/research/evidence-client.ts`

- [ ] **Step 1:** Create `apps/web/lib/research/evidence-client.ts` — React hooks for the workspace:

```typescript
'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function usePersonFacts(personId: string) {
  return useSWR(`/api/research/facts?personId=${personId}`, fetcher);
}

export function usePersonConflicts(personId: string) {
  return useSWR(`/api/research/conflicts?personId=${personId}`, fetcher);
}

export function usePersonResearchItems(personId: string) {
  return useSWR(`/api/research/items?personId=${personId}`, fetcher);
}

export async function extractFacts(text: string, personContext?: string) {
  const res = await fetch('/api/research/facts/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, personContext }),
  });
  return res.json();
}

export async function promoteToCitation(researchItemId: string, personId: string) {
  const res = await fetch('/api/research/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ researchItemId, personId }),
  });
  return res.json();
}
```

- [ ] **Step 2:** Create `apps/web/components/research/workspace/workspace-tabs.tsx` — tab navigation using shadcn Tabs component. Three tabs: Board (default), Conflicts (with conflict count badge), Timeline.

```typescript
'use client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const TABS = [
  { value: 'board', label: 'Board' },
  { value: 'conflicts', label: 'Conflicts' },
  { value: 'timeline', label: 'Timeline' },
] as const;

export function WorkspaceTabs({ conflictCount }: { conflictCount: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get('view') ?? 'board';

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <TabsList>
      {TABS.map(t => (
        <TabsTrigger key={t.value} value={t.value} onClick={() => setTab(t.value)}>
          {t.label}
          {t.value === 'conflicts' && conflictCount > 0 && (
            <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
              {conflictCount}
            </span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
```

- [ ] **Step 3:** Create `apps/web/components/research/workspace/workspace-shell.tsx` — wraps the tab content. Accepts person data, facts, research items, conflicts as props. Renders WorkspaceTabs + the active tab content area.

```typescript
'use client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { WorkspaceTabs } from './workspace-tabs';
import { useSearchParams } from 'next/navigation';

interface WorkspaceShellProps {
  personId: string;
  personName: string;
  children: React.ReactNode; // tab content slots
}

export function WorkspaceShell({ personId, personName, children }: WorkspaceShellProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('view') ?? 'board';
  // ... renders header with person name + tabs + children
}
```

- [ ] **Step 4:** Create `apps/web/app/(auth)/research/person/[id]/page.tsx` — server component. Fetches person (name, basic info), research items, facts, conflicts from DB. Passes to WorkspaceShell. Follow the pattern from `apps/web/app/(auth)/tree/page.tsx`:

```typescript
import { createDb } from '@ancstra/db';
import { WorkspaceShell } from '@/components/research/workspace/workspace-shell';
import { BoardTab } from '@/components/research/board/board-tab';
import { ConflictsTab } from '@/components/research/conflicts/conflicts-tab';
import { TimelineTab } from '@/components/research/timeline/timeline-tab';

export default async function EvidenceWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view = 'board' } = await searchParams;
  const db = createDb();

  // Fetch person, research items, facts, conflicts
  // Return 404 if person not found
  // Render workspace shell with active tab
}
```

- [ ] **Step 5:** Create `apps/web/app/(auth)/research/person/[id]/loading.tsx` — skeleton loading state with placeholder columns.

- [ ] **Step 6:** Add "Evidence" sub-link to `apps/web/components/app-sidebar.tsx` under the Research section. Link format: `/research/person/[id]` (shown contextually when a person is selected).

- [ ] **Step 7:** Commit: `feat(research): evidence workspace page shell with tab navigation`

---

## Task 4: Board Tab — Source List Panel (Left Column)

**Files:**
- Create: `apps/web/components/research/board/board-tab.tsx`
- Create: `apps/web/components/research/board/source-list-panel.tsx`
- Create: `apps/web/components/research/board/source-list-item.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/board/source-list-item.tsx` — renders a single source or research item in the list. Displays: status badge (promoted=green, draft=gold, dismissed=muted), title, snippet preview, provider badge, fact count. Clickable to select (sets active item in detail panel).

```typescript
'use client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SourceListItemProps {
  id: string;
  title: string;
  snippet?: string;
  status: 'draft' | 'promoted' | 'dismissed';
  providerName?: string;
  factCount: number;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  promoted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  dismissed: 'bg-muted text-muted-foreground opacity-60',
};
```

- [ ] **Step 2:** Create `apps/web/components/research/board/source-list-panel.tsx` — left column component. Renders a scrollable list of SourceListItems. Groups by status: promoted sources first (with green header), then draft research items (gold header), then dismissed (collapsed). Includes search/filter input at top and "Add Item" button.

- [ ] **Step 3:** Add state management: `selectedItemId` stored in URL search param `?item=` so it persists on refresh and is shareable. Use `useSearchParams` + `useRouter`.

- [ ] **Step 4:** Create `apps/web/components/research/board/board-tab.tsx` — 3-column grid layout:

```typescript
'use client';
export function BoardTab({ personId, researchItems, sources, facts, conflicts }) {
  return (
    <div className="grid grid-cols-[280px_1fr_360px] h-full divide-x">
      <SourceListPanel items={researchItems} sources={sources} /* ... */ />
      <FactMatrix facts={facts} conflicts={conflicts} /* ... */ />
      <DetailPanel selectedItem={selectedItem} /* ... */ />
    </div>
  );
}
```

- [ ] **Step 5:** Handle empty state: when no research items exist, show a prompt to search or paste a URL.

- [ ] **Step 6:** Commit: `feat(research): board tab source list panel (left column)`

---

## Task 5: Board Tab — Fact Matrix (Center Column)

**Files:**
- Create: `apps/web/components/research/board/fact-matrix.tsx`
- Create: `apps/web/components/research/board/fact-matrix-row.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/board/fact-matrix-row.tsx` — renders a single row in the fact matrix. Each row represents a fact type (e.g., "Birth Date"). Columns are sources. Cells show the fact value from that source, color-coded by confidence. Conflicting cells highlighted with red border.

```typescript
interface FactMatrixRowProps {
  factType: string;
  factTypeLabel: string;           // human-readable label
  values: {
    sourceId: string;
    factId: string;
    value: string;
    confidence: string;
    isConflicting: boolean;
  }[];
}
```

- [ ] **Step 2:** Create `apps/web/components/research/board/fact-matrix.tsx` — table component. Rows = fact types present for this person. Columns = sources (research items + promoted sources). Header row shows source titles (truncated, with tooltip). Uses `<table>` with sticky header and horizontal scroll for many sources.

- [ ] **Step 3:** Build the matrix data structure from flat facts array:

```typescript
function buildMatrix(facts: ResearchFact[], sources: Source[], researchItems: ResearchItem[]) {
  // Group facts by fact_type
  // For each fact_type, map sourceId -> fact value
  // Flag cells where conflicts exist
  // Return: { rows: MatrixRow[], columns: ColumnDef[] }
}
```

- [ ] **Step 4:** Add conflict highlighting: cells with conflicting values get `border-destructive` ring and a warning icon. Clicking a conflicting cell navigates to the Conflicts tab filtered to that fact type.

- [ ] **Step 5:** Add inline editing: double-click a cell to edit the fact value. Save via PATCH `/api/research/facts/[id]`. Show optimistic update.

- [ ] **Step 6:** Handle empty matrix gracefully: show "No facts extracted yet. Select a source to extract facts." message.

- [ ] **Step 7:** Commit: `feat(research): board tab fact matrix (center column)`

---

## Task 6: Board Tab — Detail Panel (Right Column)

**Files:**
- Create: `apps/web/components/research/board/detail-panel.tsx`
- Create: `apps/web/components/research/board/detail-panel-facts.tsx`
- Create: `apps/web/components/research/board/detail-panel-actions.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/board/detail-panel.tsx` — right column. Shows details for the selected source/research item. Sections: Header (title, URL link, provider badge, status), Content Preview (snippet or archived text, scrollable), Facts (extracted facts list), Actions.

```typescript
'use client';
interface DetailPanelProps {
  item: ResearchItem | Source | null;
  facts: ResearchFact[];
  onFactCreate: (fact: NewFact) => void;
  onPromote: () => void;
  onDismiss: () => void;
}

export function DetailPanel({ item, facts, onFactCreate, onPromote, onDismiss }: DetailPanelProps) {
  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a source from the list to view details
      </div>
    );
  }
  // Render sections...
}
```

- [ ] **Step 2:** Create `apps/web/components/research/board/detail-panel-facts.tsx` — lists extracted facts for the selected item. Each fact shows: type label, value, confidence badge, extraction method icon (manual/AI/OCR). Includes "Add Fact" button that opens an inline form with fact_type dropdown + value input + confidence select.

- [ ] **Step 3:** Add "Extract Facts with AI" button in detail-panel-facts. When clicked: sends the item's `full_text` or `snippet` to `/api/research/facts/extract`, shows loading spinner, then displays extracted facts for review. User can accept/reject each extracted fact before saving.

```typescript
async function handleAIExtract() {
  setExtracting(true);
  const { facts: extracted } = await extractFacts(item.fullText ?? item.snippet, personContext);
  setSuggestedFacts(extracted); // Show for review
  setExtracting(false);
}
```

- [ ] **Step 4:** Create `apps/web/components/research/board/detail-panel-actions.tsx` — action buttons depending on item status:
  - **Draft:** "Promote to Source" (primary), "Dismiss" (secondary), "View Archive" (if archived), "Extract Facts" (AI)
  - **Promoted:** "View Source" link, "View Archive"
  - **Dismissed:** "Restore to Draft"

- [ ] **Step 5:** Wire up Promote button to call `promoteToCitation()` from evidence-client. Show confirmation with preview of what will be created (source title, citation). On success, refresh workspace data via SWR `mutate`.

- [ ] **Step 6:** Wire up Dismiss button: PATCH `/api/research/items/[id]` with `status: 'dismissed'`. Optimistic update in the source list.

- [ ] **Step 7:** Commit: `feat(research): board tab detail panel with AI fact extraction`

---

## Task 7: Conflicts Tab

**Files:**
- Create: `apps/web/components/research/conflicts/conflicts-tab.tsx`
- Create: `apps/web/components/research/conflicts/conflict-card.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/conflicts/conflict-card.tsx` — displays a single conflict between two facts. Shows:
  - Fact type label (e.g., "Birth Date")
  - Side-by-side comparison: Value A (with source title, confidence badge) vs Value B (with source title, confidence badge)
  - Resolution buttons: "Accept A" | "Accept B" | "Mark Both Disputed"

```typescript
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ConflictCardProps {
  factType: string;
  factTypeLabel: string;
  valueA: string;
  valueB: string;
  sourceA: { title: string; id: string };
  sourceB: { title: string; id: string };
  confidenceA: string;
  confidenceB: string;
  factAId: string;
  factBId: string;
  onResolve: (winnerId: string, loserId: string) => void;
}
```

- [ ] **Step 2:** Create `apps/web/components/research/conflicts/conflicts-tab.tsx` — lists all conflicts for the person. Groups by fact_type. Shows total count in header. Empty state: "No conflicts detected" with checkmark icon.

- [ ] **Step 3:** Add resolution handler: calls POST `/api/research/conflicts/resolve` with `{ winnerFactId, loserFactId }`. On success, removes the conflict card with animation (fade out). Refreshes conflict count in tab badge.

- [ ] **Step 4:** Add "Ask AI" button per conflict: sends both values + their source context to Claude for analysis. Displays AI recommendation inline below the conflict (e.g., "The 1850 census typically has more reliable birth dates than the 1860 census. Recommend accepting Value A.").

```typescript
async function handleAskAI(conflict: ConflictPair) {
  const res = await fetch('/api/research/facts/extract', {
    method: 'POST',
    body: JSON.stringify({
      text: `Conflict: ${conflict.factType}.
        Value A: "${conflict.valueA}" (confidence: ${conflict.confidenceA}).
        Value B: "${conflict.valueB}" (confidence: ${conflict.confidenceB}).
        Which is more likely correct and why?`,
      documentType: 'conflict_analysis',
    }),
  });
  // Display AI analysis
}
```

- [ ] **Step 5:** Add filter/sort: filter by fact type, sort by severity (higher confidence conflicts first).

- [ ] **Step 6:** Commit: `feat(research): conflicts tab with resolution and AI analysis`

---

## Task 8: Timeline Tab

**Files:**
- Create: `apps/web/components/research/timeline/timeline-tab.tsx`
- Create: `apps/web/components/research/timeline/timeline-event.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/timeline/timeline-event.tsx` — renders a single event on the timeline. Shows: date (formatted), fact type icon, fact value, source title (linked), confidence badge. Conflicting events get a warning indicator.

```typescript
'use client';
import { cn } from '@/lib/utils';

interface TimelineEventProps {
  date: string | null;
  dateSortValue: number | null;
  factType: string;
  factValue: string;
  sourceName: string;
  sourceId: string;
  confidence: string;
  hasConflict: boolean;
}

export function TimelineEvent(props: TimelineEventProps) {
  return (
    <div className="flex gap-4 relative">
      {/* Vertical line connector */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-3 h-3 rounded-full border-2",
          props.hasConflict ? "border-destructive bg-destructive/20" : "border-primary bg-primary/20"
        )} />
        <div className="w-0.5 flex-1 bg-border" />
      </div>
      {/* Event content */}
      <div className="pb-6">
        <p className="text-sm font-medium">{props.factValue}</p>
        <p className="text-xs text-muted-foreground">{props.factType} — {props.sourceName}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Create `apps/web/components/research/timeline/timeline-tab.tsx` — renders all facts sorted chronologically by `fact_date_sort`. Groups events by decade or life stage. Includes both research_facts AND events from the `events` table (birth, death, marriage from the main tree).

- [ ] **Step 3:** Build the merged timeline data:

```typescript
function buildTimeline(facts: ResearchFact[], treeEvents: Event[]) {
  // Merge research_facts (with fact_date_sort) and events (with date_sort)
  // Normalize to common TimelineEntry format
  // Sort by date ascending
  // Flag entries that have conflicts
  // Return sorted TimelineEntry[]
}
```

- [ ] **Step 4:** Handle undated facts: group at the bottom in an "Undated" section. Allow manual date assignment by clicking and entering a sort date.

- [ ] **Step 5:** Highlight gaps: if there are large date gaps (e.g., 20+ years between events), show a "gap indicator" suggesting the user search for records in that period.

- [ ] **Step 6:** Add visual density: color-code events by source type. Census records blue, vital records green, newspaper articles amber, etc.

- [ ] **Step 7:** Commit: `feat(research): timeline tab with chronological event display`

---

## Task 9: Source Promotion Workflow

**Files:**
- Create: `packages/research/src/facts/promote.ts`
- Create: `apps/web/app/api/research/promote/route.ts`
- Test: `packages/research/src/__tests__/promote.test.ts`

- [ ] **Step 1:** Write `packages/research/src/__tests__/promote.test.ts` — in-memory SQLite with all required tables. Tests: successful promotion creates source + citation + updates facts + sets status; promotion of already-promoted item fails; promotion rolls back on error (transaction integrity).

```typescript
describe('Source promotion', () => {
  it('promotes research item to source in a single transaction', () => {
    const result = promoteToSource(db, {
      researchItemId: testItemId,
      personId: testPersonId,
      userId: testUserId,
    });
    // Source created
    expect(result.sourceId).toBeDefined();
    // Research item status updated
    const item = getResearchItem(db, testItemId);
    expect(item.status).toBe('promoted');
    expect(item.promotedSourceId).toBe(result.sourceId);
    // Facts updated with source_citation_id
    const facts = getFactsByResearchItem(db, testItemId);
    facts.forEach(f => expect(f.sourceCitationId).toBeDefined());
  });

  it('rejects promotion of already-promoted item', () => {
    promoteToSource(db, { researchItemId: testItemId, personId: testPersonId, userId: testUserId });
    expect(() => promoteToSource(db, { researchItemId: testItemId, personId: testPersonId, userId: testUserId }))
      .toThrow('already promoted');
  });

  it('rolls back all changes if any step fails', () => { /* ... */ });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/facts/promote.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { sources, sourceCitations, researchItems, researchFacts } from '@ancstra/db';

interface PromoteInput {
  researchItemId: string;
  personId: string;
  userId: string;
  citationText?: string;  // optional AI-generated citation
}

interface PromoteResult {
  sourceId: string;
  sourceCitationId: string;
  factsUpdated: number;
}

export function promoteToSource(db, input: PromoteInput): PromoteResult {
  // 1. Fetch research item — throw if not found or already promoted
  // 2. Begin transaction
  // 3. INSERT into sources (title, author=null, url, source_type from provider mapping)
  // 4. INSERT into source_citations (sourceId, personId, citationText)
  // 5. UPDATE research_facts SET source_citation_id = newCitationId
  //    WHERE research_item_id = input.researchItemId
  // 6. UPDATE research_items SET status = 'promoted',
  //    promoted_source_id = newSourceId
  // 7. COMMIT
  // Return { sourceId, sourceCitationId, factsUpdated }
}
```

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Create `apps/web/app/api/research/promote/route.ts` — POST handler. Validates input with Zod. Calls `promoteToSource()`. Optionally calls AI to generate citation text before promotion:

```typescript
export async function POST(request: Request) {
  const { researchItemId, personId, generateCitation } = await request.json();
  let citationText: string | undefined;

  if (generateCitation) {
    // Use Vercel AI SDK to generate Chicago-style citation
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: `Generate a Chicago Manual of Style citation for: ${item.title}, URL: ${item.url}`,
    });
    citationText = text;
  }

  const result = promoteToSource(db, { researchItemId, personId, userId, citationText });
  return Response.json(result);
}
```

- [ ] **Step 6:** Export `promoteToSource` from `packages/research/src/index.ts`.

- [ ] **Step 7:** Commit: `feat(research): source promotion workflow with transactional integrity`

---

## Summary

| Task | What | Tests | Key Files | ~Duration |
|------|------|-------|-----------|-----------|
| 1 | Research facts CRUD + AI extraction | facts-queries.test.ts | `packages/research/src/facts/queries.ts`, `apps/web/app/api/research/facts/` | 1.5d |
| 2 | Conflict detection + resolver | conflicts.test.ts | `packages/research/src/facts/conflicts.ts`, `apps/web/app/api/research/conflicts/` | 1d |
| 3 | Workspace page shell + tabs | — | `apps/web/app/(auth)/research/person/[id]/page.tsx`, `workspace-shell.tsx` | 1d |
| 4 | Board tab — source list panel | — | `source-list-panel.tsx`, `source-list-item.tsx` | 0.5d |
| 5 | Board tab — fact matrix | — | `fact-matrix.tsx`, `fact-matrix-row.tsx` | 1d |
| 6 | Board tab — detail panel | — | `detail-panel.tsx`, `detail-panel-facts.tsx`, `detail-panel-actions.tsx` | 1.5d |
| 7 | Conflicts tab | — | `conflicts-tab.tsx`, `conflict-card.tsx` | 1d |
| 8 | Timeline tab | — | `timeline-tab.tsx`, `timeline-event.tsx` | 1d |
| 9 | Source promotion workflow | promote.test.ts | `packages/research/src/facts/promote.ts`, `apps/web/app/api/research/promote/` | 1d |

**Total estimated duration:** ~9.5 days
**Total commits:** ~9
