# Tree Gap Indicators + Factsheet Canvas Graph — Design Spec

**Date:** 2026-03-27
**Status:** Draft

## Context

Ancstra's tree view currently shows no visual indication of data quality — nodes look identical whether they have full records or just a name. The quality scoring system exists in the backend (0–100 score across name, birth date, birth place, death date, source) with CSS variables for completion colors, but nothing surfaces on the tree canvas.

Separately, factsheets (research hypotheses grouping facts) are displayed as a list/detail 2-column UI. Factsheets can link to each other (parent_child, spouse, sibling), forming family unit clusters, but there's no visual graph of these relationships. The existing research Canvas tab shows sources and conflicts but not factsheet topology.

This spec covers two features:
1. **Tree Gap Indicators** — toggle-able data quality overlay on tree nodes
2. **Factsheet Canvas Graph** — unified graph replacing the research canvas with cluster and evidence drill-down views

---

## Feature 1: Tree Gap Indicators

### Design Decision
**Approach:** Bottom progress bar + dot indicators (Option C), activated via toolbar toggle (off by default).

**Rationale:** Aligns with Heritage Modern's "two densities" principle — clean tree by default, research-mode quality overlay on demand. Progress bar reads at any zoom level. Dots show per-field status without hover dependency.

### Visual Specification

#### Toolbar Toggle
- New toggle button in `TreeToolbar`: "Data Quality" (or icon: `BarChart3` from lucide-react)
- Placed after existing filter pills
- Off state: ghost/outline button style
- On state: filled primary button style (indigo)
- State persisted in component state (not database — ephemeral per session)

#### Node Augmentation (when toggle ON)
Each `PersonNode` gains two elements:

**1. Completion Dots** — row of 5 small circles below the date line:
- Position: below birth/death date text, above the progress bar
- Size: 6px diameter, 3px gap between dots
- Order (left to right): Name, Birth Date, Birth Place, Death Date, Source
- Colors:
  - Filled (has data): `var(--completion-high)` (green)
  - Missing (no data): `var(--completion-low)` (red)
  - Not applicable: `var(--border)` (gray) — e.g., death date for living persons
- Tooltip on hover: shows field name ("Birth Date: missing")

**2. Progress Bar** — thin bar along bottom edge of node:
- Height: 3px
- Width: spans full node width (flush with card edges)
- Track: `var(--border)` (light gray)
- Fill: colored by score range:
  - 0–39: `var(--completion-low)` (red)
  - 40–69: `var(--completion-medium)` (amber)
  - 70–100: `var(--completion-high)` (green)
- Fill width: `score%` of track width
- Border radius: matches node bottom corners

#### Node Height Change
- Default (toggle off): current height (~70px)
- Toggle on: +12px (dots row + progress bar)
- Transition: smooth 150ms ease-out height animation
- Dagre layout recalculates when toggle changes (nodeHeight parameter updates)

### Data Flow

1. `TreePage` already calls `getTreeData()` for persons
2. Add a parallel call to `getPriorities()` from `quality-queries.ts` when gap toggle is ON
3. Returns `PriorityPerson[]` with `score` and `missingFields` per person
4. Pass as a `Map<personId, PriorityPerson>` to `TreeCanvas`
5. `PersonNode` reads from this map via React Flow node data

**Lazy loading:** Quality data only fetched when toggle is activated (not on page load). Cached in client state until toggle is deactivated or page refreshes.

### Existing Code to Reuse
- `getPriorities()` from `packages/db/src/quality-queries.ts` — returns scores + missing fields
- `--completion-low/medium/high` CSS variables from `globals.css`
- `FilterState` pattern in `tree-utils.ts` — extend for gap toggle state
- `Badge` component from shadcn/ui for toolbar toggle styling

---

## Feature 2: Factsheet Canvas Graph

### Design Decision
**Approach:** Replace the existing research Canvas tab with a unified graph that has two drill-down views:

1. **Cluster View** (default) — factsheet-to-factsheet relationship graph
2. **Evidence Map** (drill-down) — single factsheet's facts and their source research items

Navigation: double-click a factsheet node in cluster view → drill into evidence map. Back button returns to cluster view.

### Cluster View Specification

#### Layout
- Uses existing React Flow infrastructure (same as tree canvas and current research canvas)
- Dagre layout with `rankdir: 'TB'` for hierarchical parent-child relationships
- Spouse links rendered as horizontal edges (same pattern as tree partner edges)
- Sibling links rendered as subtle horizontal dashed edges

#### Factsheet Node Design
- Width: 160px
- Background: white card with 1px border
- Content:
  - Row 1: **Title** (13px semibold, truncated) + **Status badge** (9px, colored by status config)
  - Row 2: "{N} facts · {N} links" (10px, muted)
  - Row 3: Completion dots (same 5-dot pattern as tree gap indicators)
- Border radius: 8px
- Shadow: `shadow-sm` resting, `shadow-md` on hover

#### Family Unit Clusters
- Visual grouping: dashed rounded rectangle (`stroke-dasharray: 6,3`) with light indigo fill (`#f0f4ff`)
- Label: "Family Unit Cluster" in muted indigo above the group
- Cluster detection: uses existing `getFactsheetCluster()` BFS traversal from `packages/research/src/factsheets/links.ts`
- Unlinked factsheets float outside any cluster boundary

