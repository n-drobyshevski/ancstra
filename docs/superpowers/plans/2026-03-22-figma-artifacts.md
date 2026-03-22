# Figma Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 20 Figma frames (6 user flow diagrams + 14 design system frames) in the existing Ancstra design file.

**Architecture:** Build each frame as a standalone HTML page with inline SVG/CSS, serve locally, capture into Figma via `generate_figma_design` MCP tool. A shared CSS file provides the A4 Ancstra Branded visual style. Each task produces one HTML file and one Figma capture.

**Tech Stack:** HTML/SVG/CSS (static pages), Figma MCP (`generate_figma_design`), local HTTP server (visual companion or `npx serve`), Lucide icons (CDN SVG sprites)

**Spec:** `docs/superpowers/specs/2026-03-22-figma-artifacts-design.md`

**Figma File:** `TODiDe7Q8soPIol7zmC0r9` (Ancstr)

---

## File Structure

All HTML artifacts live in `.superpowers/figma-pages/`. This directory is ephemeral (gitignored via `.superpowers/`). Each file is a self-contained HTML page that can be opened directly in a browser or served via HTTP for Figma capture.

```
.superpowers/figma-pages/
  shared-styles.css            ← A4 Ancstra Branded tokens + flow diagram classes
  flow-2.1-add-person.html     ← User flow: Add Person
  flow-2.2-import-gedcom.html  ← User flow: Import GEDCOM
  flow-2.3-navigate-tree.html  ← User flow: Navigate Tree
  flow-2.4-search-filter.html  ← User flow: Search & Filter
  flow-2.5-edit-person.html    ← User flow: Edit Person
  flow-2.6-link-relationships.html ← User flow: Link Relationships
  ds-6.1-color-palette.html    ← Design system: Color Palette
  ds-6.2-semantic-colors.html  ← Design system: Semantic Colors
  ds-6.3-typography.html       ← Design system: Typography Scale
  ds-6.4-spacing-grid.html     ← Design system: Spacing & Grid
  ds-6.5-radius-shadows.html   ← Design system: Border Radius & Shadows
  ds-6.6-icon-set.html         ← Design system: Icon Set
  ds-6.7-date-input.html       ← Custom component: DateInput
  ds-6.8-place-input.html      ← Custom component: PlaceInput
  ds-6.9-person-select.html    ← Custom component: PersonSelect
  ds-6.10-tree-node.html       ← Custom component: TreeNode / PersonNode
  ds-6.11-relationship-lines.html ← Custom component: Relationship Lines
  ds-6.12-tree-minimap.html    ← Custom component: TreeMiniMap
  ds-6.13-completion.html      ← Custom component: CompletionBar + Ring
  ds-6.14-event-timeline.html  ← Custom component: EventTimeline
```

---

## Figma Capture Workflow

Every task that captures to Figma follows this pattern:

```
1. Call generate_figma_design with outputMode: "existingFile", fileKey: "TODiDe7Q8soPIol7zmC0r9"
   → Returns a captureId and a capture URL
2. Open the capture URL in a browser (Playwright or manual)
3. Navigate to the local HTML page URL (e.g., http://localhost:PORT/flow-2.1-add-person.html)
4. Use the Figma capture toolbar to capture the page
5. Poll generate_figma_design with the captureId until status is "completed"
```

If the capture toolbar requires manual interaction, instruct the user to:
1. Open the capture URL
2. Navigate to the HTML page
3. Click "Capture" in the Figma toolbar
4. Confirm in terminal when done

---

## Task 0: Shared Style Foundation

**Files:**
- Create: `.superpowers/figma-pages/shared-styles.css`

- [ ] **Step 1: Create the figma-pages directory**

```bash
mkdir -p .superpowers/figma-pages
```

- [ ] **Step 2: Write shared-styles.css**

Create `.superpowers/figma-pages/shared-styles.css` with:

