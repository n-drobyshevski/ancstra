# Factsheet Page Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/research/factsheets` page fully responsive on mobile (< 768px) with list/detail navigation, condensed stats, long-press batch selection, and floating action bar.

**Architecture:** Pure CSS/component changes — no API or schema modifications. Mobile shows list OR detail (conditional swap based on `?fs` URL param). Graph view hidden below `md`. Stats bar collapses to single line. Long-press (500ms) on cards enters batch selection with floating bottom bar.

**Tech Stack:** React 19, Tailwind CSS v4, Next.js 16, shadcn/ui, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-27-factsheet-page-mobile-design.md`

**IMPORTANT:** Before writing any Next.js code, read relevant docs in `node_modules/next/dist/docs/`.

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `apps/web/components/research/factsheets/factsheet-stats-bar.tsx` | Add condensed mobile row with tap-to-expand |
| `apps/web/components/research/factsheets/factsheet-card.tsx` | Add `onLongPress` prop with 500ms timer |
| `apps/web/components/research/factsheets/batch-actions-bar.tsx` | Add mobile floating variant with Cancel/Done |
| `apps/web/components/research/factsheets/factsheet-sidebar.tsx` | Wire long-press, remove border-right on mobile, pass `onExitBatchMode` |
| `apps/web/components/research/factsheets/factsheets-layout.tsx` | Mobile list/detail split, back button header, hide graph toggle |

---

## Task 1: Stats Bar — Condensed Mobile Mode

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-stats-bar.tsx`

- [ ] **Step 1: Rewrite stats bar with condensed/expanded modes**

Replace the entire file content:

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FactsheetStatsBarProps {
  factsheets: FactsheetWithCounts[];
}

export function FactsheetStatsBar({ factsheets }: FactsheetStatsBarProps) {
  const [expanded, setExpanded] = useState(false);

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
    <div className="border-b border-border px-3 py-2">
      {/* Condensed row — mobile only */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between md:hidden"
      >
        <span className="text-xs text-muted-foreground">
          {total} factsheets · {draft} draft
          {conflicts > 0 && <span className="text-red-500"> · {conflicts} conflicts</span>}
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Full grid — always on desktop, conditionally on mobile */}
      <div
        className={`grid grid-cols-4 gap-2 text-center ${
          expanded ? 'grid mt-2' : 'hidden'
        } md:grid md:mt-0`}
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className={`text-lg font-bold ${stat.className}`}>{stat.value}</div>
            <div className="text-[10px] font-medium uppercase text-muted-foreground">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Resize browser to < 768px. Verify:
- Condensed row shows: "N factsheets · N draft · N conflicts"
- Chevron icon visible
- Tapping toggles the full 4-column grid
- At ≥ 768px, full grid is always visible, condensed row is hidden

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-stats-bar.tsx
git commit -m "feat: add condensed mobile mode to FactsheetStatsBar"
```

---

## Task 2: FactsheetCard — Long-Press Handler

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-card.tsx`

- [ ] **Step 1: Add onLongPress prop and timer logic**

Add `onLongPress` to the props interface:

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
  onLongPress?: () => void;
}
```

Add `useRef` to the imports:

```ts
import { useRef, useCallback } from 'react';
```

Inside the component function, add the long-press handlers before the return statement:

```ts
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const handlePointerDown = useCallback(() => {
  if (!onLongPress) return;
  longPressTimer.current = setTimeout(() => {
    onLongPress();
    longPressTimer.current = null;
  }, 500);
}, [onLongPress]);

const handlePointerUpOrLeave = useCallback(() => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
}, []);
```

Add the pointer event handlers to the outer `<div>` element (the one with `role="button"`):

```ts
onPointerDown={handlePointerDown}
onPointerUp={handlePointerUpOrLeave}
onPointerLeave={handlePointerUpOrLeave}
onPointerCancel={handlePointerUpOrLeave}
```

Also add `onLongPress` to the destructured props.

- [ ] **Step 2: Verify**

Long-press (hold 500ms) on a card should trigger the `onLongPress` callback when wired. For now just verify no errors — the wiring happens in Task 4.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-card.tsx
git commit -m "feat: add onLongPress handler to FactsheetCard"
```

---

## Task 3: BatchActionsBar — Mobile Floating Variant

**Files:**
- Modify: `apps/web/components/research/factsheets/batch-actions-bar.tsx`

- [ ] **Step 1: Add mobile prop and floating layout**

