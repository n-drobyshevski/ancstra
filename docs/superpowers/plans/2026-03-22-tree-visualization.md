# Tree Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive family tree canvas using React Flow with dagre auto-layout, custom person nodes, context menus, a slide-out detail panel, and localStorage position persistence.

**Architecture:** Server component fetches all tree data (persons + families + children) from DB. `tree-utils.ts` transforms to React Flow nodes/edges and runs dagre layout. `TreeCanvas` client component renders the interactive canvas with custom node/edge types, floating toolbar, context menus, and detail panel.

**Tech Stack:** @xyflow/react, @dagrejs/dagre, Next.js 16, TypeScript, shadcn/ui, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-22-tree-visualization-design.md`

---

## File Structure

All paths relative to project root (`D:/projects/ancstra/`).

```
apps/web/
  app/(auth)/tree/
    page.tsx                    — Server component: fetch tree data, render TreeCanvas

  components/tree/
    tree-canvas.tsx             — Client: ReactFlow wrapper, manages state, events, layout
    tree-toolbar.tsx            — Floating toolbar (Auto Layout, Save, + New Person, placeholders)
    person-node.tsx             — Custom React Flow node (avatar initials, name, dates, sex border)
    partner-edge.tsx            — Custom horizontal edge between spouses
    parent-child-edge.tsx       — Custom vertical edge (solid/dashed/dotted by validation status)
    tree-context-menu.tsx       — Right-click context menu (node/edge/canvas variants)
    tree-detail-panel.tsx       — Right slide-out person summary panel
    tree-utils.ts               — dagre layout computation, DB→ReactFlow data transforms, position helpers

  lib/
    queries.ts                  — MODIFY: add getTreeData() function
```

---

## Task 0: Install Dependencies + getTreeData Query

**Files:**
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Install React Flow and dagre**

```bash
cd D:/projects/ancstra/apps/web && pnpm add @xyflow/react @dagrejs/dagre
pnpm add -D @types/dagre
```

- [ ] **Step 2: Add tree data types to packages/shared/src/types.ts**

Add after existing types:

```typescript
// Raw family record for tree data (no assembled partners)
export interface FamilyRecord {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  relationshipType: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown';
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
}

// Child link for tree data
export interface ChildLink {
  familyId: string;
  personId: string;
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
}

// Complete tree data for React Flow transformation
export interface TreeData {
  persons: PersonListItem[];
  families: FamilyRecord[];
  childLinks: ChildLink[];
}
```

- [ ] **Step 3: Add getTreeData() to apps/web/lib/queries.ts**

Add this exported function to the existing queries.ts file:

```typescript
import type { TreeData, FamilyRecord, ChildLink } from '@ancstra/shared';

