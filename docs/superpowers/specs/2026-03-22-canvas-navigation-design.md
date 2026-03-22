# Canvas Navigation — Filter Pills + Multi-Select

> **Spec for:** Filter toggle pills in toolbar to dim nodes by sex/living status, and multi-select for group repositioning.
>
> **Search-to-focus already implemented** in tree viz iteration 2.

---

## Scope

1. Filter toggle pills in toolbar (Male, Female, Unknown, Living, Deceased)
2. Dim non-matching nodes (30% opacity, non-interactive) — preserves spatial context
3. Dim edges connected to dimmed nodes
4. Multi-select via Shift+click and drag selection box
5. Group move (drag selected nodes together)
6. Cmd+A to select all visible nodes

### Out of Scope
- Bulk delete or bulk edit operations
- Generation/date range filters
- Persisting filter state across page loads
- Search-to-focus (already done)

---

## Filter Pills

### Toolbar Integration

Right side of the toolbar, replacing the disabled "Filter" placeholder button. Rendered as toggle pills:

```
[Auto Layout] [Layouts ▼] [+ New Person]     [M] [F] [U] [Living] [Deceased] [Search] [Export]
```

- All pills ON by default (everything visible)
- Click a pill to toggle OFF → matching nodes dim
- Pill styling: filled variant = ON (active), outline variant = OFF (filtering out)
- Badge or visual indicator when any filter is active

### Filter State

```typescript
interface FilterState {
  sex: { M: boolean; F: boolean; U: boolean };
  living: { living: boolean; deceased: boolean };
}
```

Default: all `true`. Component state in TreeCanvas (not persisted).

A node is **dimmed** when:
- Its sex is toggled OFF, OR
- It's living and "Living" is OFF, OR
- It's deceased (not living) and "Deceased" is OFF

### Dim Behavior

**Dimmed nodes:**
- `opacity: 0.3` on the PersonNode wrapper
- `pointer-events: none` — can't click, drag, or start connections
- Not selectable via multi-select

**Dimmed edges:**
- Edges where either source OR target node is dimmed → edge gets `opacity: 0.3`

**Implementation:**
- `applyFilters(nodes, edges, filterState)` in `tree-utils.ts`
- Returns `{ nodes: Node[], edges: Edge[] }` with `data.dimmed: boolean` set on each
- PersonNode reads `data.dimmed` and conditionally applies opacity + pointer-events
- Custom edges read source/target dimmed state (via node lookup or edge data)

---

## Multi-Select

### React Flow Built-in Support

React Flow has built-in multi-selection. Enable with props:

```typescript
<ReactFlow
  selectionOnDrag={true}
  selectionMode={SelectionMode.Partial}
  multiSelectionKeyCode="Shift"
  // ... existing props
>
```

- **Shift+click**: toggle individual node selection
- **Drag on canvas**: draws selection rectangle, selects nodes inside
- **Drag selected node**: moves all selected nodes together (built-in)
- **Escape**: deselects all (already handled)
- **Cmd+A / Ctrl+A**: select all visible (non-dimmed) nodes

### Cmd+A Handler

Add to keyboard useEffect:
```typescript
if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
  e.preventDefault();
  // Select all non-dimmed nodes
  setNodes(nds => nds.map(n => ({ ...n, selected: !n.data?.dimmed })));
}
```

### Visual Feedback

Selected nodes already have `ring-2 ring-primary shadow-md` from PersonNode's `selected` prop. Multiple selected nodes all show this ring.

---

## File Structure

```
components/tree/
  tree-canvas.tsx   — MODIFY: filter state, applyFilters on node changes, multi-select props, Cmd+A
  tree-toolbar.tsx  — MODIFY: filter pills replacing placeholder
  person-node.tsx   — MODIFY: dimmed styling (opacity + pointer-events)
  tree-utils.ts     — MODIFY: add applyFilters() helper
```

No new files. No API changes. No schema changes. No tests (visual feature).

---

## tree-utils.ts Addition

```typescript
export interface FilterState {
  sex: { M: boolean; F: boolean; U: boolean };
  living: { living: boolean; deceased: boolean };
}

export const DEFAULT_FILTERS: FilterState = {
  sex: { M: true, F: true, U: true },
  living: { living: true, deceased: true },
};

export function applyFilters(
  nodes: Node[],
  filterState: FilterState
): Node[] {
  return nodes.map((node) => {
    if (node.type === 'draftPerson') return node;
    const data = node.data as PersonNodeData;
    const sexVisible = filterState.sex[data.sex as 'M' | 'F' | 'U'] ?? true;
    const livingVisible = data.isLiving
      ? filterState.living.living
      : filterState.living.deceased;
    const dimmed = !sexVisible || !livingVisible;
    return { ...node, data: { ...data, dimmed } };
  });
}

export function applyEdgeFilters(
  edges: Edge[],
  nodes: Node[]
): Edge[] {
  const dimmedIds = new Set(
    nodes.filter((n) => n.data?.dimmed).map((n) => n.id)
  );
  return edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: dimmedIds.has(edge.source) || dimmedIds.has(edge.target) ? 0.3 : 1,
    },
  }));
}
```
