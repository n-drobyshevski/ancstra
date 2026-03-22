# Tree Viz Iteration 2 — Editor Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-from-palette to create persons on the canvas, edge drawing to create relationships between nodes, and search-to-focus navigation — completing the "work canvas" editor experience.

**Architecture:** HTML5 Drag and Drop API for palette→canvas. React Flow's `onConnect` with handle-based relationship type inference. `fitView` with node targeting for search-to-focus. Draft person node type with inline form for quick creation. Connection validation prevents cycles and duplicates.

**Tech Stack:** @xyflow/react (React Flow v12), HTML5 DnD API, Next.js 16, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-22-tree-viz-iteration2-design.md`

---

## File Structure

```
apps/web/
  components/tree/
    tree-canvas.tsx       — MODIFY: add onConnect, onDrop, onDragOver, focusPersonId, DraftPersonNode type
    tree-toolbar.tsx      — MODIFY: palette toggle callback
    person-palette.tsx    — NEW: left sidebar with draggable person card
    draft-person-node.tsx — NEW: temporary node with inline quick-form
    tree-utils.ts         — MODIFY: add validateConnection()

  app/(auth)/tree/
    page.tsx              — MODIFY: read focus searchParam, pass to TreeCanvas

  components/
    command-palette.tsx   — MODIFY: /tree?focus= when on tree page
```

---

## Task 0: Draft Person Node

**Files:**
- Create: `apps/web/components/tree/draft-person-node.tsx`

A custom React Flow node type that renders an inline form (given name, surname, sex) instead of person data. Used when a person is dropped from the palette.

- [ ] **Step 1: Create draft-person-node.tsx**

Client component. A React Flow custom node with no handles (can't be connected while in draft state).

```typescript
'use client';

import { memo, useRef, useEffect, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DraftNodeData {
  onSave: (personId: string) => void;
  onCancel: () => void;
  [key: string]: unknown;
}

function DraftPersonNodeComponent({ data }: NodeProps) {
  const d = data as DraftNodeData;
  const inputRef = useRef<HTMLInputElement>(null);
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [sex, setSex] = useState('U');
  const [saving, setSaving] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSave() {
    if (!givenName.trim() || !surname.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ givenName, surname, sex, isLiving: true }),
      });
      if (!res.ok) { toast.error('Failed to create person'); return; }
      const person = await res.json();
      d.onSave(person.id);
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="w-[200px] rounded-lg border-2 border-dashed border-primary/40 bg-card p-2.5 shadow-sm space-y-2">
      <Input ref={inputRef} placeholder="Given name" value={givenName} onChange={(e) => setGivenName(e.target.value)} className="h-7 text-xs" />
      <Input placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} className="h-7 text-xs" />
      <select value={sex} onChange={(e) => setSex(e.target.value)} className="w-full h-7 rounded border text-xs px-2">
        <option value="M">Male</option>
        <option value="F">Female</option>
        <option value="U">Unknown</option>
      </select>
      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-xs flex-1" onClick={handleSave} disabled={saving}>
          {saving ? '...' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs flex-1" onClick={() => d.onCancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export const DraftPersonNode = memo(DraftPersonNodeComponent);
```

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/draft-person-node.tsx
git commit -m "feat(tree): DraftPersonNode — inline quick-form for canvas person creation"
```

---

## Task 1: Person Palette (Drag Source)

**Files:**
- Create: `apps/web/components/tree/person-palette.tsx`
- Modify: `apps/web/components/tree/tree-toolbar.tsx`

- [ ] **Step 1: Create person-palette.tsx**

Left sidebar (250px) with a single draggable card. Uses HTML5 Drag and Drop API.

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Users, X } from 'lucide-react';

interface PersonPaletteProps {
  onClose: () => void;
}

