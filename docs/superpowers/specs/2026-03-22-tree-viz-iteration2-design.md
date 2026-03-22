# Tree Visualization Iteration 2 — Editor Features

> **Spec for:** Drag-from-palette to create persons on canvas, edge drawing to create relationships, and search-to-focus navigation.
>
> **Builds on:** `docs/superpowers/specs/2026-03-22-tree-visualization-design.md` (iteration 1)

---

## Scope

1. Drag-from-palette: left sidebar with draggable "Person" card → drop on canvas → inline quick-form → creates person at position
2. Edge drawing: drag from handles to create relationships (bottom→top = parent-child, right→left = spouse) with validation
3. Search-to-focus: navigate to `/tree?focus=<personId>` to pan/zoom to a specific node

### Out of Scope (deferred)
- Named layout save/load from DB (tree_layouts table)
- Undo/redo for position changes
- Multi-select + bulk operations
- Export via Topola (PDF/PNG/SVG)
- Filter panel (by generation, sex, living)

---

## 1. Drag-from-Palette

### Person Palette (`components/tree/person-palette.tsx`)

Left sidebar, 250px wide, slides in when "New Person" toolbar button is clicked.

Contains a single draggable card:
```
┌─────────────────────┐
│  Person Palette      │
│                      │
│  ┌────────────────┐  │
│  │ 👤 New Person  │  │  ← draggable
│  │  Drag to canvas │  │
│  └────────────────┘  │
│                      │
│  [Close]             │
└─────────────────────┘
```

Uses HTML5 Drag and Drop API:
- `onDragStart`: sets `event.dataTransfer.setData('application/ancstra', 'new-person')`
- `event.dataTransfer.effectAllowed = 'move'`

### Canvas Drop Handler

In `tree-canvas.tsx`, add `onDragOver` and `onDrop` handlers:
- `onDragOver`: `event.preventDefault()`, set `dropEffect = 'move'`
- `onDrop`: check `getData('application/ancstra')`, use `screenToFlowPosition()` to convert mouse coords, add a draft node at that position

### Draft Person Node (`components/tree/draft-person-node.tsx`)

A custom React Flow node type `draftPerson` that renders an inline form instead of person data:

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
  [Given Name         ]
  [Surname            ]
  [Sex ▼: M/F/U       ]
  [Save]  [Cancel]
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- Dashed border (visually distinct from real nodes)
- 200px wide (same as PersonNode)
- Given name + surname + sex select — minimal fields
- **Save**: POST `/api/persons` → on success, remove draft node, refresh tree data (new person appears as real PersonNode at same position)
- **Cancel**: remove draft node
- Auto-focus the given name input on mount
- Handles: none (draft nodes can't be connected)

### Toolbar Change

Modify `tree-toolbar.tsx`:
- "New Person" button toggles palette open/close (instead of linking to `/person/new`)
- When palette is open, button shows as active/pressed state

---

## 2. Edge Drawing (Relationship Creation)

### Re-enable Connections

In `tree-canvas.tsx`:
- Change `nodesConnectable={false}` to `nodesConnectable={true}`
- Add `onConnect` handler
- Add `connectionMode={ConnectionMode.Loose}` for easier connecting

### Handle-to-Relationship Mapping

Relationship type inferred from which handles are used:

| Source Handle | Target Handle | Relationship |
|---|---|---|
| bottom (default) | top (default) | Parent → Child |
| right (id="right") | left (id="left") | Spouse ↔ Spouse |

### onConnect Handler

```typescript
const onConnect = useCallback((connection: Connection) => {
  const { source, target, sourceHandle, targetHandle } = connection;

  // Determine relationship type
  const isSpouse = sourceHandle === 'right' && targetHandle === 'left';
  const isParentChild = !sourceHandle && !targetHandle; // default handles = bottom→top

  if (isSpouse) {
    // POST /api/families { partner1Id: source, partner2Id: target }
  } else if (isParentChild) {
    // Find/create family for parent, add child
  }

  // On success: router.refresh() to reload tree data
  // On failure: toast error
}, []);
```

### Validation (in tree-utils.ts)

Before creating the relationship, validate:
- **No self-connection**: source !== target
- **No duplicate**: check if relationship already exists in current tree data
- **No cycles** (parent-child only): check that target is not already an ancestor of source
  - Walk up the parent chain from source using existing tree data
  - If target is found → reject with "Cannot create circular relationship"

Export validation helpers:
```typescript
export function validateConnection(treeData: TreeData, source: string, target: string, type: 'spouse' | 'parentChild'): { valid: boolean; error?: string }
```

### Edge Visual Feedback

While dragging a connection, React Flow shows a temporary edge. After the connection is created and tree data refreshes, the real styled edge (PartnerEdge or ParentChildEdge) replaces it.

---

## 3. Search-to-Focus

### URL Parameter

`/tree?focus=<personId>` — when present, the canvas pans and zooms to center that node.

### Implementation

In `tree-canvas.tsx`:
- Accept `focusPersonId?: string` prop
- After initial render (useEffect), if `focusPersonId` is set:
  - Call `fitView({ nodes: [{ id: focusPersonId }], duration: 500, padding: 0.5 })`
  - Open the detail panel for that person

### Integration Points

- **Cmd+K command palette**: when user selects a person and is already on `/tree`, instead of navigating to `/person/[id]`, navigate to `/tree?focus=[id]`
  - Detect current route: if pathname === '/tree', use focus param
  - Otherwise navigate to person detail as usual
- **Detail panel relative clicks**: when clicking a spouse/parent/child name in the tree detail panel, pan to that node instead of navigating away
  - The `onFocusNode` callback already exists — enhance it to also call `fitView`
- **Tree page**: read `focus` from searchParams, pass to TreeCanvas

---

## File Structure

```
components/tree/
  tree-canvas.tsx       — MODIFY: add onConnect, onDrop, onDragOver, focusPersonId, re-enable connections
  tree-toolbar.tsx      — MODIFY: palette toggle instead of /person/new link
  person-palette.tsx    — NEW: left sidebar with draggable person card
  draft-person-node.tsx — NEW: temporary node with inline quick-form
  tree-utils.ts         — MODIFY: add validateConnection() helper

app/(auth)/tree/
  page.tsx              — MODIFY: read focus searchParam, pass to TreeCanvas

components/
  command-palette.tsx   — MODIFY: navigate to /tree?focus= when already on tree page
```

---

## No New API Routes

Uses existing:
- `POST /api/persons` (create person from draft node)
- `POST /api/families` (create spouse relationship)
- `POST /api/families/[id]/children` (add child to family)
- Existing family-finding logic from `lib/queries.ts`

---

## No New Tests

Visual/interactive feature. Type check + manual testing. The `validateConnection` helper could have unit tests but is simple enough to verify manually.
