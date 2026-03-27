# Tree Gap Indicators + Factsheet Canvas Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toggle-able data quality indicators on tree nodes and replace the research canvas with a unified factsheet graph (cluster view + evidence drill-down).

**Architecture:** Two independent features sharing React Flow infrastructure. Feature 1 adds a toolbar toggle + conditional rendering in `PersonNode`. Feature 2 replaces `CanvasTab`/`CanvasInner` with new `FactsheetGraphTab` containing two views: `ClusterView` (factsheet relationship graph) and `EvidenceView` (single factsheet's facts + sources). Both use existing dagre layout, React Flow node/edge patterns, and the factsheet client API layer.

**Tech Stack:** Next.js 16 + React 19 + @xyflow/react 12.10.1 + @dagrejs/dagre 2.0.4 + shadcn/ui + Tailwind v4 + lucide-react

**IMPORTANT:** Read `node_modules/next/dist/docs/` before writing any Next.js code — this version has breaking changes from training data (see `apps/web/AGENTS.md`).

---

## Phase A: Tree Gap Indicators

### Task 1: Quality Data API Hook

**Files:**
- Create: `apps/web/lib/tree/use-quality-data.ts`
- Reference: `packages/db/src/quality-queries.ts` (existing `getPriorities` returns `PriorityPerson[]` with `score` + `missingFields`)

- [ ] **Step 1: Create the hook file**

```typescript
// apps/web/lib/tree/use-quality-data.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface QualityEntry {
  id: string;
  score: number;
  missingFields: string[];
}

export function useQualityData(enabled: boolean) {
  const [data, setData] = useState<Map<string, QualityEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!enabled) {
      setData(new Map());
      return;
    }
    setIsLoading(true);
    try {
      // Fetch all priorities (large page to get everyone)
      const res = await fetch('/api/quality/priorities?page=1&pageSize=10000');
      if (!res.ok) throw new Error('Failed to fetch quality data');
      const json = await res.json();
      const map = new Map<string, QualityEntry>();
      for (const p of json.persons) {
        map.set(p.id, { id: p.id, score: p.score, missingFields: p.missingFields });
      }
      setData(map);
    } catch {
      setData(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { qualityData: data, isLoading };
}
```

- [ ] **Step 2: Verify the hook compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `use-quality-data.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/tree/use-quality-data.ts
git commit -m "feat(tree): add useQualityData hook for gap indicators"
```

---

### Task 2: Extend PersonNode with Gap Indicators

**Files:**
- Modify: `apps/web/components/tree/person-node.tsx`
- Reference: `apps/web/app/globals.css` (has `--completion-low`, `--completion-medium`, `--completion-high` CSS vars)

- [ ] **Step 1: Add gap indicator props to PersonNodeData**

In `apps/web/components/tree/tree-utils.ts`, extend `PersonNodeData`:

```typescript
// Add to PersonNodeData interface (after line 17)
export interface PersonNodeData extends PersonListItem {
  label: string;
  qualityScore?: number;
  missingFields?: string[];
  showGaps?: boolean;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Update PersonNode component to render indicators**

Replace the entire `apps/web/components/tree/person-node.tsx`:

```tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './tree-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PersonNodeType = Node<PersonNodeData, 'person'>;

const sexColors = {
  M: { border: '#4f6bed', bg: '#e8ecf4', text: '#4f6bed' },
  F: { border: '#ec4899', bg: '#fce7f3', text: '#ec4899' },
  U: { border: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
} as const;

const GAP_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'birthDate', label: 'Birth Date' },
  { key: 'birthPlace', label: 'Birth Place' },
  { key: 'deathDate', label: 'Death Date' },
  { key: 'source', label: 'Source' },
] as const;

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--completion-high)';
  if (score >= 40) return 'var(--completion-medium)';
  return 'var(--completion-low)';
}

