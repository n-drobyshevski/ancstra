# Plan E: Advanced Workspace Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Matrix, Canvas, and Proof Summary tabs to the evidence workspace, completing all 6 view modes.

**Architecture:** All tabs share the same research_items + research_facts data layer from Plan B. Matrix is a full-width table component. Canvas reuses @xyflow/react (React Flow) from the tree visualization — custom nodes for source cards, notes, and conflicts, with positions stored in research_canvas_positions table. Proof Summary is a structured text editor.

**Tech Stack:** @xyflow/react (Canvas), jsPDF (export), React, shadcn/ui

**Spec:** [Research Workspace Design](../../superpowers/specs/2026-03-22-research-workspace-design.md)
**Depends on:** [Plan B](2026-03-22-plan-b-evidence-workspace.md) (workspace page, tab navigation, facts CRUD)

---

## File Structure

### New Files

```
apps/web/
  components/research/
    matrix/
      matrix-tab.tsx                    # Matrix tab container
      matrix-table.tsx                  # Full-width fact spreadsheet
      matrix-cell.tsx                   # Individual cell (source x fact)
      matrix-conclusion-cell.tsx        # Editable conclusion column cell
      matrix-export.ts                  # CSV + PDF export logic
    canvas/
      canvas-tab.tsx                    # Canvas tab container (ReactFlowProvider)
      canvas-inner.tsx                  # React Flow canvas with nodes/edges
      source-node.tsx                   # Custom node: source/research item card
      note-node.tsx                     # Custom node: sticky note
      conflict-node.tsx                 # Custom node: conflict indicator
      canvas-edge.tsx                   # Custom edge: evidence connection
      source-palette.tsx               # Left sidebar: drag sources onto canvas
      canvas-toolbar.tsx               # Floating toolbar: auto-layout, zoom fit
      canvas-utils.ts                  # Layout helpers, position extraction
    proof/
      proof-tab.tsx                     # Proof Summary tab container
      proof-editor.tsx                  # Structured editor (question/sources/analysis/conclusion)
      proof-section.tsx                 # Reusable section block component
      proof-export.ts                  # Export as PDF/Markdown
  lib/research/
    matrix-helpers.ts                   # Build matrix data structure from facts + sources
    canvas-positions.ts                # CRUD hooks for research_canvas_positions
```

### Modified Files

```
apps/web/components/research/workspace-tabs.tsx   # Register Matrix, Canvas, Proof tabs
apps/web/app/api/research/canvas-positions/route.ts  # API: list + bulk upsert positions
packages/db/src/research-schema.ts                # Already has researchCanvasPositions (from Plan A Task 2)
```

---

## Task 1: Matrix Tab — Full-Width Fact Table Component

**Files:**
- Create: `apps/web/lib/research/matrix-helpers.ts`, `apps/web/components/research/matrix/matrix-tab.tsx`, `apps/web/components/research/matrix/matrix-table.tsx`, `apps/web/components/research/matrix/matrix-cell.tsx`
- Modify: `apps/web/components/research/workspace-tabs.tsx`

- [ ] **Step 1:** Create `apps/web/lib/research/matrix-helpers.ts` — build a matrix data structure from research_facts and sources:
```typescript
export interface MatrixData {
  factTypes: string[];           // unique fact_type values (rows)
  sources: MatrixSource[];       // columns (research_items + source_citations)
  cells: Record<string, Record<string, MatrixCell>>; // [factType][sourceId]
  conclusions: Record<string, string>;  // [factType] -> user conclusion text
}

export interface MatrixSource {
  id: string;
  title: string;
  type: 'research_item' | 'source';
  status?: 'draft' | 'promoted' | 'dismissed';
  confidence?: string;
}

export interface MatrixCell {
  factId: string;
  value: string;
  confidence: 'high' | 'medium' | 'low' | 'disputed';
  extractionMethod: string;
}

export function buildMatrix(
  facts: ResearchFact[],
  researchItems: ResearchItem[],
  sourceCitations: SourceCitation[]
): MatrixData;
```
The `buildMatrix` function groups facts by `fact_type` (rows) and by their source (columns: `research_item_id` or `source_citation_id`). Each cell contains the fact value and metadata. `factTypes` is sorted in a canonical order (name, birth_date, birth_place, death_date, death_place, then alphabetical for the rest).

- [ ] **Step 2:** Create `apps/web/components/research/matrix/matrix-cell.tsx` — a table cell component:
  - Displays fact value text, truncated to fit
  - Background color reflects confidence: high = green-50, medium = amber-50, low = red-50, disputed = red-100
  - Tooltip on hover shows full value, extraction method, confidence
  - onClick fires `onCellClick(factId)` callback to open detail panel

```typescript
interface MatrixCellProps {
  cell: MatrixCell | undefined;
  onCellClick: (factId: string) => void;
}
```

