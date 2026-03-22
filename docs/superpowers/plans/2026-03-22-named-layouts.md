# Named Layout Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage position persistence with DB-backed named layouts, allowing users to save, switch, and manage multiple tree arrangement views with a toolbar dropdown.

**Architecture:** New `tree_layouts` Drizzle table stores named position snapshots as JSON. CRUD API routes for layout management. Toolbar dropdown replaces "Save Layout" button. TreeCanvas loads default layout from DB on mount, auto-saves to active layout on drag. localStorage migration on first load.

**Tech Stack:** Drizzle ORM, better-sqlite3, shadcn/ui DropdownMenu, Next.js 16, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-named-layouts-design.md`

---

## File Structure

```
packages/db/src/
  schema.ts                           — ADD: treeLayouts table

packages/shared/src/
  types.ts                            — ADD: TreeLayout, CreateLayoutInput

apps/web/
  lib/
    validation.ts                     — ADD: createLayoutSchema, updateLayoutSchema

  app/api/
    layouts/route.ts                  — POST, GET (list)
    layouts/[id]/route.ts             — GET, PUT, DELETE
    layouts/[id]/default/route.ts     — PUT (set default)

  components/tree/
    tree-canvas.tsx                   — MODIFY: DB-based layout loading, auto-save, migration
    tree-toolbar.tsx                  — MODIFY: layout dropdown
    tree-utils.ts                    — MODIFY: remove localStorage functions

  __tests__/
    api/layouts.test.ts               — Layout CRUD integration tests
    validation.test.ts                — ADD: layout schema tests
```

---

## Task 0: Schema + Types + Validation

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/lib/validation.ts`
- Modify: `apps/web/__tests__/validation.test.ts`

- [ ] **Step 1: Add treeLayouts table to schema.ts**

Read the file. Add after the `sourceCitations` table:

```typescript
// ==================== TREE LAYOUTS ====================
export const treeLayouts = sqliteTable('tree_layouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  layoutData: text('layout_data').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Run migration**

```bash
cd D:/projects/ancstra/packages/db && pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Add types to packages/shared/src/types.ts**

```typescript
export interface TreeLayout {
  id: string;
  name: string;
  isDefault: boolean;
  layoutData?: string;
  updatedAt: string;
}

export interface CreateLayoutInput {
  name: string;
  layoutData: string;
  isDefault?: boolean;
}
```

- [ ] **Step 4: Add Zod schemas to validation.ts**

```typescript
export const createLayoutSchema = z.object({
  name: z.string().min(1, 'Layout name is required'),
  layoutData: z.string().min(2, 'Layout data is required'),
  isDefault: z.boolean().optional(),
});

export const updateLayoutSchema = z.object({
  name: z.string().min(1).optional(),
  layoutData: z.string().min(2).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);
```

- [ ] **Step 5: Add validation tests**

```typescript
describe('createLayoutSchema', () => {
  it('accepts valid layout', () => {
    expect(createLayoutSchema.safeParse({ name: 'My Layout', layoutData: '{}' }).success).toBe(true);
  });
  it('rejects missing name', () => {
    expect(createLayoutSchema.safeParse({ layoutData: '{}' }).success).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/validation.test.ts
cd D:/projects/ancstra && git add packages/db/src/schema.ts packages/db/migrations/ packages/shared/src/types.ts apps/web/lib/validation.ts apps/web/__tests__/validation.test.ts
git commit -m "feat(layouts): schema + types + Zod schemas for named tree layouts"
```

---

## Task 1: Layout CRUD API + Tests

**Files:**
- Create: `apps/web/app/api/layouts/route.ts`
- Create: `apps/web/app/api/layouts/[id]/route.ts`
- Create: `apps/web/app/api/layouts/[id]/default/route.ts`
- Create: `apps/web/__tests__/api/layouts.test.ts`

- [ ] **Step 1: Create POST/GET /api/layouts**