function PersonNodeComponent({ data, selected }: NodeProps<PersonNodeType>) {
  const dimmed = !!(data as any).dimmed;
  const colors = sexColors[data.sex] ?? sexColors.U;
  const initials = `${data.givenName[0] ?? ''}${data.surname[0] ?? ''}`.toUpperCase();
  const showGaps = !!data.showGaps;
  const missingSet = new Set(data.missingFields ?? []);
  const score = data.qualityScore ?? 0;
  const isLiving = data.isLiving;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[200px] rounded-lg bg-card shadow-sm border transition-all ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        } ${dimmed ? 'opacity-30 pointer-events-none' : ''} ${showGaps ? 'overflow-hidden' : ''}`}
        style={{ borderLeftWidth: 4, borderLeftColor: colors.border }}
      >
        <div className="flex items-center gap-2.5 p-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {data.givenName} {data.surname}
            </div>
            {data.birthDate && (
              <div className="text-[11px] text-muted-foreground">b. {data.birthDate}</div>
            )}
            {data.deathDate && (
              <div className="text-[11px] text-muted-foreground">d. {data.deathDate}</div>
            )}
            {!data.birthDate && !data.deathDate && (
              <div className="text-[11px] text-amber-500/80">no dates</div>
            )}
            {showGaps && (
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-[3px] mt-0.5">
                  {GAP_FIELDS.map(({ key, label }) => {
                    const isNotApplicable = key === 'deathDate' && isLiving;
                    const isMissing = missingSet.has(key);
                    const dotColor = isNotApplicable
                      ? 'var(--border)'
                      : isMissing
                        ? 'var(--completion-low)'
                        : 'var(--completion-high)';
                    const tooltipText = isNotApplicable
                      ? `${label}: N/A (living)`
                      : isMissing
                        ? `${label}: missing`
                        : `${label}: ✓`;
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
        {showGaps && (
          <div className="h-[3px]" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${score}%`,
                backgroundColor: scoreColor(score),
                borderRadius: '0 2px 0 0',
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export const PersonNode = memo(PersonNodeComponent);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/tree/person-node.tsx apps/web/components/tree/tree-utils.ts
git commit -m "feat(tree): render gap dots + progress bar on PersonNode"
```

---

### Task 3: Toolbar Toggle + Wire Quality Data

**Files:**
- Modify: `apps/web/components/tree/tree-toolbar.tsx`
- Modify: `apps/web/components/tree/tree-canvas.tsx`

- [ ] **Step 1: Add Data Quality toggle to TreeToolbar**

In `apps/web/components/tree/tree-toolbar.tsx`, add the toggle button. Import `BarChart3` from lucide-react.

Add to `TreeToolbarProps`:
```typescript
showGaps: boolean;
onToggleGaps: () => void;
```

Add the button after the Living/Deceased filter buttons, before the view toggle:

```tsx
<Separator orientation="vertical" className="h-5 mx-0.5" />

<Button
  variant={showGaps ? 'default' : 'secondary'}
  size="sm"
  className="shadow-sm h-7 text-xs gap-1"
  onClick={onToggleGaps}
>
  <BarChart3 className="size-3.5" />
  Data Quality