Replace the entire file:

```tsx
'use client';

import { Button } from '@/components/ui/button';

interface BatchActionsBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onBatchDismiss: () => void;
  onBatchLink: () => void;
  isAllSelected: boolean;
  onCancel?: () => void;
}

export function BatchActionsBar({
  selectedCount, onSelectAll, onBatchDismiss, onBatchLink, isAllSelected, onCancel,
}: BatchActionsBarProps) {
  return (
    <>
      {/* Desktop: inline bar */}
      <div className="hidden md:flex gap-2 border-t border-border bg-muted/30 px-3 py-2">
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onSelectAll}>
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-xs" disabled={selectedCount === 0} onClick={onBatchDismiss}>
          Batch Dismiss
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-xs" disabled={selectedCount < 2} onClick={onBatchLink}>
          Batch Link
        </Button>
      </div>

      {/* Mobile: floating bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom,0px)] pt-2 shadow-lg md:hidden">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Done
          </Button>
        </div>
        <div className="flex gap-2 pb-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={selectedCount === 0}
            onClick={onBatchDismiss}
          >
            Dismiss
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={selectedCount < 2}
            onClick={onBatchLink}
          >
            Link
          </Button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/research/factsheets/batch-actions-bar.tsx
git commit -m "feat: add mobile floating variant to BatchActionsBar"
```

---

## Task 4: FactsheetSidebar — Mobile Adaptations

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheet-sidebar.tsx`

- [ ] **Step 1: Remove border-right on mobile**

Change the outer `<div>` className from:
```
"flex flex-col overflow-hidden border-r border-border"
```
to:
```
"flex flex-col overflow-hidden md:border-r border-border"
```

- [ ] **Step 2: Wire long-press to enter batch mode**

Add a `handleLongPress` function after the existing handlers:

```ts
const handleLongPress = useCallback((id: string) => {
  setBatchMode(true);
  setSelected(new Set([id]));
}, []);
```

In the `FactsheetCard` rendering inside the list, add the `onLongPress` prop:

```tsx
<FactsheetCard
  key={fs.id}
  factsheet={fs}
  isSelected={fs.id === selectedId}
  factCount={fs.factCount}
  linkCount={fs.linkCount}
  conflictCount={fs.conflictCount}
  onClick={() => {
    if (batchMode) {
      handleCheckChange(fs.id, !selected.has(fs.id));
    } else {
      onSelect(fs.id);
    }
  }}
  isUnanchored={fs.isUnanchored}
  isSelectable={batchMode}
  isChecked={selected.has(fs.id)}
  onCheckChange={(checked) => handleCheckChange(fs.id, checked)}
  onLongPress={() => handleLongPress(fs.id)}
/>
```

Note the `onClick` change: when in batch mode, tapping a card toggles its selection instead of navigating.

- [ ] **Step 3: Pass onCancel to BatchActionsBar**

Update the `BatchActionsBar` rendering to include `onCancel`:

```tsx
{batchMode && (
  <BatchActionsBar
    selectedCount={selected.size}
    onSelectAll={handleSelectAll}
    onBatchDismiss={handleBatchDismiss}
    onBatchLink={handleBatchLink}
    isAllSelected={isAllSelected}
    onCancel={() => {
      setBatchMode(false);
      setSelected(new Set());
    }}
  />
)}
```

- [ ] **Step 4: Verify**

On mobile (< 768px):
- Long-press a card → batch mode activates, card is auto-selected
- Floating bar appears at bottom with Cancel/Done + Dismiss/Link
- Tapping cards toggles selection (doesn't navigate)
- Cancel/Done exits batch mode

On desktop (≥ 768px):
- Behavior unchanged — Select button, inline bar

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/factsheets/factsheet-sidebar.tsx
git commit -m "feat: wire long-press batch selection and mobile adaptations in sidebar"
```

---

## Task 5: FactsheetsLayout — Mobile List/Detail Split

**Files:**
- Modify: `apps/web/components/research/factsheets/factsheets-layout.tsx`

- [ ] **Step 1: Add ArrowLeft import and clearSelection helper**

Add to the lucide-react imports at the top of the file:

```ts
import { ArrowLeft } from 'lucide-react';
```

Add a `clearSelection` callback after the existing `setView` callback:

```ts
const clearSelection = useCallback(() => {
  const params = new URLSearchParams(searchParams.toString());
  params.delete('fs');
  params.delete('view');
  router.push(`${pathname}?${params.toString()}`);
}, [searchParams, router, pathname]);
```

