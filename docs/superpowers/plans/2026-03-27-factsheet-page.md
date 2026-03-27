# Factsheet Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated factsheet page at `/research/factsheets` with cross-person overview, relationship graph canvas, batch operations, and family unit promotion.

**Architecture:** Combined sidebar (280px) + switchable main area (Detail ↔ Graph). Reuses existing `FactsheetDetail`, `FactsheetCard`, `FactsheetFactsSection`, `FactsheetLinksSection` components. Graph view uses `@xyflow/react` (already installed). New `useAllFactsheets` hook fetches cross-person data. Stats bar, filters, and batch actions in sidebar.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, Tailwind CSS v4, @xyflow/react, Drizzle ORM, better-sqlite3

**Spec:** `docs/superpowers/specs/2026-03-27-factsheet-page-design.md`

**IMPORTANT:** Before writing any Next.js code, read the relevant docs in `node_modules/next/dist/docs/` — this project uses Next.js 16 which has breaking changes from your training data.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/app/(auth)/research/factsheets/page.tsx` | Page route — server component shell |
| `apps/web/components/research/factsheets/factsheets-layout.tsx` | Client layout: sidebar + main with view toggle |
| `apps/web/components/research/factsheets/factsheet-sidebar.tsx` | Sidebar: stats + search + filters + list + batch |
| `apps/web/components/research/factsheets/factsheet-stats-bar.tsx` | Pipeline health stats (total/draft/ready/conflicts) |
| `apps/web/components/research/factsheets/batch-actions-bar.tsx` | Multi-select batch operations toolbar |
| `apps/web/components/research/factsheets/factsheet-graph-view.tsx` | React Flow canvas with force layout |
| `apps/web/components/research/factsheets/factsheet-graph-node.tsx` | Custom React Flow node for factsheets |
| `apps/web/components/research/factsheets/factsheet-graph-edge.tsx` | Custom labeled edge (spouse/parent/sibling) |
| `apps/web/components/research/factsheets/factsheet-cluster.tsx` | Cluster outline overlay + promote button |
| `apps/web/components/research/factsheets/family-promote-modal.tsx` | Family unit promotion wizard |
| `apps/web/app/api/research/factsheets/links/route.ts` | GET all factsheet links (for graph) |
| `apps/web/app/api/research/factsheets/batch/route.ts` | POST batch operations |
| `packages/research/src/factsheets/links-queries.ts` | `listAllFactsheetLinks()` query |
| `packages/research/src/factsheets/batch.ts` | `batchDismiss()`, `batchLink()` queries |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/components/app-sidebar.tsx` | Add Factsheets nav item with badge |
| `apps/web/lib/research/factsheet-client.ts` | Add `useAllFactsheets()`, `useAllFactsheetLinks()`, `useFactsheetCount()`, `batchDismiss()`, `batchLink()` |
| `apps/web/components/research/factsheets/factsheet-card.tsx` | Add unanchored indicator + optional checkbox |
| `apps/web/components/research/factsheets/factsheet-detail.tsx` | Make `personId` prop optional |
| `apps/web/components/research/factsheets/factsheet-facts-section.tsx` | Make `personId` prop optional |
| `packages/research/src/index.ts` | Export new queries |
| `packages/db/src/research-schema.ts` | Add `anchoredManually` column to factsheets |

---

