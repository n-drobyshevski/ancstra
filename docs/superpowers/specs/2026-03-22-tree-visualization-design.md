# Tree Visualization — React Flow Interactive Canvas

> **Spec for:** Full-screen tree canvas with React Flow, custom person nodes, dagre auto-layout, context menus, slide-out detail panel, and position persistence.
>
> **Based on:** ADR-005 (React Flow as primary visualization)

---

## Scope — First Iteration

### Included
1. React Flow canvas with dagre auto-layout (TB, partners side-by-side)
2. PersonNode — standard style: avatar initials, name, birth/death dates, sex color border
3. PartnerEdge (horizontal) + ParentChildEdge (vertical, styled by validation status)
4. Floating toolbar: Auto Layout, Save Layout, + New Person, Search placeholder, Filter placeholder, Export placeholder
5. Right-click context menu on nodes: View Details, Edit, Add Spouse/Parent/Child, Delete
6. Right-click on empty canvas: Add Person Here
7. Detail panel — slide-out from right (400px), read-only person summary, clickable relationships
8. MiniMap (bottom-left), Controls (bottom-right), dots background
9. Node drag-to-reposition with localStorage persistence
10. Keyboard shortcuts: Delete, Escape, /

### Deferred
- Drag-from-palette to create persons
- Draw edges between handles to create relationships
- Named layout save/load from DB (`tree_layouts` table)
- Undo/redo for position changes
- Multi-select + bulk operations
- Export via Topola (PDF/PNG/SVG)
- Filter panel (by generation, sex, living)
- Search-to-focus on canvas

---

## Page Layout

Full-screen canvas within the existing `(auth)` layout. App sidebar stays collapsed.

- **Floating toolbar** at top of canvas — transparent, pill buttons with shadows
  - Left: Auto Layout, Save Layout, + New Person
  - Right: Search, Filter, Export (placeholders)
- **Canvas** fills remaining space — React Flow with dots background
- **MiniMap** bottom-left, **Controls** (zoom +/−, fit) bottom-right
- **Detail panel** slides from right (400px) when a node is clicked, pushes canvas
- **Palette panel** slides from left when "New Person" clicked (deferred — first iteration uses context menu)

---

## PersonNode (Custom React Flow Node)

Standard design: 200px wide, 8px border-radius, left color border for sex.

```
┌────────────────────────────┐
│ [JS]  John Smith           │  ← blue left border (Male)
│       b. 15 Mar 1845       │
│       d. 23 Nov 1923       │
└────────────────────────────┘
```

- Avatar: 36px circle with initials, sex-colored background (blue M, pink F, gray U)
- Left border: 4px, same sex color
- Name: 13px semibold
- Dates: 11px muted
- Connection handles: top (target), bottom (source), left + right (for partner edges)
- Selected state: ring highlight (primary color)

---

## Edge Types

**PartnerEdge** — horizontal connection between spouses
- Straight line, gray, 2px
- Marriage date label if available (future enhancement)

**ParentChildEdge** — vertical connection from parent to child
- Styled by `validationStatus`:
  - `confirmed`: solid, 2px, gray
  - `proposed`: dashed (5,5), blue
  - `disputed`: dotted (2,4), amber

---

## Data Flow

1. **Server component** (`/tree/page.tsx`): fetch all non-deleted persons + families + children from DB via `getTreeData()` helper
2. **Transform** to React Flow format:
   - Each person → `{ id, type: 'person', data: PersonListItem, position: {x,y} }`
   - Each family partnership → `{ id, type: 'partner', source, target }`
   - Each parent-child → `{ id, type: 'parentChild', source, target, data: { validationStatus } }`
3. **Layout**: If saved positions in localStorage → apply. Otherwise → dagre auto-layout
4. **Render**: Pass to `<TreeCanvas>` client component

### Dagre Layout Config
```
rankdir: 'TB'
rankSep: 120  (vertical spacing between generations)
nodeSep: 80   (horizontal spacing between nodes)
```

