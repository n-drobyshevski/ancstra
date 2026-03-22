# Tree Visualization

> Phase: 1 | Status: Not Started
> Depth: implementation-ready
> Dependencies: [ADR-005 (React Flow)](../architecture/decisions/005-react-flow-viz.md), [ADR-006 (Closure Table)](../architecture/decisions/006-closure-table.md)
> Data model: [data-model.md](../architecture/data-model.md)

## Overview

Tree visualization is the heart of genealogy software. This spec details the integration of React Flow (@xyflow/react) as an interactive work canvas — a Figma-like editor where users can arrange, connect, and explore their family tree. Topola is retained solely for generating printable exports (PDF, PNG, SVG).

The React Flow canvas enables users to:
- **Drag nodes** to customize layout and save positions persistently
- **Interactive exploration** with smooth zoom/pan and focused searching
- **Relationship visualization** with validation status indicators (confirmed, proposed, disputed)
- **Create relationships** by drawing edges directly on the canvas
- **Group family units** using sub-flows for visual organization
- **Auto-layout** via dagre for initial hierarchical positioning

## Requirements

- [ ] Render interactive tree canvas with drag-to-reposition nodes (React Flow)
- [ ] Support auto-layout via dagre (hierarchical, top-down)
- [ ] Allow manual node repositioning with position persistence
- [ ] Support multiple saved layouts per tree
- [ ] Display custom person card nodes (photo, name, dates, sex, completion bar)
- [ ] Group family units using React Flow sub-flows
- [ ] Draw edges interactively to create relationships
- [ ] Visualize relationship validation status (confirmed: solid, proposed: dashed, disputed: dotted)
- [ ] Display person details in slide-out sidebar
- [ ] Handle large trees (5K+ nodes) with onlyRenderVisibleElements
- [ ] Export to PDF, PNG, SVG (via Topola)
- [ ] Built-in mini-map, controls, and background grid (React Flow)
- [ ] Drag persons from sidebar palette onto canvas to create new entries
- [ ] Search and focus on specific person

## Design

### Library Roles

| Library | Role | Chart Types | Interaction | Strengths |
|---------|------|-------------|-------------|-----------|
| **@xyflow/react** | Interactive work canvas | Tree (customizable layout) | Drag nodes, zoom, pan, draw edges | Figma-like UX, real-time feedback, extensive customization |
| **@dagrejs/dagre** | Auto-layout engine | Hierarchical (top-down) | Initial positioning | Fast, deterministic, publication-quality layouts |
| **topola-viewer** | Export engine only | All specialized views | View-only, export formats | PDF/PNG/SVG generation, print-quality output |

### Data Adapter Interface

Our schema is the source of truth. The adapter converts SQLite data (person_summary table) to React Flow nodes/edges:

```typescript
// packages/db/queries/tree-data.ts

import type { Node, Edge } from '@xyflow/react';

export interface PersonNodeData {
  personId: string;
  displayName: string;
  birthYear?: number;
  deathYear?: number;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
  photoUrl?: string;
  completionScore: number;
  fatherId?: string;
  motherId?: string;
}

export interface RelationshipEdgeData {
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
  relationshipType: 'parent_child' | 'partner';
}

export function toReactFlowData(
  summaries: PersonSummary[],
  layouts: TreeLayout[],
  layoutName: string = 'default'
): { nodes: Node<PersonNodeData>[]; edges: Edge<RelationshipEdgeData>[] } {
  const layoutMap = new Map(
    layouts.filter(l => l.layoutName === layoutName)
      .map(l => [l.personId, { x: l.x, y: l.y }])
  );

  const nodes: Node<PersonNodeData>[] = summaries.map(s => ({
    id: s.personId,
    type: 'person',
    position: layoutMap.get(s.personId) ?? { x: 0, y: 0 }, // dagre will set initial
    data: {
      personId: s.personId,
      displayName: s.displayName,
      birthYear: s.birthYear ?? undefined,
      deathYear: s.deathYear ?? undefined,
      sex: s.sex as 'M' | 'F' | 'U',
      isLiving: Boolean(s.isLiving),
      photoUrl: s.photoUrl ?? undefined,
      completionScore: s.completionScore,
      fatherId: s.fatherId ?? undefined,
      motherId: s.motherId ?? undefined,
    },
    draggable: true,
  }));

  const edges: Edge<RelationshipEdgeData>[] = [];

  for (const s of summaries) {
    // Parent-child edges
    if (s.fatherId) {
      edges.push({
        id: `${s.fatherId}-${s.personId}`,
        source: s.fatherId,
        target: s.personId,
        type: 'parentChild',
        data: { validationStatus: 'confirmed', relationshipType: 'parent_child' },
      });
    }
    if (s.motherId) {
      edges.push({
        id: `${s.motherId}-${s.personId}`,
        source: s.motherId,
        target: s.personId,
        type: 'parentChild',
        data: { validationStatus: 'confirmed', relationshipType: 'parent_child' },
      });
    }
    // Partner edges
    const spouseIds: string[] = JSON.parse(s.spouseIds || '[]');
    for (const spouseId of spouseIds) {
      // Only create edge once (lower ID is source)
      if (s.personId < spouseId) {
        edges.push({
          id: `partner-${s.personId}-${spouseId}`,
          source: s.personId,
          target: spouseId,
          type: 'partner',
          data: { validationStatus: 'confirmed', relationshipType: 'partner' },
        });
      }
    }
  }

  return { nodes, edges };
}

// Convert React Flow positions back to Topola format for export
export function toTopolaData(
  tree: TreeData,
  nodePositions: Map<string, { x: number; y: number }>
): TopolaJsonGedcom {
  return {
    indis: Array.from(tree.persons.entries()).map(([id, p]) => ({
      id,
      firstName: p.name.split(' ')[0],
      lastName: p.name.split(' ').slice(1).join(' '),
      sex: p.sex,
      birth: p.birthYear ? { date: { year: p.birthYear } } : undefined,
      death: p.deathYear ? { date: { year: p.deathYear } } : undefined,
      famc: findParentFamilyId(id, tree.families),
      fams: findSpouseFamilyIds(id, tree.families),
    })),
    fams: Array.from(tree.families.entries()).map(([id, f]) => ({
      id,
      husb: f.partner1Id,
      wife: f.partner2Id,
      children: f.childIds,
    })),
  };
}
```