- [ ] **Step 3:** Create `apps/web/components/research/matrix/matrix-table.tsx` — the full-width table:
  - Sticky first column (fact type labels) and sticky header row (source titles)
  - Uses `<table>` with `overflow-x-auto` wrapper for horizontal scrolling
  - Renders MatrixCell for each (factType, source) intersection
  - Empty cells show `—` in muted text
  - Final column is reserved for conclusions (rendered in Task 2)
  - Accepts `onCellClick` and `onConclusionChange` props

```typescript
interface MatrixTableProps {
  matrix: MatrixData;
  onCellClick: (factId: string) => void;
  onConclusionChange: (factType: string, value: string) => void;
}
```

- [ ] **Step 4:** Create `apps/web/components/research/matrix/matrix-tab.tsx` — tab container:
  - Fetches facts, research items, and source citations for the person (reuse hooks from Plan B)
  - Calls `buildMatrix()` to produce MatrixData
  - Renders MatrixTable full-width
  - Handles cell click by opening a slide-out detail panel (reuse `<FactDetailPanel>` from Plan B if available, or render inline)
  - Loading skeleton: a 5x4 grid of Skeleton rectangles

- [ ] **Step 5:** Register the Matrix tab in `apps/web/components/research/workspace-tabs.tsx`:
  - Add `{ id: 'matrix', label: 'Matrix', icon: Grid3X3 }` to the tabs array
  - Lazy-load `MatrixTab` with `React.lazy()` or dynamic import
  - Renders when `?view=matrix` is active

- [ ] **Step 6:** Verify the matrix renders with mock/seed data. Ensure horizontal scrolling works when there are many sources. Ensure sticky column and header remain visible during scroll.

- [ ] **Step 7:** Commit: `feat(research): matrix tab — full-width fact table component`

---

## Task 2: Matrix Tab — Editable Conclusion Column

**Files:**
- Create: `apps/web/components/research/matrix/matrix-conclusion-cell.tsx`
- Modify: `apps/web/components/research/matrix/matrix-table.tsx`
- Create or modify: `apps/web/app/api/research/conclusions/route.ts` (API for persisting conclusions)

- [ ] **Step 1:** Design the conclusion storage. Conclusions are per-person, per-fact-type text strings. Add an API route to persist them. Options:
  - Store as JSON in a `research_conclusions` column on a new lightweight table, or
  - Store in `research_facts` with a special `source_citation_id = NULL` and `research_item_id = NULL` marked as `extraction_method = 'manual'` with a convention (e.g., a `is_conclusion` flag).

  **Decision:** Use a simple key-value approach — store conclusions as a JSON object `{ [factType]: conclusionText }` in localStorage initially, with a PATCH endpoint to persist to a `research_conclusions` table or as person metadata. For v1, use localStorage with debounced save to API.

- [ ] **Step 2:** Create `apps/web/app/api/research/conclusions/route.ts`:
  - GET `?personId=xxx` — returns `Record<string, string>` of fact_type -> conclusion text
  - PUT — body `{ personId, conclusions: Record<string, string> }` — upserts all conclusions for a person
  - Store in `research_facts` table with `extraction_method = 'manual'`, `confidence = 'high'`, `research_item_id = NULL`, `source_citation_id = NULL` — but this violates the CHECK constraint. Instead, store as a JSON text field on a new row in a simple table or as person notes.

  **Simpler approach:** Add a `research_conclusions` entry to research_facts where the fact has a special marker. Actually, the cleanest approach: store conclusions as a JSON blob in localStorage synced to an API endpoint that saves to a `person_research_meta` or similar. For Plan E v1, persist via a dedicated API route that stores in a `research_person_meta` table with columns `(person_id, meta_key, meta_value)`.

  Create the API route:
```typescript
// GET /api/research/conclusions?personId=xxx
// Returns: { conclusions: Record<string, string> }

// PUT /api/research/conclusions
// Body: { personId: string, conclusions: Record<string, string> }
// Stores each fact_type conclusion as a row in research_person_meta
```

- [ ] **Step 3:** Create `apps/web/components/research/matrix/matrix-conclusion-cell.tsx`:
  - Inline editable text cell in the final "Conclusion" column
  - Click to edit: renders a `<textarea>` with auto-resize
  - Blur or Enter saves the value
  - Debounced 500ms save to parent via `onConclusionChange(factType, value)`
  - Visual: slightly different background (indigo-50) to distinguish from source cells
  - Shows a pencil icon when empty to indicate editability

```typescript
interface MatrixConclusionCellProps {
  factType: string;
  value: string;
  onChange: (factType: string, value: string) => void;
}
```

- [ ] **Step 4:** Integrate conclusion cells into `matrix-table.tsx`:
  - Add a final column header "Conclusion" with a sticky position (rightmost)
  - Render `MatrixConclusionCell` for each fact type row in the conclusion column
  - Wire `onConclusionChange` to debounced API save (PUT /api/research/conclusions)

- [ ] **Step 5:** Add a `useConclusionsForPerson(personId)` hook in `apps/web/lib/research/matrix-helpers.ts`:
  - Fetches conclusions on mount via GET
  - Returns `{ conclusions, updateConclusion, isSaving }`
  - `updateConclusion` debounces 800ms before PUT to API
  - Optimistic update: sets local state immediately

