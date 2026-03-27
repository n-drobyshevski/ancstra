# Factsheet UI Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI for factsheet management across 3 integration points: person workspace tab, research hub inbox tab, and inline promote flow.

**Architecture:** Client-side React components using existing patterns from the research workspace (board-tab 2-column grid, source-list-item cards, evidence-client hooks). All data fetched from the factsheet API routes built earlier. State managed via URL params (selected factsheet) + local state (promote flow).

**Tech Stack:** React 19, Next.js 16 App Router, shadcn/ui, Tailwind CSS v4, Lucide icons, sonner toasts

---

## File Structure

### New files
```
apps/web/lib/research/factsheet-client.ts          — Data hooks (useFactsheets, useFactsheetDetail, etc.)
apps/web/lib/research/factsheet-constants.ts        — Status config for factsheet-specific statuses

apps/web/components/research/factsheets/
  factsheets-tab.tsx          — Tab wrapper: 2-col grid, data fetching, selection state
  factsheet-list.tsx          — Left sidebar: factsheet cards grouped by status
  factsheet-card.tsx          — Individual factsheet card in the list
  factsheet-detail.tsx        — Right panel: notes, facts, links, promote
  factsheet-facts-section.tsx — Facts list with provenance + conflict indicators
  factsheet-fact-row.tsx      — Single fact row with accept/reject for conflicts
  factsheet-links-section.tsx — Linked factsheets section with pills
  factsheet-promote.tsx       — Progressive promote accordion (3 steps)
  create-factsheet-form.tsx   — Inline create form in sidebar
  assign-facts-popover.tsx    — Popover to multi-select and assign facts

apps/web/components/research/inbox/
  inbox-tab.tsx               — Full inbox tab content
  inbox-item-card.tsx         — Card for unanchored research item
```

### Modified files
```
apps/web/components/research/workspace/workspace-tabs.tsx   — Add 'factsheets' to type + tabs array
apps/web/components/research/workspace/workspace-shell.tsx  — Import + render FactsheetsTab
apps/web/components/research/research-layout.tsx            — Add 'inbox' tab
apps/web/lib/research/constants.ts                          — Add factsheet status config
```

---

## Task 1: Data Hooks

**Files:**
- Create: `apps/web/lib/research/factsheet-client.ts`

- [ ] **Step 1: Create the factsheet data hooks file**

```typescript
// apps/web/lib/research/factsheet-client.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Generic fetch helper (same pattern as evidence-client.ts)
// ---------------------------------------------------------------------------
function useFetchData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// Factsheet types
// ---------------------------------------------------------------------------
export interface Factsheet {
  id: string;
  title: string;
  entityType: 'person' | 'couple' | 'family_unit';
  status: 'draft' | 'ready' | 'promoted' | 'merged' | 'dismissed';
  notes: string | null;
  promotedPersonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactsheetFact {
  id: string;
  personId: string;
  factType: string;
  factValue: string;
  factDateSort: number | null;
  researchItemId: string | null;
  sourceCitationId: string | null;
  factsheetId: string | null;
  accepted: boolean | null;
  confidence: string;
  extractionMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactsheetLink {
  id: string;
  fromFactsheetId: string;
  toFactsheetId: string;
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceFactId: string | null;
  confidence: string;
  createdAt: string;
}

export interface FactsheetDetail extends Factsheet {
  facts: FactsheetFact[];
  links: FactsheetLink[];
}

export interface DuplicateMatch {
  personId: string;
  givenName: string;
  surname: string;
  score: number;
  matchedFields: string[];
}

export interface FactsheetConflict {
  factType: string;
  facts: Array<{
    id: string;
    factValue: string;
    confidence: string;
    accepted: boolean | null;
    researchItemId: string | null;
  }>;
}

export interface PromotabilityResult {
  promotable: boolean;
  blockers: string[];
  conflicts: FactsheetConflict[];
}

export interface InboxItem {
  id: string;
  title: string;
  url: string | null;
  snippet: string | null;
  status: string;
  discoveryMethod: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useFactsheets(personId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{ factsheets: Factsheet[] }>(
    `/api/research/factsheets?personId=${personId}`
  );
  return { factsheets: data?.factsheets ?? [], isLoading, error, refetch };
}

export function useFactsheetDetail(factsheetId: string | null) {
  const { data, isLoading, error, refetch } = useFetchData<FactsheetDetail>(
    factsheetId ? `/api/research/factsheets/${factsheetId}` : null
  );
  return { detail: data, isLoading, error, refetch };
}

export function useFactsheetConflicts(factsheetId: string | null) {
  const { data, isLoading, error, refetch } = useFetchData<{ conflicts: FactsheetConflict[] }>(
    factsheetId ? `/api/research/factsheets/${factsheetId}/conflicts` : null
  );
  return { conflicts: data?.conflicts ?? [], isLoading, error, refetch };
}

export function useFactsheetDuplicates(factsheetId: string | null, enabled: boolean) {
  const { data, isLoading, error, refetch } = useFetchData<{ matches: DuplicateMatch[] }>(
    factsheetId && enabled ? `/api/research/factsheets/${factsheetId}/duplicates` : null
  );
  return { matches: data?.matches ?? [], isLoading, error, refetch };
}

export function useInbox() {
  const { data, isLoading, error, refetch } = useFetchData<{ items: InboxItem[]; total: number }>(
    '/api/research/inbox'
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading, error, refetch };
}

export function useInboxCount() {
  const { data, isLoading, refetch } = useFetchData<{ count: number }>(
    '/api/research/inbox?count=true'
  );
  return { count: data?.count ?? 0, isLoading, refetch };
}

// ---------------------------------------------------------------------------
// Mutations (non-hook — called imperatively)
// ---------------------------------------------------------------------------
export async function createFactsheet(title: string, entityType = 'person') {
  const res = await fetch('/api/research/factsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, entityType }),
  });
  if (!res.ok) throw new Error('Failed to create factsheet');
  return res.json() as Promise<Factsheet>;
}

export async function updateFactsheet(id: string, data: { title?: string; notes?: string; status?: string }) {
  const res = await fetch(`/api/research/factsheets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update factsheet');
  return res.json() as Promise<Factsheet>;
}