export function PersonPalette({ onClose }: PersonPaletteProps) {
  function onDragStart(event: React.DragEvent) {
    event.dataTransfer.setData('application/ancstra', 'new-person');
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="absolute top-0 left-0 z-20 h-full w-[250px] border-r bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Person Palette</h3>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={onDragStart}
      >
        <Users className="size-5 text-primary" />
        <div>
          <div className="text-sm font-medium">New Person</div>
          <div className="text-xs text-muted-foreground">Drag to canvas</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify tree-toolbar.tsx**

Read the current file. Change the "+ New Person" button from a Link to a toggle button:

```typescript
interface TreeToolbarProps {
  onAutoLayout: () => void;
  onSaveLayout: () => void;
  onTogglePalette: () => void;
  paletteOpen: boolean;
}

// Replace the Link button with:
<Button
  size="sm"
  className="shadow-sm"
  variant={paletteOpen ? 'default' : 'secondary'}
  onClick={onTogglePalette}
>
  + New Person
</Button>
```

Remove the `Link` import if no longer used in this file.

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/person-palette.tsx apps/web/components/tree/tree-toolbar.tsx
git commit -m "feat(tree): person palette sidebar with draggable card + toolbar toggle"
```

---

## Task 2: Canvas Drop + Edge Drawing

**Files:**
- Modify: `apps/web/components/tree/tree-canvas.tsx`
- Modify: `apps/web/components/tree/tree-utils.ts`

This is the core task — integrates palette drop, draft nodes, connection handling, and validation.

- [ ] **Step 1: Add validateConnection to tree-utils.ts**

Read `tree-utils.ts`. Add at the end:

```typescript
export function validateConnection(
  treeData: TreeData,
  sourceId: string,
  targetId: string,
  type: 'spouse' | 'parentChild'
): { valid: boolean; error?: string } {
  if (sourceId === targetId) return { valid: false, error: 'Cannot connect a person to themselves' };

  const { families, childLinks } = treeData;

  if (type === 'spouse') {
    // Check if already spouses
    const existing = families.some(
      (f) => (f.partner1Id === sourceId && f.partner2Id === targetId) ||
             (f.partner1Id === targetId && f.partner2Id === sourceId)
    );
    if (existing) return { valid: false, error: 'These persons are already spouses' };
  }

  if (type === 'parentChild') {
    // Check if already parent-child
    for (const cl of childLinks) {
      const fam = families.find((f) => f.id === cl.familyId);
      if (!fam) continue;
      if ((fam.partner1Id === sourceId || fam.partner2Id === sourceId) && cl.personId === targetId) {
        return { valid: false, error: 'This parent-child relationship already exists' };
      }
    }

    // Check for cycles: is targetId an ancestor of sourceId?
    function isAncestor(personId: string, ancestorId: string, visited: Set<string>): boolean {
      if (visited.has(personId)) return false;
      visited.add(personId);
      for (const cl of childLinks) {
        if (cl.personId !== personId) continue;
        const fam = families.find((f) => f.id === cl.familyId);
        if (!fam) continue;
        if (fam.partner1Id === ancestorId || fam.partner2Id === ancestorId) return true;
        if (fam.partner1Id && isAncestor(fam.partner1Id, ancestorId, visited)) return true;
        if (fam.partner2Id && isAncestor(fam.partner2Id, ancestorId, visited)) return true;
      }
      return false;
    }

    if (isAncestor(sourceId, targetId, new Set())) {
      return { valid: false, error: 'Cannot create circular relationship' };
    }
  }

  return { valid: true };
}
```

- [ ] **Step 2: Major update to tree-canvas.tsx**

Read the full current file. Changes needed:

**New imports:**
```typescript
import { ConnectionMode, type Connection } from '@xyflow/react';
import { DraftPersonNode } from './draft-person-node';
import { PersonPalette } from './person-palette';
import { validateConnection } from './tree-utils';
```

**Update nodeTypes (must remain outside component):**
```typescript
const nodeTypes = { person: PersonNode, draftPerson: DraftPersonNode };
```

**Add to TreeCanvasProps:**
```typescript
interface TreeCanvasProps {
  treeData: TreeData;
  focusPersonId?: string;
}
```

**New state in TreeCanvasInner:**
```typescript
const [paletteOpen, setPaletteOpen] = useState(false);
```

**Add onDragOver handler:**
```typescript
const onDragOver = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}, []);
```

**Add onDrop handler:**
```typescript
const { screenToFlowPosition } = useReactFlow();