- [ ] **Step 6:** Verify editing a conclusion cell saves and persists across page reloads.

- [ ] **Step 7:** Commit: `feat(research): matrix tab — editable conclusion column with persistence`

---

## Task 3: Matrix Tab — Conflict Row Highlighting + Cell Click Detail

**Files:**
- Modify: `apps/web/components/research/matrix/matrix-table.tsx`, `apps/web/components/research/matrix/matrix-cell.tsx`
- Modify: `apps/web/lib/research/matrix-helpers.ts`

- [ ] **Step 1:** Extend `buildMatrix()` in `matrix-helpers.ts` to detect conflicts:
  - For each fact_type row, check if there are 2+ cells with different `value` strings (excluding multi-valued types: residence, occupation, child_name, other)
  - Add a `conflicts: Record<string, ConflictInfo>` field to `MatrixData`:
```typescript
export interface ConflictInfo {
  factType: string;
  values: { factId: string; value: string; sourceTitle: string; confidence: string }[];
}
```

- [ ] **Step 2:** Update `matrix-table.tsx` to highlight conflict rows:
  - If `matrix.conflicts[factType]` exists, apply a red-50 background to the entire row
  - Add a small `AlertTriangle` icon (lucide) in the fact type label cell for conflict rows
  - Tooltip on the icon: "Conflicting values from N sources"

- [ ] **Step 3:** Update `matrix-cell.tsx` for conflict styling:
  - When the cell is part of a conflict row and its value differs from another cell in the same row, add a red left-border (border-l-2 border-red-400)
  - This visually marks which specific cells contain the disagreeing values

- [ ] **Step 4:** Implement cell click detail panel:
  - When `onCellClick(factId)` fires, the matrix-tab opens a slide-out `<Sheet>` (shadcn/ui) from the right
  - Sheet content shows: fact value, confidence badge, extraction method, source title + link, created date
  - If the fact came from a research item: show item status badge (draft/promoted/dismissed) and a "View Source" link
  - If fact came from a source citation: show citation text
  - Include "Edit Confidence" dropdown and "Delete Fact" button

- [ ] **Step 5:** Add a conflict summary banner above the matrix table:
  - If any conflicts exist, show a yellow banner: "N conflicts detected across M fact types"
  - Clicking the banner scrolls to the first conflict row (using `scrollIntoView`)

- [ ] **Step 6:** Verify: create 2 research items for the same person with differing birth_date values. Confirm the matrix shows the conflict row highlighted, cells have red borders, and clicking a cell opens the detail panel.

- [ ] **Step 7:** Commit: `feat(research): matrix tab — conflict highlighting and cell detail panel`

---

## Task 4: Matrix Tab — CSV/PDF Export

**Files:**
- Create: `apps/web/components/research/matrix/matrix-export.ts`
- Modify: `apps/web/components/research/matrix/matrix-tab.tsx`

- [ ] **Step 1:** Install jsPDF: `cd apps/web && pnpm add jspdf jspdf-autotable`. Add `jspdf-autotable` for table rendering in PDFs. Add types: `pnpm add -D @types/jspdf`.

- [ ] **Step 2:** Create `apps/web/components/research/matrix/matrix-export.ts` with two export functions:

```typescript
export function exportMatrixAsCsv(matrix: MatrixData, personName: string): void;
export function exportMatrixAsPdf(matrix: MatrixData, personName: string): void;
```

- [ ] **Step 3:** Implement `exportMatrixAsCsv`:
  - Build a CSV string: header row = `Fact Type, Source1, Source2, ..., Conclusion`
  - Each data row = `factType, cellValue1, cellValue2, ..., conclusionValue`
  - Escape commas and quotes in values (wrap in double quotes, escape internal quotes)
  - Create a Blob and trigger download via `URL.createObjectURL` + invisible `<a>` click
  - Filename: `{personName}-evidence-matrix-{YYYY-MM-DD}.csv`