### Component Architecture

```
TreePage (Server Component)
  TreeCanvas (Client Component — React Flow)
    ReactFlow
      <MiniMap />
      <Controls />
      <Background variant="dots" />
    Custom node types:
      PersonNode — person card with photo, name, dates, sex indicator, completion bar
      FamilyGroupNode — sub-flow grouping partners + children
    Custom edge types:
      ParentChildEdge — solid/dashed/dotted by validation status
      PartnerEdge — horizontal connection between partners
    Sidebar
      PersonPalette — drag new persons onto canvas
      SearchPanel — find and focus person
      FilterPanel — filter by generation, sex, living status
  TopolaWrapper (Client Component — export only)
    Used ONLY for PDF/SVG/PNG export
  PersonDetailPanel (slide-out)
    PersonHeader, EventsList, SourcesList, MediaGallery, etc.
```

### PersonNode Component

```typescript
// apps/web/components/tree/PersonNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from '@/lib/tree-data';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

export function PersonNode({ data, selected }: NodeProps<PersonNodeData>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-lg border-2 min-w-[120px] bg-card",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
        data.sex === 'M' ? "border-l-blue-500 border-l-4" :
        data.sex === 'F' ? "border-l-pink-500 border-l-4" : ""
      )}>
        <Avatar className="w-8 h-8">
          {data.photoUrl ? (
            <AvatarImage src={data.photoUrl} alt={data.displayName} />
          ) : (
            <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
          )}
        </Avatar>
        <span className="text-sm font-medium text-center leading-tight">
          {data.isLiving ? 'Living' : data.displayName}
        </span>
        {!data.isLiving && (data.birthYear || data.deathYear) && (
          <span className="text-xs text-muted-foreground">
            {data.birthYear ?? '?'} - {data.deathYear ?? '?'}
          </span>
        )}
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${data.completionScore}%` }}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
```

### Relationship Link Visualization

Links reflect validation status as follows:

| Status | Line Style | Color | Meaning |
|--------|-----------|-------|---------|
| `confirmed` | Solid line | Gray (#6b7280) | Validated relationship with justification |
| `proposed` | Dashed line (8,4) | Blue (#3b82f6) | AI/API-discovered, pending editor review |
| `disputed` | Dotted line (3,3) | Amber (#f59e0b) | Conflicting evidence, under investigation |

Additional visual indicators:
- **Justification badge:** Small shield/checkmark icon on confirmed links showing evidence count (e.g., "3 sources")
- **Pending proposal badge:** Person nodes with pending proposals show a notification dot
- **Clicking a link** opens the justification panel in the PersonDetailPanel sidebar, showing all evidence and the validation history

```typescript
// apps/web/components/tree/ParentChildEdge.tsx
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { RelationshipEdgeData } from '@/lib/tree-data';

const edgeStyles = {
  confirmed: { stroke: '#6b7280', strokeWidth: 2, strokeDasharray: 'none' },
  proposed: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '8,4', animation: 'dashdraw 0.5s linear infinite' },
  disputed: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '3,3' },
};

