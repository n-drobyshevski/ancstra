# ADR-005: React Flow (@xyflow/react) as Primary Visualization, Topola for Export Only

> Date: 2026-03-21 | Status: Accepted | Supersedes: ADR-004

## Context

The family-chart + Topola dual-library approach from ADR-004 has revealed critical limitations after initial implementation:

1. **SVG-based rendering bottleneck:** Both family-chart and Topola are SVG-based, creating one DOM element per node and edge. Past ~500 nodes, rendering performance degrades significantly (>2s refresh cycles).

2. **family-chart is a viewer, not an editor:** It excels at pan/zoom/click navigation, but lacks drag-to-reposition, manual layout control, and relationship drawing. Users cannot customize layouts interactively.

3. **Two visualization libraries create maintenance burden:** Supporting both family-chart (for interactive) and Topola (for specialized views) increases bundle size, CSS conflicts, and testing complexity. The libraries don't share position data; repositioning in one doesn't sync to the other.

4. **Users need a "work canvas":** Early feedback shows genealogy research is a design activity — users want to drag people around, group family units, draw new relationships, and save custom layouts. A node-based editor paradigm (like Figma or workflow builders) maps naturally to genealogy work.

After performance analysis and user interviews, we evaluated canvas-based and editor-first solutions:

- **Cytoscape.js:** Canvas-based, excellent performance, but editor UX is secondary (better for network analysis).
- **react-force-graph:** WebGL rendering, but force-directed layout is wrong for genealogy (family trees are hierarchical, not particle systems).
- **@antv/g6:** Canvas + tree layouts, but documentation is Chinese-primary; API stability uncertain.
- **Custom d3-hierarchy + Canvas:** Maximum control, but 3–4 weeks development overhead.
- **@xyflow/react:** DOM-based with `onlyRenderVisibleElements`, built as a node editor, Figma-like UX, excellent TypeScript support, active maintenance.

React Flow's approach — render only visible DOM nodes (~50–200 at any zoom level), support custom React components as nodes, provide built-in drag, edge drawing, and sub-flows — overcomes family-chart's limitations while keeping rendering manageable.

## Decision

**Use React Flow (@xyflow/react) as the primary interactive canvas for tree visualization and layout. Keep Topola solely for PDF/SVG/PNG export.**

| Responsibility | Library | Interaction | Output |
|---|---|---|---|
| **Primary interactive editor** | React Flow | Drag nodes, draw edges, save custom layouts, click to select | Positions stored in `tree_layouts` table |
| **Specialized export formats** | Topola | None (export-only) | PDF, PNG, SVG downloads |

Concretely:
- Default view: React Flow interactive canvas with auto-layout (hierarchical via dagre)
- Manual override: Users drag nodes to custom positions; layout persists per view
- Export: All formats via Topola (same as ADR-004)
- Legacy family-chart removed; Topola specialized views deprecated (users manage views in React Flow)

## Reasons

