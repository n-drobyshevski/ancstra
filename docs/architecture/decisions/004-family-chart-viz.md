# ADR-004: family-chart as Primary Visualization, Topola for Specialized Views

> Date: 2026-03-21 | Status: **Superseded by [ADR-005](005-react-flow-viz.md)**
>
> **Note:** This ADR has been superseded. React Flow (@xyflow/react) replaces family-chart as the primary interactive visualization. See [ADR-005](005-react-flow-viz.md) for the current decision and rationale.

## Context

Tree visualization is critical to genealogy software. Two mature JavaScript/TypeScript libraries are available:

1. **family-chart** — Interactive D3-based tree viewer with click, zoom, pan, drag interactions
2. **Topola** — Static SVG chart generator supporting 8+ chart types (ancestors, descendants, hourglass, relatives, fancy)

The question: which library should be primary, and how do they complement each other?

Early analysis showed both are actively maintained and well-tested. The trade-off is between interactivity (family-chart) and chart variety (Topola).

## Decision

**Use family-chart as the primary interactive viewer for daily navigation. Use Topola for specialized chart types and export formats (PDF, PNG, SVG).**

| Responsibility | Library | Chart Types | Interaction |
|---|---|---|---|
| **Primary interactive viewer** | family-chart | Pedigree (ancestors), family group sheet | Click to select, zoom, pan, drag to navigate |
| **Specialized views + export** | Topola | Ancestors, descendants, hourglass, relatives, fancy | View-only, export to PDF/PNG/SVG |

Concretely:
- Default view: family-chart pedigree chart (best for understanding lineage)
- Alt views accessible via toolbar: descendants, hourglass, relatives (switch to Topola)
- Export: always via Topola (better PDF output)

## Reasons

1. **family-chart excels at interaction:** D3-based layout responds to clicks, zoom, pan. Essential for daily genealogy work (navigate to person → view their details → jump to spouse → view their line).

2. **Topola excels at variety:** 8 different chart types serve different user needs:
   - Ancestors: classic pedigree (same as family-chart)
   - Descendants: view children/grandchildren downward
   - Hourglass: show both ancestors AND descendants in one view
   - Relatives: show siblings, cousins
   - Fancy: decorated version with photos and colors

3. **Division of labor:** family-chart handles browse/explore; Topola handles "show me a printable chart." No library bloat.

4. **Both libraries are maintained:** Verified via context7 (dependency health check) — active issues, recent commits, community support.

5. **Technical maturity:** Both work well with React/Next.js; both accept our data format (family-chart uses custom `FamilyChartDatum[]`, Topola uses GEDCOM-JSON).

6. **User expectations:** Most genealogy software (Ancestry, FamilySearch, Gramps) offer both interactive browsing AND printable charts. Ancstra aligns with user mental model.

7. **Progressive enhancement:** Start with family-chart interactive viewer (Phase 1). Add Topola specialized views later (Phase 2). Both optional; tree still functional with just one library.

## Consequences

1. **Two visualization libraries to maintain:** Longer initial build time, more dependencies. Mitigation: both are stable; minimal maintenance expected post-integration.

2. **Data adapter required:** Must convert our SQLite schema → family-chart's format AND Topola's format. Section 4.2 details the adapter interface with both mappings.

3. **Performance on large trees:** Both libraries have limits. Mitigation: viewport culling for family-chart, pagination for Topola descendants. Details in Section 4.6 (Performance Strategy).

4. **Chart styling consistency:** family-chart uses its own styling; Topola uses SVG attributes. Users may notice visual differences. Mitigation: minimal — Topola output is mostly for PDF export; users won't compare them side-by-side often.

5. **Testing complexity:** Must test both libraries in concert. Adapter code tested with mock data for both formats.

## Design Details

### Data Adapter Pattern

Our schema is the source of truth. Both libraries expect different formats, so we provide adapters:

```typescript
// Our schema (SQLite)
interface TreeData {
  persons: Map<string, TreePerson>;
  families: Map<string, TreeFamily>;
  rootPersonId: string;
}

// Adapter for family-chart
export function toFamilyChartData(tree: TreeData): FamilyChartDatum[] { ... }

// Adapter for Topola
export function toTopolaData(tree: TreeData): TopolaJsonGedcom { ... }
```