`apps/web/app/api/layouts/route.ts`:
- **POST**: Auth, validate with `createLayoutSchema`. If `isDefault: true`, unset all other defaults first (`UPDATE tree_layouts SET is_default = 0`). Insert layout. Return 201.
- **GET**: Auth. Select all layouts ordered by name. Return `{ layouts }` with `id, name, isDefault, updatedAt` (exclude `layoutData` for list).

- [ ] **Step 2: Create GET/PUT/DELETE /api/layouts/[id]**

`apps/web/app/api/layouts/[id]/route.ts`:
- **GET**: Auth. Find by id, return full layout including `layoutData`. 404 if not found.
- **PUT**: Auth. Validate with `updateLayoutSchema`. Update provided fields + `updatedAt`. Return updated.
- **DELETE**: Auth. Hard delete. Return `{ success: true }`.

- [ ] **Step 3: Create PUT /api/layouts/[id]/default**

`apps/web/app/api/layouts/[id]/default/route.ts`:
- **PUT**: Auth. Wrap in transaction: unset all defaults → set this layout as default. Return `{ success: true }`.

- [ ] **Step 4: Write integration tests**

`apps/web/__tests__/api/layouts.test.ts` — in-memory SQLite with `tree_layouts` DDL:

```sql
CREATE TABLE tree_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  layout_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Tests:
- POST creates layout with name and data
- GET lists layouts without layoutData
- GET /[id] returns full layout with layoutData
- PUT updates layout name
- PUT updates layout data
- DELETE removes layout
- PUT /[id]/default sets default and unsets previous
- Only one default at a time (create two defaults, verify only last is default)

- [ ] **Step 5: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
cd D:/projects/ancstra && git add apps/web/app/api/layouts/ apps/web/__tests__/api/layouts.test.ts
git commit -m "feat(api): layout CRUD — create, list, get, update, delete, set default"
```

---

## Task 2: Toolbar Layout Dropdown

**Files:**
- Modify: `apps/web/components/tree/tree-toolbar.tsx`

Install shadcn dropdown-menu if not already present (it was installed in Week 2 for the mode toggle).

- [ ] **Step 1: Rewrite tree-toolbar.tsx with layout dropdown**

Read the current file. Replace the "Save Layout" button with a shadcn `DropdownMenu`. The toolbar needs new props:

```typescript
interface TreeToolbarProps {
  onAutoLayout: () => void;
  onTogglePalette: () => void;
  paletteOpen: boolean;
  // Layout management
  layouts: { id: string; name: string; isDefault: boolean }[];
  activeLayoutId: string | null;
  activeLayoutName: string | null;
  onLoadLayout: (id: string) => void;
  onSaveAsNew: () => void;
  onUpdateLayout: () => void;
  onSetDefault: () => void;
  onDeleteLayout: () => void;
  onRenameLayout: () => void;
}
```

Dropdown structure:
- List of saved layouts (star icon for default, bold for active)
- Separator
- "Save as new..." item
- "Update [active name]" item (only when activeLayoutId is set)
- Separator
- "Set as default" / "Rename" / "Delete" items (only when activeLayoutId is set)