1. **Editor-first UX aligns with genealogy workflow:** React Flow is designed for node-based editors (used by Retool, n8n, Figma's plugin system). Genealogy is inherently a spatial design task — users group families, arrange partners, visualize lineage branches. A node editor paradigm is more natural than a read-only chart viewer.

2. **Custom React components as nodes:** Each person is a full React component with shadcn/ui Button, Badge, and Popover — show photos, names, dates, sex indicators, completion bars, validation status. No SVG/Canvas drawing API limitations; reuse app's design system.

3. **Performance with `onlyRenderVisibleElements`:** React Flow only mounts DOM nodes visible in the viewport. At 5,000 total nodes, maybe 50–200 are visible at any zoom level — comparable to a standard React page with a paginated data grid. Eliminates the ~500-node SVG ceiling.

4. **Position persistence and multiple layouts:** Nodes have explicit {x, y} coordinates stored in a `tree_layouts` table. Users save multiple layouts ("pedigree view", "research workspace", "presentation mode") without data loss. Auto-layout (dagre) provides intelligent initial positions; manual overrides take precedence.

5. **Built-in node-editor features:** MiniMap, Controls (zoom, fit-view), Background (dots/lines/cross), pan/zoom gestures, keyboard shortcuts (delete, duplicate, arrow keys), accessibility (aria-labels, focus management) — all included. No custom implementation needed.

6. **Sub-flows for family grouping:** React Flow's sub-flow feature groups partners + children as a collapsible family unit. Reduces visual clutter for large trees while preserving structure.

7. **Active ecosystem and support:** React Flow has 30K+ GitHub stars, monthly releases, excellent TypeScript support, comprehensive docs, and responsive maintainers. Lower risk than smaller alternatives.

8. **Unified interactive path:** Replaces both family-chart (primary viewer) and Topola specialized views. Only Topola remains for export. Single data flow (SQLite → React Flow → positions), simpler architecture.

## Consequences

1. **DOM-based rendering at extreme scale:** React Flow uses DOM elements, not Canvas. At 10K+ nodes with all visible in viewport (highly unlikely but theoretically possible), Canvas would be faster. Mitigation: `onlyRenderVisibleElements` makes this scenario impractical; real-world trees have >99% nodes outside viewport at any zoom.

2. **Genealogy-specific layout logic required:** React Flow doesn't know about family trees. We use @dagrejs/dagre for hierarchical layout, but must add custom logic to position partners side-by-side and children below (rather than Topola's ready-made family layouts).

3. **Topola still required for export:** React Flow doesn't generate PDF/SVG. Topola remains as an export-only library. Two visualization code paths exist (React Flow for interactive, Topola for export), but interactive is unified.

4. **New `tree_layouts` table:** Persist custom node positions per view. Schema:
   ```sql
   CREATE TABLE tree_layouts (
     id TEXT PRIMARY KEY,
     tree_id TEXT NOT NULL REFERENCES trees(id),
     name TEXT NOT NULL,
     is_default BOOLEAN DEFAULT FALSE,
     layout_data JSON NOT NULL,  -- { [personId]: { x, y, width, height } }
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

5. **GEDCOM import must generate initial positions:** GEDCOM importer now calls dagre to compute hierarchical positions before storing persons. Performance: <100ms for trees <5K nodes.

6. **Bundle size change:** `@xyflow/react` (~200KB) + `@dagrejs/dagre` (~30KB) replaces `family-chart` (~120KB) + `d3` (~60KB + transitive). Net: ~+50KB (acceptable; React Flow's extras justify the cost).

7. **Deprecated Topola specialized views:** Descendants, hourglass, relatives views are no longer separate entry points. Users instead use React Flow with filters ("show only descendants", "show hourglass pattern via dagre config"). Simpler UX.

## Design Details

### Component Architecture

```
TreePage (Server Component)
├── TreeToolbar (Client Component)
│   ├── LayoutOptions
│   │   ├── LoadLayout (dropdown of saved layouts)
│   │   ├── SaveAsLayout (modal to save current state)
│   │   └── AutoLayout toggle (dagre refresh)
│   ├── SearchPerson
│   ├── FilterPanel (generation, sex, living status)
│   └── ExportButton (to Topola)
├── TreeCanvas (Client Component — React Flow)
│   ├── ReactFlow
│   │   ├── <MiniMap />
│   │   ├── <Controls />
│   │   ├── <Background variant="dots" />
│   │   └── <Panel position="top-left"><HelpText /></Panel>
│   ├── Custom Node Types:
│   │   ├── PersonNode
│   │   │   └── Renders: photo, name, dates, sex indicator, badges
│   │   └── FamilyGroupNode (sub-flow)
│   │       └── Groups: partners (horizontal) + children (below)
│   ├── Custom Edge Types:
│   │   ├── ParentChildEdge
│   │   │   └── Line style by validation_status: solid/dashed/dotted
│   │   └── PartnerEdge
│   │       └── Horizontal connection with marriage date label
│   └── Sidebar
│       ├── PersonPalette (drag new persons onto canvas)
│       ├── SearchPersonPanel (find and focus)
│       └── FilterPanel (advanced: by date range, event, source)
├── PersonDetailPanel (slide-out)
│   ├── PersonHeader
│   ├── EventsList
│   ├── SourcesList
│   ├── MediaGallery
│   └── RelationshipManager (add/edit partnerships, parents, children)
└── TopolaExportModal (Client Component — export only)
    ├── Converts React Flow data to Topola format
    ├── Format selector: PDF | PNG | SVG
    └── Download button
