# Factsheet Page — Dedicated Research Synthesis Hub

> **Status:** Design approved
> **Date:** 2026-03-27
> **Scope:** Dedicated page at `/research/factsheets` with cross-person overview, relationship graph, batch operations, triage, and family promotion
> **Dependencies:** factsheet-ui-components-design, research-to-tree-pipeline-design, research-workspace-design

## Context

Factsheets are working hypotheses — curated groupings of facts representing a theory about a person, couple, or family unit. They are the central concept in the Research → Tree pipeline. Currently, factsheets are only accessible via a tab inside `/research/person/[id]`, requiring users to navigate 3 levels deep. The existing per-person tab handles single-person factsheet CRUD, but cannot show cross-person views, relationship graphs, or batch operations.

This spec adds a dedicated page that serves as the **research synthesis hub** — the place where scattered evidence becomes structured family units ready for tree promotion.

## Design Principles

1. **Heritage Modern** — 90% neutral palette, color only for status signals. **Badge colors:** draft=amber, ready=green, promoted=indigo, dismissed=gray, conflict=red. **Graph node borders:** draft/working=indigo-400, ready=green-500, unanchored=amber-500, promoted=indigo-600, dismissed=gray-300. The distinction: badges communicate status text, graph borders communicate visual grouping (indigo=working hypothesis, amber=needs attention).
2. **Reuse existing components** — `FactsheetList`, `FactsheetDetail`, `FactsheetCard`, `FactsheetFactsSection`, `FactsheetLinksSection`, `FactsheetPromote` already exist in `components/research/factsheets/`. Wrap and extend, don't rewrite.
3. **Progressive disclosure** — stats bar → list → detail → graph. Complexity reveals as you engage.
4. **Cross-person is the differentiator** — this page shows ALL factsheets, the per-person tab shows one person's. Don't duplicate; complement.
5. **Graph makes clusters actionable** — the force-directed view isn't decorative; it's where family unit promotion happens.

## Navigation

### Route
- Path: `/research/factsheets`
- Sub-route of `/research` in URL structure
- Page file: `apps/web/app/(auth)/research/factsheets/page.tsx`

### Sidebar Entry
Add to `researchItems` array in `app-sidebar.tsx`:

```ts
const researchItems: NavItem[] = [
  { title: 'Research', href: '/research', icon: Microscope },
  { title: 'Factsheets', href: '/research/factsheets', icon: FileStack },
  { title: 'Sources', href: '/sources', icon: Bookmark },
];
```

- Icon: `FileStack` from lucide-react (stacked documents — represents grouped hypotheses)
- Badge: count of `draft + ready` factsheets (non-terminal, actionable items)
- Active state: `pathname.startsWith('/research/factsheets')` — note: must check this BEFORE the `/research` match to avoid false positives. Reorder the active check or use exact match for `/research`.

### Sidebar Active State Fix
Currently `pathname.startsWith(item.href)` means `/research/factsheets` would also highlight the "Research" item. Fix by checking items in longest-path-first order, or using `pathname === item.href || pathname.startsWith(item.href + '/')` for the Research item specifically.

## Page Layout

### Structure
Combined layout: persistent sidebar (280px) + switchable main area (Detail ↔ Graph toggle).