</Button>
```

- [ ] **Step 2: Wire quality data in TreeCanvas**

In `apps/web/components/tree/tree-canvas.tsx`:

1. Import `useQualityData` from `@/lib/tree/use-quality-data`
2. Add state: `const [showGaps, setShowGaps] = useState(false);`
3. Call the hook: `const { qualityData } = useQualityData(showGaps);`
4. When building nodes, merge quality data into node data. Add an effect after the filter effect:

```typescript
// Merge quality data into nodes when showGaps changes
useEffect(() => {
  setNodes(nds => nds.map(node => {
    if (node.type !== 'person') return node;
    const q = qualityData.get(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        showGaps,
        qualityScore: q?.score ?? 0,
        missingFields: q?.missingFields ?? [],
      },
    };
  }));
}, [showGaps, qualityData, setNodes]);
```

5. Update `NODE_HEIGHT` dynamically in tree-utils or pass to dagre when gaps are shown. In `tree-canvas.tsx`, when calling `applyDagreLayout`, use the gap-aware height:

```typescript
const handleAutoLayout = useCallback(() => {
  const laid = applyDagreLayout(rawNodes, rawEdges, showGaps ? 82 : undefined);
  setNodes(laid);
  setActiveLayoutId(null);
  setActiveLayoutName(null);
}, [rawNodes, rawEdges, setNodes, showGaps]);
```

6. Update `applyDagreLayout` in `tree-utils.ts` to accept optional `nodeHeight`:

```typescript
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  nodeHeight = NODE_HEIGHT,
): Node[] {
  // ... existing code, replace NODE_HEIGHT with nodeHeight in g.setNode
```

7. Pass toolbar props:

```tsx
<TreeToolbar
  // ... existing props
  showGaps={showGaps}
  onToggleGaps={() => setShowGaps(v => !v)}
/>
```

- [ ] **Step 3: Verify it compiles and test manually**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Then: Open tree view, click "Data Quality" toggle, verify bars and dots appear.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/tree/tree-toolbar.tsx apps/web/components/tree/tree-canvas.tsx apps/web/components/tree/tree-utils.ts
git commit -m "feat(tree): wire Data Quality toolbar toggle with quality data overlay"
```

---

## Phase B: Factsheet Canvas Graph

### Task 4: Factsheet Graph Utilities

**Files:**
- Create: `apps/web/components/research/canvas/factsheet-graph-utils.ts`

- [ ] **Step 1: Create utility file for converting factsheet data to React Flow nodes/edges**

```typescript
// apps/web/components/research/canvas/factsheet-graph-utils.ts
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type {
  Factsheet,
  FactsheetFact,
  FactsheetLink,
  FactsheetDetail,
} from '@/lib/research/factsheet-client';

// ---- Cluster View types ----

export interface FactsheetNodeData extends Record<string, unknown> {
  factsheet: Factsheet;
  factCount: number;
  linkCount: number;
  missingFields: string[];
}

export interface ClusterBoundary {
  factsheetIds: string[];
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
}

// ---- Evidence View types ----

export interface FactNodeData extends Record<string, unknown> {
  fact: FactsheetFact;
  hasConflict: boolean;
}

export interface SourceResearchNodeData extends Record<string, unknown> {
  researchItemId: string;
  title: string;
  provider: string | null;
}

export interface CenterFactsheetNodeData extends Record<string, unknown> {
  factsheet: Factsheet;
  factCount: number;
}

// ---- Constants ----

const FACTSHEET_NODE_WIDTH = 160;
const FACTSHEET_NODE_HEIGHT = 80;
const FACT_NODE_WIDTH = 130;
const FACT_NODE_HEIGHT = 70;
const SOURCE_NODE_WIDTH = 110;
const SOURCE_NODE_HEIGHT = 50;
const CENTER_NODE_WIDTH = 160;
const CENTER_NODE_HEIGHT = 60;

// ---- Edge style configs ----

export const LINK_EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  parent_child: { stroke: '#4f6bed', strokeWidth: 2 },
  spouse: { stroke: '#9ca3af', strokeDasharray: '4,3', strokeWidth: 1.5 },
  sibling: { stroke: '#d4d4d8', strokeDasharray: '2,2', strokeWidth: 1 },
};

export const LINK_LABELS: Record<string, string> = {
  parent_child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
};

// ---- Cluster View builders ----

export function buildClusterNodes(
  factsheets: Factsheet[],
  allLinks: FactsheetLink[],
  factCounts: Map<string, number>,
): Node<FactsheetNodeData>[] {
  return factsheets.map((fs) => {
    const linkCount = allLinks.filter(
      (l) => l.fromFactsheetId === fs.id || l.toFactsheetId === fs.id,
    ).length;

    return {
      id: fs.id,
      type: 'factsheetNode',
      position: { x: 0, y: 0 },
      data: {
        factsheet: fs,
        factCount: factCounts.get(fs.id) ?? 0,
        linkCount,
        missingFields: [], // computed later if needed
      },
    };
  });
}

export function buildClusterEdges(links: FactsheetLink[]): Edge[] {
  return links.map((link) => {
    const style = LINK_EDGE_STYLES[link.relationshipType] ?? LINK_EDGE_STYLES.parent_child;
    return {
      id: `link-${link.id}`,
      source: link.fromFactsheetId,
      target: link.toFactsheetId,
      type: 'factsheetLink',
      data: { relationshipType: link.relationshipType, linkId: link.id },
      style,
      label: LINK_LABELS[link.relationshipType] ?? '',
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
    };
  });
}

export function layoutClusterNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: FACTSHEET_NODE_WIDTH, height: FACTSHEET_NODE_HEIGHT });
  }

  for (const edge of edges) {
    // Only use parent_child edges for hierarchical layout
    if ((edge.data as any)?.relationshipType === 'parent_child') {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - FACTSHEET_NODE_WIDTH / 2, y: pos.y - FACTSHEET_NODE_HEIGHT / 2 },
    };
  });
}

/**
 * Detect clusters via BFS on links. Returns array of connected component ID sets.
 */
export function detectClusters(
  factsheetIds: string[],
  links: FactsheetLink[],
): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of factsheetIds) adj.set(id, new Set());
  for (const link of links) {
    adj.get(link.fromFactsheetId)?.add(link.toFactsheetId);
    adj.get(link.toFactsheetId)?.add(link.fromFactsheetId);
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const id of factsheetIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.push(cur);
      for (const neighbor of adj.get(cur) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (component.length > 1) clusters.push(component);
  }

  return clusters;
}

/**
 * Compute bounding rectangles for clusters (after layout).
 */
export function computeClusterBounds(
  clusters: string[][],
  nodes: Node[],
): ClusterBoundary[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const PADDING = 24;

  return clusters.map((ids, i) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (!node) continue;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + FACTSHEET_NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + FACTSHEET_NODE_HEIGHT);
    }
    return {
      factsheetIds: ids,
      label: `Family Unit ${i + 1}`,
      bounds: {
        x: minX - PADDING,
        y: minY - PADDING - 16, // extra space for label
        width: maxX - minX + PADDING * 2,
        height: maxY - minY + PADDING * 2 + 16,
      },
    };
  });
}

// ---- Evidence View builders ----

export function buildEvidenceNodes(
  factsheet: FactsheetDetail,
  researchItems: Map<string, { title: string; provider: string | null }>,
  conflictFactIds: Set<string>,
): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Center factsheet node
  nodes.push({
    id: `center-${factsheet.id}`,
    type: 'centerFactsheet',
    position: { x: 0, y: 0 },
    data: {
      factsheet,
      factCount: factsheet.facts.length,
    } satisfies CenterFactsheetNodeData,
  });

  // Fact nodes
  for (const fact of factsheet.facts) {
    const nodeId = `fact-${fact.id}`;
    nodes.push({
      id: nodeId,
      type: 'factNode',
      position: { x: 0, y: 0 },
      data: {
        fact,
        hasConflict: conflictFactIds.has(fact.id),
      } satisfies FactNodeData,
    });

    // Edge: center → fact
    edges.push({
      id: `edge-center-${fact.id}`,
      source: `center-${factsheet.id}`,
      target: nodeId,
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    });

    // Source node if fact has a research item
    if (fact.researchItemId) {
      const sourceNodeId = `source-${fact.researchItemId}`;
      const item = researchItems.get(fact.researchItemId);
      if (item && !nodes.some((n) => n.id === sourceNodeId)) {
        nodes.push({
          id: sourceNodeId,
          type: 'sourceResearchNode',
          position: { x: 0, y: 0 },
          data: {
            researchItemId: fact.researchItemId,
            title: item.title,
            provider: item.provider,
          } satisfies SourceResearchNodeData,
        });
      }

      // Edge: source → fact
      edges.push({
        id: `edge-source-${fact.researchItemId}-${fact.id}`,
        source: sourceNodeId,
        target: nodeId,
        style: { stroke: '#fbbf24', strokeWidth: 1, strokeDasharray: '3,2' },
      });
    }
  }

  return { nodes, edges };
}

export function layoutEvidenceNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 40, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    let w = FACT_NODE_WIDTH;
    let h = FACT_NODE_HEIGHT;
    if (node.type === 'centerFactsheet') { w = CENTER_NODE_WIDTH; h = CENTER_NODE_HEIGHT; }
    if (node.type === 'sourceResearchNode') { w = SOURCE_NODE_WIDTH; h = SOURCE_NODE_HEIGHT; }
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - (pos.width ?? 0) / 2, y: pos.y - (pos.height ?? 0) / 2 },
    };
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/canvas/factsheet-graph-utils.ts
git commit -m "feat(research): factsheet graph utility functions for cluster + evidence views"
```

---

### Task 5: Factsheet Graph Node Components

**Files:**
- Create: `apps/web/components/research/canvas/factsheet-node.tsx`
- Create: `apps/web/components/research/canvas/fact-node.tsx`
- Create: `apps/web/components/research/canvas/center-factsheet-node.tsx`
- Create: `apps/web/components/research/canvas/source-research-node.tsx`
- Create: `apps/web/components/research/canvas/factsheet-link-edge.tsx`

- [ ] **Step 1: Create FactsheetNode (cluster view)**

```tsx
// apps/web/components/research/canvas/factsheet-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { FactsheetNodeData } from './factsheet-graph-utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  promoted: { label: 'Promoted', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  merged: { label: 'Merged', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

type FactsheetNodeType = Node<FactsheetNodeData, 'factsheetNode'>;

function FactsheetNodeComponent({ data, selected }: NodeProps<FactsheetNodeType>) {
  const { factsheet, factCount, linkCount } = data;
  const config = STATUS_CONFIG[factsheet.status] ?? STATUS_CONFIG.draft;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[160px] rounded-lg bg-card border shadow-sm cursor-pointer transition-all hover:shadow-md ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        }`}
      >
        <div className="p-2">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="truncate text-[12px] font-semibold text-foreground">{factsheet.title}</span>
            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${config.className}`}>
              {config.label}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {factCount} facts · {linkCount} links
          </div>
        </div>
      </div>
    </>
  );
}

export const FactsheetNode = memo(FactsheetNodeComponent);
```