#### Edge Types
| Relationship | Style | Color | Label |
|---|---|---|---|
| parent_child | Solid, 2px | Primary indigo | "parent" |
| spouse | Dashed, 1.5px | Gray (#9ca3af) | "spouse" |
| sibling | Dotted, 1px | Light gray (#d4d4d8) | "sibling" |

#### Drag-to-Link
- Draw an edge from one factsheet node to another to create a link
- On drop: popover appears with relationship type selector (parent_child / spouse / sibling) and confidence dropdown
- Uses React Flow's `onConnect` handler
- Calls `createFactsheetLink()` API on confirm
- Edge animates in on creation

#### Promote from Graph
- Right-click context menu on factsheet node: "Promote" / "Promote Family Unit"
- Cluster boundary gets a "Promote Family Unit" floating action button when cluster has all `ready` factsheets
- Calls existing promote API endpoints

#### Toolbar
- Left: **"← Cluster View"** breadcrumb (disabled when already in cluster view)
- Center: **Auto Layout** button, **Filter** dropdown (status: draft/ready/promoted/dismissed)
- Right: hint text "Double-click to drill into evidence"

### Evidence Map Specification

#### Layout
- Central node: the factsheet (larger, indigo background, white text)
- Surrounding nodes: facts (positioned radially or via force-directed layout)
- Outer nodes: source research items connected to their facts

#### Fact Node Design
- Width: 130px
- Left border: 3px, colored by confidence (high=green, medium=amber, low=red, disputed=destructive red)
- Content:
  - Row 1: **Fact type** label (10px, semibold) — "Birth Date", "Name", etc.
  - Row 2: **Fact value** (10px, muted) — the actual data
  - Row 3: Confidence dot + label (9px)
- Conflict indicator: if fact has `accepted === null` and there are multiple facts of same type, show red border + warning icon (⚠). Clicking opens inline conflict resolution popover.

#### Source Node Design
- Width: 110px
- Background: warm amber tint (`#fffbeb`)
- Border: `#fde68a`
- Content:
  - Row 1: 📄 icon + source title (9px, semibold)
  - Row 2: Provider name (9px, muted)

#### Edge Types (Evidence Map)
| Connection | Style | Color |
|---|---|---|
| Factsheet → Fact | Solid, 1.5px | Slate (#cbd5e1) |
| Source → Fact | Dashed, 1px | Amber (#fbbf24) |

#### Conflict Resolution (inline)
- Fact nodes with unresolved conflicts show a pulsing red outline
- Click to open popover with competing facts listed
- Accept/Reject buttons per fact
- On resolution, fact border updates to reflect accepted/rejected state
- Uses existing `resolveFactsheetConflict()` API

#### Promote Button
- Fixed in toolbar: "Promote" button (primary style)
- Calls existing single promote flow
- Disabled if factsheet has unresolved conflicts (tooltip explains why)

#### Toolbar
- Left: **"← Back to Clusters"** link (returns to cluster view)
- Center: Factsheet title + status badge
- Right: **Promote** button

### Data Flow

#### Cluster View
1. Fetch all factsheets for current person via `listFactsheets()`
2. Fetch links via `getFactsheetLinks()` for each factsheet
3. Detect clusters via `getFactsheetCluster()` for visual grouping
4. Convert to React Flow nodes/edges
5. Apply Dagre layout

#### Evidence Map
1. Fetch factsheet detail via `getFactsheet(id)` — returns facts + links
2. Fetch conflicts via `detectFactsheetConflicts()`
3. Resolve source research items for each fact (via `researchItemId` FK)
4. Convert to React Flow nodes/edges
5. Apply force-directed or radial layout

### Existing Code to Reuse
- `CanvasTab`, `CanvasInner` from `apps/web/components/research/canvas/` — React Flow setup, position persistence
- `researchCanvasPositions` table — reuse for factsheet graph positions
- `SourceNode`, `EvidenceEdge` from existing canvas — adapt for evidence map
- `getFactsheetCluster()` from `packages/research/src/factsheets/links.ts`
- `detectFactsheetConflicts()` from research package
- `FACTSHEET_STATUS_CONFIG`, `CONFIDENCE_VARIANT` from factsheet components
- `treeDataToFlow()` pattern from `tree-utils.ts` — adapt for factsheet-to-flow conversion
- `applyDagreLayout()` from `tree-utils.ts`

### Migration from Current Canvas
- Current Canvas tab components (`SourceNode`, `NoteNode`, `ConflictNode`) are **removed** — their functionality is subsumed by the evidence map
- `SourcePalette` removed — sources now appear as nodes in evidence map automatically
- Canvas position data for old node types can be cleaned up but doesn't need migration
- The `research_canvas_positions` table schema stays the same, `node_type` gains new values: `'factsheet'`, `'fact'`, `'source_research_item'`

---

## Verification Plan

### Tree Gap Indicators
1. Open tree view — confirm no gap indicators visible by default
2. Click "Data Quality" toolbar toggle — confirm progress bars and dots appear on all nodes
3. Verify a node with full data shows all green dots + green full bar
4. Verify a node with only a name shows mostly red dots + red thin bar
5. Verify living persons show death date dot as gray (not applicable)
6. Toggle off — confirm indicators disappear, node heights restore
7. Check dark mode rendering of dot/bar colors
8. Zoom out to 50% — confirm progress bar still readable

### Factsheet Canvas Graph
1. Navigate to research person → Canvas tab
2. Confirm cluster view shows factsheet nodes with correct status badges
3. Verify family unit clusters have dashed boundary
4. Drag edge between two factsheet nodes → confirm link creation popover appears
5. Double-click a factsheet → confirm drill-down to evidence map
6. Verify fact nodes show correct confidence colors
7. Verify source nodes appear with amber styling connected to their facts
8. Click a conflicting fact → confirm conflict resolution popover works
9. Click "Promote" → confirm promote flow triggers
10. Click "← Back to Clusters" → confirm return to cluster view
11. Right-click a factsheet in cluster view → confirm context menu with promote option