Use `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` from shadcn.

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-toolbar.tsx
git commit -m "feat(tree): layout dropdown in toolbar with save/load/manage actions"
```

---

## Task 3: Canvas DB Integration + localStorage Migration

**Files:**
- Modify: `apps/web/components/tree/tree-canvas.tsx`
- Modify: `apps/web/components/tree/tree-utils.ts`

This is the big integration task — wires up the toolbar dropdown to the canvas state, replaces localStorage with API calls.

- [ ] **Step 1: Remove localStorage functions from tree-utils.ts**

Read the file. Remove these exports: `savePositions`, `loadPositions`, `clearPositions`, `applyStoredPositions`, and the `LAYOUT_KEY` constant. The canvas will now use API calls instead.

Keep `applyStoredPositions` but rename it to `applyPositionMap` — it's still useful for applying positions from any source (DB or migration):

```typescript
export function applyPositionMap(
  nodes: Node[],
  positions: Record<string, { x: number; y: number }>
): Node[] {
  return nodes.map((node) => {
    const stored = positions[node.id];
    if (stored) return { ...node, position: stored };
    return node;
  });
}
```

Add a helper to extract current positions:

```typescript
export function extractPositions(nodes: Node[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (n.type !== 'draftPerson') {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    }
  }
  return positions;
}
```

- [ ] **Step 2: Major update to tree-canvas.tsx**

Read the full current file. Key changes:

**New state:**
```typescript
const [layouts, setLayouts] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
const [activeLayoutName, setActiveLayoutName] = useState<string | null>(null);
```

**On mount — load layouts + default + migration:**
```typescript
useEffect(() => {
  // Fetch layouts
  fetch('/api/layouts').then(r => r.json()).then(data => {
    setLayouts(data.layouts ?? []);
    const defaultLayout = (data.layouts ?? []).find((l: any) => l.isDefault);

    if (defaultLayout) {
      // Load default layout positions
      fetch(`/api/layouts/${defaultLayout.id}`).then(r => r.json()).then(layout => {
        const positions = JSON.parse(layout.layoutData);
        setNodes(applyPositionMap(rawNodes, positions));
        setActiveLayoutId(layout.id);
        setActiveLayoutName(layout.name);
      });
    } else if (typeof window !== 'undefined' && localStorage.getItem('ancstra-tree-layout')) {
      // Migration: localStorage → DB
      const stored = localStorage.getItem('ancstra-tree-layout');
      if (stored) {
        const positions = JSON.parse(stored);
        setNodes(applyPositionMap(rawNodes, positions));
        // Auto-create "Default" layout in DB
        fetch('/api/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Default', layoutData: stored, isDefault: true }),
        }).then(r => r.json()).then(layout => {
          setActiveLayoutId(layout.id);
          setActiveLayoutName('Default');
          setLayouts([{ id: layout.id, name: 'Default', isDefault: true }]);
        });
        localStorage.removeItem('ancstra-tree-layout');
      }
    }
  });
}, []);
```

**Auto-save on drag (debounced 2s, only when active layout):**
Replace the existing 500ms localStorage save with:
```typescript
const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