export function getTreeData(db: Database): TreeData {
  // 1. All non-deleted persons with primary names + birth/death dates
  const personRows = db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(persons)
    .innerJoin(
      personNames,
      and(eq(personNames.personId, persons.id), eq(personNames.isPrimary, true))
    )
    .where(isNull(persons.deletedAt))
    .all();

  // Get birth/death dates for all persons
  const personIds = personRows.map((r) => r.id);
  const birthDeathEvents = personIds.length > 0
    ? db
        .select({
          personId: events.personId,
          eventType: events.eventType,
          dateOriginal: events.dateOriginal,
        })
        .from(events)
        .where(
          sql`${events.personId} IN (${sql.join(
            personIds.map((id) => sql`${id}`),
            sql`, `
          )}) AND ${events.eventType} IN ('birth', 'death')`
        )
        .all()
    : [];

  const eventsByPerson = new Map<string, { birthDate?: string | null; deathDate?: string | null }>();
  for (const ev of birthDeathEvents) {
    if (!ev.personId) continue;
    const entry = eventsByPerson.get(ev.personId) ?? {};
    if (ev.eventType === 'birth') entry.birthDate = ev.dateOriginal;
    if (ev.eventType === 'death') entry.deathDate = ev.dateOriginal;
    eventsByPerson.set(ev.personId, entry);
  }

  const personsWithDates: PersonListItem[] = personRows.map((r) => ({
    ...r,
    birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
    deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
  }));

  // 2. All non-deleted families
  const familyRows: FamilyRecord[] = db
    .select({
      id: families.id,
      partner1Id: families.partner1Id,
      partner2Id: families.partner2Id,
      relationshipType: families.relationshipType,
      validationStatus: families.validationStatus,
    })
    .from(families)
    .where(isNull(families.deletedAt))
    .all();

  // 3. All child links
  const childRows: ChildLink[] = db
    .select({
      familyId: children.familyId,
      personId: children.personId,
      validationStatus: children.validationStatus,
    })
    .from(children)
    .all();

  return { persons: personsWithDates, families: familyRows, childLinks: childRows };
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd D:/projects/ancstra && git add packages/shared/src/types.ts apps/web/lib/queries.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(tree): install React Flow + dagre, add getTreeData query helper"
```

---

## Task 1: Tree Utils (Data Transform + Dagre Layout)

**Files:**
- Create: `apps/web/components/tree/tree-utils.ts`

This is pure logic, no UI. Transforms DB data to React Flow nodes/edges and runs dagre layout.

- [ ] **Step 1: Create apps/web/components/tree/tree-utils.ts**

```typescript
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { PersonListItem, FamilyRecord, ChildLink, TreeData } from '@ancstra/shared';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const PARTNER_GAP = 40;

export interface PersonNodeData extends PersonListItem {
  label: string;
}

// Transform DB data → React Flow nodes and edges
export function treeDataToFlow(data: TreeData): { nodes: Node[]; edges: Edge[] } {
  const { persons, families, childLinks } = data;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Nodes: one per person
  const nodes: Node[] = persons.map((p) => ({
    id: p.id,
    type: 'person',
    position: { x: 0, y: 0 }, // will be set by dagre
    data: { ...p, label: `${p.givenName} ${p.surname}` } satisfies PersonNodeData,
  }));

  const edges: Edge[] = [];

  // Partner edges: for each family with two partners
  for (const fam of families) {
    if (fam.partner1Id && fam.partner2Id) {
      edges.push({
        id: `partner-${fam.id}`,
        type: 'partner',
        source: fam.partner1Id,
        target: fam.partner2Id,
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { familyId: fam.id },
      });
    }
  }

  // Parent-child edges: for each child link, connect from parents to child
  for (const cl of childLinks) {
    const family = families.find((f) => f.id === cl.familyId);
    if (!family) continue;

    // Edge from partner1 → child
    if (family.partner1Id && personMap.has(family.partner1Id) && personMap.has(cl.personId)) {
      edges.push({
        id: `pc-${family.partner1Id}-${cl.personId}`,
        type: 'parentChild',
        source: family.partner1Id,
        target: cl.personId,
        data: { validationStatus: cl.validationStatus, familyId: cl.familyId },
      });
    }
    // Edge from partner2 → child (only if partner1 didn't exist, to avoid double edges)
    if (family.partner2Id && !family.partner1Id && personMap.has(family.partner2Id) && personMap.has(cl.personId)) {
      edges.push({
        id: `pc-${family.partner2Id}-${cl.personId}`,
        type: 'parentChild',
        source: family.partner2Id,
        target: cl.personId,
        data: { validationStatus: cl.validationStatus, familyId: cl.familyId },
      });
    }
  }

  return { nodes, edges };
}

// Run dagre auto-layout on nodes and edges
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[]
): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: 120,
    nodesep: 80,
    marginx: 40,
    marginy: 40,
  });

  // Only use parent-child edges for dagre (not partner edges — partners are same rank)
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    if (edge.type === 'parentChild') {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  // Apply dagre positions
  const positioned = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  // Post-layout: adjust partners to be side-by-side
  const partnerEdges = edges.filter((e) => e.type === 'partner');
  for (const pe of partnerEdges) {
    const sourceNode = positioned.find((n) => n.id === pe.source);
    const targetNode = positioned.find((n) => n.id === pe.target);
    if (sourceNode && targetNode) {
      // Place at same Y, separated horizontally
      const midX = (sourceNode.position.x + targetNode.position.x) / 2;
      const midY = (sourceNode.position.y + targetNode.position.y) / 2;
      sourceNode.position = { x: midX - (NODE_WIDTH + PARTNER_GAP) / 2, y: midY };
      targetNode.position = { x: midX + (NODE_WIDTH + PARTNER_GAP) / 2, y: midY };
    }
  }

  return positioned;
}