```
┌──────────────────────────────────────────────────────────┐
│ [sidebar 280px]              [main area 1fr]             │
│ ┌──────────────┐  ┌────────────────────────────────────┐ │
│ │ Stats Bar    │  │ Toolbar: [Detail|Graph] Title  [⋯] │ │
│ │ 12 5 4 2    │  ├────────────────────────────────────┤ │
│ ├──────────────┤  │                                    │ │
│ │ Search       │  │  Detail View (selected factsheet)  │ │
│ │ Filter pills │  │  — OR —                            │ │
│ ├──────────────┤  │  Graph View (force-directed canvas) │ │
│ │ Factsheet    │  │                                    │ │
│ │ List         │  │                                    │ │
│ │              │  │                                    │ │
│ │              │  │                                    │ │
│ ├──────────────┤  │                                    │ │
│ │ Batch Actions│  │                                    │ │
│ └──────────────┘  └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Mobile (< 768px): Stacked vertically. List is full-width. Tapping a factsheet shows detail full-screen with back button. Graph toggle becomes a FAB or is hidden on mobile (graph requires pointer interaction).

### Height
`h-[calc(100vh-var(--header-height))]` — fills available space below the app header. Matches the pattern used in the per-person factsheets tab (`h-[calc(100vh-16rem)]`) but without the person header offset.

## Section 1: Stats Bar

Top of the sidebar. Compact 4-column grid showing pipeline health at a glance.

| Metric | Color | Source |
|--------|-------|--------|
| Total | `text-foreground` | `factsheets.length` |
| Draft | `text-amber-500` | `status === 'draft'` count |
| Ready | `text-green-600` | `status === 'ready'` count |
| Conflicts | `text-red-500` | Sum of unresolved conflicts across all factsheets |

### Implementation
- Component: `FactsheetStatsBar`
- Data: derived from the `listFactsheets()` response (already returns all factsheets)
- Conflict count: requires a new API endpoint or extending `listFactsheets` to include conflict counts per factsheet. **Preferred:** add `conflictCount` to the list response via a subquery join.
- Layout: `grid grid-cols-4 gap-2 text-center` inside a `px-3 py-3 border-b border-border` container
- Each cell: large number (`text-lg font-bold`) + label (`text-[10px] uppercase text-muted-foreground`)

## Section 2: Sidebar — Search, Filters, List

### Search
- `<Input>` with placeholder "Search factsheets..."
- Filters client-side by title match (case-insensitive)
- Debounced 200ms

### Filter Pills
Horizontal row of toggleable status filters:

- **All** (default active) — `bg-foreground text-background` when active
- **Draft** — filters to `status === 'draft'`
- **Ready** — filters to `status === 'ready'`
- **Promoted** — filters to `status === 'promoted'`
- **Unanchored** — special filter: factsheets where `promotedPersonId === null` AND no linked person in `research_item_persons`. Requires backend support (see API section).

Active filter: `bg-foreground text-background rounded`. Inactive: `text-muted-foreground`.

### List
Reuses existing `FactsheetCard` component with one addition:

- **Unanchored indicator:** factsheets not linked to any tree person get `border-l-3 border-l-amber-500 bg-amber-50/50` and show "⚠ unanchored" in the summary line.
- Sort order: draft → ready → promoted → merged → dismissed (existing `STATUS_ORDER`)
- Selected card: `border-primary bg-accent/5` (existing pattern)
- Keyboard: arrow keys navigate list, Enter selects

### Empty State
"No factsheets yet. Extract facts from research items, then group them into hypotheses." + "Go to Research" link to `/research`.

## Section 3: Batch Actions Bar

Bottom of sidebar. Appears when list has items.

- **Select All** — toggles checkbox selection on all visible (filtered) factsheets
- **Batch Dismiss** — dismisses all selected factsheets (confirmation dialog)
- **Batch Link** — opens a modal to create links between selected factsheets (relationship type picker)

Layout: `flex gap-2 px-3 py-2 border-t border-border bg-muted/30`

Buttons: `variant="outline" size="sm"` with `text-xs`. Disabled when no selection.

### Selection State
- Each `FactsheetCard` gains an optional checkbox (visible when batch mode active)
- Batch mode activates when user clicks "Select All" or long-presses a card
- Selection stored in component state: `Set<string>` of factsheet IDs

## Section 4: Main Area — Toolbar

Persistent toolbar at top of main area with:

### View Toggle
Segmented control (not tabs): `[Detail | Graph]`
- Implementation: two `Button` elements in a `div` with `border rounded-lg overflow-hidden flex`
- Active segment: `bg-primary text-primary-foreground`
- Inactive: `text-muted-foreground`
- State stored in URL search param: `?view=detail` (default) or `?view=graph`

### Title (Detail mode only)
Shows selected factsheet's title + status badge. Reuses `FACTSHEET_STATUS_CONFIG` for badge styling.

### Summary (Graph mode only)
Shows "Showing {N} clusters · {N} solo" — derived from graph clustering algorithm.

### Actions
- **Promote to Tree** — `variant="outline"` with green tint (same as per-person tab). Disabled when factsheet has unresolved conflicts.
- **Overflow menu (⋯)** — Rename, Change Status, Dismiss, Delete

## Section 5: Main Area — Detail View

When `?view=detail` (default), shows the selected factsheet's full detail.

**Reuses existing components directly:**
- `FactsheetDetail` — the component from `factsheets/factsheet-detail.tsx`

**Key difference from per-person tab:** The per-person tab passes `personId` to scope operations. The dedicated page passes `personId: null` (or omits it) since factsheets here are cross-person. The `FactsheetDetail` component needs a minor refactor to make `personId` optional.

### Sections displayed:
1. **Notes** — editable textarea, auto-save on blur (existing)
2. **Facts** — list with type, value, source, confidence badge (existing `FactsheetFactsSection`)
3. **Linked Factsheets** — clickable links to related factsheets (existing `FactsheetLinksSection`). Clicking a linked factsheet selects it in the sidebar.
4. **Possible Tree Matches** — duplicate check against existing persons (existing `useFactsheetDuplicates`)
5. **Promote** — expandable promote workflow (existing `FactsheetPromote`)

### Empty State (no factsheet selected)
"Select a factsheet from the list, or switch to Graph view to see the relationship canvas."

## Section 6: Main Area — Graph View

When `?view=graph`, shows the force-directed relationship canvas.

### Technology
**React Flow** — already a project dependency concept (used for tree canvas via `@xyflow/react`). Use the same library for consistency.

If React Flow is not currently installed, use **D3-force** for the simulation with custom SVG rendering. React Flow is preferred for node interaction consistency.

### Node Design
Each factsheet renders as a custom React Flow node:

```
┌─────────────────────┐
│ John H. Smith       │  ← title (font-semibold)
│ 5 facts · b. ~1823  │  ← summary (text-muted-foreground)
│ [draft] [person]    │  ← status + entity type badges
└─────────────────────┘
```

- Width: 160px fixed
- Border color by status: draft=`border-indigo-400`, ready=`border-green-500`, unanchored=`border-amber-500`, promoted=`border-indigo-600`, dismissed=`border-gray-300 opacity-50`
- Background: white
- Shadow: `shadow-sm`
- Border radius: `rounded-lg` (10px)
- Cursor: pointer

### Edge Design
- Stroke: `#94a3b8` (slate-400), width 2px
- Spouse edges: dashed stroke
- Parent-child edges: solid stroke
- Sibling edges: dotted stroke
- Label: relationship type in a pill (`bg-white border rounded px-1 text-[9px]`)
- On hover: edge thickens to 3px, label becomes more prominent