Post-dagre adjustments:
- Partners placed at same Y, separated by `nodeWidth + 40px`
- Children centered below couple midpoint

### Position Persistence (localStorage for now)
- Key: `ancstra-tree-layout`
- Value: `{ [personId]: { x: number, y: number } }`
- Saved on node drag end (debounced 500ms)
- "Auto Layout" button clears saved positions and recomputes
- "Save Layout" button saves explicitly (same storage for now, DB later)

---

## Context Menu

**On node right-click:**
```
John Smith
──────────
👁 View Details    → opens detail panel
✏️ Edit Person     → navigates to /person/[id]/edit
──────────
+ Add Spouse       → /person/new?relation=spouse&of=[id]
+ Add Parent       → /person/new?relation=father&of=[id] (or mother)
+ Add Child        → /person/new?relation=child&of=[id]
──────────
🗑 Delete Person   → confirmation → DELETE API
```

**On empty canvas right-click:**
```
+ Add Person Here  → /person/new (future: inline form at position)
⊡ Fit View         → fitView()
```

**On edge right-click:**
```
🗑 Delete Relationship → confirmation → unlink API
```

---

## Detail Panel (Right Slide-Out)

400px wide, appears when node clicked, pushes canvas.

Sections:
1. **Header**: Name, sex, living status, close [×] button
2. **Vital Info**: Birth/death dates and places
3. **Family**: Spouses, parents, children — clickable (focuses node on canvas)
4. **Events**: Chronological list (type, date, place)
5. **Actions**: "Edit Full Page" → `/person/[id]/edit`, "View Detail Page" → `/person/[id]`

Read-only summary — no inline editing. Close with [×] or Escape.

---

## Interactions

| Action | Trigger | Result |
|---|---|---|
| Pan | Click+drag on canvas | Moves viewport |
| Zoom | Scroll wheel / +/- buttons | Zooms in/out |
| Select node | Click node | Highlights, opens detail panel |
| Move node | Drag node | Repositions, debounced save |
| Context menu | Right-click node/canvas/edge | Shows contextual actions |
| Fit view | Click ⊡ or double-click minimap | Fits all nodes in viewport |
| Delete | Select node + Delete key | Confirmation → soft-delete |
| Close panel | Escape or [×] | Closes detail panel |
| Search | / key | Focuses search (placeholder for now) |

---

## File Structure

```
apps/web/
  app/(auth)/tree/
    page.tsx                    — Server: fetch tree data, pass to canvas

  components/tree/
    tree-canvas.tsx             — Client: ReactFlow wrapper, handles state + events
    tree-toolbar.tsx            — Floating toolbar buttons
    person-node.tsx             — Custom node: avatar, name, dates, sex border
    partner-edge.tsx            — Custom horizontal edge for spouses
    parent-child-edge.tsx       — Custom vertical edge (solid/dashed/dotted)
    tree-context-menu.tsx       — Right-click menu (node/edge/canvas variants)
    tree-detail-panel.tsx       — Right slide-out person summary
    tree-utils.ts               — dagre layout, data transforms, position helpers

  lib/
    queries.ts                  — MODIFY: add getTreeData() function
```

### New Dependencies
- `@xyflow/react` — React Flow canvas
- `@dagrejs/dagre` — Hierarchical auto-layout

### Query Helper Addition

`getTreeData()` in `lib/queries.ts`:
- Fetch all persons (non-deleted) with primary names + birth/death dates
- Fetch all families (non-deleted) with partner IDs
- Fetch all children records
- Return `{ persons: PersonListItem[], families: FamilyRecord[], childLinks: ChildLink[] }`

---

## No New DB Schema

Position persistence uses localStorage for this iteration. The `tree_layouts` table from ADR-005 is deferred to the named-layouts feature.

## No New Tests

Heavily visual/interactive feature. Type check + manual testing. Snapshot tests can be added later.