// localStorage position persistence
const LAYOUT_KEY = 'ancstra-tree-layout';

export function savePositions(nodes: Node[]): void {
  if (typeof window === 'undefined') return;
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = { x: n.position.x, y: n.position.y };
  }
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(positions));
}

export function loadPositions(): Record<string, { x: number; y: number }> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearPositions(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAYOUT_KEY);
}

export function applyStoredPositions(
  nodes: Node[],
  positions: Record<string, { x: number; y: number }>
): Node[] {
  return nodes.map((node) => {
    const stored = positions[node.id];
    if (stored) {
      return { ...node, position: stored };
    }
    return node;
  });
}

export { NODE_WIDTH, NODE_HEIGHT };
```

- [ ] **Step 2: Verify types compile**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/tree/tree-utils.ts
git commit -m "feat(tree): data transforms + dagre layout + position persistence utils"
```

---

## Task 2: PersonNode + Custom Edges

**Files:**
- Create: `apps/web/components/tree/person-node.tsx`
- Create: `apps/web/components/tree/partner-edge.tsx`
- Create: `apps/web/components/tree/parent-child-edge.tsx`

- [ ] **Step 1: Create person-node.tsx**

Custom React Flow node component. Uses Handle for connections.

```typescript
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './tree-utils';

type PersonNodeType = Node<PersonNodeData, 'person'>;

const sexColors = {
  M: { border: '#4f6bed', bg: '#e8ecf4', text: '#4f6bed' },
  F: { border: '#ec4899', bg: '#fce7f3', text: '#ec4899' },
  U: { border: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
} as const;

function PersonNodeComponent({ data, selected }: NodeProps<PersonNodeType>) {
  const d = data;
  const colors = sexColors[d.sex] ?? sexColors.U;
  const initials = `${d.givenName[0] ?? ''}${d.surname[0] ?? ''}`.toUpperCase();

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[200px] rounded-lg bg-card shadow-sm border transition-shadow ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: colors.border }}
      >
        <div className="flex items-center gap-2.5 p-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {d.givenName} {d.surname}
            </div>
            {d.birthDate && (
              <div className="text-[11px] text-muted-foreground">b. {d.birthDate}</div>
            )}
            {d.deathDate && (
              <div className="text-[11px] text-muted-foreground">d. {d.deathDate}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const PersonNode = memo(PersonNodeComponent);
```

- [ ] **Step 2: Create partner-edge.tsx**

```typescript
import { type Edge, type EdgeProps, getStraightPath, BaseEdge } from '@xyflow/react';

type PartnerEdgeType = Edge<{ familyId: string }, 'partner'>;

export function PartnerEdge({
  id, sourceX, sourceY, targetX, targetY,
}: EdgeProps<PartnerEdgeType>) {
  const [edgePath] = getStraightPath({
    sourceX, sourceY, targetX, targetY,
  });

  return <BaseEdge id={id} path={edgePath} style={{ stroke: '#9ca3af', strokeWidth: 2 }} />;
}
```

- [ ] **Step 3: Create parent-child-edge.tsx**

```typescript
import { type Edge, type EdgeProps, getSmoothStepPath, BaseEdge } from '@xyflow/react';

type ParentChildEdgeType = Edge<{ validationStatus: string; familyId: string }, 'parentChild'>;

const statusStyles = {
  confirmed: { strokeDasharray: 'none', stroke: '#6b7280' },
  proposed: { strokeDasharray: '5,5', stroke: '#3b82f6' },
  disputed: { strokeDasharray: '2,4', stroke: '#f59e0b' },
} as const;

export function ParentChildEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps<ParentChildEdgeType>) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    borderRadius: 8,
  });

  const status = data?.validationStatus ?? 'confirmed';
  const s = statusStyles[status as keyof typeof statusStyles] ?? statusStyles.confirmed;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: s.stroke, strokeWidth: 2, strokeDasharray: s.strokeDasharray }}
    />
  );
}
```