```css
/* A4 Ancstra Branded — Flow Diagram & Design System Styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  /* Flow diagram tokens */
  --flow-start-fill: #e8f5e9;
  --flow-start-stroke: #4caf50;
  --flow-start-text: #2e7d32;

  --flow-screen-fill: #e3f2fd;
  --flow-screen-stroke: #5c7cba;
  --flow-screen-text: #1a3a5c;
  --flow-screen-label: #5c7cba;
  --flow-screen-accent: #5c7cba;

  --flow-decision-fill: #fff8e1;
  --flow-decision-stroke: #f9a825;
  --flow-decision-text: #e65100;

  --flow-error-fill: #ffebee;
  --flow-error-stroke: #ef5350;
  --flow-error-text: #c62828;

  --flow-annotation-fill: #f5f5f5;
  --flow-annotation-stroke: #bdbdbd;
  --flow-annotation-text: #757575;

  --flow-action-fill: #fff8e1;
  --flow-action-stroke: #f9a825;
  --flow-action-text: #e65100;

  --flow-line: #b0bec5;
  --flow-arrow: #90a4ae;

  /* Ancstra design system tokens (OKLCH approximated to hex for HTML rendering) */
  --primary: #4a6fa5;
  --primary-fg: #f5f7fa;
  --secondary: #5a9a6a;
  --secondary-fg: #f5faf6;
  --accent: #c4923a;
  --accent-fg: #2a1f0f;
  --destructive: #c0392b;
  --destructive-fg: #faf2f2;
  --background: #f8f9fb;
  --card: #ffffff;
  --muted: #eef0f4;
  --foreground: #1a2332;
  --card-fg: #1a2332;
  --muted-fg: #6b7a8d;
  --border: #dce0e8;
  --ring: #4a6fa5;

  /* Sex indicators */
  --sex-male: #4a7fd4;
  --sex-female: #d46aa0;
  --sex-unknown: #8a95a5;

  /* Validation */
  --status-confirmed: #3a8a5a;
  --status-proposed: #4a7fd4;
  --status-disputed: #b8912a;

  /* Completion */
  --completion-low: #c0392b;
  --completion-medium: #b8912a;
  --completion-high: #3a8a5a;

  --living-badge: #3a8a5a;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #ffffff;
  color: var(--foreground);
}

/* Frame container — each page is one Figma frame */
.frame {
  padding: 48px;
  background: #ffffff;
  min-height: 100vh;
}

.frame-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 8px;
}

.frame-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: var(--muted-fg);
  margin-bottom: 32px;
}

/* Flow diagram legend */
.legend {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: #f8f9fb;
  border-radius: 8px;
  margin-bottom: 32px;
  border: 1px solid var(--border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-fg);
}

.legend-swatch {
  width: 32px;
  height: 18px;
  border-radius: 4px;
}

.legend-swatch.start { background: var(--flow-start-fill); border: 1.5px solid var(--flow-start-stroke); border-radius: 9px; }
.legend-swatch.screen { background: var(--flow-screen-fill); border: 1.5px solid var(--flow-screen-stroke); }
.legend-swatch.decision { background: var(--flow-decision-fill); border: 1.5px solid var(--flow-decision-stroke); transform: rotate(45deg); width: 16px; height: 16px; }
.legend-swatch.error { background: var(--flow-error-fill); border: 1.5px solid var(--flow-error-stroke); }
.legend-swatch.annotation { background: var(--flow-annotation-fill); border: 1.5px dashed var(--flow-annotation-stroke); }
.legend-swatch.action { background: var(--flow-action-fill); border: 1px solid var(--flow-action-stroke); border-radius: 9px; }

/* Design system swatch grid */
.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.swatch-color {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.swatch-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.swatch-value {
  font-size: 10px;
  color: var(--muted-fg);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

/* Section headers within design system frames */
.section-header {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin: 24px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.section-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

/* Component specimen container */
.specimen {
  padding: 24px;
  background: #f8f9fb;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.specimen-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-fg);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
```

- [ ] **Step 3: Verify shared styles load in browser**

Create a minimal test HTML page, open in browser, confirm Inter font loads and CSS variables resolve.

```bash
# Start a local server to serve the figma-pages directory
npx serve .superpowers/figma-pages -l 3333 &
# Open http://localhost:3333 in browser
```

- [ ] **Step 4: Verify file exists**

```bash
ls -la .superpowers/figma-pages/shared-styles.css
```

Expected: file exists with CSS content. No git commit needed — `.superpowers/` is gitignored (ephemeral build artifacts).

---

## Task 1: Flow 2.1 — Add Person (Manual Entry)

**Files:**
- Create: `.superpowers/figma-pages/flow-2.1-add-person.html`