- [ ] **Step 2: Create CenterFactsheetNode (evidence view center)**

```tsx
// apps/web/components/research/canvas/center-factsheet-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CenterFactsheetNodeData } from './factsheet-graph-utils';

type CenterNodeType = Node<CenterFactsheetNodeData, 'centerFactsheet'>;

function CenterFactsheetNodeComponent({ data }: NodeProps<CenterNodeType>) {
  return (
    <>
      <Handle type="source" position={Position.Top} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Left} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/40" />
      <div className="w-[160px] rounded-xl bg-primary text-primary-foreground p-3 shadow-lg">
        <div className="text-[13px] font-bold">{data.factsheet.title}</div>
        <div className="text-[10px] opacity-80">Factsheet · {data.factCount} facts</div>
      </div>
    </>
  );
}

export const CenterFactsheetNode = memo(CenterFactsheetNodeComponent);
```

- [ ] **Step 3: Create FactNode (evidence view fact)**

```tsx
// apps/web/components/research/canvas/fact-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { FactNodeData } from './factsheet-graph-utils';

type FactNodeType = Node<FactNodeData, 'factNode'>;

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
  disputed: '#dc2626',
};

const FACT_TYPE_LABELS: Record<string, string> = {
  name: 'Name',
  birth_date: 'Birth Date',
  birth_place: 'Birth Place',
  death_date: 'Death Date',
  death_place: 'Death Place',
  marriage_date: 'Marriage Date',
  marriage_place: 'Marriage Place',
  residence: 'Residence',
  occupation: 'Occupation',
  immigration: 'Immigration',
  military_service: 'Military',
  religion: 'Religion',
  ethnicity: 'Ethnicity',
  parent_name: 'Parent Name',
  spouse_name: 'Spouse Name',
  child_name: 'Child Name',
  other: 'Other',
};

function FactNodeComponent({ data }: NodeProps<FactNodeType>) {
  const { fact, hasConflict } = data;
  const borderColor = CONFIDENCE_COLORS[fact.confidence] ?? CONFIDENCE_COLORS.medium;
  const label = FACT_TYPE_LABELS[fact.factType] ?? fact.factType;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Right} className="!w-1.5 !h-1.5 !bg-muted-foreground/40" />
      <div
        className={`w-[130px] rounded-md bg-card border shadow-sm ${
          hasConflict ? 'ring-2 ring-destructive animate-pulse' : ''
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
      >
        <div className="p-1.5">
          <div className="text-[10px] font-semibold text-foreground">{label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{fact.factValue}</div>
          <div className="flex items-center gap-1 mt-1">
            <span
              className="inline-block size-[5px] rounded-full"
              style={{ backgroundColor: borderColor }}
            />
            <span className="text-[9px] text-muted-foreground">{fact.confidence}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export const FactNode = memo(FactNodeComponent);
```

- [ ] **Step 4: Create SourceResearchNode (evidence view source)**

```tsx
// apps/web/components/research/canvas/source-research-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { SourceResearchNodeData } from './factsheet-graph-utils';

type SourceResearchNodeType = Node<SourceResearchNodeData, 'sourceResearchNode'>;

function SourceResearchNodeComponent({ data }: NodeProps<SourceResearchNodeType>) {
  return (
    <>
      <Handle type="source" position={Position.Left} className="!w-1.5 !h-1.5 !bg-amber-400/60" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-amber-400/60" />
      <div className="w-[110px] rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
        <div className="p-1.5">
          <div className="flex items-center gap-1">
            <FileText className="size-3 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="text-[9px] font-semibold text-amber-800 dark:text-amber-300 truncate">{data.title}</span>
          </div>
          {data.provider && (
            <div className="text-[9px] text-amber-600 dark:text-amber-500 truncate">{data.provider}</div>
          )}
        </div>
      </div>
    </>
  );
}

export const SourceResearchNode = memo(SourceResearchNodeComponent);
```

- [ ] **Step 5: Create FactsheetLinkEdge (cluster view edge with label)**

```tsx
// apps/web/components/research/canvas/factsheet-link-edge.tsx
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

interface FactsheetLinkEdgeData {
  relationshipType: string;
  linkId: string;
}

type FactsheetLinkEdgeType = Edge<FactsheetLinkEdgeData, 'factsheetLink'>;

function FactsheetLinkEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  label,
}: EdgeProps<FactsheetLinkEdgeType>) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[8px] text-muted-foreground bg-background/80 px-1 rounded pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FactsheetLinkEdge = memo(FactsheetLinkEdgeComponent);
```

- [ ] **Step 6: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/research/canvas/factsheet-node.tsx \
  apps/web/components/research/canvas/center-factsheet-node.tsx \
  apps/web/components/research/canvas/fact-node.tsx \
  apps/web/components/research/canvas/source-research-node.tsx \
  apps/web/components/research/canvas/factsheet-link-edge.tsx
git commit -m "feat(research): factsheet graph node and edge components"
```