- [ ] **Step 4:** Implement `exportMatrixAsPdf`:
  - Create a new `jsPDF` instance (landscape orientation for wide tables)
  - Add title: "{personName} — Evidence Matrix" in 16pt bold
  - Add date: "Generated {YYYY-MM-DD}" in 10pt gray
  - Use `jspdf-autotable` to render the matrix as a table:
    - Header row: Fact Type | Source columns | Conclusion
    - Body rows: one per fact type
    - Conflict rows: light red background (#FEE2E2)
    - Conclusion column: light indigo background (#E0E7FF)
  - Trigger download: `{personName}-evidence-matrix-{YYYY-MM-DD}.pdf`

- [ ] **Step 5:** Add export buttons to `matrix-tab.tsx`:
  - Place a toolbar row above the table with two buttons:
    - `<Button variant="outline" size="sm">` with Download icon + "Export CSV"
    - `<Button variant="outline" size="sm">` with FileText icon + "Export PDF"
  - Each button calls the corresponding export function with current matrix data and person name

- [ ] **Step 6:** Verify both exports produce valid files. Open CSV in a spreadsheet app. Open PDF and confirm table layout, conflict highlighting, and conclusion column are rendered correctly.

- [ ] **Step 7:** Commit: `feat(research): matrix tab — CSV and PDF export`

---

## Task 5: Canvas Tab — React Flow Setup + Custom Source Node

**Files:**
- Create: `apps/web/components/research/canvas/canvas-tab.tsx`, `apps/web/components/research/canvas/canvas-inner.tsx`, `apps/web/components/research/canvas/source-node.tsx`, `apps/web/components/research/canvas/canvas-edge.tsx`, `apps/web/components/research/canvas/canvas-utils.ts`
- Modify: `apps/web/components/research/workspace-tabs.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/canvas/canvas-utils.ts` — utility functions:
```typescript
import type { Node, Edge } from '@xyflow/react';

export interface CanvasNodeData {
  type: 'research_item' | 'source' | 'note' | 'conflict';
  title: string;
  snippet?: string;
  status?: string;
  confidence?: string;
  conflictInfo?: { factType: string; values: string[] };
  noteText?: string;
  sourceId?: string;         // ID of the research_item or source
}

// Convert research items + sources into React Flow nodes
export function buildCanvasNodes(
  researchItems: ResearchItem[],
  sources: SourceWithCitations[],
  positions: CanvasPosition[],
  conflicts: ConflictInfo[]
): Node<CanvasNodeData>[];

// Auto-layout using a simple grid or force-directed approach
export function autoLayoutNodes(nodes: Node[]): Node[];

// Extract position map from current nodes
export function extractCanvasPositions(
  nodes: Node[],
  personId: string
): { personId: string; nodeType: string; nodeId: string; x: number; y: number }[];
```

- [ ] **Step 2:** Create `apps/web/components/research/canvas/source-node.tsx` — custom React Flow node for sources and research items:
  - Renders as a Card (shadcn/ui) with:
    - Status badge: draft (gold), promoted (green), dismissed (gray) — for research items
    - Source type badge for promoted sources
    - Title (bold, truncated to 2 lines)
    - Snippet (muted, truncated to 3 lines)
    - Confidence indicator: colored dot (green/amber/red)
    - Connection handles: top (target), bottom (source) — for linking to other nodes
  - Dimensions: ~220px wide, auto-height (min 100px)
  - Visual distinction: research items have a dashed border, promoted sources have a solid border
  - `selected` state: ring-2 ring-indigo-500

```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';

export function SourceNode({ data, selected }: NodeProps<CanvasNodeData>) { ... }
```

- [ ] **Step 3:** Create `apps/web/components/research/canvas/canvas-edge.tsx` — custom edge:
  - Simple bezier edge with a label showing the relationship (e.g., "supports", "contradicts", "related")
  - Edge colors: default gray, contradicts = red, supports = green
  - Deletable on click (shows X button on hover)

- [ ] **Step 4:** Create `apps/web/components/research/canvas/canvas-inner.tsx` — the React Flow canvas:
  - Registers node types: `{ source: SourceNode }` (note and conflict added in Task 6)
  - Registers edge types: `{ evidence: CanvasEdge }`
  - Uses `useNodesState` and `useEdgesState` from @xyflow/react
  - Loads initial nodes from `buildCanvasNodes()` using fetched data
  - Background: dots pattern (same as tree-canvas)
  - Controls: bottom-right zoom controls
  - MiniMap: bottom-left
  - Handles `onNodesChange` for drag repositioning
  - Handles `onConnect` to create evidence relationship edges

```typescript
interface CanvasInnerProps {
  personId: string;
  researchItems: ResearchItem[];
  sources: SourceWithCitations[];
  positions: CanvasPosition[];
  conflicts: ConflictInfo[];
}
```

- [ ] **Step 5:** Create `apps/web/components/research/canvas/canvas-tab.tsx` — tab container:
  - Wraps `CanvasInner` in `<ReactFlowProvider>`
  - Fetches research items, sources, canvas positions, and conflicts for the person
  - Shows loading skeleton while data loads
  - Full height container (`h-full`) to fill workspace area

- [ ] **Step 6:** Register the Canvas tab in `workspace-tabs.tsx`:
  - Add `{ id: 'canvas', label: 'Canvas', icon: Workflow }` to the tabs array
  - Lazy-load `CanvasTab` with dynamic import
  - Renders when `?view=canvas` is active

- [ ] **Step 7:** Verify: source nodes render on the canvas, can be dragged, connections can be drawn between nodes.

- [ ] **Step 8:** Commit: `feat(research): canvas tab — React Flow setup with source nodes`

---

## Task 6: Canvas Tab — Note Node + Conflict Node

**Files:**
- Create: `apps/web/components/research/canvas/note-node.tsx`, `apps/web/components/research/canvas/conflict-node.tsx`
- Modify: `apps/web/components/research/canvas/canvas-inner.tsx`, `apps/web/components/research/canvas/canvas-utils.ts`

- [ ] **Step 1:** Create `apps/web/components/research/canvas/note-node.tsx` — custom node for researcher notes:
  - Renders as a yellow sticky-note style Card:
    - Background: amber-50, border: amber-200
    - Editable textarea inside the node (contentEditable or controlled textarea)
    - Auto-resize height based on content
    - Minimum size: 150x100px
    - "Delete" button (X) in top-right corner on hover
  - Connection handles: top + bottom for linking notes to sources
  - Double-click to enter edit mode, click outside to save
  - Data shape: `{ type: 'note', noteText: string, noteId: string }`

```typescript
export function NoteNode({ data, selected, id }: NodeProps<CanvasNodeData>) { ... }
```

- [ ] **Step 2:** Create `apps/web/components/research/canvas/conflict-node.tsx` — custom node for conflicts:
  - Renders as a red-tinted diamond or octagon-shaped Card:
    - Background: red-50, border: red-300
    - AlertTriangle icon centered
    - Title: the fact_type in conflict (e.g., "Birth Date")
    - Lists the conflicting values (max 3, then "+N more")
    - Non-editable, auto-generated from conflict detection
  - Connection handles: left + right for linking to the source nodes that conflict
  - Click opens a conflict resolution popover (reuse from Plan B conflicts tab)
  - Data shape: `{ type: 'conflict', conflictInfo: { factType, values } }`

- [ ] **Step 3:** Update `canvas-utils.ts` `buildCanvasNodes()`:
  - Generate conflict nodes from the `conflicts` array
  - Position conflict nodes between their related source nodes (if positions exist) or in a dedicated row below sources
  - Auto-generate edges from conflict nodes to their related source nodes (red dashed edges)

- [ ] **Step 4:** Register new node types in `canvas-inner.tsx`:
```typescript
const nodeTypes = {
  source: SourceNode,
  note: NoteNode,
  conflict: ConflictNode,
};
```

- [ ] **Step 5:** Add "Add Note" functionality to canvas:
  - Double-click on empty canvas creates a new note node at the click position
  - Alternatively, a "+" button in the toolbar creates a note at center viewport
  - New notes start in edit mode with placeholder text "Add your notes..."
  - Note content is stored in `research_canvas_positions` with `node_type = 'note'` and `node_id` as a generated UUID. The note text is stored as JSON in a notes field or via a separate lightweight store.

- [ ] **Step 6:** Verify: note nodes can be created, edited, and deleted. Conflict nodes auto-appear when facts conflict. Edges connect conflict nodes to their related sources.

- [ ] **Step 7:** Commit: `feat(research): canvas tab — note and conflict node types`

---

## Task 7: Canvas Tab — Connection Edges + Auto-Layout

**Files:**
- Modify: `apps/web/components/research/canvas/canvas-inner.tsx`, `apps/web/components/research/canvas/canvas-utils.ts`
- Create: `apps/web/components/research/canvas/canvas-toolbar.tsx`

- [ ] **Step 1:** Implement edge creation on connect in `canvas-inner.tsx`:
  - `onConnect` callback: when user draws an edge between two nodes, create an edge with:
    - `type: 'evidence'`
    - `label`: prompt user to select relationship type from a small popover: "supports", "contradicts", "related", "derived from"
    - `data: { relationship }` stored on the edge
  - Store edges in component state (persisted with positions in Task 9)
  - Edge deletion: right-click edge shows "Delete" option, or click edge then press Delete key

- [ ] **Step 2:** Create `apps/web/components/research/canvas/canvas-toolbar.tsx` — floating toolbar:
  - Position: top-center of canvas, overlaid with `absolute` positioning
  - Buttons:
    - **Auto-Layout**: re-arranges all nodes using dagre or a simple grid layout
    - **Zoom Fit**: calls `fitView()` from React Flow
    - **Add Note**: creates a new note node at center
    - **Toggle MiniMap**: show/hide minimap
  - Uses shadcn/ui `Button` with icon-only variants in a `flex gap-1` row
  - Semi-transparent background with backdrop-blur

```typescript
interface CanvasToolbarProps {
  onAutoLayout: () => void;
  onZoomFit: () => void;
  onAddNote: () => void;
  onToggleMiniMap: () => void;
  miniMapVisible: boolean;
}
```

- [ ] **Step 3:** Implement auto-layout in `canvas-utils.ts`:
  - Use dagre (already a dependency from tree visualization) to compute positions:
    - Source/research item nodes as primary nodes
    - Note nodes positioned near their connected sources
    - Conflict nodes positioned between their related sources
  - Direction: top-to-bottom (TB) layout
  - Node spacing: 50px horizontal, 80px vertical
  - After layout, update all node positions via `setNodes`

```typescript
import dagre from '@dagrejs/dagre';

export function autoLayoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });
  // ... add nodes and edges, compute layout, return positioned nodes
}
```

- [ ] **Step 4:** Wire toolbar into `canvas-inner.tsx`:
  - Render `<CanvasToolbar>` as an overlay inside the canvas container
  - Auto-layout button calls `autoLayoutNodes()` and updates state
  - Zoom fit button calls `fitView()` from `useReactFlow()`
  - Add note button creates a note node at the center of the current viewport

- [ ] **Step 5:** Add keyboard shortcuts in canvas:
  - `Ctrl+Shift+L` — auto-layout
  - `Ctrl+Shift+F` — zoom to fit
  - `N` — add new note (when no node is selected/being edited)
  - `Delete` / `Backspace` — delete selected node or edge

- [ ] **Step 6:** Verify: draw edges between nodes, auto-layout rearranges nodes cleanly, zoom fit works, keyboard shortcuts function.

- [ ] **Step 7:** Commit: `feat(research): canvas tab — connection edges, auto-layout, and toolbar`

---

## Task 8: Canvas Tab — Source Palette Sidebar (Drag to Add)

**Files:**
- Create: `apps/web/components/research/canvas/source-palette.tsx`
- Modify: `apps/web/components/research/canvas/canvas-inner.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/canvas/source-palette.tsx` — left sidebar:
  - Width: 260px, collapsible with a toggle button
  - Header: "Sources" with item count badge
  - Search/filter input at top (filters by title)
  - Two sections separated by a divider:
    - **Research Items** (draft): gold left-border, draggable
    - **Promoted Sources** (confirmed): green left-border, draggable
  - Each item shows: title (truncated), provider badge, confidence dot
  - Items already on the canvas show a checkmark and are slightly faded
  - Drag handle on the left side of each item

```typescript
interface SourcePaletteProps {
  researchItems: ResearchItem[];
  sources: SourceWithCitations[];
  nodesOnCanvas: Set<string>;  // IDs already placed on canvas
  onClose: () => void;
}
```

- [ ] **Step 2:** Implement drag-and-drop from palette to canvas:
  - Each palette item sets `onDragStart` with `event.dataTransfer.setData('application/ancstra-research', JSON.stringify({ id, type, title }))`
  - Set `effectAllowed = 'move'`
  - Use a custom drag preview (semi-transparent card)

- [ ] **Step 3:** Handle drop on canvas in `canvas-inner.tsx`:
  - `onDragOver`: `event.preventDefault()`, set `dropEffect = 'move'`
  - `onDrop`: read `application/ancstra-research` data, compute drop position via `screenToFlowPosition()`, add a new source node at that position
  - After drop, update the `nodesOnCanvas` set so the palette reflects the change

```typescript
const onDrop = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  const raw = event.dataTransfer.getData('application/ancstra-research');
  if (!raw) return;
  const { id, type, title } = JSON.parse(raw);
  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
  // Add node to canvas state
}, [screenToFlowPosition, setNodes]);
```

- [ ] **Step 4:** Add palette toggle to canvas toolbar:
  - Add a "Sources" button (LayoutPanelLeft icon) to `canvas-toolbar.tsx`
  - Toggles the palette sidebar visibility
  - Pass `paletteOpen` state down to control rendering

- [ ] **Step 5:** Implement palette collapse animation:
  - Use `transition-all duration-200` on the sidebar width
  - When collapsed, show only a thin strip (40px) with the toggle button
  - Canvas area adjusts to fill available space

- [ ] **Step 6:** Verify: open palette, drag a research item onto the canvas, node appears at drop position. Dragged item shows checkmark in palette. Filter by title works. Toggle palette open/closed.

- [ ] **Step 7:** Commit: `feat(research): canvas tab — source palette sidebar with drag-to-add`

---

## Task 9: Canvas Tab — Position Persistence (research_canvas_positions)

**Files:**
- Create: `apps/web/app/api/research/canvas-positions/route.ts`, `apps/web/lib/research/canvas-positions.ts`
- Modify: `apps/web/components/research/canvas/canvas-inner.tsx`

- [ ] **Step 1:** Create `apps/web/app/api/research/canvas-positions/route.ts`:
  - **GET** `?personId=xxx` — returns all canvas positions for the person from `research_canvas_positions` table:
```typescript
// Response: { positions: { id, personId, nodeType, nodeId, x, y }[] }
```
  - **PUT** — bulk upsert positions for a person:
```typescript
// Body: { personId: string, positions: { nodeType, nodeId, x, y }[] }
// Uses INSERT ... ON CONFLICT(person_id, node_type, node_id) DO UPDATE SET x, y
```
  - **DELETE** `?personId=xxx&nodeId=yyy&nodeType=zzz` — removes a single position (when a node is removed from canvas)

- [ ] **Step 2:** Create `apps/web/lib/research/canvas-positions.ts` — React hooks:
```typescript
export function useCanvasPositions(personId: string) {
  // Fetches positions on mount via GET
  // Returns { positions, savePositions, removePosition, isLoading }
  // savePositions: debounced 1500ms bulk PUT
  // removePosition: immediate DELETE for single node
}
```

- [ ] **Step 3:** Integrate position loading in `canvas-inner.tsx`:
  - On mount, fetch positions via `useCanvasPositions(personId)`
  - Pass positions to `buildCanvasNodes()` which applies stored x,y to matching nodes
  - Nodes without stored positions get auto-layout positions

- [ ] **Step 4:** Implement debounced position saving on drag:
  - In `onNodesChange` handler, detect position changes (same pattern as tree-canvas.tsx):
```typescript
const handleNodesChange: OnNodesChange = useCallback((changes) => {
  onNodesChange(changes);
  // Check for position changes where dragging just ended
  if (changes.some(c => c.type === 'position' && !('dragging' in c && c.dragging))) {
    debouncedSave();
  }
}, [onNodesChange]);
```
  - `debouncedSave` extracts all node positions via `extractCanvasPositions()` and calls `savePositions()`

- [ ] **Step 5:** Handle node deletion:
  - When a note or source node is removed from canvas, call `removePosition(nodeType, nodeId)`
  - This sends a DELETE request to the API

- [ ] **Step 6:** Also persist edge data. Since `research_canvas_positions` only stores node positions, extend the approach:
  - Store edges as a JSON array in a new column on the positions table, OR
  - Store canvas edges as JSON in localStorage keyed by `canvas-edges-{personId}` (simpler v1)
  - For v1, use localStorage. Document that edge persistence will move to DB in a future iteration.

- [ ] **Step 7:** Verify: place nodes on canvas, drag them around, reload page — positions are preserved. Remove a node, reload — it is gone. Edges reconnect based on stored data.

- [ ] **Step 8:** Commit: `feat(research): canvas tab — position persistence via research_canvas_positions`

---

## Task 10: Proof Summary Tab — Structured Editor

**Files:**
- Create: `apps/web/components/research/proof/proof-tab.tsx`, `apps/web/components/research/proof/proof-editor.tsx`, `apps/web/components/research/proof/proof-section.tsx`
- Modify: `apps/web/components/research/workspace-tabs.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/proof/proof-section.tsx` — reusable section block:
  - Props: `title: string`, `description: string`, `children: ReactNode`, `icon: LucideIcon`
  - Renders as a bordered section with:
    - Header row: icon + title (bold) + description (muted, smaller)
    - Content area below for the section's editor/content
  - Collapsible via a chevron toggle (default expanded)
  - Visual: left border accent in indigo

```typescript
interface ProofSectionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

- [ ] **Step 2:** Create `apps/web/components/research/proof/proof-editor.tsx` — the structured editor with 4 GPS-inspired sections:

  **Section 1: Research Question**
  - Single textarea: "What question is this proof statement answering?"
  - Placeholder: "e.g., Who were the parents of John Smith born c.1845 in County Cork, Ireland?"
  - Auto-populated suggestion based on person's known facts (name, birth date/place)

  **Section 2: Sources Consulted**
  - Auto-populated list of all research items + promoted sources for the person
  - Each source shown as a compact row: title, type badge, confidence dot
  - Checkbox to include/exclude each source from the proof statement
  - "Add Source Note" button per source to add a brief annotation about what the source provided
  - Sources sorted by: promoted first, then draft, then dismissed

  **Section 3: Information Analysis**
  - Rich textarea for the researcher's analysis
  - Placeholder: "Analyze the information from each source. Address any conflicts or correlations..."
  - Below the textarea: auto-generated conflict summary (pulled from conflict detection) showing each conflict with the competing values — researcher can reference these in their analysis
  - Optional: numbered footnote references to sources (simple [1], [2] notation)

  **Section 4: Conclusion**
  - Rich textarea for the final conclusion
  - Placeholder: "State your conclusion and the evidence that supports it..."
  - Confidence selector: High / Medium / Low (dropdown)
  - "Date of Conclusion" auto-filled with today's date, editable

```typescript
interface ProofEditorProps {
  personId: string;
  personName: string;
  researchItems: ResearchItem[];
  sources: SourceWithCitations[];
  conflicts: ConflictInfo[];
  initialData?: ProofStatementData;
  onSave: (data: ProofStatementData) => void;
}

export interface ProofStatementData {
  question: string;
  sourcesIncluded: { sourceId: string; type: string; note: string; included: boolean }[];
  analysis: string;
  conclusion: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  conclusionDate: string;
}
```

- [ ] **Step 3:** Implement auto-save for the proof editor:
  - Debounce 1000ms on any field change
  - Save to API: PUT `/api/research/proof-summary?personId=xxx`
  - API stores the `ProofStatementData` as JSON in a `research_proof_summaries` key-value row or a dedicated table column
  - For v1: store as a JSON text column in a new row pattern — or use the same `research_person_meta` table from Task 2 with `meta_key = 'proof_summary'`

- [ ] **Step 4:** Create `apps/web/components/research/proof/proof-tab.tsx` — tab container:
  - Fetches research items, sources, conflicts, and existing proof data for the person
  - Renders ProofEditor with all data
  - Loading state: skeleton for each section
  - Max-width container (prose-like, ~800px) centered for readability

- [ ] **Step 5:** Register the Proof Summary tab in `workspace-tabs.tsx`:
  - Add `{ id: 'proof', label: 'Proof Summary', icon: FileCheck }` to the tabs array
  - Lazy-load `ProofTab` with dynamic import
  - Renders when `?view=proof` is active

- [ ] **Step 6:** Verify: navigate to Proof Summary tab, fill in all 4 sections, reload — data persists. Sources list auto-populates. Conflicts appear in analysis section.

- [ ] **Step 7:** Commit: `feat(research): proof summary tab — GPS-inspired structured editor`

---

## Task 11: Proof Summary Tab — Export as Document

**Files:**
- Create: `apps/web/components/research/proof/proof-export.ts`
- Modify: `apps/web/components/research/proof/proof-tab.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/proof/proof-export.ts` with two export functions:

```typescript
export function exportProofAsPdf(
  data: ProofStatementData,
  personName: string,
  sources: { title: string; type: string }[]
): void;

export function exportProofAsMarkdown(
  data: ProofStatementData,
  personName: string,
  sources: { title: string; type: string }[]
): string;
```

- [ ] **Step 2:** Implement `exportProofAsMarkdown`:
  - Generate a structured Markdown document:
```markdown
# Proof Summary: {personName}

**Date:** {conclusionDate}
**Confidence:** {confidenceLevel}

## Research Question

{question}

## Sources Consulted

1. {sourceTitle} ({sourceType}) — {sourceNote}
2. ...
(Only included sources listed)

## Information Analysis

{analysis}

## Conclusion

{conclusion}
```
  - Return the string. Also trigger download as `.md` file via Blob.

- [ ] **Step 3:** Implement `exportProofAsPdf`:
  - Create a new `jsPDF` instance (portrait, A4)
  - Title: "Proof Summary: {personName}" — 18pt bold
  - Subtitle: "Date: {date} | Confidence: {level}" — 11pt gray
  - Horizontal rule
  - **Section: Research Question** — 14pt bold header, then question text in 11pt
  - **Section: Sources Consulted** — 14pt bold header, then numbered list with source title, type in parentheses, and annotation. Each source on its own line.
  - **Section: Information Analysis** — 14pt bold header, then analysis text in 11pt with proper line wrapping via `doc.splitTextToSize()`
  - **Section: Conclusion** — 14pt bold header, then conclusion text in 11pt
  - Footer: "Generated by Ancstra — {date}" in 8pt gray
  - Trigger download: `{personName}-proof-summary-{YYYY-MM-DD}.pdf`

- [ ] **Step 4:** Add export buttons to `proof-tab.tsx`:
  - Place a toolbar row at the top of the tab:
    - "Export PDF" button (FileText icon)
    - "Export Markdown" button (FileCode icon)
    - "Copy to Clipboard" button (Copy icon) — copies Markdown to clipboard via `navigator.clipboard.writeText()`
  - Buttons disabled when the proof is empty (question field is blank)

- [ ] **Step 5:** Add a print-friendly CSS class for the proof editor:
  - `@media print` rules that hide tab navigation, toolbar, sidebars
  - Show only the proof content in a clean, readable format
  - "Print" button in the toolbar triggers `window.print()`

- [ ] **Step 6:** Verify: fill in a complete proof summary, export as PDF — confirm all 4 sections render. Export as Markdown — confirm formatting. Copy to clipboard — paste into a text editor and confirm content. Print preview shows clean output.

- [ ] **Step 7:** Commit: `feat(research): proof summary tab — PDF, Markdown, and clipboard export`

---

## Summary

| Task | What | Key Files | ~Duration |
|------|------|-----------|-----------|
| 1 | Matrix tab — fact table | matrix-tab.tsx, matrix-table.tsx | 1d |
| 2 | Matrix tab — conclusion column | matrix-conclusion-cell.tsx, conclusions API | 0.5d |
| 3 | Matrix tab — conflict highlighting | matrix-table.tsx, matrix-helpers.ts | 0.5d |
| 4 | Matrix tab — CSV/PDF export | matrix-export.ts | 0.5d |
| 5 | Canvas tab — React Flow + source node | canvas-tab.tsx, source-node.tsx | 1.5d |
| 6 | Canvas tab — note + conflict nodes | note-node.tsx, conflict-node.tsx | 1d |
| 7 | Canvas tab — edges + auto-layout | canvas-toolbar.tsx, canvas-utils.ts | 1d |
| 8 | Canvas tab — source palette sidebar | source-palette.tsx | 0.5d |
| 9 | Canvas tab — position persistence | canvas-positions API, hooks | 0.5d |
| 10 | Proof Summary — structured editor | proof-editor.tsx, proof-section.tsx | 1.5d |
| 11 | Proof Summary — document export | proof-export.ts | 0.5d |

**Total estimated duration:** ~9 days
**Total commits:** ~11
