# Named Layout Management

> **Spec for:** Persistent named layouts in DB replacing localStorage, layout dropdown in toolbar, auto-save to active layout.
>
> **No undo/redo** — named layouts serve as save/restore checkpoints.

---

## Scope

1. New `tree_layouts` DB table (global, no tree_id)
2. Layout CRUD API (create, list, get, update, delete, set default)
3. Toolbar dropdown for switching/saving/managing layouts
4. Auto-load default layout on tree page visit
5. Auto-save to active layout on node drag (debounced 2s)
6. Migration from localStorage to DB on first load
7. Remove localStorage position persistence

---

## Schema

```sql
CREATE TABLE tree_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  layout_data TEXT NOT NULL,  -- JSON: { [personId]: { x: number, y: number } }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Drizzle definition:
```typescript
export const treeLayouts = sqliteTable('tree_layouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  layoutData: text('layout_data').notNull(), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

---

## API Routes

### `GET /api/layouts`
- Auth required
- Return all layouts: `{ layouts: { id, name, isDefault, updatedAt }[] }`
- Ordered by name. Don't return `layoutData` in list (it can be large).

### `POST /api/layouts`
- Auth required
- Body: `{ name: string, layoutData: string, isDefault?: boolean }`
- If `isDefault: true`, unset previous default first
- Return created layout with 201

### `GET /api/layouts/[id]`
- Auth required
- Return full layout including `layoutData`
- 404 if not found

### `PUT /api/layouts/[id]`
- Auth required
- Body: `{ name?: string, layoutData?: string }`
- Updates provided fields + `updatedAt`
- Return updated layout

### `DELETE /api/layouts/[id]`
- Auth required
- Hard delete
- If deleted layout was default, no layout is default (falls back to dagre)
- Return `{ success: true }`

### `PUT /api/layouts/[id]/default`
- Auth required
- Set this layout as default (unset all others first in a transaction)
- Return `{ success: true }`

---

## Types

```typescript
export interface TreeLayout {
  id: string;
  name: string;
  isDefault: boolean;
  layoutData?: string; // JSON, only included on GET /api/layouts/[id]
  updatedAt: string;
}

export interface CreateLayoutInput {
  name: string;
  layoutData: string;
  isDefault?: boolean;
}
```

---

## Toolbar Dropdown

Replace "Save Layout" button with a dropdown menu using shadcn `DropdownMenu`:

```
[Layouts ▼]
├─ ★ Pedigree View          → load this layout
├─   Research Layout         → load this layout
├─   Presentation            → load this layout
├─ ──────────────
├─ Save as new...            → prompt name, save current positions
├─ Update "[active name]"    → overwrite active layout (only shown when a layout is active)
├─ ──────────────
├─ Set as default            → star the active layout
├─ Rename                    → inline rename
├─ Delete                    → confirm, delete active layout
```

Active layout tracked in TreeCanvas state: `activeLayoutId: string | null`.

---

## Canvas Behavior

### On page load:
1. Fetch layouts list: `GET /api/layouts`
2. If a default layout exists → fetch its data: `GET /api/layouts/[id]` → apply positions
3. If no default → check localStorage for migration (see below)
4. If nothing → dagre auto-layout

### Auto-save (debounced 2s):
- When a node is dragged and an active layout is set → `PUT /api/layouts/[id]` with current positions
- Only saves if `activeLayoutId` is set (not when using unsaved dagre layout)
- Debounced to avoid hammering the API during rapid dragging

### Load layout:
- Click layout in dropdown → `GET /api/layouts/[id]` → apply positions → set as `activeLayoutId`

### Auto Layout button:
- Recomputes dagre positions → clears `activeLayoutId` (no longer tracking a saved layout)
- Does NOT delete any saved layout

---

## localStorage Migration

On first tree page load after upgrade:
1. Check if `localStorage.getItem('ancstra-tree-layout')` exists
2. If yes AND no layouts exist in DB → create a "Default" layout in DB with those positions, set as default
3. Remove localStorage key
4. If layouts already exist in DB → just remove localStorage key (user already migrated)

This runs once in the TreeCanvas useEffect.

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
    tree-canvas.tsx                   — MODIFY: load from DB, auto-save, activeLayoutId
    tree-toolbar.tsx                  — MODIFY: layout dropdown replaces save button
    tree-utils.ts                    — MODIFY: remove localStorage functions, add API-based helpers

  __tests__/
    api/layouts.test.ts               — Layout CRUD integration tests
```

---

## Validation Schemas

```
createLayoutSchema: name required (min 1), layoutData required (valid JSON string)
updateLayoutSchema: name optional, layoutData optional, at least one required
```

---

## Tests

### `__tests__/api/layouts.test.ts`
- POST creates layout with name and positions
- GET lists layouts without layoutData
- GET /[id] returns layout with layoutData
- PUT updates layout name and data
- DELETE removes layout
- PUT /[id]/default sets default and unsets previous
- Only one default at a time

---

## Out of Scope
- Undo/redo (named layouts serve as manual checkpoints)
- Layout sharing between users
- Layout thumbnails/previews
- Per-layout zoom/viewport state