---

### Task 6: Cluster View Component

**Files:**
- Create: `apps/web/components/research/canvas/cluster-view.tsx`

- [ ] **Step 1: Create ClusterView**

```tsx
// apps/web/components/research/canvas/cluster-view.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FactsheetNode } from './factsheet-node';
import { FactsheetLinkEdge } from './factsheet-link-edge';
import {
  buildClusterNodes,
  buildClusterEdges,
  layoutClusterNodes,
  detectClusters,
  computeClusterBounds,
  type ClusterBoundary,
} from './factsheet-graph-utils';
import type { Factsheet, FactsheetLink } from '@/lib/research/factsheet-client';
import { createFactsheetLink } from '@/lib/research/factsheet-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const nodeTypes = { factsheetNode: FactsheetNode };
const edgeTypes = { factsheetLink: FactsheetLinkEdge };

interface ClusterViewProps {
  factsheets: Factsheet[];
  links: FactsheetLink[];
  factCounts: Map<string, number>;
  onDrillDown: (factsheetId: string) => void;
  onRefresh: () => void;
}

export function ClusterView({
  factsheets,
  links,
  factCounts,
  onDrillDown,
  onRefresh,
}: ClusterViewProps) {
  const { fitView } = useReactFlow();

  const rawNodes = useMemo(
    () => buildClusterNodes(factsheets, links, factCounts),
    [factsheets, links, factCounts],
  );
  const rawEdges = useMemo(() => buildClusterEdges(links), [links]);
  const initialNodes = useMemo(() => layoutClusterNodes(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);
  const [clusters, setClusters] = useState<ClusterBoundary[]>([]);

  // Pending connection for link-type popover
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

  // Compute cluster boundaries after layout
  useEffect(() => {
    const clusterIds = detectClusters(
      factsheets.map((f) => f.id),
      links,
    );
    const bounds = computeClusterBounds(clusterIds, nodes);
    setClusters(bounds);
  }, [nodes, factsheets, links]);

  // Re-layout when data changes
  useEffect(() => {
    const laid = layoutClusterNodes(rawNodes, rawEdges);
    setNodes(laid);
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    const laid = layoutClusterNodes(rawNodes, rawEdges);
    setNodes(laid);
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50);
  }, [rawNodes, rawEdges, setNodes, fitView]);

  // Double-click to drill down
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onDrillDown(node.id);
    },
    [onDrillDown],
  );

  // Drag-to-link: show relationship type picker
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setPendingConnection(connection);
  }, []);

  const handleCreateLink = useCallback(
    async (relationshipType: string) => {
      if (!pendingConnection?.source || !pendingConnection?.target) return;
      try {
        await createFactsheetLink(
          pendingConnection.source,
          pendingConnection.target,
          relationshipType,
        );
        toast.success(`${relationshipType.replace('_', ' ')} link created`);
        onRefresh();
      } catch {
        toast.error('Failed to create link');
      }
      setPendingConnection(null);
    },
    [pendingConnection, onRefresh],
  );

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap position="bottom-left" zoomable pannable className="!bg-card !border !shadow-sm !rounded-lg" />
        <Controls position="bottom-right" className="!bg-card !border !shadow-sm !rounded-lg" />

        {/* Cluster boundaries rendered as SVG background */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }}>
          {clusters.map((cluster) => (
            <g key={cluster.factsheetIds.join('-')}>
              <rect
                x={cluster.bounds.x}
                y={cluster.bounds.y}
                width={cluster.bounds.width}
                height={cluster.bounds.height}
                rx={16}
                fill="oklch(0.95 0.02 265 / 0.3)"
                stroke="oklch(0.80 0.05 265)"
                strokeWidth={1}
                strokeDasharray="6,3"
              />
              <text
                x={cluster.bounds.x + cluster.bounds.width / 2}
                y={cluster.bounds.y + 14}
                textAnchor="middle"
                fontSize={10}
                fill="oklch(0.60 0.08 265)"
                fontWeight={500}
              >
                {cluster.label}
              </text>
            </g>
          ))}
        </svg>
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
        <div className="flex gap-1.5 pointer-events-auto">
          <Button variant="secondary" size="sm" className="shadow-sm" onClick={handleAutoLayout}>
            Auto Layout
          </Button>
        </div>
        <div className="pointer-events-auto">
          <span className="text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded shadow-sm">
            Double-click to drill into evidence
          </span>
        </div>
      </div>

      {/* Link type popover */}
      {pendingConnection && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-card border rounded-lg shadow-lg p-3 space-y-1.5">
            <div className="text-xs font-semibold text-foreground mb-2">Link type:</div>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('parent_child')}>
              Parent → Child
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('spouse')}>
              Spouse
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('sibling')}>
              Sibling
            </Button>
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setPendingConnection(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/canvas/cluster-view.tsx
git commit -m "feat(research): ClusterView component with factsheet relationship graph"
```