const onDrop = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  const type = event.dataTransfer.getData('application/ancstra');
  if (type !== 'new-person') return;

  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const draftId = `draft-${Date.now()}`;

  setNodes((nds) => [
    ...nds,
    {
      id: draftId,
      type: 'draftPerson',
      position,
      data: {
        onSave: (personId: string) => {
          // Remove draft, refresh tree to get new person
          setNodes((n) => n.filter((node) => node.id !== draftId));
          router.refresh();
        },
        onCancel: () => {
          setNodes((n) => n.filter((node) => node.id !== draftId));
        },
      },
    },
  ]);
  setPaletteOpen(false);
}, [screenToFlowPosition, setNodes, router]);
```

Note: need to add `const router = useRouter();` at the top of TreeCanvasInner.

**Add onConnect handler:**
```typescript
const onConnect = useCallback(async (connection: Connection) => {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return;

  const isSpouse = sourceHandle === 'right' && targetHandle === 'left';
  const type = isSpouse ? 'spouse' : 'parentChild';

  const validation = validateConnection(treeData, source, target, type);
  if (!validation.valid) {
    toast.error(validation.error ?? 'Invalid connection');
    return;
  }

  try {
    if (isSpouse) {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner1Id: source, partner2Id: target }),
      });
      if (!res.ok) { toast.error('Failed to create relationship'); return; }
    } else {
      // Parent-child: create family with parent, add child
      const famRes = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner1Id: source }),
      });
      if (!famRes.ok) { toast.error('Failed to create family'); return; }
      const family = await famRes.json();
      const childRes = await fetch(`/api/families/${family.id}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: target }),
      });
      if (!childRes.ok) { toast.error('Failed to link child'); return; }
    }
    toast.success(isSpouse ? 'Spouse linked' : 'Parent-child linked');
    router.refresh();
  } catch { toast.error('Network error'); }
}, [treeData, router]);
```

**Add focus effect:**
```typescript
// Focus on person after initial render
useEffect(() => {
  if (focusPersonId) {
    setTimeout(() => {
      fitView({ nodes: [{ id: focusPersonId }], duration: 500, padding: 0.5 });
      const person = treeData.persons.find((p) => p.id === focusPersonId);
      if (person) setSelectedPerson(person);
    }, 100);
  }
}, [focusPersonId, fitView, treeData]);
```

**Update ReactFlow props:**
```typescript
<ReactFlow
  // ... existing props
  nodesConnectable={true}  // was false
  connectionMode={ConnectionMode.Loose}
  onConnect={onConnect}
  onDragOver={onDragOver}
  onDrop={onDrop}
>
```

**Update toolbar rendering:**
```typescript
<TreeToolbar
  onAutoLayout={handleAutoLayout}
  onSaveLayout={handleSaveLayout}
  onTogglePalette={() => setPaletteOpen((o) => !o)}
  paletteOpen={paletteOpen}
/>
```

**Add palette rendering (before the ReactFlow div):**
```typescript
{paletteOpen && <PersonPalette onClose={() => setPaletteOpen(false)} />}
```

**Add imports for toast and router:**
```typescript
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
```

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-canvas.tsx apps/web/components/tree/tree-utils.ts
git commit -m "feat(tree): drag-from-palette + edge drawing with validation"
```

---

## Task 3: Search-to-Focus + Integration

**Files:**
- Modify: `apps/web/app/(auth)/tree/page.tsx`
- Modify: `apps/web/components/command-palette.tsx`

- [ ] **Step 1: Update tree page to read focus param**

Read the current file. Update to accept and pass searchParams:

```typescript
import { createDb } from '@ancstra/db';
import { getTreeData } from '@/lib/queries';
import { TreeCanvas } from '@/components/tree/tree-canvas';

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const db = createDb();
  const treeData = getTreeData(db);

  if (treeData.persons.length === 0) {
    // ... existing empty state unchanged
  }

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <TreeCanvas treeData={treeData} focusPersonId={focus} />
    </div>
  );
}
```

Note: Next.js 16 makes `searchParams` a Promise that must be awaited.

- [ ] **Step 2: Update command palette for tree focus**

Read `apps/web/components/command-palette.tsx`. In the `handleSelect` callback, when selecting a person and the current route is `/tree`, navigate with focus param instead of going to the detail page:

```typescript
import { usePathname } from 'next/navigation';

// Inside CommandPalette:
const pathname = usePathname();

const handleSelect = useCallback((href: string) => {
  setOpen(false);
  setQuery('');
  setResults([]);

  // If selecting a person while on the tree page, focus instead of navigating away
  if (href.startsWith('/person/') && pathname === '/tree') {
    const personId = href.split('/person/')[1];
    router.push(`/tree?focus=${personId}`);
  } else {
    router.push(href);
  }
}, [router, pathname]);
```

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add "apps/web/app/(auth)/tree/page.tsx" apps/web/components/command-palette.tsx
git commit -m "feat(tree): search-to-focus via /tree?focus= + Cmd+K integration"
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

Expected: All 111 tests pass.

- [ ] **Step 3: Manual smoke test**

```bash
cd D:/projects/ancstra/apps/web && pnpm dev
```

**Palette + Drop test:**
1. Go to `/tree`
2. Click "+ New Person" in toolbar → palette slides in from left
3. Drag the "New Person" card onto the canvas
4. Draft node appears with dashed border and inline form
5. Type "Test Person", select Male, click Save
6. Draft node replaced with real PersonNode
7. Click Cancel on a new draft → node disappears

**Edge drawing test:**
8. Drag from bottom handle of parent node to top handle of child node
9. Toast: "Parent-child linked", edge appears
10. Drag from right handle of one person to left handle of another
11. Toast: "Spouse linked", horizontal edge appears
12. Try to connect a person to themselves → error toast
13. Try to create a duplicate relationship → error toast

**Search-to-focus test:**
14. Open Cmd+K while on tree page
15. Search for a person → select → canvas pans to that node, detail panel opens
16. Click a relative name in the detail panel → canvas pans to that node

- [ ] **Step 4: Commit any remaining changes**

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | DraftPersonNode (inline form) | — |
| 1 | Person palette (drag source) + toolbar toggle | 0 |
| 2 | Canvas drop handler + edge drawing + validation | 0, 1 |
| 3 | Search-to-focus + Cmd+K integration | — |
| 4 | Final verification | All |

**Critical path:** 0 → 1 → 2

**Parallelizable:** Task 3 is independent of Tasks 0-2.