## Task 1: Sidebar Nav Entry + Page Route

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`
- Create: `apps/web/app/(auth)/research/factsheets/page.tsx`

- [ ] **Step 1: Add Factsheets to sidebar navigation**

In `apps/web/components/app-sidebar.tsx`, add the `FileStack` import and new nav item:

```ts
import {
  Home,
  Users,
  GitBranch,
  Microscope,
  Bookmark,
  Upload,
  Download,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
  FileStack,
  type LucideIcon,
} from 'lucide-react';
```

Update `researchItems`:

```ts
const researchItems: NavItem[] = [
  { title: 'Research', href: '/research', icon: Microscope },
  { title: 'Factsheets', href: '/research/factsheets', icon: FileStack },
  { title: 'Sources', href: '/sources', icon: Bookmark },
];
```

Fix the active state in `NavGroup` to handle path prefix overlap — `/research/factsheets` must not also highlight `/research`:

```tsx
function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          // Check if another item in this group is a more specific match
          const hasMoreSpecificMatch = items.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(item.href) &&
              pathname.startsWith(other.href)
          );
          const isActive = pathname.startsWith(item.href) && !hasMoreSpecificMatch;

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge != null && item.badge > 0 && (
                <SidebarMenuBadge className="bg-primary/20 text-primary">
                  {item.badge}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
```

- [ ] **Step 2: Create placeholder page**

Create `apps/web/app/(auth)/research/factsheets/page.tsx`:

```tsx
export default function FactsheetsPage() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Factsheets page — coming soon
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev` (if not already running)

Navigate to `/research/factsheets`. Verify:
- Page renders the placeholder text
- Sidebar shows "Factsheets" item with `FileStack` icon under Research group
- "Factsheets" is highlighted, "Research" is NOT highlighted
- Clicking "Research" still navigates to `/research`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/app-sidebar.tsx apps/web/app/\(auth\)/research/factsheets/page.tsx
git commit -m "feat: add factsheets nav item and placeholder page route"
```

---

## Task 2: API Enhancement — Cross-Person Listing + Counts

**Files:**
- Modify: `packages/research/src/factsheets/queries.ts`
- Modify: `packages/research/src/index.ts`
- Modify: `apps/web/app/api/research/factsheets/route.ts`
- Modify: `apps/web/lib/research/factsheet-client.ts`

- [ ] **Step 1: Add `listFactsheetsWithCounts` query**

In `packages/research/src/factsheets/queries.ts`, add after `listFactsheets`:

```ts
export interface FactsheetWithCounts {
  id: string;
  title: string;
  entityType: string;
  status: string;
  notes: string | null;
  promotedPersonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  factCount: number;
  linkCount: number;
  conflictCount: number;
  isUnanchored: boolean;
}

export async function listFactsheetsWithCounts(
  db: Database,
  filters: FactsheetFilters = {}
): Promise<FactsheetWithCounts[]> {
  const rows = await listFactsheets(db, filters);

  // Batch-fetch counts for all factsheets
  const ids = rows.map((r: any) => r.id);
  if (ids.length === 0) return [];

  // Fact counts
  const factCounts = await db.all<{ factsheetId: string; cnt: number }>(sql`
    SELECT factsheet_id as factsheetId, COUNT(*) as cnt
    FROM research_facts
    WHERE factsheet_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    GROUP BY factsheet_id
  `);
  const factMap = new Map(factCounts.map(r => [r.factsheetId, r.cnt]));

  // Link counts
  const linkCounts = await db.all<{ fsId: string; cnt: number }>(sql`
    SELECT fs_id as fsId, SUM(cnt) as cnt FROM (
      SELECT from_factsheet_id as fs_id, COUNT(*) as cnt
      FROM factsheet_links
      WHERE from_factsheet_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
      GROUP BY from_factsheet_id
      UNION ALL
      SELECT to_factsheet_id as fs_id, COUNT(*) as cnt
      FROM factsheet_links
      WHERE to_factsheet_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
      GROUP BY to_factsheet_id
    ) GROUP BY fs_id
  `);
  const linkMap = new Map(linkCounts.map(r => [r.fsId, r.cnt]));

  // Anchored check: factsheets with at least one fact that has a personId
  const anchored = await db.all<{ factsheetId: string }>(sql`
    SELECT DISTINCT factsheet_id as factsheetId
    FROM research_facts
    WHERE factsheet_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
      AND person_id IS NOT NULL
  `);
  const anchoredSet = new Set(anchored.map(r => r.factsheetId));

  return rows.map((r: any) => ({
    ...r,
    factCount: factMap.get(r.id) ?? 0,
    linkCount: linkMap.get(r.id) ?? 0,
    conflictCount: 0, // TODO: conflicts require per-factsheet detection — expensive, defer to detail view
    isUnanchored: r.promotedPersonId === null && !anchoredSet.has(r.id),
  }));
}
```

- [ ] **Step 2: Export the new query**

In `packages/research/src/index.ts`, add to the factsheets exports:

```ts
export { listFactsheetsWithCounts, type FactsheetWithCounts } from './factsheets/queries';
```

Find the existing factsheets export block and add `listFactsheetsWithCounts` and `FactsheetWithCounts` alongside the existing exports.

- [ ] **Step 3: Update API route to support `include=counts`**

In `apps/web/app/api/research/factsheets/route.ts`, update the GET handler:

```ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createFactsheet, listFactsheets, listFactsheetsWithCounts } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get('status') ?? undefined,
      createdBy: searchParams.get('createdBy') ?? undefined,
      personId: searchParams.get('personId') ?? undefined,
    };

    const includeCounts = searchParams.get('include') === 'counts';

    if (includeCounts) {
      const rows = await listFactsheetsWithCounts(familyDb, filters);
      return NextResponse.json({ factsheets: rows });
    }

    const rows = await listFactsheets(familyDb, filters);
    return NextResponse.json({ factsheets: rows });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

Keep the POST handler unchanged.

- [ ] **Step 4: Add `useAllFactsheets` and `useFactsheetCount` hooks**

In `apps/web/lib/research/factsheet-client.ts`, add after the existing `useFactsheets` hook:

```ts
// ---------------------------------------------------------------------------
// Types for cross-person listing with counts
// ---------------------------------------------------------------------------

export interface FactsheetWithCounts extends Factsheet {
  factCount: number;
  linkCount: number;
  conflictCount: number;
  isUnanchored: boolean;
}

// ---------------------------------------------------------------------------
// useAllFactsheets — fetch all factsheets across all people, with counts
// ---------------------------------------------------------------------------
export function useAllFactsheets() {
  const { data, isLoading, error, refetch } = useFetchData<{
    factsheets: FactsheetWithCounts[];
  }>('/api/research/factsheets?include=counts');

  return { factsheets: data?.factsheets ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useFactsheetCount — lightweight count for sidebar badge
// ---------------------------------------------------------------------------
export function useFactsheetCount() {
  const { factsheets } = useAllFactsheets();
  const count = factsheets.filter(
    (fs) => fs.status === 'draft' || fs.status === 'ready'
  ).length;
  return { count };
}
```

- [ ] **Step 5: Wire sidebar badge**

In `apps/web/components/app-sidebar.tsx`, import `useFactsheetCount` and add badge:

```ts
import { useInboxCount, useFactsheetCount } from '@/lib/research/factsheet-client';
```

In `AppSidebar`, add the count and inject it:

```tsx
export function AppSidebar() {
  const pathname = usePathname();
  const { count: inboxCount } = useInboxCount();
  const { count: factsheetCount } = useFactsheetCount();

  const researchWithBadges = researchItems.map((item) => {
    if (item.href === '/research') return { ...item, badge: inboxCount };
    if (item.href === '/research/factsheets') return { ...item, badge: factsheetCount };
    return item;
  });
  // ... rest unchanged
```

- [ ] **Step 6: Verify**

Navigate to `/research/factsheets`. Sidebar should show factsheet badge count.

Open browser devtools Network tab, verify `GET /api/research/factsheets?include=counts` returns factsheets with `factCount`, `linkCount`, `isUnanchored` fields.

- [ ] **Step 7: Commit**

```bash
git add packages/research/src/factsheets/queries.ts packages/research/src/index.ts apps/web/app/api/research/factsheets/route.ts apps/web/lib/research/factsheet-client.ts apps/web/components/app-sidebar.tsx
git commit -m "feat: add cross-person factsheet listing with counts and sidebar badge"
```

---

## Task 3: Make FactsheetDetail Accept Optional personId

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-detail.tsx`
- Modify: `apps/web/components/research/factsheets/factsheet-facts-section.tsx`

- [ ] **Step 1: Update FactsheetFactsSection**

In `apps/web/components/research/factsheets/factsheet-facts-section.tsx`, change `personId` from required to optional:

```ts
interface FactsheetFactsSectionProps {
  factsheetId: string;
  personId?: string;  // was: personId: string
  facts: FactsheetFact[];
  conflicts: FactsheetConflict[];
  researchItemTitles: Map<string, string>;
  onDataChanged: () => void;
}
```

Find any usage of `personId` inside the component and guard with optional chaining or conditionals. The "Assign facts" feature needs `personId` to query available facts — when absent, disable that button or show "Link to a person first to assign facts."

- [ ] **Step 2: Update FactsheetDetail**

In `apps/web/components/research/factsheets/factsheet-detail.tsx`, change the interface:

```ts
interface FactsheetDetailProps {
  detail: FactsheetDetailType;
  allFactsheets: Factsheet[];
  researchItemTitles: Map<string, string>;
  personId?: string;  // was: personId: string
  onDataChanged: () => void;
  onSelectFactsheet: (id: string) => void;
}
```

No other changes needed — `personId` is passed through to `FactsheetFactsSection` which now handles optional.

- [ ] **Step 3: Verify existing per-person tab still works**

Navigate to `/research/person/[any-person-id]` → Factsheets tab. Verify factsheet detail still renders correctly with the existing personId being passed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-detail.tsx apps/web/components/research/factsheets/factsheet-facts-section.tsx
git commit -m "refactor: make personId optional in FactsheetDetail and FactsheetFactsSection"
```

---

## Task 4: FactsheetStatsBar Component

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-stats-bar.tsx`

- [ ] **Step 1: Build the stats bar**

Create `apps/web/components/research/factsheets/factsheet-stats-bar.tsx`:

```tsx
'use client';

import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FactsheetStatsBarProps {
  factsheets: FactsheetWithCounts[];
}

export function FactsheetStatsBar({ factsheets }: FactsheetStatsBarProps) {
  const total = factsheets.length;
  const draft = factsheets.filter((fs) => fs.status === 'draft').length;
  const ready = factsheets.filter((fs) => fs.status === 'ready').length;
  const conflicts = factsheets.reduce((sum, fs) => sum + fs.conflictCount, 0);

  const stats = [
    { label: 'Total', value: total, className: 'text-foreground' },
    { label: 'Draft', value: draft, className: 'text-amber-500' },
    { label: 'Ready', value: ready, className: 'text-green-600' },
    { label: 'Conflicts', value: conflicts, className: 'text-red-500' },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-2 border-b border-border px-3 py-3 text-center">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className={`text-lg font-bold ${stat.className}`}>{stat.value}</div>
          <div className="text-[10px] font-medium uppercase text-muted-foreground">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-stats-bar.tsx
git commit -m "feat: add FactsheetStatsBar component"
```

---

## Task 5: FactsheetCard — Unanchored Indicator + Checkbox

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-card.tsx`

- [ ] **Step 1: Read the current FactsheetCard**

Read `apps/web/components/research/factsheets/factsheet-card.tsx` to see its full implementation.

- [ ] **Step 2: Add unanchored and selection props**

Add new props to the interface:

```ts
interface FactsheetCardProps {
  factsheet: Factsheet;
  isSelected: boolean;
  factCount: number;
  linkCount: number;
  conflictCount: number;
  onClick: () => void;
  isUnanchored?: boolean;
  isSelectable?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
}
```

Add the visual indicators to the component JSX:

- When `isUnanchored`, add `border-l-3 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20` to the card wrapper classes
- When `isUnanchored`, add `<span className="text-amber-600 dark:text-amber-400 text-[10px]">⚠ unanchored</span>` to the summary line
- When `isSelectable`, render a styled checkbox div at the top-left of the card: `<button role="checkbox" aria-checked={isChecked} onClick={(e) => { e.stopPropagation(); onCheckChange?.(!isChecked); }} className={cn('size-4 rounded border border-border flex items-center justify-center', isChecked && 'bg-primary border-primary')}>{isChecked && <Check className="size-3 text-primary-foreground" />}</button>` — import `Check` from lucide-react
- When `isSelectable`, clicking the checkbox should NOT trigger `onClick` (use `e.stopPropagation()`)

- [ ] **Step 3: Verify with browser**

This can be verified once integrated with the sidebar in the next task.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-card.tsx
git commit -m "feat: add unanchored indicator and checkbox to FactsheetCard"
```

---

## Task 6: FactsheetSidebar + Filters

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-sidebar.tsx`
- Create: `apps/web/components/research/factsheets/batch-actions-bar.tsx`

- [ ] **Step 1: Create BatchActionsBar**

Create `apps/web/components/research/factsheets/batch-actions-bar.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';

interface BatchActionsBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onBatchDismiss: () => void;
  onBatchLink: () => void;
  isAllSelected: boolean;
}

export function BatchActionsBar({
  selectedCount,
  onSelectAll,
  onBatchDismiss,
  onBatchLink,
  isAllSelected,
}: BatchActionsBarProps) {
  return (
    <div className="flex gap-2 border-t border-border bg-muted/30 px-3 py-2">
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        onClick={onSelectAll}
      >
        {isAllSelected ? 'Deselect All' : 'Select All'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        disabled={selectedCount === 0}
        onClick={onBatchDismiss}
      >
        Batch Dismiss
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs"
        disabled={selectedCount < 2}
        onClick={onBatchLink}
      >
        Batch Link
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create FactsheetSidebar**

Create `apps/web/components/research/factsheets/factsheet-sidebar.tsx`:

```tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FactsheetStatsBar } from './factsheet-stats-bar';
import { FactsheetCard } from './factsheet-card';
import { BatchActionsBar } from './batch-actions-bar';
import { CreateFactsheetForm } from './create-factsheet-form';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

type StatusFilter = 'all' | 'draft' | 'ready' | 'promoted' | 'unanchored';

const STATUS_ORDER = ['draft', 'ready', 'promoted', 'merged', 'dismissed'];

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'promoted', label: 'Promoted' },
  { value: 'unanchored', label: 'Unanchored' },
];

interface FactsheetSidebarProps {
  factsheets: FactsheetWithCounts[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDataChanged: () => void;
}

export function FactsheetSidebar({
  factsheets,
  selectedId,
  onSelect,
  onDataChanged,
}: FactsheetSidebarProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const filtered = useMemo(() => {
    let list = factsheets;

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((fs) => fs.title.toLowerCase().includes(q));
    }

    // Filter
    if (filter === 'unanchored') {
      list = list.filter((fs) => fs.isUnanchored);
    } else if (filter !== 'all') {
      list = list.filter((fs) => fs.status === filter);
    }

    // Sort by status order
    return [...list].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  }, [factsheets, search, filter]);

  const handleSelectAll = useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      setBatchMode(false);
    } else {
      setSelected(new Set(filtered.map((fs) => fs.id)));
      setBatchMode(true);
    }
  }, [filtered, selected.size]);

  const handleCheckChange = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      if (next.size === 0) setBatchMode(false);
      return next;
    });
  }, []);

  const handleBatchDismiss = useCallback(async () => {
    // TODO Task 10: implement batch dismiss API call
    console.log('batch dismiss', [...selected]);
  }, [selected]);

  const handleBatchLink = useCallback(async () => {
    // TODO Task 10: implement batch link modal
    console.log('batch link', [...selected]);
  }, [selected]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-background">
      {/* Stats */}
      <FactsheetStatsBar factsheets={factsheets} />

      {/* Search + Filters */}
      <div className="border-b border-border px-3 py-2">
        <Input
          placeholder="Search factsheets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Factsheets ({filtered.length})
        </span>
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

      {/* List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {showCreate && (
          <CreateFactsheetForm
            onCreated={() => {
              setShowCreate(false);
              onDataChanged();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {filtered.length === 0 && !showCreate && (
          <div className="px-2 py-8 text-center">
            <p className="mb-1 text-sm font-medium">No factsheets found</p>
            <p className="mb-4 text-xs text-muted-foreground">
              {filter !== 'all'
                ? 'Try a different filter.'
                : 'Extract facts from research items, then group them into hypotheses.'}
            </p>
          </div>
        )}

        {filtered.map((fs) => (
          <FactsheetCard
            key={fs.id}
            factsheet={fs}
            isSelected={selectedId === fs.id}
            factCount={fs.factCount}
            linkCount={fs.linkCount}
            conflictCount={fs.conflictCount}
            isUnanchored={fs.isUnanchored}
            isSelectable={batchMode}
            isChecked={selected.has(fs.id)}
            onCheckChange={(checked) => handleCheckChange(fs.id, checked)}
            onClick={() => onSelect(fs.id)}
          />
        ))}
      </div>

      {/* Batch Actions */}
      <BatchActionsBar
        selectedCount={selected.size}
        onSelectAll={handleSelectAll}
        onBatchDismiss={handleBatchDismiss}
        onBatchLink={handleBatchLink}
        isAllSelected={selected.size === filtered.length && filtered.length > 0}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-sidebar.tsx apps/web/components/research/factsheets/batch-actions-bar.tsx
git commit -m "feat: add FactsheetSidebar with stats, search, filters, and batch actions"
```

---

## Task 7: FactsheetsLayout + Wire Page

**Files:**
- Create: `apps/web/components/research/factsheets/factsheets-layout.tsx`
- Modify: `apps/web/app/(auth)/research/factsheets/page.tsx`

- [ ] **Step 1: Build the main layout component**

Create `apps/web/components/research/factsheets/factsheets-layout.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAllFactsheets, useFactsheetDetail } from '@/lib/research/factsheet-client';
import { FactsheetSidebar } from './factsheet-sidebar';
import { FactsheetDetail } from './factsheet-detail';

export function FactsheetsLayout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = searchParams.get('view') ?? 'detail';
  const selectedId = searchParams.get('fs');

  const { factsheets, refetch: refetchList } = useAllFactsheets();
  const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedId);

  // Build research item titles map for detail view (empty for now — cross-person has no single item set)
  const researchItemTitles = useMemo(() => new Map<string, string>(), []);

  // All factsheets for links section
  const allFactsheets = useMemo(
    () => factsheets.map(({ factCount, linkCount, conflictCount, isUnanchored, ...fs }) => fs),
    [factsheets]
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const setSelectedFactsheet = useCallback(
    (id: string) => setParam('fs', id),
    [setParam]
  );

  const setView = useCallback(
    (v: string) => setParam('view', v),
    [setParam]
  );

  // Auto-select first factsheet
  useEffect(() => {
    if (!selectedId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedId, factsheets, setSelectedFactsheet]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
  }, [refetchList, refetchDetail]);

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden rounded-lg border border-border">
      {/* Sidebar */}
      <FactsheetSidebar
        factsheets={factsheets}
        selectedId={selectedId}
        onSelect={setSelectedFactsheet}
        onDataChanged={handleDataChanged}
      />

      {/* Main Area */}
      <div className="flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setView('detail')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  view === 'detail'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Detail
              </button>
              <button
                onClick={() => setView('graph')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  view === 'graph'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Graph
              </button>
            </div>

            {view === 'detail' && detail && (
              <span className="text-sm font-semibold">{detail.title}</span>
            )}
            {view === 'graph' && (
              <span className="text-xs text-muted-foreground">
                {factsheets.length} factsheets
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'detail' && detail ? (
            <FactsheetDetail
              detail={detail}
              allFactsheets={allFactsheets}
              researchItemTitles={researchItemTitles}
              onDataChanged={handleDataChanged}
              onSelectFactsheet={setSelectedFactsheet}
            />
          ) : view === 'detail' ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {factsheets.length > 0
                ? 'Select a factsheet from the list'
                : 'No factsheets yet. Create one to get started.'}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Graph view — coming in Task 8
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the page to render the layout**

Replace `apps/web/app/(auth)/research/factsheets/page.tsx`:

```tsx
import { Suspense } from 'react';
import { FactsheetsLayout } from '@/components/research/factsheets/factsheets-layout';

export default function FactsheetsPage() {
  return (
    <div className="p-4">
      <Suspense fallback={<div className="flex h-96 items-center justify-center text-muted-foreground">Loading factsheets...</div>}>
        <FactsheetsLayout />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Verify end-to-end**

Navigate to `/research/factsheets`. Verify:
- Stats bar shows correct counts
- Search filters the list
- Status filter pills work (All, Draft, Ready, Promoted, Unanchored)
- Clicking a factsheet shows its detail in the main area
- Detail/Graph toggle switches (Graph shows placeholder)
- URL updates with `?fs=...&view=...` params
- Unanchored factsheets show amber left border (if any exist)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/factsheets-layout.tsx apps/web/app/\(auth\)/research/factsheets/page.tsx
git commit -m "feat: wire FactsheetsLayout with sidebar, detail view, and view toggle"
```

---

## Task 8: All Factsheet Links API Endpoint

**Files:**
- Create: `packages/research/src/factsheets/links-queries.ts`
- Modify: `packages/research/src/index.ts`
- Create: `apps/web/app/api/research/factsheets/links/route.ts`
- Modify: `apps/web/lib/research/factsheet-client.ts`

- [ ] **Step 1: Add query to list all links**

Create `packages/research/src/factsheets/links-queries.ts`:

```ts
import { sql } from 'drizzle-orm';
import { factsheetLinks } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export async function listAllFactsheetLinks(db: Database) {
  return db.select().from(factsheetLinks).all();
}
```

- [ ] **Step 2: Export from research package**

In `packages/research/src/index.ts`, add:

```ts
export { listAllFactsheetLinks } from './factsheets/links-queries';
```

- [ ] **Step 3: Create API route**

Create `apps/web/app/api/research/factsheets/links/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { listAllFactsheetLinks } from '@ancstra/research';

export async function GET() {
  try {
    const { familyDb } = await withAuth('ai:research');
    const links = await listAllFactsheetLinks(familyDb);
    return NextResponse.json({ links });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheet-links GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add client hook**

In `apps/web/lib/research/factsheet-client.ts`, add:

```ts
// ---------------------------------------------------------------------------
// useAllFactsheetLinks — fetch all links for graph view
// ---------------------------------------------------------------------------
export function useAllFactsheetLinks() {
  const { data, isLoading, error, refetch } = useFetchData<{
    links: FactsheetLink[];
  }>('/api/research/factsheets/links');

  return { links: data?.links ?? [], isLoading, error, refetch };
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/research/src/factsheets/links-queries.ts packages/research/src/index.ts apps/web/app/api/research/factsheets/links/route.ts apps/web/lib/research/factsheet-client.ts
git commit -m "feat: add API endpoint and hook for all factsheet links"
```

---

## Task 9: Graph View — Nodes, Edges, Clusters

**Files:**
- Create: `apps/web/components/research/factsheets/factsheet-graph-node.tsx`
- Create: `apps/web/components/research/factsheets/factsheet-graph-edge.tsx`
- Create: `apps/web/components/research/factsheets/factsheet-cluster.tsx`
- Create: `apps/web/components/research/factsheets/factsheet-graph-view.tsx`
- Modify: `apps/web/components/research/factsheets/factsheets-layout.tsx`

- [ ] **Step 1: Create custom graph node**

Create `apps/web/components/research/factsheets/factsheet-graph-node.tsx`:

```tsx
'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';

export interface FactsheetNodeData {
  title: string;
  status: string;
  entityType: string;
  factCount: number;
  isUnanchored: boolean;
  isSelected: boolean;
  [key: string]: unknown;
}

const BORDER_COLORS: Record<string, string> = {
  draft: 'border-indigo-400',
  ready: 'border-green-500',
  promoted: 'border-indigo-600',
  merged: 'border-cyan-500',
  dismissed: 'border-gray-300',
};

function FactsheetGraphNodeInner({ data }: NodeProps) {
  const nodeData = data as unknown as FactsheetNodeData;
  const statusCfg = FACTSHEET_STATUS_CONFIG[nodeData.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const borderColor = nodeData.isUnanchored
    ? 'border-amber-500'
    : BORDER_COLORS[nodeData.status] ?? 'border-gray-300';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div
        className={cn(
          'w-40 rounded-lg border-2 bg-background p-2.5 shadow-sm transition-shadow',
          borderColor,
          nodeData.isSelected && 'ring-2 ring-primary/50',
          nodeData.status === 'dismissed' && 'opacity-50'
        )}
      >
        <div className="truncate text-xs font-semibold">{nodeData.title}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {nodeData.factCount} facts
          {nodeData.isUnanchored && (
            <span className="ml-1 text-amber-600">⚠</span>
          )}
        </div>
        <div className="mt-1.5 flex gap-1">
          <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium', statusCfg.className)}>
            {statusCfg.label}
          </span>
          {nodeData.entityType !== 'person' && (
            <span className="rounded bg-muted px-1 py-0.5 text-[9px]">
              {nodeData.entityType}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}

export const FactsheetGraphNode = memo(FactsheetGraphNodeInner);
```

- [ ] **Step 2: Create custom edge**

Create `apps/web/components/research/factsheets/factsheet-graph-edge.tsx`:

```tsx
'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/research/constants';

const STROKE_STYLES: Record<string, string> = {
  spouse: '4',
  parent_child: '0',
  sibling: '2 2',
};

function FactsheetGraphEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const relType = (data?.relationshipType as string) ?? 'parent_child';
  const label = RELATIONSHIP_TYPE_LABELS[relType] ?? relType;
  const dashArray = STROKE_STYLES[relType] ?? '0';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: dashArray,
        }}
      />
      <foreignObject
        x={labelX - 20}
        y={labelY - 8}
        width={40}
        height={16}
        className="pointer-events-none"
      >
        <div className="flex items-center justify-center rounded border border-border bg-background px-1 text-[9px] text-muted-foreground">
          {label}
        </div>
      </foreignObject>
    </>
  );
}

export const FactsheetGraphEdge = memo(FactsheetGraphEdgeInner);
```

- [ ] **Step 3: Create graph view**

Create `apps/web/components/research/factsheets/factsheet-graph-view.tsx`:

```tsx
'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FactsheetGraphNode, type FactsheetNodeData } from './factsheet-graph-node';
import { FactsheetGraphEdge } from './factsheet-graph-edge';
import type { FactsheetWithCounts, FactsheetLink } from '@/lib/research/factsheet-client';

const nodeTypes = { factsheet: FactsheetGraphNode };
const edgeTypes = { factsheetEdge: FactsheetGraphEdge };

interface FactsheetGraphViewProps {
  factsheets: FactsheetWithCounts[];
  links: FactsheetLink[];
  selectedId: string | null;
  onSelectFactsheet: (id: string) => void;
}

function computeGridPositions(count: number): { x: number; y: number }[] {
  const cols = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * 220 + 50,
    y: Math.floor(i / cols) * 140 + 50,
  }));
}

export function FactsheetGraphView({
  factsheets,
  links,
  selectedId,
  onSelectFactsheet,
}: FactsheetGraphViewProps) {
  const initialNodes = useMemo<Node[]>(() => {
    const positions = computeGridPositions(factsheets.length);
    return factsheets.map((fs, i) => ({
      id: fs.id,
      type: 'factsheet',
      position: positions[i],
      data: {
        title: fs.title,
        status: fs.status,
        entityType: fs.entityType,
        factCount: fs.factCount,
        isUnanchored: fs.isUnanchored,
        isSelected: fs.id === selectedId,
      } satisfies FactsheetNodeData,
    }));
  }, [factsheets, selectedId]);

  const initialEdges = useMemo<Edge[]>(() => {
    return links.map((link) => ({
      id: link.id,
      source: link.fromFactsheetId,
      target: link.toFactsheetId,
      type: 'factsheetEdge',
      data: { relationshipType: link.relationshipType, confidence: link.confidence },
    }));
  }, [links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectFactsheet(node.id);
    },
    [onSelectFactsheet]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-muted/20"
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as FactsheetNodeData;
            if (data.isUnanchored) return '#f59e0b';
            if (data.status === 'ready') return '#10b981';
            if (data.status === 'promoted') return '#4f46e5';
            return '#818cf8';
          }}
          className="!bottom-4 !right-4"
        />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 4: Wire graph into layout**

In `apps/web/components/research/factsheets/factsheets-layout.tsx`, add the graph view import and data:

Add imports at top:

```ts
import { useAllFactsheets, useFactsheetDetail, useAllFactsheetLinks } from '@/lib/research/factsheet-client';
import { FactsheetGraphView } from './factsheet-graph-view';
```

Replace the `useAllFactsheets` line and add links:

```ts
const { factsheets, refetch: refetchList } = useAllFactsheets();
const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedId);
const { links } = useAllFactsheetLinks();
```

Replace the graph placeholder in the JSX (the `view === 'graph'` branch that shows "coming in Task 8"):

```tsx
) : (
  <FactsheetGraphView
    factsheets={factsheets}
    links={links}
    selectedId={selectedId}
    onSelectFactsheet={setSelectedFactsheet}
  />
)}
```

- [ ] **Step 5: Verify graph view**

Navigate to `/research/factsheets?view=graph`. Verify:
- Factsheet nodes render with correct titles, status badges, and border colors
- Edges render between linked factsheets with relationship labels
- Clicking a node selects it in the sidebar
- Zoom/pan/minimap work
- Nodes are draggable

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-graph-node.tsx apps/web/components/research/factsheets/factsheet-graph-edge.tsx apps/web/components/research/factsheets/factsheet-graph-view.tsx apps/web/components/research/factsheets/factsheets-layout.tsx
git commit -m "feat: add force-directed factsheet graph view with custom nodes and edges"
```

---

## Task 10: Batch Operations API

**Files:**
- Create: `packages/research/src/factsheets/batch.ts`
- Modify: `packages/research/src/index.ts`
- Create: `apps/web/app/api/research/factsheets/batch/route.ts`
- Modify: `apps/web/lib/research/factsheet-client.ts`
- Modify: `apps/web/components/research/factsheets/factsheet-sidebar.tsx`

- [ ] **Step 1: Create batch queries**

Create `packages/research/src/factsheets/batch.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { factsheets, factsheetLinks } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export async function batchDismissFactsheets(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  for (const id of ids) {
    await db.update(factsheets)
      .set({ status: 'dismissed', updatedAt: now })
      .where(eq(factsheets.id, id))
      .run();
  }
}

export async function batchLinkFactsheets(
  db: Database,
  factsheetIds: string[],
  relationshipType: 'parent_child' | 'spouse' | 'sibling',
  createdBy: string
) {
  if (factsheetIds.length < 2) return;
  const now = new Date().toISOString();

  // Create links between consecutive pairs
  for (let i = 0; i < factsheetIds.length - 1; i++) {
    const id = crypto.randomUUID();
    await db.insert(factsheetLinks)
      .values({
        id,
        fromFactsheetId: factsheetIds[i],
        toFactsheetId: factsheetIds[i + 1],
        relationshipType,
        confidence: 'medium',
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
  }
}
```

- [ ] **Step 2: Export batch functions**

In `packages/research/src/index.ts`, add:

```ts
export { batchDismissFactsheets, batchLinkFactsheets } from './factsheets/batch';
```

- [ ] **Step 3: Create batch API route**

Create `apps/web/app/api/research/factsheets/batch/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { batchDismissFactsheets, batchLinkFactsheets } from '@ancstra/research';

export async function POST(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research');
    const body = await request.json();

    const { action, factsheetIds, relationshipType } = body as {
      action: 'dismiss' | 'link';
      factsheetIds: string[];
      relationshipType?: string;
    };

    if (!action || !Array.isArray(factsheetIds) || factsheetIds.length === 0) {
      return NextResponse.json({ error: 'action and factsheetIds required' }, { status: 400 });
    }

    if (action === 'dismiss') {
      await batchDismissFactsheets(familyDb, factsheetIds);
      return NextResponse.json({ dismissed: factsheetIds.length });
    }

    if (action === 'link') {
      if (!relationshipType) {
        return NextResponse.json({ error: 'relationshipType required for link action' }, { status: 400 });
      }
      await batchLinkFactsheets(
        familyDb,
        factsheetIds,
        relationshipType as 'parent_child' | 'spouse' | 'sibling',
        ctx.userId
      );
      return NextResponse.json({ linked: factsheetIds.length });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets-batch POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add client mutations**

In `apps/web/lib/research/factsheet-client.ts`, add:

```ts
// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

export async function batchDismiss(factsheetIds: string[]) {
  const res = await fetch('/api/research/factsheets/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dismiss', factsheetIds }),
  });
  if (!res.ok) throw new Error('Batch dismiss failed');
  return res.json();
}

export async function batchLink(factsheetIds: string[], relationshipType: string) {
  const res = await fetch('/api/research/factsheets/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'link', factsheetIds, relationshipType }),
  });
  if (!res.ok) throw new Error('Batch link failed');
  return res.json();
}
```

- [ ] **Step 5: Wire batch actions in sidebar**

In `apps/web/components/research/factsheets/factsheet-sidebar.tsx`, replace the TODO batch handlers:

Add imports:

```ts
import { batchDismiss, batchLink } from '@/lib/research/factsheet-client';
import { toast } from 'sonner';
```

Replace `handleBatchDismiss`:

```ts
const handleBatchDismiss = useCallback(async () => {
  if (selected.size === 0) return;
  try {
    await batchDismiss([...selected]);
    toast.success(`Dismissed ${selected.size} factsheets`);
    setSelected(new Set());
    setBatchMode(false);
    onDataChanged();
  } catch {
    toast.error('Failed to batch dismiss');
  }
}, [selected, onDataChanged]);
```

Replace `handleBatchLink`:

```ts
const handleBatchLink = useCallback(async () => {
  if (selected.size < 2) return;
  // Default to parent_child — a proper modal picker is a future enhancement
  try {
    await batchLink([...selected], 'parent_child');
    toast.success(`Linked ${selected.size} factsheets`);
    setSelected(new Set());
    setBatchMode(false);
    onDataChanged();
  } catch {
    toast.error('Failed to batch link');
  }
}, [selected, onDataChanged]);
```

- [ ] **Step 6: Verify**

Select multiple factsheets → Batch Dismiss → verify they become dismissed. Select 2+ → Batch Link → verify links appear in graph view.

- [ ] **Step 7: Commit**

```bash
git add packages/research/src/factsheets/batch.ts packages/research/src/index.ts apps/web/app/api/research/factsheets/batch/route.ts apps/web/lib/research/factsheet-client.ts apps/web/components/research/factsheets/factsheet-sidebar.tsx
git commit -m "feat: add batch dismiss and batch link operations"
```

---

## Task 11: Family Unit Promote Modal

**Files:**
- Create: `apps/web/components/research/factsheets/family-promote-modal.tsx`
- Modify: `apps/web/components/research/factsheets/factsheet-graph-view.tsx`

- [ ] **Step 1: Create the family promote modal**

Create `apps/web/components/research/factsheets/family-promote-modal.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { promoteFactsheet } from '@/lib/research/factsheet-client';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FamilyPromoteModalProps {
  open: boolean;
  onClose: () => void;
  factsheets: FactsheetWithCounts[];
  onPromoted: () => void;
}

export function FamilyPromoteModal({
  open,
  onClose,
  factsheets,
  onPromoted,
}: FamilyPromoteModalProps) {
  const [isPromoting, setIsPromoting] = useState(false);

  const nonDismissed = factsheets.filter(
    (fs) => fs.status !== 'dismissed' && fs.status !== 'promoted' && fs.status !== 'merged'
  );

  const handlePromote = useCallback(async () => {
    setIsPromoting(true);
    try {
      // Promote each factsheet in the cluster sequentially using existing single-promote
      // The first one uses cluster=true to signal atomic family creation
      for (const fs of nonDismissed) {
        await promoteFactsheet(fs.id, 'create', undefined, true);
      }
      toast.success(`Promoted ${nonDismissed.length} factsheets as family unit`);
      onPromoted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  }, [nonDismissed, onPromoted, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote Family Unit</DialogTitle>
          <DialogDescription>
            This will create tree entries for {nonDismissed.length} factsheets and their relationships.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Will be promoted ({nonDismissed.length})
          </p>
          {nonDismissed.map((fs) => {
            const cfg = FACTSHEET_STATUS_CONFIG[fs.status] ?? FACTSHEET_STATUS_CONFIG.draft;
            return (
              <div
                key={fs.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium">{fs.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {fs.factCount} facts
                  </span>
                </div>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.className)}>
                  {cfg.label}
                </span>
              </div>
            );
          })}

          {nonDismissed.some((fs) => fs.conflictCount > 0) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Some factsheets have unresolved conflicts. Resolve them first for best results.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPromoting}>
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={isPromoting || nonDismissed.length === 0}>
            {isPromoting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Promote {nonDismissed.length} to Tree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add cluster selection + promote button to graph view**

In `apps/web/components/research/factsheets/factsheet-graph-view.tsx`, add cluster detection and the promote modal.

Add imports:

```ts
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FamilyPromoteModal } from './family-promote-modal';
```

Add cluster detection utility inside the file:

```ts
function findClusters(
  factsheets: FactsheetWithCounts[],
  links: FactsheetLink[]
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const fs of factsheets) adj.set(fs.id, new Set());
  for (const link of links) {
    adj.get(link.fromFactsheetId)?.add(link.toFactsheetId);
    adj.get(link.toFactsheetId)?.add(link.fromFactsheetId);
  }

  const visited = new Set<string>();
  const clusters = new Map<string, Set<string>>();

  for (const fsId of adj.keys()) {
    if (visited.has(fsId)) continue;
    const cluster = new Set<string>();
    const queue = [fsId];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      cluster.add(curr);
      for (const neighbor of adj.get(curr) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (cluster.size > 1) {
      const clusterId = [...cluster].sort().join(',');
      clusters.set(clusterId, cluster);
    }
  }
  return clusters;
}
```

Add state and UI to the `FactsheetGraphView` component:

```ts
const [promoteCluster, setPromoteCluster] = useState<FactsheetWithCounts[] | null>(null);

const clusters = useMemo(() => findClusters(factsheets, links), [factsheets, links]);

const selectedCluster = useMemo(() => {
  if (!selectedId) return null;
  for (const [, members] of clusters) {
    if (members.has(selectedId)) {
      return factsheets.filter((fs) => members.has(fs.id));
    }
  }
  return null;
}, [selectedId, clusters, factsheets]);
```

Add after the `<ReactFlow>` close tag but inside the outer div:

```tsx
{selectedCluster && selectedCluster.length > 1 && (
  <div className="absolute bottom-4 left-4 z-10">
    <Button
      onClick={() => setPromoteCluster(selectedCluster)}
      className="shadow-lg"
    >
      Promote Family Unit ({selectedCluster.length})
    </Button>
  </div>
)}

{promoteCluster && (
  <FamilyPromoteModal
    open={!!promoteCluster}
    onClose={() => setPromoteCluster(null)}
    factsheets={promoteCluster}
    onPromoted={() => {
      setPromoteCluster(null);
      onSelectFactsheet(promoteCluster[0].id);
    }}
  />
)}
```

Also add `onPromoted` callback prop to `FactsheetGraphViewProps` and wire it from the layout.

- [ ] **Step 3: Verify**

In graph view, click a node that's part of a cluster. Verify "Promote Family Unit (N)" button appears at bottom-left. Click it. Verify modal shows preview of factsheets to promote.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/factsheets/family-promote-modal.tsx apps/web/components/research/factsheets/factsheet-graph-view.tsx
git commit -m "feat: add family unit promotion modal with cluster detection"
```

---

## Summary

| Task | Priority | What It Delivers |
|------|----------|------------------|
| 1 | P0 | Route + sidebar entry |
| 2 | P0 | Cross-person API + hooks + badge |
| 3 | P0 | Make detail view reusable (optional personId) |
| 4 | P1 | Stats bar component |
| 5 | P1 | Card unanchored + checkbox |
| 6 | P0/P1 | Sidebar (search + filters + list + batch) |
| 7 | P0 | Layout shell wiring everything together |
| 8 | P2 | Links API for graph data |
| 9 | P2 | Graph view with nodes, edges, minimap |
| 10 | P4 | Batch dismiss + batch link |
| 11 | P3 | Family unit promotion modal |

After Task 7, you have a fully working factsheet page with cross-person overview and detail view. Tasks 8-11 add graph and batch features incrementally.