---

### Task 7: Evidence View Component

**Files:**
- Create: `apps/web/components/research/canvas/evidence-view.tsx`

- [ ] **Step 1: Create EvidenceView**

```tsx
// apps/web/components/research/canvas/evidence-view.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CenterFactsheetNode } from './center-factsheet-node';
import { FactNode } from './fact-node';
import { SourceResearchNode } from './source-research-node';
import {
  buildEvidenceNodes,
  layoutEvidenceNodes,
} from './factsheet-graph-utils';
import {
  useFactsheetDetail,
  useFactsheetConflicts,
  promoteFactsheet,
  resolveFactsheetConflict,
} from '@/lib/research/factsheet-client';
import { usePersonResearchItems } from '@/lib/research/evidence-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = {
  centerFactsheet: CenterFactsheetNode,
  factNode: FactNode,
  sourceResearchNode: SourceResearchNode,
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800' },
  promoted: { label: 'Promoted', className: 'bg-indigo-100 text-indigo-800' },
  merged: { label: 'Merged', className: 'bg-cyan-100 text-cyan-800' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-500' },
};

interface EvidenceViewProps {
  factsheetId: string;
  personId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function EvidenceView({
  factsheetId,
  personId,
  onBack,
  onRefresh,
}: EvidenceViewProps) {
  const { fitView } = useReactFlow();
  const { detail, isLoading: detailLoading, refetch: refetchDetail } = useFactsheetDetail(factsheetId);
  const { conflicts, refetch: refetchConflicts } = useFactsheetConflicts(factsheetId);
  const { items: researchItems } = usePersonResearchItems(personId);

  const conflictFactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      for (const f of c.facts) {
        if (f.accepted === null) ids.add(f.id);
      }
    }
    return ids;
  }, [conflicts]);

  const researchItemMap = useMemo(() => {
    const map = new Map<string, { title: string; provider: string | null }>();
    for (const item of researchItems) {
      map.set(item.id, { title: item.title, provider: item.providerId });
    }
    return map;
  }, [researchItems]);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    return buildEvidenceNodes(detail, researchItemMap, conflictFactIds);
  }, [detail, researchItemMap, conflictFactIds]);

  const layoutNodes = useMemo(() => layoutEvidenceNodes(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => {
    const laid = layoutEvidenceNodes(rawNodes, rawEdges);
    setNodes(laid);
    setEdges(rawEdges);
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 100);
  }, [rawNodes, rawEdges, setNodes, setEdges, fitView]);

  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromote = useCallback(async () => {
    if (!detail) return;
    setIsPromoting(true);
    try {
      await promoteFactsheet(detail.id, 'create');
      toast.success('Factsheet promoted to tree');
      onRefresh();
      onBack();
    } catch (err: any) {
      toast.error(err.message ?? 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  }, [detail, onRefresh, onBack]);

  const hasUnresolvedConflicts = conflictFactIds.size > 0;

  if (detailLoading || !detail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap position="bottom-left" zoomable pannable className="!bg-card !border !shadow-sm !rounded-lg" />
        <Controls position="bottom-right" className="!bg-card !border !shadow-sm !rounded-lg" />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button variant="ghost" size="sm" className="shadow-sm gap-1 text-primary" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
            Back to Clusters
          </Button>
          <span className="text-[12px] font-semibold text-foreground">{detail.title}</span>
          <Badge variant="secondary" className={`text-[9px] ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        </div>
        <div className="pointer-events-auto">
          <Button
            size="sm"
            disabled={isPromoting || hasUnresolvedConflicts || detail.status === 'promoted' || detail.status === 'merged'}
            onClick={handlePromote}
            title={hasUnresolvedConflicts ? 'Resolve all conflicts before promoting' : undefined}
          >
            {isPromoting ? 'Promoting...' : 'Promote'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/canvas/evidence-view.tsx
git commit -m "feat(research): EvidenceView component with fact graph and promote action"
```

---

### Task 8: Replace CanvasTab with Unified Factsheet Graph

**Files:**
- Modify: `apps/web/components/research/canvas/canvas-tab.tsx`
- Create: `apps/web/lib/research/use-all-factsheet-links.ts`

- [ ] **Step 1: Create a hook to fetch all links for a person's factsheets**

```typescript
// apps/web/lib/research/use-all-factsheet-links.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FactsheetLink, Factsheet } from '@/lib/research/factsheet-client';

export function useAllFactsheetLinks(factsheets: Factsheet[]) {
  const [links, setLinks] = useState<FactsheetLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (factsheets.length === 0) {
      setLinks([]);
      return;
    }
    setIsLoading(true);
    try {
      const allLinks: FactsheetLink[] = [];
      const seenIds = new Set<string>();
      for (const fs of factsheets) {
        const res = await fetch(`/api/research/factsheets/${fs.id}/links`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const link of (data.links ?? []) as FactsheetLink[]) {
          if (!seenIds.has(link.id)) {
            seenIds.add(link.id);
            allLinks.push(link);
          }
        }
      }
      setLinks(allLinks);
    } catch {
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [factsheets]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, isLoading, refetch: fetchLinks };
}
```

- [ ] **Step 2: Replace CanvasTab with factsheet graph**

```tsx
// apps/web/components/research/canvas/canvas-tab.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useFactsheets } from '@/lib/research/factsheet-client';
import { useAllFactsheetLinks } from '@/lib/research/use-all-factsheet-links';
import { ClusterView } from './cluster-view';
import { EvidenceView } from './evidence-view';

interface CanvasTabProps {
  personId: string;
}

export function CanvasTab({ personId }: CanvasTabProps) {
  const { factsheets, isLoading: fsLoading, refetch: refetchFs } = useFactsheets(personId);
  const { links, isLoading: linksLoading, refetch: refetchLinks } = useAllFactsheetLinks(factsheets);

  const [drillDownId, setDrillDownId] = useState<string | null>(null);

  const isLoading = fsLoading || linksLoading;

  const factCounts = useMemo(() => {
    const map = new Map<string, number>();
    // We don't have fact counts from the list endpoint, so show 0 for now
    // The detail fetch in evidence view has the actual counts
    for (const fs of factsheets) {
      map.set(fs.id, 0);
    }
    return map;
  }, [factsheets]);

  const handleRefresh = useCallback(() => {
    refetchFs();
    refetchLinks();
  }, [refetchFs, refetchLinks]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-16rem)] rounded-lg border border-border bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm">Loading canvas...</p>
        </div>
      </div>
    );
  }

  if (factsheets.length === 0) {
    return (
      <div className="h-[calc(100vh-16rem)] rounded-lg border border-border bg-muted/30 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm font-medium">No factsheets yet</p>
          <p className="text-xs mt-1">Create factsheets in the Factsheets tab to visualize them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)] rounded-lg border border-border overflow-hidden">
      <ReactFlowProvider>
        {drillDownId ? (
          <EvidenceView
            factsheetId={drillDownId}
            personId={personId}
            onBack={() => setDrillDownId(null)}
            onRefresh={handleRefresh}
          />
        ) : (
          <ClusterView
            factsheets={factsheets}
            links={links}
            factCounts={factCounts}
            onDrillDown={setDrillDownId}
            onRefresh={handleRefresh}
          />
        )}
      </ReactFlowProvider>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Test manually**