### Cluster Detection
Auto-detect clusters from graph connectivity (connected components algorithm):
1. Build adjacency list from `factsheetLinks`
2. BFS/DFS to find connected components
3. Each component = one cluster

### Cluster Visualization
- Dashed border outline around each cluster: `border-2 border-dashed rounded-2xl`
- Cluster color: `border-indigo-400 bg-indigo-50/10` for normal clusters, `border-amber-500 bg-amber-50/10` for clusters containing unanchored factsheets
- Label at top-left: "{Name} Cluster · {N} factsheets"
- **"Promote Family Unit" button** appears below cluster when clicked

### Cluster Calculation
Cluster outline is a convex hull of member node positions + padding (24px). Recalculated on node drag.

### Solo Nodes
Factsheets with no links float independently. No cluster outline. These are candidates for linking or dismissal.

### Canvas Controls
- Zoom: scroll wheel + toolbar buttons (−, +, Fit)
- Pan: click and drag on background
- Minimap: optional, bottom-right corner (React Flow built-in)
- Background: dot grid pattern (`background-size: 20px 20px`)

### Interactions

| Action | Result |
|--------|--------|
| Click node | Select in sidebar, highlight node border |
| Double-click node | Switch to Detail view for that factsheet |
| Drag node | Reposition; force simulation adjusts neighbors |
| Click cluster outline | Select all members in sidebar, show "Promote Family Unit" button |
| Click edge | Open edge edit popover (change type, confidence, remove) |
| Hover edge | Show relationship label + confidence |
| Right-click node | Context menu: Link to..., Dismiss, Delete |

### Position Persistence
Save node positions to `researchCanvasPositions` table (already exists in schema) keyed by `factsheetId`. Load on page mount; fall back to force-directed auto-layout for new factsheets.

## Section 7: Family Unit Promotion

The killer feature of the graph view. Select a cluster → promote all linked factsheets as a family unit.

### Flow
1. Click cluster outline or manually select multiple factsheets
2. "Promote Family Unit" button appears
3. Click → opens promotion modal:
   - Shows preview: which persons will be created, which relationships
   - For each factsheet, shows: title → person name, accepted facts that will become events
   - Conflict warning if any factsheet has unresolved conflicts
   - "Merge into existing" option for factsheets matching tree persons
