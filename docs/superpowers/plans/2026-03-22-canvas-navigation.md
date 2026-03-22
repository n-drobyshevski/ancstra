# Canvas Navigation — Filter Pills + Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filter toggle pills to dim tree nodes by sex/living status, and enable multi-select with group repositioning.

**Architecture:** Filter state in TreeCanvas drives `applyFilters()` which sets `dimmed` flag on each node. PersonNode reads `dimmed` for opacity/pointer-events styling. React Flow's built-in multi-selection handles group move. Toolbar renders toggle pills.

**Tech Stack:** @xyflow/react, shadcn/ui Button, Next.js 16

**Spec:** `docs/superpowers/specs/2026-03-22-canvas-navigation-design.md`

---

## File Structure

```
components/tree/
  tree-utils.ts     — ADD: FilterState, DEFAULT_FILTERS, applyFilters(), applyEdgeFilters()
  person-node.tsx   — MODIFY: read dimmed flag, apply opacity + pointer-events
  tree-toolbar.tsx  — MODIFY: add filter pills replacing placeholder
  tree-canvas.tsx   — MODIFY: filter state, apply on changes, multi-select props, Cmd+A
```

---

## Task 0: Filter Helpers + PersonNode Dimming

**Files:**
- Modify: `apps/web/components/tree/tree-utils.ts`
- Modify: `apps/web/components/tree/person-node.tsx`

- [ ] **Step 1: Add filter types and helpers to tree-utils.ts**

Add `FilterState`, `DEFAULT_FILTERS`, `applyFilters()`, `applyEdgeFilters()` as specified in the spec.

- [ ] **Step 2: Update PersonNode to support dimming**

Read `person-node.tsx`. Add dimmed support to the outer div:

```typescript
const dimmed = !!(data as any).dimmed;

// On the outer div, add conditional classes:
className={`w-[200px] rounded-lg bg-card shadow-sm border transition-all ${
  selected ? 'ring-2 ring-primary shadow-md' : ''
} ${dimmed ? 'opacity-30 pointer-events-none' : ''}`}
```

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
git commit ...
```

---

## Task 1: Toolbar Filter Pills + Canvas Integration

**Files:**
- Modify: `apps/web/components/tree/tree-toolbar.tsx`
- Modify: `apps/web/components/tree/tree-canvas.tsx`

- [ ] **Step 1: Add filter pills to toolbar**

Add new props to TreeToolbarProps:
```typescript
filterState: FilterState;
onToggleFilter: (category: 'sex' | 'living', key: string) => void;
```

Replace the disabled "Filter" button with toggle pills. Each pill is a Button with variant toggling between 'secondary' (on) and 'outline' (off).

- [ ] **Step 2: Add filter state + multi-select to tree-canvas**

Add `filterState` state with `DEFAULT_FILTERS`. When filter changes, run `applyFilters` on nodes and `applyEdgeFilters` on edges. Add React Flow multi-select props. Add Cmd+A handler.

- [ ] **Step 3: Type check + run tests + commit**

---

## Task 2: Final Verification

Type check, run all tests, manual smoke test.