```

### Edge Styling (Validation Status)

| Status | Line Style | Color | Meaning |
|--------|-----------|-------|---------|
| `confirmed` | Solid, strokeWidth: 2 | Gray/black (#333) | Validated relationship with source |
| `proposed` | Animated dashed (strokeDasharray: "5,5"; animation) | Blue (#3B82F6) | AI/API-discovered, pending review |
| `disputed` | Dotted (strokeDasharray: "2,4") | Amber (#F59E0B) | Conflicting evidence, under investigation |

### Hierarchical Layout (Dagre Configuration)

```typescript
const dagreConfig = {
  rankdir: 'TB',         // Top-to-bottom (ancestors at top, descendants below)
  nodesep: 80,           // Horizontal spacing between nodes
  ranksep: 120,          // Vertical spacing between generations
  marginx: 20,
  marginy: 20,
  align: 'UL',           // Align to upper-left of bounding box
};

// Custom logic: position partners side-by-side
// If person A has partner B, place B at { x: A.x + nodeWidth + spacing, y: A.y }
// Then layout children below the couple
```

### Multiple Layout Persistence

```typescript
// User clicks "Save Layout"
const layout = {
  name: 'Pedigree View',
  nodes: nodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })),
  // edges unchanged
};
// Stored in tree_layouts table; can restore instantly

// User clicks "Auto Layout"
const newLayout = dagre(...);
setNodes(newLayout.nodes);
// Saved as "Auto Layout (refreshed at 2026-03-21 14:30)"
```

## Dependencies

**Add:**
- `@xyflow/react` — React Flow interactive canvas and node editor
- `@dagrejs/dagre` — Hierarchical auto-layout for genealogy trees

**Keep:**
- `topola-viewer` — PDF/SVG/PNG export only (no interactive use)

**Remove:**
- `family-chart` — Replaced by React Flow; remove to reduce bundle
- `d3` — No longer a direct dependency (was `family-chart`'s dependency)
- `html-to-image` — React Flow has native screenshot via ref

## Revisit Triggers

1. **DOM performance at 10K+ visible nodes:** If users zoom out to view 10K+ nodes simultaneously and performance degrades below 30 fps, evaluate Canvas-based alternative (Cytoscape.js with canvas mode) or WebGL (Sigma.js).

2. **Users request 3D visualization:** If demand for 3D family trees emerges, evaluate Three.js integration as a parallel view (not replacement).

3. **React Flow becomes unmaintained:** If no updates for 12+ months, fallback: Cytoscape.js with custom editor UX.

4. **Real-time collaborative canvas editing:** If teams request shared whiteboard-style genealogy editing, upgrade React Flow with CRDT (Y.js) for position sync. Adds complexity; defer unless demand is high.

5. **dagre layout inadequate for genealogy:** If hierarchical layout produces confusing results for complex families (e.g., cousin marriages, multiple partnerships), implement custom force-directed tweaks or consult layout domain experts.

---

## Related Decisions

- **ADR-004 (Superseded):** Original family-chart + Topola dual-library approach. Topola remains for export.
- **ADR-002:** SQLite + Drizzle ORM (data layer unchanged; new `tree_layouts` table added).
- **ADR-006 (Planned):** Closure table optimization for fast tree queries (feeds React Flow node/edge fetching).