- [ ] **Step 4: Verify types compile, commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/person-node.tsx apps/web/components/tree/partner-edge.tsx apps/web/components/tree/parent-child-edge.tsx
git commit -m "feat(tree): PersonNode + PartnerEdge + ParentChildEdge custom components"
```

---

## Task 3: TreeCanvas (React Flow Wrapper)

**Files:**
- Create: `apps/web/components/tree/tree-canvas.tsx`

The main client component that wraps ReactFlow with all configuration.

- [ ] **Step 1: Create tree-canvas.tsx**

```typescript
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonNode } from './person-node';
import { PartnerEdge } from './partner-edge';
import { ParentChildEdge } from './parent-child-edge';
import { TreeToolbar } from './tree-toolbar';
import { TreeContextMenu } from './tree-context-menu';
import { TreeDetailPanel } from './tree-detail-panel';
import {
  treeDataToFlow,
  applyDagreLayout,
  savePositions,
  loadPositions,
  clearPositions,
  applyStoredPositions,
} from './tree-utils';

const nodeTypes = { person: PersonNode };
const edgeTypes = { partner: PartnerEdge, parentChild: ParentChildEdge };

interface TreeCanvasProps {
  treeData: TreeData;
}

function TreeCanvasInner({ treeData }: TreeCanvasProps) {
  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => treeDataToFlow(treeData),
    [treeData]
  );

  // Apply stored positions or dagre layout
  const initialNodes = useMemo(() => {
    const stored = loadPositions();
    if (stored) {
      return applyStoredPositions(rawNodes, stored);
    }
    return applyDagreLayout(rawNodes, rawEdges);
  }, [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Selected node for detail panel
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge' | 'canvas';
    nodeId?: string;
    edgeId?: string;
  } | null>(null);

  // Debounced position save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Save positions on drag end
      if (changes.some((c) => c.type === 'position' && !c.dragging)) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          // Read current nodes from state via callback
          setNodes((currentNodes) => {
            savePositions(currentNodes);
            return currentNodes;
          });
        }, 500);
      }
    },
    [onNodesChange, setNodes]
  );

  const { fitView } = useReactFlow();

  // Node click → open detail panel
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const person = treeData.persons.find((p) => p.id === node.id);
    if (person) setSelectedPerson(person);
    setContextMenu(null);
  }, [treeData]);

  // Right-click handlers
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'edge', edgeId: edge.id });
    },
    []
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'canvas' });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Auto layout
  const handleAutoLayout = useCallback(() => {
    clearPositions();
    const laid = applyDagreLayout(rawNodes, rawEdges);
    setNodes(laid);
    savePositions(laid);
  }, [rawNodes, rawEdges, setNodes]);

  // Save layout (explicit)
  const handleSaveLayout = useCallback(() => {
    setNodes((currentNodes) => {
      savePositions(currentNodes);
      return currentNodes;
    });
  }, [setNodes]);

  // Close panel
  const handleClosePanel = useCallback(() => setSelectedPerson(null), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPerson(null);
        setContextMenu(null);
      }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        // Search placeholder — will be implemented with FTS5
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus a node (from detail panel clicking a relative)
  const handleFocusNode = useCallback((personId: string) => {
    const person = treeData.persons.find((p) => p.id === personId);
    if (person) setSelectedPerson(person);
  }, [treeData]);

  return (
    <div className="relative flex h-full">
      <div className={`flex-1 transition-all ${selectedPerson ? 'mr-[400px]' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap
            position="bottom-left"
            zoomable
            pannable
            className="!bg-card !border !shadow-sm !rounded-lg"
          />
          <Controls
            position="bottom-right"
            className="!bg-card !border !shadow-sm !rounded-lg"
          />
        </ReactFlow>

        {/* Floating toolbar */}
        <TreeToolbar
          onAutoLayout={handleAutoLayout}
          onSaveLayout={handleSaveLayout}
        />

        {/* Context menu */}
        {contextMenu && (
          <TreeContextMenu
            {...contextMenu}
            persons={treeData.persons}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      {/* Detail panel */}
      {selectedPerson && (
        <TreeDetailPanel
          person={selectedPerson}
          treeData={treeData}
          onClose={handleClosePanel}
          onFocusNode={handleFocusNode}
        />
      )}
    </div>
  );
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Verify types compile**

This will fail until we create the remaining components (TreeToolbar, TreeContextMenu, TreeDetailPanel). That's fine — we create placeholder stubs.

Create minimal stubs:

`apps/web/components/tree/tree-toolbar.tsx`:
```typescript
'use client';
export function TreeToolbar({ onAutoLayout, onSaveLayout }: { onAutoLayout: () => void; onSaveLayout: () => void }) {
  return <div className="absolute top-3 left-3 right-3 z-10 flex justify-between" />;
}
```

`apps/web/components/tree/tree-context-menu.tsx`:
```typescript
'use client';
import type { PersonListItem } from '@ancstra/shared';
export function TreeContextMenu(props: { x: number; y: number; type: string; nodeId?: string; edgeId?: string; persons: PersonListItem[]; onClose: () => void }) {
  return null;
}
```

`apps/web/components/tree/tree-detail-panel.tsx`:
```typescript
'use client';
import type { PersonListItem, TreeData } from '@ancstra/shared';
export function TreeDetailPanel(props: { person: PersonListItem; treeData: TreeData; onClose: () => void; onFocusNode: (id: string) => void }) {
  return null;
}
```

- [ ] **Step 3: Verify types compile, commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/
git commit -m "feat(tree): TreeCanvas React Flow wrapper + component stubs"
```

---

## Task 4: Tree Page (Server Component)

**Files:**
- Create: `apps/web/app/(auth)/tree/page.tsx`

- [ ] **Step 1: Create the tree page**

```typescript
import { createDb } from '@ancstra/db';
import { getTreeData } from '@/lib/queries';
import { TreeCanvas } from '@/components/tree/tree-canvas';

export default function TreePage() {
  const db = createDb();
  const treeData = getTreeData(db);

  if (treeData.persons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-medium">No persons in your tree yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first person to start building your family tree.
          </p>
          <a href="/person/new" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Add First Person
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <TreeCanvas treeData={treeData} />
    </div>
  );
}
```

The height calc subtracts the 56px (3.5rem) app header.

- [ ] **Step 2: Verify page loads**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add "apps/web/app/(auth)/tree/page.tsx"
git commit -m "feat(tree): tree page server component with empty state"
```

---

## Task 5: Floating Toolbar

**Files:**
- Rewrite: `apps/web/components/tree/tree-toolbar.tsx`

- [ ] **Step 1: Implement the toolbar**

Replace the stub with the full implementation:

```typescript
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TreeToolbarProps {
  onAutoLayout: () => void;
  onSaveLayout: () => void;
}

export function TreeToolbar({ onAutoLayout, onSaveLayout }: TreeToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" onClick={onAutoLayout}>
          Auto Layout
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" onClick={onSaveLayout}>
          Save Layout
        </Button>
        <Button size="sm" className="shadow-sm" asChild>
          <Link href="/person/new">+ New Person</Link>
        </Button>
      </div>
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Search
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Filter
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Export
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile, commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-toolbar.tsx
git commit -m "feat(tree): floating toolbar with layout + action buttons"
```

---

## Task 6: Context Menu

**Files:**
- Rewrite: `apps/web/components/tree/tree-context-menu.tsx`

- [ ] **Step 1: Implement the context menu**

Replace the stub. Uses a fixed-position div rendered at click coordinates.

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonListItem } from '@ancstra/shared';
import { toast } from 'sonner';

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'canvas';
  nodeId?: string;
  edgeId?: string;
  persons: PersonListItem[];
  onClose: () => void;
}

export function TreeContextMenu({ x, y, type, nodeId, edgeId, persons, onClose }: ContextMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const person = nodeId ? persons.find((p) => p.id === nodeId) : null;

  const menuItems: { label: string; onClick: () => void; destructive?: boolean; separator?: boolean }[] = [];

  if (type === 'node' && person) {
    menuItems.push(
      { label: `${person.givenName} ${person.surname}`, onClick: () => {}, separator: true },
      { label: 'View Details', onClick: () => { onClose(); /* detail panel handles via node click */ } },
      { label: 'Edit Person', onClick: () => { router.push(`/person/${nodeId}/edit`); onClose(); } },
      { label: '', onClick: () => {}, separator: true },
      { label: '+ Add Spouse', onClick: () => { router.push(`/person/new?relation=spouse&of=${nodeId}`); onClose(); } },
      { label: '+ Add Father', onClick: () => { router.push(`/person/new?relation=father&of=${nodeId}`); onClose(); } },
      { label: '+ Add Mother', onClick: () => { router.push(`/person/new?relation=mother&of=${nodeId}`); onClose(); } },
      { label: '+ Add Child', onClick: () => { router.push(`/person/new?relation=child&of=${nodeId}`); onClose(); } },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Delete Person',
        destructive: true,
        onClick: async () => {
          if (!confirm(`Delete ${person.givenName} ${person.surname}?`)) return;
          const res = await fetch(`/api/persons/${nodeId}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Person deleted');
            router.refresh();
          } else {
            toast.error('Failed to delete');
          }
          onClose();
        },
      },
    );
  } else if (type === 'edge') {
    menuItems.push(
      {
        label: 'Delete Relationship',
        destructive: true,
        onClick: async () => {
          if (!confirm('Delete this relationship?')) return;
          // Edge deletion requires knowing the family/child link — for now just refresh
          toast.success('Relationship removal — coming soon');
          onClose();
        },
      },
    );
  } else if (type === 'canvas') {
    menuItems.push(
      { label: 'Add Person', onClick: () => { router.push('/person/new'); onClose(); } },
      { label: 'Fit View', onClick: () => { onClose(); /* fitView called from parent */ } },
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, i) => {
        if (item.separator && !item.label) {
          return <div key={i} className="my-1 h-px bg-border" />;
        }
        if (item.separator && item.label) {
          return (
            <div key={i} className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </div>
          );
        }
        return (
          <button
            key={i}
            onClick={item.onClick}
            className={`w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent ${
              item.destructive ? 'text-destructive hover:bg-destructive/10' : ''
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile, commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-context-menu.tsx
git commit -m "feat(tree): right-click context menu for nodes and canvas"
```

---

## Task 7: Detail Panel (Slide-Out Right)

**Files:**
- Rewrite: `apps/web/components/tree/tree-detail-panel.tsx`

- [ ] **Step 1: Implement the detail panel**

Replace the stub. Read-only person summary with clickable relationships.

```typescript
'use client';

import Link from 'next/link';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

interface TreeDetailPanelProps {
  person: PersonListItem;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
}

export function TreeDetailPanel({ person, treeData, onClose, onFocusNode }: TreeDetailPanelProps) {
  const { families, childLinks, persons } = treeData;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Find spouses
  const spouses: PersonListItem[] = [];
  for (const fam of families) {
    if (fam.partner1Id === person.id && fam.partner2Id) {
      const s = personMap.get(fam.partner2Id);
      if (s) spouses.push(s);
    } else if (fam.partner2Id === person.id && fam.partner1Id) {
      const s = personMap.get(fam.partner1Id);
      if (s) spouses.push(s);
    }
  }

  // Find parents
  const parents: PersonListItem[] = [];
  const childFamIds = childLinks.filter((cl) => cl.personId === person.id).map((cl) => cl.familyId);
  for (const famId of childFamIds) {
    const fam = families.find((f) => f.id === famId);
    if (!fam) continue;
    if (fam.partner1Id) { const p = personMap.get(fam.partner1Id); if (p) parents.push(p); }
    if (fam.partner2Id) { const p = personMap.get(fam.partner2Id); if (p) parents.push(p); }
  }

  // Find children
  const childrenList: PersonListItem[] = [];
  const partnerFamIds = families
    .filter((f) => f.partner1Id === person.id || f.partner2Id === person.id)
    .map((f) => f.id);
  for (const famId of partnerFamIds) {
    const kids = childLinks.filter((cl) => cl.familyId === famId);
    for (const k of kids) {
      const c = personMap.get(k.personId);
      if (c && !childrenList.some((e) => e.id === c.id)) childrenList.push(c);
    }
  }

  function RelativeButton({ p }: { p: PersonListItem }) {
    return (
      <button
        onClick={() => onFocusNode(p.id)}
        className="text-sm text-primary underline-offset-4 hover:underline text-left"
      >
        {p.givenName} {p.surname}
        {p.birthDate ? ` (b. ${p.birthDate})` : ''}
      </button>
    );
  }

  return (
    <div className="absolute top-0 right-0 z-20 h-full w-[400px] border-l bg-card overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-base font-semibold">{person.givenName} {person.surname}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">{sexLabel[person.sex]}</Badge>
            {person.isLiving && <Badge className="text-xs">Living</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Vital Info */}
      <div className="border-b p-4 space-y-1 text-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Vital Info</h3>
        {person.birthDate && <div>Birth: {person.birthDate}</div>}
        {person.deathDate && <div>Death: {person.deathDate}</div>}
        {!person.birthDate && !person.deathDate && (
          <div className="text-muted-foreground">No dates recorded</div>
        )}
      </div>

      {/* Family */}
      <div className="border-b p-4 space-y-3 text-sm">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Family</h3>
        {spouses.length > 0 && (
          <div>
            <div className="text-muted-foreground text-xs mb-1">Spouses</div>
            {spouses.map((s) => <div key={s.id}><RelativeButton p={s} /></div>)}
          </div>
        )}
        {parents.length > 0 && (
          <div>
            <div className="text-muted-foreground text-xs mb-1">Parents</div>
            {parents.map((p) => <div key={p.id}><RelativeButton p={p} /></div>)}
          </div>
        )}
        {childrenList.length > 0 && (
          <div>
            <div className="text-muted-foreground text-xs mb-1">Children</div>
            {childrenList.map((c) => <div key={c.id}><RelativeButton p={c} /></div>)}
          </div>
        )}
        {spouses.length === 0 && parents.length === 0 && childrenList.length === 0 && (
          <div className="text-muted-foreground">No relationships recorded</div>
        )}
      </div>

      {/* Note: Events section deferred — PersonListItem doesn't carry events.
          Users click "View Detail Page" to see full events list. */}

      {/* Actions */}
      <div className="p-4 space-y-2">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/person/${person.id}/edit`}>Edit Full Page</Link>
        </Button>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/person/${person.id}`}>View Detail Page</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile, commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/tree/tree-detail-panel.tsx
git commit -m "feat(tree): slide-out detail panel with relationships and actions"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Type check everything**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests (ensure nothing broken)**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
```

Expected: All 38 existing tests pass.

- [ ] **Step 3: Manual smoke test**

```bash
cd D:/projects/ancstra/apps/web && pnpm dev
```

Test flow:
1. Log in → Dashboard (should show recent persons)
2. Click "Tree" in sidebar → `/tree`
3. See family tree rendered with dagre layout
4. Persons shown as standard nodes (avatar, name, dates, sex border)
5. Partner edges horizontal, parent-child edges vertical
6. Drag a node → it moves and stays on refresh (localStorage)
7. Click "Auto Layout" → recomputes positions
8. Click a node → detail panel slides from right with person info
9. Click a relative name in panel → focuses that node
10. Right-click a node → context menu with View/Edit/Add/Delete options
11. Right-click empty canvas → "Add Person" option
12. Press Escape → closes panel and context menu
13. Press Delete on selected node → confirmation → deletes

- [ ] **Step 4: Commit any remaining changes**

```bash
cd D:/projects/ancstra && git status
# If changes exist, commit with appropriate message
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | Install deps + getTreeData query | — |
| 1 | tree-utils (data transform + dagre + positions) | 0 |
| 2 | PersonNode + PartnerEdge + ParentChildEdge | 0 |
| 3 | TreeCanvas (React Flow wrapper + stubs) | 1, 2 |
| 4 | Tree page (server component) | 3 |
| 5 | Floating toolbar | 3 |
| 6 | Context menu | 3 |
| 7 | Detail panel (slide-out) | 3 |
| 8 | Final verification | All |

**Critical path:** 0 → 1 → 3 → 4

**Parallelizable:** Tasks 1 and 2 after Task 0. Tasks 5, 6, 7 after Task 3.