- [ ] **Step 2: Disable auto-select on mobile**

The current auto-select effect selects the first factsheet on mount. On mobile this would immediately show the detail view. Guard it:

Replace:
```ts
useEffect(() => {
  if (!selectedId && factsheets.length > 0) {
    setSelectedFactsheet(factsheets[0].id);
  }
}, [selectedId, factsheets, setSelectedFactsheet]);
```

With:
```ts
useEffect(() => {
  // Only auto-select on desktop — on mobile, show list first
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  if (isDesktop && !selectedId && factsheets.length > 0) {
    setSelectedFactsheet(factsheets[0].id);
  }
}, [selectedId, factsheets, setSelectedFactsheet]);
```

- [ ] **Step 3: Rewrite the return JSX for desktop/mobile split**

Replace the entire return block (lines 70–156) with:

```tsx
return (
  <>
    <div className="h-full overflow-hidden rounded-lg border border-border">
      {/* Desktop: 2-column grid */}
      <div className="hidden h-full md:grid md:grid-cols-[280px_1fr]">
        <FactsheetSidebar
          factsheets={factsheets}
          selectedId={selectedId}
          onSelect={setSelectedFactsheet}
          onDataChanged={handleDataChanged}
        />

        <div className="flex flex-col overflow-hidden">
          {/* Toolbar with view toggle */}
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
            <div className="flex items-center gap-3">
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

          {/* Desktop content */}
          <div className={`flex-1 ${view === 'graph' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
              <FactsheetGraphView
                factsheets={factsheets}
                links={links}
                selectedId={selectedId}
                onSelectFactsheet={setSelectedFactsheet}
                onPromoteCluster={(cluster) => setPromoteCluster(cluster)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile: list OR detail */}
      <div className="flex h-full flex-col md:hidden">
        {selectedId && detail ? (
          <>
            {/* Mobile detail header */}
            <div className="flex h-12 items-center gap-2 border-b border-border px-3">
              <button
                onClick={clearSelection}
                className="-ml-1 rounded-md p-1.5 hover:bg-muted"
                aria-label="Back to factsheet list"
              >
                <ArrowLeft className="size-4" />
              </button>
              <span className="flex-1 truncate text-sm font-semibold">{detail.title}</span>
            </div>
            {/* Mobile detail content */}
            <div className="flex-1 overflow-y-auto">
              <FactsheetDetail
                detail={detail}
                allFactsheets={allFactsheets}
                researchItemTitles={researchItemTitles}
                onDataChanged={handleDataChanged}
                onSelectFactsheet={setSelectedFactsheet}
              />
            </div>
          </>
        ) : (
          <FactsheetSidebar
            factsheets={factsheets}
            selectedId={selectedId}
            onSelect={setSelectedFactsheet}
            onDataChanged={handleDataChanged}
          />
        )}
      </div>
    </div>

    {promoteCluster && (
      <FamilyPromoteModal
        open={!!promoteCluster}
        onClose={() => setPromoteCluster(null)}
        factsheets={promoteCluster}
        onPromoted={() => {
          setPromoteCluster(null);
          handleDataChanged();
        }}
      />
    )}
  </>
);
```

- [ ] **Step 4: Verify on mobile**

Resize browser to < 768px. Verify:
- List view is full-screen (no graph toggle visible)
- Tapping a factsheet shows detail with back arrow header
- Back arrow returns to list (clears `?fs` param)
- No graph toggle visible on mobile
- Stats bar shows condensed row

Resize to ≥ 768px. Verify:
- 2-column layout unchanged
- Detail/Graph toggle visible
- Graph view works

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/factsheets/factsheets-layout.tsx
git commit -m "feat: add mobile list/detail split with back navigation, hide graph toggle"
```

---

## Summary

| Task | Component | Mobile Change |
|------|-----------|---------------|
| 1 | `factsheet-stats-bar.tsx` | Condensed row with tap-to-expand |
| 2 | `factsheet-card.tsx` | `onLongPress` prop (500ms timer) |
| 3 | `batch-actions-bar.tsx` | Floating bottom bar with Cancel/Done |
| 4 | `factsheet-sidebar.tsx` | No border-right, long-press wiring, batch mode on tap |
| 5 | `factsheets-layout.tsx` | List OR detail, back button header, hide graph |

After all 5 tasks, the factsheet page is fully responsive. Desktop behavior unchanged.