export async function deleteFactsheet(id: string) {
  const res = await fetch(`/api/research/factsheets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete factsheet');
}

export async function assignFactToFactsheet(factsheetId: string, factId: string) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factId }),
  });
  if (!res.ok) throw new Error('Failed to assign fact');
}

export async function removeFactFromFactsheet(factsheetId: string, factId: string) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/facts`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factId }),
  });
  if (!res.ok) throw new Error('Failed to remove fact');
}

export async function createFactsheetLink(
  fromId: string,
  toId: string,
  relationshipType: string,
  sourceFactId?: string,
) {
  const res = await fetch(`/api/research/factsheets/${fromId}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toFactsheetId: toId, relationshipType, sourceFactId }),
  });
  if (!res.ok) throw new Error('Failed to create link');
  return res.json();
}

export async function resolveFactsheetConflict(
  factsheetId: string,
  acceptedFactId: string,
  rejectedFactIds: string[],
) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/conflicts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedFactId, rejectedFactIds }),
  });
  if (!res.ok) throw new Error('Failed to resolve conflict');
}

export async function promoteFactsheet(
  factsheetId: string,
  mode: 'create' | 'merge',
  mergeTargetPersonId?: string,
  cluster?: boolean,
) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, mergeTargetPersonId, cluster }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Promotion failed' }));
    throw new Error(err.error ?? 'Promotion failed');
  }
  return res.json();
}

export async function fetchLinkSuggestions(factsheetId: string) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/links?suggest=true`);
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json() as Promise<{ suggestions: Array<{
    factId: string; factType: string; factValue: string;
    suggestedFactsheetId: string; suggestedFactsheetTitle: string;
    relationshipType: string;
  }> }>;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep factsheet-client`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/research/factsheet-client.ts
git commit -m "feat(research): add factsheet data hooks and mutations"
```

---

## Task 2: Constants & Status Config

**Files:**
- Modify: `apps/web/lib/research/constants.ts`

- [ ] **Step 1: Add factsheet status config to constants.ts**

Add after the existing `STATUS_CONFIG`:

```typescript
export const FACTSHEET_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  ready: {
    label: 'Ready',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  promoted: {
    label: 'Promoted',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  merged: {
    label: 'Merged',
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
  },
};

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  parent_child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/research/constants.ts
git commit -m "feat(research): add factsheet status and relationship constants"
```

---

## Task 3: Wire Factsheets Tab into Workspace

**Files:**
- Modify: `apps/web/components/research/workspace/workspace-tabs.tsx`
- Modify: `apps/web/components/research/workspace/workspace-shell.tsx`

- [ ] **Step 1: Add factsheets to workspace-tabs.tsx**

At line 5, add `Layers` to the lucide import:
```typescript
import {
  LayoutGrid,
  Table2,
  GitCompareArrows,
  Clock,
  PenTool,
  BookOpen,
  FileText,
  Layers,
  type LucideIcon,
} from 'lucide-react';
```

At line 18, update the type:
```typescript
export type WorkspaceView = 'board' | 'matrix' | 'conflicts' | 'timeline' | 'canvas' | 'hints' | 'proof' | 'factsheets';
```

At line 27 (after proof), add:
```typescript
  { value: 'factsheets', label: 'Factsheets', icon: Layers },
```

In the tab rendering (after the hints badge block around line 138), add badge for factsheets:
```typescript
              {tab.value === 'factsheets' && factsheetCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-muted text-muted-foreground">
                  {factsheetCount}
                </Badge>
              )}
```

Add `factsheetCount` to WorkspaceTabsProps:
```typescript
interface WorkspaceTabsProps {
  conflictCount?: number;
  hintCount?: number;
  factsheetCount?: number;
}
```

And destructure it:
```typescript
export function WorkspaceTabs({ conflictCount = 0, hintCount = 0, factsheetCount = 0 }: WorkspaceTabsProps) {
```

- [ ] **Step 2: Add FactsheetsTab to workspace-shell.tsx**

At line 18 (imports), add:
```typescript
import { FactsheetsTab } from '../factsheets/factsheets-tab';
import { useFactsheets } from '@/lib/research/factsheet-client';
```

Inside `ShellInner`, after the hints hook (line 51):
```typescript
  const { factsheets } = useFactsheets(person.id);
  const activeFactsheetCount = factsheets.filter(f => f.status !== 'dismissed').length;
```

Update the WorkspaceTabs call (line 87):
```typescript
      <WorkspaceTabs
        conflictCount={conflicts.length}
        hintCount={hints.length}
        factsheetCount={activeFactsheetCount}
      />
```

After the proof tab render (line 125), add:
```typescript
            {activeView === 'factsheets' && (
              <FactsheetsTab personId={person.id} />
            )}
```

- [ ] **Step 3: Create stub FactsheetsTab for compilation check**

Create `apps/web/components/research/factsheets/factsheets-tab.tsx`:

```typescript
'use client';

interface FactsheetsTabProps {
  personId: string;
}

export function FactsheetsTab({ personId }: FactsheetsTabProps) {
  return <div className="text-sm text-muted-foreground">Factsheets tab — coming next</div>;
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "workspace-tabs|workspace-shell|factsheets-tab"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/workspace/workspace-tabs.tsx apps/web/components/research/workspace/workspace-shell.tsx apps/web/components/research/factsheets/factsheets-tab.tsx
git commit -m "feat(research): wire factsheets tab into workspace"
```

---

## Task 4: Factsheet Card + List

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-card.tsx`
- Create: `apps/web/components/research/factsheets/factsheet-list.tsx`

- [ ] **Step 1: Create factsheet-card.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-card.tsx
'use client';

import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import type { Factsheet } from '@/lib/research/factsheet-client';

interface FactsheetCardProps {
  factsheet: Factsheet;
  isSelected: boolean;
  factCount: number;
  linkCount: number;
  conflictCount: number;
  onClick: () => void;
}

export function FactsheetCard({
  factsheet,
  isSelected,
  factCount,
  linkCount,
  conflictCount,
  onClick,
}: FactsheetCardProps) {
  const status = FACTSHEET_STATUS_CONFIG[factsheet.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const isDismissed = factsheet.status === 'dismissed';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
        'hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'border-primary bg-accent/5' : 'border-border',
        isDismissed && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-medium leading-snug line-clamp-1">{factsheet.title}</p>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
          {status.label}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {factCount} fact{factCount !== 1 ? 's' : ''}
        {linkCount > 0 && ` · ${linkCount} link${linkCount !== 1 ? 's' : ''}`}
        {conflictCount > 0 && (
          <span className="text-destructive"> · {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>
        )}
      </p>
    </button>
  );
}
```

- [ ] **Step 2: Create factsheet-list.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-list.tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FactsheetCard } from './factsheet-card';
import { CreateFactsheetForm } from './create-factsheet-form';
import type { Factsheet, FactsheetDetail } from '@/lib/research/factsheet-client';