1. Open `/research/person/[id]?tab=canvas`
2. Verify cluster view shows factsheet nodes with status badges
3. Double-click a factsheet → verify drill-down to evidence map
4. Click "Back to Clusters" → verify return
5. Draw edge between two factsheets → verify link type popover

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/canvas/canvas-tab.tsx \
  apps/web/lib/research/use-all-factsheet-links.ts
git commit -m "feat(research): replace research canvas with unified factsheet graph"
```

---

### Task 9: Clean Up Old Canvas Components

**Files:**
- Delete (or mark unused): `apps/web/components/research/canvas/source-palette.tsx`
- Keep: `source-node.tsx`, `note-node.tsx`, `conflict-node.tsx`, `evidence-edge.tsx` (may be useful for other features)
- Modify: `apps/web/components/research/canvas/canvas-inner.tsx` — no longer imported by canvas-tab

- [ ] **Step 1: Verify old canvas-inner is no longer imported**

Run: `cd /d/projects/ancstra && grep -r "canvas-inner" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules`

If `canvas-inner.tsx` is only referenced by the old `canvas-tab.tsx` (which we replaced), it's safe to leave as-is. No deletion needed — just ensure no import errors.

- [ ] **Step 2: Verify full project compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: clean up unused canvas imports after factsheet graph migration"
```

---

## Verification Plan

### Tree Gap Indicators (Phase A)
1. Open tree view → confirm no gap indicators visible by default
2. Click "Data Quality" toolbar toggle → confirm progress bars + dots appear on all nodes
3. Verify a node with full data: all green dots + green bar
4. Verify a node with only a name: mostly red dots + red thin bar
5. Verify living persons: death date dot is gray (N/A)
6. Toggle off → confirm indicators disappear
7. Check dark mode rendering
8. Zoom to 50% → confirm progress bar still readable

### Factsheet Canvas Graph (Phase B)
1. Navigate to research person → Canvas tab
2. Confirm cluster view shows factsheet nodes with status badges
3. Verify family unit clusters have dashed boundary
4. Drag edge between two factsheet nodes → link type popover appears
5. Double-click a factsheet → drill-down to evidence map
6. Verify fact nodes show correct confidence colors
7. Verify source nodes in amber styling
8. Click "Promote" → confirm flow triggers
9. Click "Back to Clusters" → confirm return
10. Verify empty state when no factsheets exist
