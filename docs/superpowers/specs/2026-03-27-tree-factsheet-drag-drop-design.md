# Tree Factsheet Drag-and-Drop

> **Status:** Design approved
> **Date:** 2026-03-27
> **Scope:** Drag factsheets from palette onto tree canvas to promote them inline
> **Dependencies:** factsheet-ui-components-design, research-to-tree-pipeline-design

## Context

The factsheet pipeline is complete (backend + UI), but there's no way to place factsheets onto the tree spatially. The tree canvas already supports drag-from-palette for creating new persons. This feature extends that pattern to support dragging factsheets onto the canvas, showing an inline promote card at the drop position, and converting it to a real PersonNode on promotion.

## Design

### Drag Source: Extended Palette

The existing `person-palette.tsx` is extended with a "Factsheets" section below the "New Person" drag item.

- Fetches factsheets via `useFactsheets` (filters to non-dismissed, non-promoted)
- Each factsheet is a draggable card showing: title, status badge, fact count
- Drag sets `dataTransfer.setData('application/ancstra', 'factsheet:{factsheetId}')`
- Only factsheets with status `draft` or `ready` are draggable (promoted/merged/dismissed are not)
- Empty state: "No factsheets to place. Create one from Research."

### Drop Target: Extended Canvas

The existing `tree-canvas.tsx` `onDrop` handler is extended:

1. Read `dataTransfer.getData('application/ancstra')`
2. If value starts with `factsheet:`, extract the factsheetId
3. Create a `draftFactsheet` node at the drop position with `data: { factsheetId, onPromoted, onCancel }`
4. Existing `new-person` handling unchanged

New node type added to `nodeTypes`: `{ ..., draftFactsheet: DraftFactsheetNode }`

### Inline Promote Card: DraftFactsheetNode

A React Flow custom node rendered at the drop position. Shows:

- **Header:** factsheet title + status badge
- **Summary:** "{N} facts · {N} links" line
- **Key facts:** up to 3 facts shown (name, birth_date, birth_place if available)
- **Duplicate check:** auto-runs on mount, shows match warning if found
- **Actions:**
  - "Create Person" button (primary) — promotes with mode='create'
  - "Merge" button (outline, only if duplicate match found) — promotes with mode='merge'
  - "Cancel" (ghost) — removes the draft node
- **Loading state:** button shows spinner during promotion
- **On success:** removes draft node, calls `onPromoted()` which triggers `router.refresh()` to load the new PersonNode

Card dimensions: ~240px wide, auto height. Styled to match DraftPersonNode patterns (border, rounded-lg, bg-card, shadow-md).

### Family Unit Handling

If the dropped factsheet has links (connected factsheets), show an additional indicator:

- "Part of family unit ({N} linked)" text below the summary
- Promote button becomes "Promote Family Unit" which calls `promoteFactsheet(id, 'create', undefined, true)` (cluster=true)
- All connected factsheets are promoted atomically

## Files

### New
- `apps/web/components/tree/draft-factsheet-node.tsx` — inline promote card node

### Modified
- `apps/web/components/tree/person-palette.tsx` — add factsheet list section
- `apps/web/components/tree/tree-canvas.tsx` — extend onDrop + add draftFactsheet nodeType

## Verification

1. Open tree view → click "+ New Person" to open palette → see factsheet list below
2. Drag a factsheet card → drop on canvas → inline promote card appears at drop position
3. Click "Create Person" → spinner → person appears on tree, draft card disappears
4. Drag a factsheet with links → card shows "Part of family unit" → "Promote Family Unit" creates all persons + relationships
5. Click "Cancel" on draft card → card disappears, no changes
6. Duplicate found → "Merge" button appears alongside "Create Person"
7. Keyboard: Escape on focused draft card triggers cancel