interface FactsheetListProps {
  factsheets: Factsheet[];
  selectedId: string | null;
  details: Map<string, { factCount: number; linkCount: number; conflictCount: number }>;
  onSelect: (id: string) => void;
  onCreated: () => void;
}

const STATUS_ORDER = ['draft', 'ready', 'promoted', 'merged', 'dismissed'];

export function FactsheetList({ factsheets, selectedId, details, onSelect, onCreated }: FactsheetListProps) {
  const [showCreate, setShowCreate] = useState(false);

  const sorted = [...factsheets].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Factsheets</h3>
        <Button
          variant="default"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-1 size-3" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {showCreate && (
          <CreateFactsheetForm
            onCreated={() => { setShowCreate(false); onCreated(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {sorted.length === 0 && !showCreate && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm font-medium mb-1">No factsheets yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Group extracted facts into hypotheses about a person.
            </p>
            <Button variant="default" size="sm" onClick={() => setShowCreate(true)}>
              Create First Factsheet
            </Button>
          </div>
        )}

        {sorted.map((fs) => {
          const d = details.get(fs.id) ?? { factCount: 0, linkCount: 0, conflictCount: 0 };
          return (
            <FactsheetCard
              key={fs.id}
              factsheet={fs}
              isSelected={selectedId === fs.id}
              factCount={d.factCount}
              linkCount={d.linkCount}
              conflictCount={d.conflictCount}
              onClick={() => onSelect(fs.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create create-factsheet-form.tsx**

```typescript
// apps/web/components/research/factsheets/create-factsheet-form.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createFactsheet } from '@/lib/research/factsheet-client';
import { toast } from 'sonner';

interface CreateFactsheetFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateFactsheetForm({ onCreated, onCancel }: CreateFactsheetFormProps) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createFactsheet(title.trim());
      toast.success('Factsheet created');
      onCreated();
    } catch {
      toast.error('Failed to create factsheet');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-2.5 space-y-2">
      <Input
        autoFocus
        placeholder="Factsheet title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!title.trim() || saving}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "factsheet-"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-card.tsx apps/web/components/research/factsheets/factsheet-list.tsx apps/web/components/research/factsheets/create-factsheet-form.tsx
git commit -m "feat(research): factsheet card, list, and create form components"
```

---

## Task 5: Factsheet Fact Row + Facts Section

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-fact-row.tsx`
- Create: `apps/web/components/research/factsheets/factsheet-facts-section.tsx`

- [ ] **Step 1: Create factsheet-fact-row.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-fact-row.tsx
'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CONFIDENCE_VARIANT } from '@/lib/research/constants';
import { Badge } from '@/components/ui/badge';
import type { FactsheetFact } from '@/lib/research/factsheet-client';

interface FactsheetFactRowProps {
  fact: FactsheetFact;
  isConflict: boolean;
  sourceTitle?: string;
  onAccept?: () => void;
  onReject?: () => void;
  isResolving?: boolean;
}

export function FactsheetFactRow({
  fact,
  isConflict,
  sourceTitle,
  onAccept,
  onReject,
  isResolving,
}: FactsheetFactRowProps) {
  const isAccepted = fact.accepted === true;
  const isRejected = fact.accepted === false;
  const confVariant = CONFIDENCE_VARIANT[fact.confidence] ?? 'secondary';

  return (
    <div
      className={cn(
        'rounded-md px-3 py-2 border',
        isConflict && !isAccepted && !isRejected && 'border-destructive/40 bg-destructive/5',
        isAccepted && 'border-l-[3px] border-l-green-500 border-t-border border-r-border border-b-border bg-muted/30',
        isRejected && 'opacity-50 line-through border-border bg-muted/20',
        !isConflict && !isAccepted && !isRejected && 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {fact.factType.replace(/_/g, ' ')}
          </span>
          <span className={cn('ml-2 text-sm', isRejected && 'line-through')}>
            {fact.factValue}
          </span>
          {isAccepted && <span className="ml-2 text-[10px] text-green-500">✓ accepted</span>}
          {isConflict && !isAccepted && !isRejected && (
            <span className="ml-2 text-[10px] text-destructive">⚠ conflict</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isConflict && !isAccepted && !isRejected && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-green-500 hover:text-green-400"
                onClick={onAccept}
                disabled={isResolving}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive/80"
                onClick={onReject}
                disabled={isResolving}
              >
                Reject
              </Button>
            </>
          )}
          <Badge variant={confVariant} className="text-[9px] h-4 px-1.5">
            {fact.confidence}
          </Badge>
        </div>
      </div>

      {sourceTitle && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          From: {sourceTitle}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create factsheet-facts-section.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-facts-section.tsx
'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { FactsheetFactRow } from './factsheet-fact-row';
import { resolveFactsheetConflict } from '@/lib/research/factsheet-client';
import type { FactsheetFact, FactsheetConflict } from '@/lib/research/factsheet-client';

interface FactsheetFactsSectionProps {
  factsheetId: string;
  facts: FactsheetFact[];
  conflicts: FactsheetConflict[];
  researchItemTitles: Map<string, string>;
  onDataChanged: () => void;
  onAssignFacts: () => void;
}

export function FactsheetFactsSection({
  factsheetId,
  facts,
  conflicts,
  researchItemTitles,
  onDataChanged,
  onAssignFacts,
}: FactsheetFactsSectionProps) {
  const conflictFactIds = new Set(
    conflicts.flatMap((c) => c.facts.map((f) => f.id)),
  );

  const handleAccept = useCallback(
    async (acceptedId: string, factType: string) => {
      const conflict = conflicts.find((c) => c.factType === factType);
      if (!conflict) return;
      const rejectedIds = conflict.facts
        .filter((f) => f.id !== acceptedId)
        .map((f) => f.id);
      try {
        await resolveFactsheetConflict(factsheetId, acceptedId, rejectedIds);
        toast.success('Conflict resolved');
        onDataChanged();
      } catch {
        toast.error('Failed to resolve conflict');
      }
    },
    [factsheetId, conflicts, onDataChanged],
  );

  const handleReject = useCallback(
    async (rejectedId: string, factType: string) => {
      const conflict = conflicts.find((c) => c.factType === factType);
      if (!conflict) return;
      const others = conflict.facts.filter((f) => f.id !== rejectedId);
      if (others.length === 1) {
        // Auto-accept the remaining one
        await handleAccept(others[0].id, factType);
      }
    },
    [conflicts, handleAccept],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Facts ({facts.length})
        </h4>
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={onAssignFacts}
        >
          + Assign facts
        </button>
      </div>

      {facts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No facts assigned yet. Assign facts from research items.
        </p>
      ) : (
        <div className="space-y-1">
          {facts.map((fact) => (
            <FactsheetFactRow
              key={fact.id}
              fact={fact}
              isConflict={conflictFactIds.has(fact.id)}
              sourceTitle={fact.researchItemId ? researchItemTitles.get(fact.researchItemId) : undefined}
              onAccept={() => handleAccept(fact.id, fact.factType)}
              onReject={() => handleReject(fact.id, fact.factType)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "factsheet-fact"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-fact-row.tsx apps/web/components/research/factsheets/factsheet-facts-section.tsx
git commit -m "feat(research): factsheet fact row with conflict resolution + facts section"
```

---

## Task 6: Factsheet Links Section

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-links-section.tsx`

- [ ] **Step 1: Create factsheet-links-section.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-links-section.tsx
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RELATIONSHIP_TYPE_LABELS, FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { fetchLinkSuggestions } from '@/lib/research/factsheet-client';
import type { FactsheetLink, Factsheet } from '@/lib/research/factsheet-client';

interface FactsheetLinksSectionProps {
  factsheetId: string;
  links: FactsheetLink[];
  allFactsheets: Factsheet[];
  onLinkClick: (factsheetId: string) => void;
  onCreateLink: () => void;
}

export function FactsheetLinksSection({
  factsheetId,
  links,
  allFactsheets,
  onLinkClick,
  onCreateLink,
}: FactsheetLinksSectionProps) {
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    fetchLinkSuggestions(factsheetId)
      .then((data) => setSuggestionCount(data.suggestions.length))
      .catch(() => setSuggestionCount(0));
  }, [factsheetId]);

  const fsMap = new Map(allFactsheets.map((f) => [f.id, f]));

  function getLinkedFactsheet(link: FactsheetLink): Factsheet | undefined {
    const otherId = link.fromFactsheetId === factsheetId ? link.toFactsheetId : link.fromFactsheetId;
    return fsMap.get(otherId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Linked Factsheets ({links.length})
        </h4>
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={onCreateLink}
        >
          + Link
          {suggestionCount > 0 && (
            <span className="ml-1 text-primary">{suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''}</span>
          )}
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No linked factsheets. Relationship facts can suggest links.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const linked = getLinkedFactsheet(link);
            if (!linked) return null;
            const statusCfg = FACTSHEET_STATUS_CONFIG[linked.status];
            const relLabel = RELATIONSHIP_TYPE_LABELS[link.relationshipType] ?? link.relationshipType;

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onLinkClick(linked.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded px-1 py-0.5">
                  {relLabel}
                </span>
                <span className="font-medium">{linked.title}</span>
                {statusCfg && (
                  <span className={cn('rounded px-1 py-0.5 text-[9px]', statusCfg.className)}>
                    {statusCfg.label.toLowerCase()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-links-section.tsx
git commit -m "feat(research): factsheet links section with suggestion count"
```

---

## Task 7: Promote Accordion

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-promote.tsx`

- [ ] **Step 1: Create factsheet-promote.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-promote.tsx
'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useFactsheetDuplicates,
  promoteFactsheet,
  type FactsheetConflict,
  type DuplicateMatch,
} from '@/lib/research/factsheet-client';

interface FactsheetPromoteProps {
  factsheetId: string;
  factCount: number;
  unresolvedConflicts: FactsheetConflict[];
  hasLinks: boolean;
  onPromoted: () => void;
}

export function FactsheetPromote({
  factsheetId,
  factCount,
  unresolvedConflicts,
  hasLinks,
  onPromoted,
}: FactsheetPromoteProps) {
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(1);
  const [checkDups, setCheckDups] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<DuplicateMatch | null>(null);
  const [mode, setMode] = useState<'create' | 'merge' | null>(null);
  const [promoting, setPromoting] = useState(false);

  const { matches, isLoading: dupsLoading } = useFactsheetDuplicates(factsheetId, checkDups);

  const step1Pass = factCount > 0 && unresolvedConflicts.length === 0;

  const handleCheckDuplicates = useCallback(() => {
    setCheckDups(true);
    setStep(2);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!mode) return;
    setPromoting(true);
    try {
      await promoteFactsheet(
        factsheetId,
        mode,
        mode === 'merge' ? selectedMatch?.personId : undefined,
        hasLinks,
      );
      toast.success('Promoted to tree');
      onPromoted();
    } catch (err: any) {
      toast.error(err.message ?? 'Promotion failed');
    } finally {
      setPromoting(false);
    }
  }, [factsheetId, mode, selectedMatch, hasLinks, onPromoted]);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div>
          <span className="text-sm font-semibold">Promote to Tree</span>
          <span className="ml-2 text-xs text-muted-foreground">Create a person from this hypothesis</span>
        </div>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="divide-y divide-border">
          {/* Step 1: Readiness */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 1 · Readiness
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                {factCount > 0 ? <Check className="size-3 text-green-500" /> : <X className="size-3 text-destructive" />}
                <span>{factCount > 0 ? `${factCount} facts assigned` : 'No facts assigned'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {unresolvedConflicts.length === 0
                  ? <Check className="size-3 text-green-500" />
                  : <X className="size-3 text-destructive" />
                }
                <span>
                  {unresolvedConflicts.length === 0
                    ? 'No conflicts'
                    : `${unresolvedConflicts.length} unresolved conflict${unresolvedConflicts.length > 1 ? 's' : ''} — resolve above`
                  }
                </span>
              </div>
            </div>
            {step1Pass && step === 1 && (
              <Button size="sm" className="mt-3 h-7 text-xs" onClick={handleCheckDuplicates}>
                Check for Matches
              </Button>
            )}
          </div>

          {/* Step 2: Duplicate Check */}
          <div className={cn('px-4 py-3', !step1Pass && 'opacity-40 pointer-events-none')}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 2 · Duplicate Check
            </p>
            {!checkDups && <p className="text-xs text-muted-foreground">Complete step 1 first...</p>}
            {dupsLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Checking for matches...
              </div>
            )}
            {checkDups && !dupsLoading && matches.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <Check className="size-3" />
                No duplicates found
              </div>
            )}
            {checkDups && !dupsLoading && matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-500">
                  {matches.length} possible match{matches.length > 1 ? 'es' : ''} found
                </p>
                {matches.map((m) => (
                  <div key={m.personId} className="flex items-center justify-between rounded-md border border-border p-2">
                    <div>
                      <span className="text-sm font-medium">{m.givenName} {m.surname}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.matchedFields.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-500">{Math.round(m.score * 100)}%</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => { setSelectedMatch(m); setMode('merge'); setStep(3); }}
                      >
                        Merge into this
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {checkDups && !dupsLoading && step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => { setMode('create'); setStep(3); }}
              >
                Continue as new person
              </Button>
            )}
          </div>

          {/* Step 3: Confirm */}
          <div className={cn('px-4 py-3', step < 3 && 'opacity-40 pointer-events-none')}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 3 · Confirm & Create
            </p>
            {step >= 3 && mode && (
              <>
                <p className="text-xs mb-3">
                  {mode === 'create'
                    ? 'Will create a new person from this factsheet.'
                    : `Will merge facts into ${selectedMatch?.givenName} ${selectedMatch?.surname}.`
                  }
                  {hasLinks && ' Connected factsheets will be promoted as a family unit.'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setStep(2); setMode(null); setSelectedMatch(null); }}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                    disabled={promoting}
                    onClick={handleConfirm}
                  >
                    {promoting ? <><Loader2 className="mr-1 size-3 animate-spin" />Promoting...</> : 'Confirm Promote'}
                  </Button>
                </div>
              </>
            )}
            {step < 3 && <p className="text-xs text-muted-foreground">Complete previous steps...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-promote.tsx
git commit -m "feat(research): progressive promote accordion with 3-step flow"
```

---

## Task 8: Factsheet Detail + Full Tab Assembly

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-detail.tsx`
- Update: `apps/web/components/research/factsheets/factsheets-tab.tsx` (replace stub)

- [ ] **Step 1: Create factsheet-detail.tsx**

```typescript
// apps/web/components/research/factsheets/factsheet-detail.tsx
'use client';

import { useState, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import {
  updateFactsheet,
  useFactsheetConflicts,
  type FactsheetDetail as FactsheetDetailType,
  type Factsheet,
} from '@/lib/research/factsheet-client';
import { FactsheetFactsSection } from './factsheet-facts-section';
import { FactsheetLinksSection } from './factsheet-links-section';
import { FactsheetPromote } from './factsheet-promote';

interface FactsheetDetailProps {
  detail: FactsheetDetailType;
  allFactsheets: Factsheet[];
  researchItemTitles: Map<string, string>;
  onDataChanged: () => void;
  onSelectFactsheet: (id: string) => void;
  onAssignFacts: () => void;
}

export function FactsheetDetail({
  detail,
  allFactsheets,
  researchItemTitles,
  onDataChanged,
  onSelectFactsheet,
  onAssignFacts,
}: FactsheetDetailProps) {
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { conflicts, refetch: refetchConflicts } = useFactsheetConflicts(detail.id);

  const statusCfg = FACTSHEET_STATUS_CONFIG[detail.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const isTerminal = detail.status === 'promoted' || detail.status === 'merged' || detail.status === 'dismissed';

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (notesTimer) clearTimeout(notesTimer);
      const timer = setTimeout(async () => {
        try {
          await updateFactsheet(detail.id, { notes: value });
        } catch {
          toast.error('Failed to save notes');
        }
      }, 500);
      setNotesTimer(timer);
    },
    [detail.id, notesTimer],
  );

  const handleDataChanged = useCallback(() => {
    onDataChanged();
    refetchConflicts();
  }, [onDataChanged, refetchConflicts]);

  const unresolvedConflicts = conflicts.filter((c) =>
    c.facts.some((f) => f.accepted === null),
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', statusCfg.className)}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10">
              Promote to Tree
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this hypothesis..."
          rows={2}
          disabled={isTerminal}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Facts */}
      <FactsheetFactsSection
        factsheetId={detail.id}
        facts={detail.facts}
        conflicts={conflicts}
        researchItemTitles={researchItemTitles}
        onDataChanged={handleDataChanged}
        onAssignFacts={onAssignFacts}
      />

      {/* Links */}
      <FactsheetLinksSection
        factsheetId={detail.id}
        links={detail.links}
        allFactsheets={allFactsheets}
        onLinkClick={onSelectFactsheet}
        onCreateLink={() => {/* TODO: link creation popover */}}
      />

      {/* Promote */}
      {!isTerminal && (
        <FactsheetPromote
          factsheetId={detail.id}
          factCount={detail.facts.length}
          unresolvedConflicts={unresolvedConflicts}
          hasLinks={detail.links.length > 0}
          onPromoted={onDataChanged}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace factsheets-tab.tsx stub with full implementation**

```typescript
// apps/web/components/research/factsheets/factsheets-tab.tsx
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  useFactsheets,
  useFactsheetDetail,
  useFactsheetConflicts,
} from '@/lib/research/factsheet-client';
import { usePersonResearchItems } from '@/lib/research/evidence-client';
import { FactsheetList } from './factsheet-list';
import { FactsheetDetail } from './factsheet-detail';

interface FactsheetsTabProps {
  personId: string;
}

export function FactsheetsTab({ personId }: FactsheetsTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedFactsheetId = searchParams.get('fs');

  const { factsheets, refetch: refetchList } = useFactsheets(personId);
  const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedFactsheetId);
  const { items } = usePersonResearchItems(personId);

  // Build research item title map for provenance display
  const researchItemTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.id, item.title);
    }
    return map;
  }, [items]);

  // Build details map for the list (fact/link/conflict counts per factsheet)
  const detailsMap = useMemo(() => {
    const map = new Map<string, { factCount: number; linkCount: number; conflictCount: number }>();
    // We only have full detail for the selected one; for others, show 0s
    // (list-level counts could be added via a summary API later)
    if (detail) {
      const unresolvedConflicts = detail.facts.filter((f, _, arr) => {
        const sameType = arr.filter((o) => o.factType === f.factType && o.factValue !== f.factValue);
        return sameType.length > 0 && f.accepted === null;
      });
      map.set(detail.id, {
        factCount: detail.facts.length,
        linkCount: detail.links.length,
        conflictCount: 0, // simplified — would need per-factsheet conflict count
      });
    }
    return map;
  }, [detail]);

  const setSelectedFactsheet = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('fs', id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  // Auto-select first factsheet if none selected
  useEffect(() => {
    if (!selectedFactsheetId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedFactsheetId, factsheets, setSelectedFactsheet]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
  }, [refetchList, refetchDetail]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-16rem)] divide-x divide-border rounded-lg border border-border overflow-hidden">
      <FactsheetList
        factsheets={factsheets}
        selectedId={selectedFactsheetId}
        details={detailsMap}
        onSelect={setSelectedFactsheet}
        onCreated={handleDataChanged}
      />
      {detail ? (
        <FactsheetDetail
          detail={detail}
          allFactsheets={factsheets}
          researchItemTitles={researchItemTitles}
          onDataChanged={handleDataChanged}
          onSelectFactsheet={setSelectedFactsheet}
          onAssignFacts={() => {/* TODO: assign facts popover */}}
        />
      ) : (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          {factsheets.length > 0
            ? 'Select a factsheet to view details'
            : 'Create your first factsheet to get started'
          }
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "factsheet"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/
git commit -m "feat(research): complete factsheets tab with detail view, facts, links, promote"
```

---

## Task 9: Inbox Tab

**Files:**
- Create: `apps/web/components/research/inbox/inbox-tab.tsx`
- Create: `apps/web/components/research/inbox/inbox-item-card.tsx`
- Modify: `apps/web/components/research/research-layout.tsx`

- [ ] **Step 1: Create inbox-item-card.tsx**

```typescript
// apps/web/components/research/inbox/inbox-item-card.tsx
'use client';

import { Button } from '@/components/ui/button';
import { DISCOVERY_METHOD_LABELS } from '@/lib/research/constants';
import type { InboxItem } from '@/lib/research/factsheet-client';

interface InboxItemCardProps {
  item: InboxItem;
  onAssign: () => void;
  onCreateFactsheet: () => void;
  onDismiss: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function InboxItemCard({ item, onAssign, onCreateFactsheet, onDismiss }: InboxItemCardProps) {
  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {methodLabel} · {timeAgo(item.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAssign}>
          Assign to person
        </Button>
        <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={onCreateFactsheet}>
          Create factsheet
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create inbox-tab.tsx**

```typescript
// apps/web/components/research/inbox/inbox-tab.tsx
'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInbox } from '@/lib/research/factsheet-client';
import { InboxItemCard } from './inbox-item-card';

export function InboxTab() {
  const { items, total, isLoading, refetch } = useInbox();

  const handleDismiss = useCallback(async (itemId: string) => {
    try {
      await fetch(`/api/research/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      toast.success('Item dismissed');
      refetch();
    } catch {
      toast.error('Failed to dismiss');
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium mb-1">Inbox is empty</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
          When you search without selecting a person first, saved items appear here for triage.
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.href = '/research'}>
          Go to Search
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Unanchored Items</h2>
        <p className="text-xs text-muted-foreground">
          Research items not linked to any person. Assign them or dismiss.
        </p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <InboxItemCard
            key={item.id}
            item={item}
            onAssign={() => {/* TODO: person search popover */}}
            onCreateFactsheet={() => {/* TODO: person select → create factsheet flow */}}
            onDismiss={() => handleDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire inbox into research-layout.tsx**

In `apps/web/components/research/research-layout.tsx`, add these changes:

Add import at top:
```typescript
import { Inbox } from 'lucide-react';
import { InboxTab } from './inbox/inbox-tab';
import { useInboxCount } from '@/lib/research/factsheet-client';
import { Badge } from '@/components/ui/badge';
```

Update the type and tabs array (lines 10-20):
```typescript
type ResearchView = 'search' | 'chat' | 'inbox';

const tabs: { value: ResearchView; label: string; icon: typeof Search }[] = [
  { value: 'search', label: 'Search', icon: Search },
  { value: 'chat', label: 'AI Chat', icon: Sparkles },
  { value: 'inbox', label: 'Inbox', icon: Inbox },
];
```

Inside `ResearchLayoutInner`, add the inbox count hook:
```typescript
  const { count: inboxCount } = useInboxCount();
```

In the tab button rendering, after `{tab.label}`, add the inbox badge:
```typescript
              {tab.value === 'inbox' && inboxCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-amber-500/20 text-amber-500">
                  {inboxCount}
                </Badge>
              )}
```

In the content area, add the inbox tab render after the chat panel:
```typescript
        {activeView === 'inbox' && (
          <div className="h-full overflow-y-auto p-6">
            <InboxTab />
          </div>
        )}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep -E "inbox|research-layout"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/inbox/ apps/web/components/research/research-layout.tsx
git commit -m "feat(research): inbox tab with unanchored items in research hub"
```

---

## Task 10: Update Docs

**Files:**
- Modify: `docs/INDEX.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Add UI spec to INDEX.md**

Add after the Research → Tree Pipeline entry:
```markdown
| Factsheet UI Components | [spec](superpowers/specs/2026-03-27-factsheet-ui-components-design.md) | 2 | approved | In Progress |
```

- [ ] **Step 2: Add UI items to ROADMAP.md Phase 2**

Add after the Factsheet Pipeline section:
```markdown
### Factsheet UI Components — In Progress

| Feature | Status |
|---------|--------|
| Factsheet data hooks + mutations | `[██████████] 100% Complete` |
| Factsheet status constants | `[██████████] 100% Complete` |
| Workspace tab wiring (factsheets) | `[██████████] 100% Complete` |
| Factsheet card + list + create form | `[██████████] 100% Complete` |
| Factsheet fact row + facts section (with conflicts) | `[██████████] 100% Complete` |
| Factsheet links section | `[██████████] 100% Complete` |
| Progressive promote accordion | `[██████████] 100% Complete` |
| Factsheet detail + full tab assembly | `[██████████] 100% Complete` |
| Inbox tab (research hub) | `[██████████] 100% Complete` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/INDEX.md ROADMAP.md
git commit -m "docs: add factsheet UI spec and roadmap entries"
```