4. Confirm → atomic transaction creates:
   - Person records for each factsheet
   - Family record linking spouses
   - Child relationships
   - Events from accepted facts
   - Source citations from fact provenance
5. Success → factsheets marked `promoted`, nodes turn indigo, toast confirmation

### Backend
Uses existing `POST /api/research/factsheets/[id]/promote` for single factsheets. Family unit promotion needs a new endpoint:

```
POST /api/research/factsheets/promote-family
Body: { factsheetIds: string[], relationships: FactsheetLink[] }
Response: { persons: Person[], family: Family, events: Event[] }
```

This wraps the existing promote logic in a transaction across multiple factsheets.

## Section 8: Unanchored Factsheet Triage

Unanchored factsheets are hypotheses not linked to any existing tree person. They come from free-form research (e.g., "Smiths in Ohio 1850").

### Identification
A factsheet is "unanchored" when:
- `promotedPersonId === null` (not yet promoted)
- None of its facts have a `personId` pointing to an existing tree person

### Triage Actions (per unanchored factsheet)
- **Link to Person** — opens person search, assigns factsheet's facts to that person's `personId`
- **Keep as Hypothesis** — sets a new `anchoredManually` boolean field on the factsheet to `true`, suppressing the unanchored warning. Schema change: add `anchoredManually INTEGER DEFAULT 0` to `factsheets` table. The unanchored check becomes: `promotedPersonId === null AND no facts with personId AND anchoredManually === false`.
- **Dismiss** — mark as dismissed

### Visual Treatment
- Amber left border on list card: `border-l-3 border-l-amber-500`
- Warm background tint: `bg-amber-50/50`
- Warning text: "⚠ unanchored" in summary line
- In graph: amber cluster border instead of indigo

### Filter
"Unanchored" filter pill in sidebar shows only unanchored factsheets.

## API Changes

### New Endpoints

#### `GET /api/research/factsheets` (modify existing)
Currently scoped to a person. Add support for unscoped listing:
- No `personId` param → returns ALL factsheets across all people
- Add `include=counts` param to include `factCount`, `linkCount`, `conflictCount` per factsheet
- Add `filter=unanchored` param to return only unanchored factsheets

#### `POST /api/research/factsheets/promote-family`
Atomic family unit promotion. Accepts array of factsheet IDs + their relationships.

#### `POST /api/research/factsheets/batch`
Batch operations: dismiss, link, or delete multiple factsheets.
```
Body: { action: 'dismiss' | 'link' | 'delete', factsheetIds: string[], linkType?: string }
```

#### `GET /api/research/factsheets/links`
Returns ALL factsheet links across the project (not scoped to one factsheet). Used by the graph view to build the full network.
```
Response: FactsheetLink[] (same shape as existing link type)
```

### Modified Endpoints
- `GET /api/research/factsheets` — make `personId` query param optional
- `GET /api/research/factsheets/[id]` — no changes needed (already ID-based)

## Component Architecture

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `FactsheetsPage` | `app/(auth)/research/factsheets/page.tsx` | Page component, data fetching |
| `FactsheetsLayout` | `components/research/factsheets/factsheets-layout.tsx` | Main layout shell (sidebar + main) |
| `FactsheetStatsBar` | `components/research/factsheets/factsheet-stats-bar.tsx` | Pipeline health stats |
| `FactsheetSidebar` | `components/research/factsheets/factsheet-sidebar.tsx` | Search + filters + list + batch |
| `FactsheetGraphView` | `components/research/factsheets/factsheet-graph-view.tsx` | Force-directed canvas |
| `FactsheetGraphNode` | `components/research/factsheets/factsheet-graph-node.tsx` | Custom React Flow node |
| `FactsheetGraphEdge` | `components/research/factsheets/factsheet-graph-edge.tsx` | Custom labeled edge |
| `FactsheetCluster` | `components/research/factsheets/factsheet-cluster.tsx` | Cluster outline + promote button |
| `FamilyPromoteModal` | `components/research/factsheets/family-promote-modal.tsx` | Family unit promotion wizard |
| `BatchActionsBar` | `components/research/factsheets/batch-actions-bar.tsx` | Batch operations toolbar |