This is the first flow and serves as the **capture quality validation**. If the Figma capture doesn't look right, we adjust the HTML/CSS before building the remaining 5 flows.

- [ ] **Step 1: Write the HTML page**

Create `.superpowers/figma-pages/flow-2.1-add-person.html` — a full HTML document that:

1. Links `shared-styles.css`
2. Contains an SVG diagram (~1200x900) with the A4 branded style
3. Includes all nodes from the spec:
   - START (green pill)
   - Dashboard or Tree View (blue screen node with SCREEN label + accent bar)
   - Decision: "Global or Contextual?" (yellow diamond)
   - Global path: "Add Person" action pill → /person/new screen
   - Contextual path: Person Detail Panel screen → "Add Father/Mother/Spouse/Child" action → Decision: "Search existing or Create new?" → two branches
   - Converge: Form validation action → Person created screen (/person/[id]) → "Add Relative" prompt annotation
   - END (green pill)
4. Shape legend in top-right corner
5. Flow number + title as frame header: "2.1 Add Person (Manual Entry)"

SVG layout guidance:
- Main spine flows top-to-bottom
- Decision branches go left/right then rejoin below
- Use `<marker>` elements for arrowheads
- Screen nodes: rect with rx=8, 4px left accent bar as a separate narrow rect
- Decision nodes: rect rotated 45deg (or `<polygon>` diamond)
- Action pills: rect with rx=17, amber fill
- Connector lines: stroke `#b0bec5` 1.5px
- All text uses Inter font-family

- [ ] **Step 2: Preview in browser**

Open `http://localhost:3333/flow-2.1-add-person.html` (or use the visual companion server). Verify:
- All nodes render correctly
- Text is readable at 100% zoom
- Layout has no overlapping elements
- Colors match the A4 style table from the spec
- Legend is visible and accurate

Ask user to confirm the flow looks correct before capture.

- [ ] **Step 3: Capture into Figma**

```
1. Call generate_figma_design with:
   - outputMode: "existingFile"
   - fileKey: "TODiDe7Q8soPIol7zmC0r9"
   (omit nodeId to create a new page)

2. Returns captureId + capture URL

3. Navigate browser to capture URL
4. In the capture toolbar, navigate to the local HTML page URL
5. Capture the page

6. Poll generate_figma_design with captureId until status: "completed"
```

- [ ] **Step 4: Verify capture in Figma**