export function ParentChildEdge(props: EdgeProps<RelationshipEdgeData>) {
  const [edgePath] = getSmoothStepPath(props);
  const style = edgeStyles[props.data?.validationStatus ?? 'confirmed'];
  return <BaseEdge path={edgePath} style={style} />;
}

export function PartnerEdge(props: EdgeProps<RelationshipEdgeData>) {
  const [edgePath] = getSmoothStepPath({
    ...props,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.sourceY, // Keep same Y level for horizontal appearance
  });
  const style = edgeStyles[props.data?.validationStatus ?? 'confirmed'];
  return <BaseEdge path={edgePath} style={style} />;
}
```

## Layout Strategy

React Flow positions are persisted to enable custom, hand-curated layouts. Multiple layout presets support different exploration needs.

### Auto-Layout (Dagre)

Initial positions are computed via dagre (@dagrejs/dagre) with hierarchical layout:
- **rankDir:** 'TB' (top-down)
- **rankSep:** 100 (pixels between generation levels)
- **nodeSep:** 50 (pixels between siblings)

Dagre layout runs once on canvas load. Users can then manually adjust positions by dragging.

```typescript
// apps/web/lib/layout.ts
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export function computeLayout(
  nodes: Node[],
  edges: Edge[]
): { x: number; y: number }[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(node => {
    g.setNode(node.id, { width: 120, height: 200 });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    return { x: pos.x, y: pos.y };
  });
}
```

### Manual Layout Override

When a user drags a node, the new position is saved to the `tree_layouts` table (debounced 500ms). If the user then switches to a different layout view, saved positions are restored.

### Multiple Saved Layouts

Users can save layout snapshots for different purposes:
- **"default"** — Auto-positioned via dagre
- **"pedigree_view"** — Vertically stacked ancestors
- **"research_workspace"** — Custom hand-curated positions
- **"presentation_layout"** — Optimized for screen sharing / printing

Layout schema:
```sql
CREATE TABLE tree_layouts (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  layout_name TEXT NOT NULL DEFAULT 'default',
  x REAL NOT NULL,
  y REAL NOT NULL,
  UNIQUE(person_id, layout_name)
);
```

### Custom Layout with New Persons

When new persons are added after a layout was saved, auto-layout (dagre) is applied only to new nodes while existing positions are preserved. This prevents disrupting a hand-curated workspace.

## Performance Strategy for Large Trees

React Flow is optimized for interactive performance even with thousands of nodes:

1. **onlyRenderVisibleElements={true}** — Only mounts DOM for visible nodes (~50-200 at any zoom level)
2. **person_summary table** — Provides all node data in a single query (no JOINs needed)
3. **Lazy-load person detail** — Detail panel loads on click, not upfront
4. **Debounce position saves** — 500ms debounce after last drag to reduce database writes
5. **Virtualize sidebar lists** — PersonPalette and SearchPanel use react-window for long lists
6. **Dagre runs once** — Layout computation happens once on load, not on every render

Performance targets:
- **5K+ nodes:** Should render and remain interactive
- **1K nodes:** Smooth zoom/pan at 60fps
- **Render time:** < 2 seconds for 1K nodes

```typescript
// apps/web/components/tree/TreeCanvas.tsx

export function TreeCanvas({ treeId }: { treeId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutName, setLayoutName] = useState('default');

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    // Debounced save to tree_layouts table
    debouncedSaveLayout(treeId, layoutName, nodes);
  }, [treeId, layoutName]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={{ person: PersonNode, familyGroup: FamilyGroupNode }}
      edgeTypes={{ parentChild: ParentChildEdge, partner: PartnerEdge }}
      onlyRenderVisibleElements={true}
      fitView
    >
      <MiniMap />
      <Controls />
      <Background variant="dots" />
    </ReactFlow>
  );
}
```

## Print and Export

Topola is used exclusively for export (not interactive views). The data adapter converts React Flow positions to Topola format for consistent export output.

| Format | Library | Use Case | Quality |
|--------|---------|----------|---------|
| **PDF** | Topola (built-in) | High-quality printable charts | Excellent for printing |
| **PNG** | Topola (built-in) | Sharing on social media | Good resolution |
| **SVG** | Topola (built-in) | Scalable vector for printing | Lossless, best for high-res printing |
| **GEDCOM** | Our exporter | Data interchange, backup | Portable format |

```typescript
// apps/web/components/tree/ExportButton.tsx