// In handleNodesChange, when position changes end:
if (activeLayoutId && changes.some(c => c.type === 'position' && !('dragging' in c && c.dragging))) {
  clearTimeout(autoSaveRef.current);
  autoSaveRef.current = setTimeout(() => {
    setNodes(currentNodes => {
      const positions = extractPositions(currentNodes);
      fetch(`/api/layouts/${activeLayoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData: JSON.stringify(positions) }),
      });
      return currentNodes;
    });
  }, 2000);
}
```

**Layout action handlers (passed to toolbar):**
```typescript
const handleLoadLayout = useCallback(async (id: string) => {
  const res = await fetch(`/api/layouts/${id}`);
  const layout = await res.json();
  const positions = JSON.parse(layout.layoutData);
  setNodes(applyPositionMap(rawNodes, positions));
  setActiveLayoutId(layout.id);
  setActiveLayoutName(layout.name);
}, [rawNodes, setNodes]);

const handleSaveAsNew = useCallback(async () => {
  const name = prompt('Layout name:');
  if (!name) return;
  const positions = extractPositions(nodes);
  const res = await fetch('/api/layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, layoutData: JSON.stringify(positions) }),
  });
  const layout = await res.json();
  setActiveLayoutId(layout.id);
  setActiveLayoutName(name);
  // Refresh layouts list
  const listRes = await fetch('/api/layouts');
  setLayouts((await listRes.json()).layouts);
  toast.success(`Layout "${name}" saved`);
}, [nodes]);

const handleUpdateLayout = useCallback(async () => {
  if (!activeLayoutId) return;
  const positions = extractPositions(nodes);
  await fetch(`/api/layouts/${activeLayoutId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layoutData: JSON.stringify(positions) }),
  });
  toast.success('Layout updated');
}, [activeLayoutId, nodes]);

const handleSetDefault = useCallback(async () => {
  if (!activeLayoutId) return;
  await fetch(`/api/layouts/${activeLayoutId}/default`, { method: 'PUT' });
  const listRes = await fetch('/api/layouts');
  setLayouts((await listRes.json()).layouts);
  toast.success('Set as default');
}, [activeLayoutId]);

const handleRenameLayout = useCallback(async () => {
  if (!activeLayoutId) return;
  const name = prompt('New name:', activeLayoutName ?? '');
  if (!name) return;
  await fetch(`/api/layouts/${activeLayoutId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  setActiveLayoutName(name);
  const listRes = await fetch('/api/layouts');
  setLayouts((await listRes.json()).layouts);
}, [activeLayoutId, activeLayoutName]);

const handleDeleteLayout = useCallback(async () => {
  if (!activeLayoutId) return;
  if (!confirm(`Delete layout "${activeLayoutName}"?`)) return;
  await fetch(`/api/layouts/${activeLayoutId}`, { method: 'DELETE' });
  setActiveLayoutId(null);
  setActiveLayoutName(null);
  const listRes = await fetch('/api/layouts');
  setLayouts((await listRes.json()).layouts);
  toast.success('Layout deleted');
}, [activeLayoutId, activeLayoutName]);
```

**Update Auto Layout handler:**
```typescript
const handleAutoLayout = useCallback(() => {
  const laid = applyDagreLayout(rawNodes, rawEdges);
  setNodes(laid);
  setActiveLayoutId(null);  // No longer tracking a saved layout
  setActiveLayoutName(null);
}, [rawNodes, rawEdges, setNodes]);
```

**Update toolbar rendering with all new props:**
```typescript
<TreeToolbar
  onAutoLayout={handleAutoLayout}
  onTogglePalette={() => setPaletteOpen(o => !o)}
  paletteOpen={paletteOpen}
  layouts={layouts}
  activeLayoutId={activeLayoutId}
  activeLayoutName={activeLayoutName}
  onLoadLayout={handleLoadLayout}
  onSaveAsNew={handleSaveAsNew}
  onUpdateLayout={handleUpdateLayout}
  onSetDefault={handleSetDefault}
  onDeleteLayout={handleDeleteLayout}
  onRenameLayout={handleRenameLayout}
/>
```

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-canvas.tsx apps/web/components/tree/tree-utils.ts
git commit -m "feat(tree): DB-based layout loading, auto-save, localStorage migration"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Type check**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
```

Expected: All 111+ existing tests + ~10 new layout tests pass.

- [ ] **Step 3: Manual smoke test**

1. Go to `/tree` → tree loads with dagre layout (no saved layouts yet)
2. Drag some nodes around
3. Click "Layouts ▼" → "Save as new..." → name "My Pedigree" → saved
4. Dropdown now shows "My Pedigree"
5. Click Auto Layout → positions reset, active layout cleared
6. Click "Layouts ▼" → "My Pedigree" → positions restored
7. Drag a node → wait 2s → auto-saved (refresh page, positions persist)
8. "Set as default" → star appears → refresh page → layout auto-loads
9. "Rename" → new name appears in dropdown
10. "Delete" → layout removed → falls back to dagre
11. If you had localStorage positions from before → they migrate to "Default" layout on first load

- [ ] **Step 4: Commit any remaining changes**

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | Schema + types + validation | — |
| 1 | Layout CRUD API + integration tests | 0 |
| 2 | Toolbar layout dropdown | 1 |
| 3 | Canvas DB integration + localStorage migration | 1, 2 |
| 4 | Final verification | All |

**Critical path:** 0 → 1 → 2 → 3

**Parallelizable:** Tasks 2 and the test portion of Task 1 overlap but touch different files.