Ask user to check the captured frame in Figma:
- Does it look like the HTML preview?
- Are fonts rendering correctly?
- Are SVG shapes crisp (not rasterized)?
- Is the frame on a new page (we'll rename pages later)?

If issues found, adjust HTML and re-capture before proceeding.

- [ ] **Step 5: Checkpoint — confirm capture quality**

This is the gate. If the capture quality is acceptable, proceed with remaining flows. If not, debug and fix the HTML/CSS approach.

---

## Task 2: Flows 2.2–2.6 (Remaining 5 Flows)

**Files:**
- Create: `.superpowers/figma-pages/flow-2.2-import-gedcom.html`
- Create: `.superpowers/figma-pages/flow-2.3-navigate-tree.html`
- Create: `.superpowers/figma-pages/flow-2.4-search-filter.html`
- Create: `.superpowers/figma-pages/flow-2.5-edit-person.html`
- Create: `.superpowers/figma-pages/flow-2.6-link-relationships.html`

These 5 flows can be built in parallel by subagents since they share the same styles and are independent.

**Prerequisite:** Ensure local HTTP server is running on `.superpowers/figma-pages/` (e.g., `npx serve .superpowers/figma-pages -l 3333`). Follow the Figma Capture Workflow described in the top-level section for all captures.

- [ ] **Step 1: Build flow-2.2-import-gedcom.html**

Linear 5-step wizard layout (~1200x700). Nodes flow top-to-bottom:
- START → Import sidebar action → 5 sequential screens (Upload, Processing, Preview, Confirm, Success) → View Tree action → /tree screen → END
- Minimal branching — mostly a straight vertical flow
- Each wizard step screen labeled "Step N: [Name]"

- [ ] **Step 2: Build flow-2.3-navigate-tree.html**

Hub-and-spoke layout (~1400x800). Central hub is `/tree` screen with 8 parallel actions radiating outward:
- Zoom, Pan, Click node (→ Person Detail Sheet → Focus), Switch view, Drag node, Minimap click, Breadcrumb click, Export dropdown
- Use a radial/fan layout from the central /tree node
- Person Detail Sheet is a secondary screen node connected from "Click node"

- [ ] **Step 3: Build flow-2.4-search-filter.html**

Two-path layout (~1200x800):
- PATH A (left): Cmd+K → Command palette → Typeahead → Decision (Found?) → Yes: Person Detail / Partial: → PATH B
- PATH B (right): /search page → Filters + Results → Click result → Person Detail
- Both paths converge at Person Detail screen at bottom

- [ ] **Step 4: Build flow-2.5-edit-person.html**

Two-entry convergence (~1200x700):
- PATH A (left): Person Detail Panel → Click "Edit" action
- PATH B (right): Direct URL /person/[id]/edit screen
- Converge at edit form → Save action → Decision (Valid?) → Yes: success / No: inline errors

- [ ] **Step 5: Build flow-2.6-link-relationships.html**

Three-branch decision tree (~1400x900). Most complex flow:
- Person Detail → "Add Relative" action → Decision (Which type?)
- Three branches: Spouse (modal → search/create → type → save), Parent (search/create → decision: existing family? → save), Child (decision: multiple spouses? → search/create → type → save)
- Each branch ends with a "tree updates" annotation

- [ ] **Step 6: Preview all 5 flows in browser**

Open each URL and verify layout, readability, style consistency with Flow 2.1.

- [ ] **Step 7: Capture all 5 flows into Figma**

For each flow (2.2 through 2.6):
1. Call `generate_figma_design` with `outputMode: "existingFile"`, `fileKey: "TODiDe7Q8soPIol7zmC0r9"`
2. Navigate to the HTML page, capture
3. Poll until completed

- [ ] **Step 8: Verify all 6 flows in Figma**

Check that all 6 flow frames are present in the file. They may be on separate auto-created pages — that's fine, we'll organize pages in the final task.

---

## Task 3: Design System Foundations (Frames 6.1–6.6)

**Files:**
- Create: `.superpowers/figma-pages/ds-6.1-color-palette.html`
- Create: `.superpowers/figma-pages/ds-6.2-semantic-colors.html`
- Create: `.superpowers/figma-pages/ds-6.3-typography.html`
- Create: `.superpowers/figma-pages/ds-6.4-spacing-grid.html`
- Create: `.superpowers/figma-pages/ds-6.5-radius-shadows.html`
- Create: `.superpowers/figma-pages/ds-6.6-icon-set.html`

These 6 can be built in parallel.

**Prerequisite:** Ensure local HTTP server is running on `.superpowers/figma-pages/`. Follow the Figma Capture Workflow described in the top-level section for all captures.

- [ ] **Step 1: Build ds-6.1-color-palette.html (~1400x600)**

Two side-by-side sections: "Light Mode" and "Dark Mode".

Each section has a grid of swatches (80x80px rounded rects). 8 rows:
- Primary: `--primary` oklch(0.55 0.15 250), `--primary-foreground` oklch(0.98 0.005 250)
- Secondary: `--secondary` oklch(0.65 0.10 150), `--secondary-foreground` oklch(0.98 0.005 150)
- Accent: `--accent` oklch(0.70 0.12 50), `--accent-foreground` oklch(0.20 0.02 50)
- Destructive: `--destructive` oklch(0.55 0.20 25), `--destructive-foreground` oklch(0.98 0.005 25)
- Surfaces: `--background`, `--card`, `--popover`, `--muted`
- Text: `--foreground`, `--card-foreground`, `--muted-foreground`
- Borders: `--border`, `--input`, `--ring`
- Sidebar: `--sidebar-background`, `--sidebar-foreground`, `--sidebar-accent`

Below each swatch: variable name (monospace) + OKLCH value.

Use actual `oklch()` CSS for fills where browser supports it, with hex fallback.

- [ ] **Step 2: Build ds-6.2-semantic-colors.html (~1200x500)**

4 category rows, each with swatches + mini usage example:

- **Sex indicators:** 3 swatches (male blue, female pink, unknown gray). Usage example: 3 mini tree node outlines with colored left borders.
- **Validation statuses:** 3 swatches (confirmed green, proposed blue, disputed amber). Usage example: 3 short line segments (solid, dashed, dotted) in respective colors.
- **Completion:** 3 swatches (low red, medium amber, high green). Usage example: 3 progress bars at 15%, 50%, 85%.
- **Living badge:** 1 swatch (green). Usage example: small "Living" badge.

Light + dark variants side by side.

- [ ] **Step 3: Build ds-6.3-typography.html (~1200x500)**

7 rows, each showing:
- Token name in monospace (left column, fixed width)
- Specimen text at actual rendered size and weight (middle, fluid)
- Size / Weight / Line-height / Usage metadata (right column, muted text)

Rows per spec:
1. `text-xs` 12px/400 — "Last modified 3 hours ago" — Metadata
2. `text-sm` 14px/500 — "Given Name" — Form labels
3. `text-base` 16px/400 — "John was born in Springfield, Illinois on March 15, 1872." — Body
4. `text-lg` 18px/600 — "John William Smith" — Person name
5. `text-xl` 20px/600 — "Family Tree" — Page titles
6. `text-2xl` 24px/700 — "456" — Dashboard stats
7. `text-3xl` 30px/700 — "Welcome to Ancstra" — Landing

Plus a font stack section at top: "Inter (system-ui fallback)" for UI, mono specimen for dates/IDs.

- [ ] **Step 4: Build ds-6.4-spacing-grid.html (~1400x600)**

Three sections:

**A. Base unit ruler:** Horizontal bar with markings at 4, 8, 12, 16, 24, 32, 48, 64px. Each segment colored and labeled.

**B. Layout diagrams (3 breakpoints):** Side-by-side wireframe boxes showing:
- Desktop (1280px): sidebar 240px | main fluid | detail panel 400px, top bar 56px
- Tablet (768px): sidebar 64px | main fluid | detail panel 50%, top bar 56px
- Mobile (375px): full-width main, top bar 56px, bottom tab bar 64px

**C. Spacing tokens:** Visual examples of card padding (p-4, p-6), form gap (space-y-4), page padding (px-6 py-8 desktop, px-4 py-4 mobile).

- [ ] **Step 5: Build ds-6.5-radius-shadows.html (~1000x400)**

Two rows:

**Border radius specimens:** 4 boxes side by side, each 100x80px:
- `rounded-md` (6px) with label "Buttons, Inputs"
- `rounded-lg` (8px) with label "Cards, Tree Nodes"
- `rounded-xl` (12px) with label "Modals, Sheets"
- `rounded-full` (50%) circle with label "Avatars, Badges"

**Shadow specimens:** 4 boxes on a light gray background:
- `shadow-sm` with label "Cards"
- `shadow-md` with label "Dropdowns, Hover"
- `shadow-lg` with label "Modals"
- `ring-2 ring-primary` with label "Selected State" (blue ring outline)

- [ ] **Step 6: Build ds-6.6-icon-set.html (~1200x500)**

Grid of 38 Lucide icons at 20px. Use Lucide CDN: `https://unpkg.com/lucide-static/icons/`.

9 category groups with header labels:
- Person (3), Navigation (6), Actions (6), Data (4), Privacy (2), Zoom (3), Theme (2), Events (8), Feedback (4)

Each icon: 20px SVG centered in a 48x60px cell, with name label below in text-xs.

- [ ] **Step 7: Preview all 6 foundation frames in browser**

Verify each page renders correctly, consistent styling.

- [ ] **Step 8: Capture all 6 into Figma**

For each (6.1 through 6.6):
1. `generate_figma_design` with `outputMode: "existingFile"`, `fileKey: "TODiDe7Q8soPIol7zmC0r9"`
2. Navigate, capture, poll until completed.

---

## Task 4: Custom Components (Frames 6.7–6.14)

**Files:**
- Create: `.superpowers/figma-pages/ds-6.7-date-input.html`
- Create: `.superpowers/figma-pages/ds-6.8-place-input.html`
- Create: `.superpowers/figma-pages/ds-6.9-person-select.html`
- Create: `.superpowers/figma-pages/ds-6.10-tree-node.html`
- Create: `.superpowers/figma-pages/ds-6.11-relationship-lines.html`
- Create: `.superpowers/figma-pages/ds-6.12-tree-minimap.html`
- Create: `.superpowers/figma-pages/ds-6.13-completion.html`
- Create: `.superpowers/figma-pages/ds-6.14-event-timeline.html`

These 8 can be built in parallel.

**Prerequisite:** Ensure local HTTP server is running on `.superpowers/figma-pages/`. Follow the Figma Capture Workflow described in the top-level section for all captures.

- [ ] **Step 1: Build ds-6.7-date-input.html (~800x400)**

4 specimen rows showing different modifier states:

1. **Exact:** `[Exact ▾]` select + `[15 Mar 1872]` input → "Interpreted: 15 March 1872" helper text
2. **Between:** `[Between ▾]` select + `[Jan 1880]` input + "and" label + `[Dec 1885]` input → helper text
3. **About:** `[About ▾]` select + `[1880]` input → helper text
4. **Before/After:** `[Before ▾]` + `[1900]` and `[After ▾]` + `[1850]` side by side

Style inputs with: rounded-md border, border-color var(--border), focus ring. Select with chevron-down icon. Helper text in text-xs muted.

- [ ] **Step 2: Build ds-6.8-place-input.html (~800x400)**

4 states stacked vertically:

1. **Idle:** Input with MapPin icon, placeholder "Search for a place..."
2. **Typing:** Input with "Springfield" typed, subtle loading spinner
3. **Results dropdown:** Input + dropdown below with 3 results: "Springfield, Sangamon, Illinois, USA", "Springfield, Clark, Ohio, USA", "Springfield, Hampden, Massachusetts, USA" — each in text-sm with hierarchical formatting
4. **Add new:** Same dropdown but with "+ Add 'Springfield' as new place" option at bottom, styled as a subtle action link

- [ ] **Step 3: Build ds-6.9-person-select.html (~800x400)**

3 states stacked:

1. **Idle:** Input with Search icon, placeholder "Search for a person..."
2. **Results:** Input with "John" typed + dropdown with 3 results. Each result row: 32px avatar circle (initials "JS", "JW", "JA"), full name in text-sm semibold, life dates in text-xs muted (e.g., "1845-1923")
3. **Create new:** Same dropdown + "+ Create New Person" button at bottom with UserPlus icon

- [ ] **Step 4: Build ds-6.10-tree-node.html (~1000x500)**

3x4 variant matrix (12 total nodes):

Columns: Male, Female, Unknown
Rows: Default, Hover, Selected, Living

Each node (~180x80px):
- 4px left border in sex color (blue/pink/gray)
- 32px avatar circle with initials
- Name: "John Smith" / "Mary Johnson" / "Pat Morgan" in text-sm semibold
- Dates: "1845 - 1923" in text-xs muted
- Completion bar at bottom (width varies: 80%, 45%, 20%)
- Hover state: shadow-md
- Selected state: ring-2 ring-primary (blue outline)
- Living state: name shown, dates replaced with "Living" badge in green

- [ ] **Step 5: Build ds-6.11-relationship-lines.html (~800x300)**

3 horizontal specimens, each showing two mini tree nodes connected by a line:

1. **Confirmed:** Solid line, stroke `var(--status-confirmed)` color, label "Confirmed" in green badge
2. **Proposed:** Dashed line (dasharray: 8 4), stroke `var(--status-proposed)` color, label "Proposed" in blue badge
3. **Disputed:** Dotted line (dasharray: 2 2), stroke `var(--status-disputed)` color, label "Disputed" in amber badge

Mini tree nodes are simplified: just a small rect with a name inside.

- [ ] **Step 6: Build ds-6.12-tree-minimap.html (~600x400)**

Single specimen showing a minimap in context:

- Large light gray rectangle (representing the tree canvas area, ~500x300)
- Inside: scattered small dots (8-12) connected by thin lines (representing a simplified tree)
- A semi-transparent blue rectangle (~120x80) representing the viewport, positioned in the lower-right quadrant
- Below the minimap: label "TreeMiniMap — bottom-right corner overlay"
- Note: "Click to jump, drag viewport to pan"

- [ ] **Step 7: Build ds-6.13-completion.html (~800x300)**

Two rows:

**Bar variant:** 3 progress bars side by side:
- 15% filled, red (`--completion-low`), label "Low (<25%)"
- 50% filled, amber (`--completion-medium`), label "Medium (25-75%)"
- 85% filled, green (`--completion-high`), label "High (>75%)"
Each bar: 160px wide, 6px tall, rounded-full, gray background track.

**Ring variant:** 3 circular progress rings side by side:
- 15% ring, red, "15%" text in center
- 50% ring, amber, "50%" text in center
- 85% ring, green, "85%" text in center
Each ring: 64px diameter, 4px stroke width, SVG circle with stroke-dashoffset.

- [ ] **Step 8: Build ds-6.14-event-timeline.html (~800x500)**

Vertical timeline with 5 events + add button:

Each event row:
- Vertical timeline line (2px, gray) on the left
- Timeline dot (8px circle, colored by event type) at the junction
- Lucide icon (20px) next to the dot
- Event text: type in text-sm semibold, date + place in text-sm, optional description in text-xs muted

Events:
1. Birth (Baby icon, green dot) — "15 Mar 1845, Springfield, IL"
2. Baptism (Church icon, blue dot) — "20 Mar 1845, First Baptist Church"
3. Marriage (Heart icon, pink dot) — "12 Jun 1870, Chicago, IL" + "to Mary Johnson"
4. Residence (House icon, gray dot) — "1880, Cook County, IL" + "Census record"
5. Death (Cross icon, dark dot) — "23 Nov 1923, Chicago, IL"

At bottom: "+ Add Event" button (outline variant, Plus icon).

- [ ] **Step 9: Preview all 8 custom component frames**

Verify each renders correctly with consistent styling.

- [ ] **Step 10: Capture all 8 into Figma**

For each (6.7 through 6.14):
1. `generate_figma_design` with `outputMode: "existingFile"`, `fileKey: "TODiDe7Q8soPIol7zmC0r9"`
2. Navigate, capture, poll until completed.

---

## Task 5: Organize Figma Pages

After all captures are complete, the file will have auto-created pages from each capture. This task organizes them into the planned 12-page structure.

- [ ] **Step 1: Take inventory of captured pages**

Use `get_metadata` on the file root to list all pages and their node IDs.

```
mcp: get_metadata(fileKey: "TODiDe7Q8soPIol7zmC0r9", nodeId: "0:1")
```

- [ ] **Step 2: Create placeholder pages**

The target structure has 12 pages. Some may already exist from captures. Create any missing placeholder pages. Each placeholder gets a single text frame with the page name centered.

Target page list:
```
 0. Cover
 1. Research
 2. User Flows
 3. Wireframes-Desktop
 4. Wireframes-Mobile
 5. Wireframes-Tablet
 6. Design System
 7. Hi-Fi Desktop
 8. Hi-Fi Mobile
 9. Hi-Fi Tablet
10. Prototypes
11. UX Roadmap
```

- [ ] **Step 3: Organize captured frames**

Move/rename frames so that:
- All 6 flow diagram frames are on the "2. User Flows" page
- All 14 design system frames are on the "6. Design System" page
- Each frame is labeled with its number + name (e.g., "2.1 Add Person (Manual Entry)")

Note: This may require manual work in Figma by the user if the MCP tools don't support page reorganization. If so, provide the user with exact instructions for which frames to move where.

- [ ] **Step 4: Final verification**

Use `get_screenshot` on key pages to verify the organized structure looks correct:
```
mcp: get_screenshot(fileKey: "TODiDe7Q8soPIol7zmC0r9", nodeId: "[page-2-id]")
mcp: get_screenshot(fileKey: "TODiDe7Q8soPIol7zmC0r9", nodeId: "[page-6-id]")
```

- [ ] **Step 5: Report completion**

Summarize to user:
- Total frames captured: 20
- Pages organized: 12 (2 active + 10 placeholder)
- Link to Figma file for final review
- Note: pass 2 items (error branches, shadcn components, dark mode variants) are deferred

---

## Summary

| Task | Frames | Parallelizable |
|------|--------|----------------|
| 0: Shared styles | 0 (foundation) | No (prerequisite) |
| 1: Flow 2.1 | 1 (quality gate) | No (must validate first) |
| 2: Flows 2.2-2.6 | 5 | Yes (all 5 independent) |
| 3: DS Foundations 6.1-6.6 | 6 | Yes (all 6 independent, also parallel with Task 2) |
| 4: Custom Components 6.7-6.14 | 8 | Yes (all 8 independent, also parallel with Tasks 2-3) |
| 5: Organize pages | 0 (structure) | No (requires all captures) |

**Critical path:** Task 0 → Task 1 (quality gate) → Tasks 2+3+4 in parallel → Task 5

**Total frames:** 20