async function handleExport(format: 'pdf' | 'png' | 'svg' | 'gedcom') {
  if (format === 'gedcom') {
    // Use our GEDCOM exporter
    const gedcomStr = await exportGedcom(db, {
      version: '5.5.1',
      filterLiving: false,
      includeMedia: true,
      includeNotes: true,
      charset: 'UTF-8',
    });
    downloadFile(gedcomStr, 'genealogy.ged');
  } else {
    // Use Topola exporter with tree data
    const topolaData = toTopolaData(treeData, nodePositions);
    const svg = await topolaChart.render(topolaData);

    if (format === 'svg') {
      downloadFile(svg, 'tree.svg');
    } else if (format === 'pdf') {
      const pdf = await svgToPdf(svg);
      downloadFile(pdf, 'tree.pdf');
    } else if (format === 'png') {
      const png = await svgToPng(svg);
      downloadFile(png, 'tree.png');
    }
  }
}
```

## Work Canvas — Interactive Relationship Drawing

Users can draw new edges directly on the canvas to create relationships:

```typescript
// apps/web/components/tree/TreeCanvas.tsx

const onConnect = useCallback((connection: Connection) => {
  // User has drawn an edge from source to target
  // Create a "proposed_relationship" for validation
  const newEdge: Edge<RelationshipEdgeData> = {
    id: `proposed-${connection.source}-${connection.target}`,
    source: connection.source,
    target: connection.target,
    type: 'parentChild',
    data: { validationStatus: 'proposed', relationshipType: 'parent_child' },
  };
  setEdges(eds => addEdge(newEdge, eds));

  // Save as proposed relationship in database
  await createProposedRelationship(treeId, {
    personId1: connection.source,
    personId2: connection.target,
    relationshipType: 'parent_child',
    validationStatus: 'proposed',
    source: 'user_created',
  });
}, [treeId]);

return (
  <ReactFlow
    nodes={nodes}
    edges={edges}
    onConnect={onConnect}
    // ... other props
  />
);
```

## Edge Cases & Error Handling

- **Empty tree:** Show placeholder message "No persons in tree"
- **Single person:** Show just that person, no relationships
- **Circular references:** Detect and break cycles to prevent infinite loops
- **Missing parents/spouses:** Render as orphan nodes with warning badge
- **Living persons:** Show as "Living" instead of name; hide death date
- **Large trees (5K+ nodes):** Auto-layout is computed; zoom/pan remains fluid with onlyRenderVisibleElements
- **Layout conflicts:** When importing GEDCOM into existing tree, generate dagre positions for all new nodes; keep existing positions
- **Custom layouts:** When new persons are added after layout was saved, auto-position only new nodes (dagre), keep existing positions

## Open Questions

1. **Should we show sibling relationships?** Currently: no (not in initial implementation). Consider Phase 2.
2. **How to handle multiple spouses with same person?** Currently: show all as separate connections. User can validate which are correct.
3. **Should we auto-center on selected person?** Currently: yes via React Flow's `fitView` after search. Configurable in settings?
4. **How to display DNA relationships (not genealogical)?** Defer to Phase 4.
5. **Should family unit sub-flows be expanded/collapsed?** Consider Phase 2 for visual grouping toggle.

## Implementation Notes

**Phase 1 deliverables:**
- React Flow canvas integration with custom PersonNode
- dagre auto-layout
- Position persistence (tree_layouts table)
- ParentChildEdge + PartnerEdge with validation styling
- Person detail sidebar
- Drag-from-sidebar to create persons
- Interactive edge drawing (relationship creation)
- MiniMap, Controls, Background (built-in React Flow components)
- Topola export (PDF/PNG/SVG)
- Search and focus functionality
- Multiple saved layouts

**Libraries:**
- `@xyflow/react` (interactive work canvas)
- `@dagrejs/dagre` (hierarchical auto-layout)
- `topola-viewer` (export only)
- `react-window` (virtualized sidebar lists)

**Removed (from ADR-004):**
- `family-chart`
- `d3` (dagre handles layout; no longer needed from family-chart)
- `html-to-image` (React Flow/Topola handle exports)

**Test coverage:**
- Adapter correctness (persons/families correctly mapped to React Flow format)
- Canvas rendering (visual inspection, node/edge presence)
- Performance (5K nodes should render and remain interactive; 1K nodes at 60fps)
- Layout persistence (positions saved and restored correctly)
- Export formats (PDF, PNG, SVG validation via Topola)
- Mobile responsiveness (touch interactions, responsive sidebar)
- Accessibility (keyboard navigation, ARIA labels, screen reader support)

**Accessibility considerations:**
- Color-blind safe: use pattern fills + text labels for relationship status, not just color
- Keyboard navigation: arrow keys to navigate canvas, Tab to focus nodes, Enter to select person
- Screen reader support: ARIA labels for nodes, links, buttons, and edge descriptions
- Text contrast: ensure person name text is readable (WCAG AA standard)
- Focus management: visible focus ring on selected nodes, keyboard shortcuts accessible