Both adapters are implemented in `packages/db/queries/tree-data.ts` (Section 4.2).

### Component Architecture

```
TreePage (Server Component)
├── TreeToolbar (Client Component)
│   ├── ChartTypeSelector
│   │   └── Options: pedigree (family-chart) | descendants | hourglass | ancestors | relatives (Topola)
│   ├── SearchPersonInput
│   ├── ZoomControls
│   └── ExportButton
├── InteractiveTreeView (Client Component)
│   ├── family-chart Wrapper (if chartType = pedigree | family_group)
│   └── Topola Wrapper (if chartType = descendants | hourglass | ancestors | relatives)
├── PersonDetailPanel
│   └── (slide-out sidebar with person details)
└── MiniMap
    └── (overview for large trees)
```

### Chart Type Selection

**family-chart specializes in:**
- Pedigree (4 generations back)
- Family group (parents + siblings + children)

**Topola specializes in:**
- Ancestors (like pedigree but scrollable)
- Descendants (children → grandchildren downward)
- Hourglass (both directions in one view)
- Relatives (show siblings, cousins, aunts/uncles)
- Fancy (decorated with photos, colors, borders)

**User experience:**
1. Default: family-chart pedigree (loads instantly, interactive)
2. Click toolbar "Chart Type" → dropdown appears
3. Select "Descendants" → Topola SVG renders below
4. Click "Export PDF" → Topola generates PDF download

### Relationship Link Styling (Validation Status)

Both libraries support custom link styling. Links reflect validation status (Section 4.5):

| Status | Line Style | Color | Meaning |
|--------|-----------|-------|---------|
| `confirmed` | Solid line | Gray/black | Validated relationship with justification |
| `proposed` | Dashed line | Blue | AI/API-discovered, pending editor review |
| `disputed` | Dotted line | Amber/yellow | Conflicting evidence, under investigation |

Implementation:
- family-chart: custom SVG path renderer with stroke styles
- Topola: `stroke-dasharray` attributes in exported SVG

### Performance Optimization

Both libraries can struggle with 1000+ node trees. Mitigation strategies:

**family-chart:**
- Viewport culling (only render visible nodes + 1 screen buffer)
- Level-of-detail (distant nodes show simplified boxes; nearby nodes show full detail)
- Lazy-load person details on demand
- Debounced zoom/pan events

**Topola:**
- Generate layouts in Web Worker for 1000+ node trees
- Pagination for descendants view (load generation-by-generation)
- "Load more" buttons instead of rendering everything

### Export Formats

| Format | Library | Use Case | Quality |
|--------|---------|----------|---------|
| **PDF** | Topola (built-in) | Printable charts, 8.5x11 page | Excellent for printing |
| **PNG** | Topola (built-in) or html-to-image | Sharing on social media | Good resolution |
| **SVG** | Topola (built-in) | Vector format for printing, lossless | Best for high-resolution printing |
| **GEDCOM** | Our exporter (Section 3) | Data interchange, backup | Portable format |

## Revisit Triggers

1. **Users heavily request interactive Topola chart:** If 20%+ of feedback is "make descendants chart clickable," evaluate Topola's interactivity extensions or rebuild Topola in D3.

2. **family-chart doesn't scale past 500 nodes:** If performance becomes unacceptable, consider D3-based custom implementation.

3. **Topola library becomes unmaintained:** If no updates for 12+ months and users report bugs, build custom Topola replacement (Topola's source is open; can fork).

4. **Users request 3D visualization:** If demand for 3D family tree emerges, evaluate Three.js or Babylon.js integration (new library, not replacement).

---

## Related Decisions

- **ADR-002:** SQLite + Drizzle (consequence: data adapter pattern enables swapping visualization libraries)
- **Section 4 (Tree Visualization):** Full implementation details, component architecture, performance strategy
- **Section 3 (GEDCOM Export):** Topola can export GEDCOM; matches our exporter output