### Reused Components (no changes)
- `FactsheetFactsSection` — facts list in detail view
- `FactsheetLinksSection` — linked factsheets in detail view
- `FactsheetPromote` — single promote workflow
- `CreateFactsheetForm` — creation dialog

### Modified Components
- `FactsheetCard` — add unanchored visual indicator (amber left border + warning text), add optional checkbox for batch selection mode
- `FactsheetList` — add checkbox selection mode, pass `isUnanchored` flag to cards
- `FactsheetDetail` — make `personId` prop optional (currently required)
- `AppSidebar` — add Factsheets nav item to `researchItems`

## Data Flow

```
FactsheetsPage (server component)
  └─ FactsheetsLayout (client component)
       ├─ FactsheetSidebar
       │    ├─ FactsheetStatsBar ← useAllFactsheets() hook
       │    ├─ Search + Filters  ← client-side filter state
       │    ├─ FactsheetList     ← filtered factsheets
       │    └─ BatchActionsBar   ← selection state
       └─ Main Area (view toggle)
            ├─ FactsheetDetail   ← useFactsheetDetail(selectedId)
            └─ FactsheetGraphView
                 ├─ React Flow canvas
                 ├─ FactsheetGraphNode × N
                 ├─ FactsheetGraphEdge × N
                 └─ FactsheetCluster × N
```

### New Hook: `useAllFactsheets()`
Similar to existing `useFactsheets(personId)` but without person scoping:
```ts
function useAllFactsheets(filter?: { status?: string; unanchored?: boolean }) {
  return useFetchData<FactsheetWithCounts[]>(
    `/api/research/factsheets?include=counts${filter?.status ? `&status=${filter.status}` : ''}${filter?.unanchored ? '&filter=unanchored' : ''}`
  );
}
```

### Graph Data
The graph needs all factsheet links to build the network. New hook:
```ts
function useAllFactsheetLinks() {
  return useFetchData<FactsheetLink[]>('/api/research/factsheets/links');
}
```

This endpoint returns ALL links across all factsheets (not just one factsheet's links).

## URL State

| Param | Values | Default | Purpose |
|-------|--------|---------|---------|
| `view` | `detail`, `graph` | `detail` | Active main view |
| `fs` | factsheet UUID | first in list | Selected factsheet |
| `filter` | `all`, `draft`, `ready`, `promoted`, `unanchored` | `all` | Active filter |
| `q` | string | empty | Search query |

## Accessibility

- **Keyboard navigation:** Arrow keys in list, Enter to select, Tab between sidebar/main
- **Focus management:** switching views moves focus to the new view's first interactive element
- **Screen reader:** graph nodes have `aria-label` with factsheet title + status + fact count
- **Reduced motion:** force simulation runs without animation when `prefers-reduced-motion` is set
- **Color not sole indicator:** status badges include text labels, not just color. Unanchored items have "⚠ unanchored" text, not just amber border.

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| ≥ 1024px | Full 2-column layout |
| 768–1023px | Sidebar collapses to 220px, main area adjusts |
| < 768px | Stacked: list full-width → tap factsheet → full-screen detail with back button. Graph view hidden (requires pointer for drag interactions) |

## Performance Considerations

- **Lazy load graph:** Graph view components loaded via `dynamic()` import (React Flow is heavy). Only loaded when user switches to graph mode.
- **Virtualize list:** If factsheet count exceeds 50, virtualize the sidebar list (react-window or similar).
- **Debounce search:** 200ms debounce on search input.
- **Canvas positions:** Saved on drag end (not during drag) to avoid excessive writes.
- **Cluster calculation:** Run in a web worker if factsheet count exceeds 100 (unlikely in typical use but safe).

## Implementation Priority

1. **P0 — Page + sidebar + detail view** — route, navigation entry, all-factsheets listing, reuse existing detail. This alone provides the cross-person overview.
2. **P1 — Stats bar + filters + unanchored indicator** — pipeline health visibility and triage affordance.
3. **P2 — Graph view** — force-directed canvas with nodes, edges, and clusters.
4. **P3 — Family unit promotion** — cluster selection + atomic promotion modal.
5. **P4 — Batch operations** — multi-select + batch dismiss/link/delete.

## Out of Scope

- AI-suggested links between factsheets (future: "These two factsheets might be the same person")
- Drag factsheet from graph directly onto tree canvas (future: cross-page DnD)
- Factsheet merge (combining two factsheets into one — distinct from promote)
- Timeline view of factsheet activity
