# Phase 0 Remaining Work: Exhaustive Figma Design Sprint Plan

> Covers Steps 0.3 (Figma flow diagrams), 0.4 (Figma design system), 0.5 (Lo-Fi Wireframes), and 0.6 (Hi-Fi Mockups).
> All markdown deliverables are DONE. This plan covers the visual/Figma artifacts only.

---

## Table of Contents

1. [Figma File Organization](#1-figma-file-organization)
2. [Step 0.3R: User Flow Diagrams in Figma](#2-step-03r-user-flow-diagrams-in-figma)
3. [Step 0.4R: Design System in Figma](#3-step-04r-design-system-in-figma)
4. [Step 0.5: Lo-Fi Wireframes](#4-step-05-lo-fi-wireframes)
5. [Step 0.6: Hi-Fi Mockups](#5-step-06-hi-fi-mockups)
6. [Dependency Graph](#6-dependency-graph)
7. [State Matrix (All Screens)](#7-state-matrix-all-screens)
8. [Responsive Breakpoint Specifications](#8-responsive-breakpoint-specifications)
9. [Dark Mode Specifications](#9-dark-mode-specifications)
10. [Accessibility Checklist Per Screen](#10-accessibility-checklist-per-screen)
11. [Design Token Mapping](#11-design-token-mapping)
12. [Edge Cases and Open Questions](#12-edge-cases-and-open-questions)

---

## 1. Figma File Organization

### Naming Convention

- **Pages** prefixed with number: `0. Cover`, `1. Research`, `2. User Flows`, etc.
- **Frames** use format: `[Screen] / [Variant] / [State]` -- e.g., `Dashboard / Desktop / Default`
- **Components** use format: `[Category] / [Name] / [Variant]` -- e.g., `Tree / PersonNode / Male-Selected`
- **Color styles** use format: `[Role] / [Variant]` -- e.g., `Primary / Default`, `Primary / Foreground`
- **Text styles** use format: `[Semantic] / [Size]` -- e.g., `Heading / H1`, `Body / Base`
- **Effect styles** use format: `Shadow / [Level]` -- e.g., `Shadow / SM`, `Shadow / LG`

### Page Structure (Expanded from phase-0-design.md)

```
Ancstra Design
|-- 0. Cover
|   |-- Project info frame (name, version, date, phase, status)
|   |-- Table of contents with page links
|
|-- 1. Research (reference only -- screenshots + notes)
|   |-- Competitive Analysis Board (6 competitor screenshots annotated)
|   |-- Proto-Personas (3 cards with photos, needs, goals)
|
|-- 2. User Flows (6 flow diagrams)
|   |-- Flow 1: Add Person (Manual Entry)
|   |-- Flow 2: Import GEDCOM
|   |-- Flow 3: Navigate Tree
|   |-- Flow 4: Search & Filter
|   |-- Flow 5: Edit Person
|   |-- Flow 6: Link Relationships
|
|-- 3. Wireframes-Desktop (1280px frames)
|   |-- 3.1 Dashboard / Default
|   |-- 3.2 Dashboard / Empty State
|   |-- 3.3 Tree View / Default (populated)
|   |-- 3.4 Tree View / Empty State
|   |-- 3.5 Tree View / Single Person
|   |-- 3.6 Tree View / Large Tree (1000+)
|   |-- 3.7 Person Detail Panel (Sheet, right)
|   |-- 3.8 Person Create Form
|   |-- 3.9 Person Edit Form
|   |-- 3.10 GEDCOM Import / Step 1 Upload
|   |-- 3.11 GEDCOM Import / Step 2 Processing
|   |-- 3.12 GEDCOM Import / Step 3 Preview
|   |-- 3.13 GEDCOM Import / Step 4 Confirm
|   |-- 3.14 GEDCOM Import / Step 5 Success
|   |-- 3.15 GEDCOM Import / Error States
|   |-- 3.16 GEDCOM Export / Default
|   |-- 3.17 GEDCOM Export / Privacy Preview
|   |-- 3.18 Search Results / With Results
|   |-- 3.19 Search Results / No Results
|   |-- 3.20 Search Results / With Filters Active
|   |-- 3.21 Command Palette (Cmd+K overlay)
|   |-- 3.22 Settings / Profile
|   |-- 3.23 Settings / Privacy
|   |-- 3.24 Settings / Data
|
|-- 4. Wireframes-Mobile (375px frames)
|   |-- 4.1 Dashboard / Default
|   |-- 4.2 Dashboard / Empty State
|   |-- 4.3 Tree View / Default
|   |-- 4.4 Tree View / With Bottom Sheet
|   |-- 4.5 Person Detail (Full Screen Drawer, 90vh)
|   |-- 4.6 Person Create Form (single column)
|   |-- 4.7 GEDCOM Import (all steps, stacked)
|   |-- 4.8 Search Results
|   |-- 4.9 Search Filters (Bottom Sheet)
|   |-- 4.10 Settings
|   |-- 4.11 Bottom Tab Bar (all states)
|
|-- 5. Wireframes-Tablet (768px frames)
|   |-- 5.1 Tree View (collapsed sidebar, 50% detail panel)
|   |-- 5.2 Dashboard
|   |-- 5.3 Forms (two-column layout)
|
|-- 6. Design System
|   |-- 6.1 Color Palette (OKLCH swatches, light + dark)
|   |-- 6.2 Genealogy Semantic Colors (sex, validation, completion, living)
|   |-- 6.3 Typography Scale (all sizes with specimens)
|   |-- 6.4 Spacing & Grid (8px grid overlay, layout dimensions)
|   |-- 6.5 Border Radius specimens
|   |-- 6.6 Shadow specimens
|   |-- 6.7 Icon Set (Lucide mappings with labels)
|   |-- 6.8 Component Library -- Base (shadcn/ui)
|   |     |-- Button (all variants x sizes x states)
|   |     |-- Input (default, focused, error, disabled)
|   |     |-- Select (closed, open, with selection)
|   |     |-- Textarea
|   |     |-- Sheet (right panel)
|   |     |-- Tabs (active, inactive, disabled)
|   |     |-- Command Palette
|   |     |-- Progress Bar
|   |     |-- Toast / Sonner (success, error, warning, info)
|   |     |-- AlertDialog (default, destructive)
|   |     |-- Sidebar (expanded, collapsed)
|   |     |-- Breadcrumb
|   |     |-- Table (with sort, pagination)
|   |     |-- Badge (all variants)
|   |     |-- Avatar (photo, initials, fallback icon)
|   |     |-- Skeleton (card, text line, avatar)
|   |     |-- Accordion (open, closed)
|   |     |-- Checkbox, RadioGroup, Switch
|   |     |-- Popover, Tooltip, Dialog
|   |     |-- DropdownMenu
|   |     |-- Separator
|   |     |-- Card
|   |-- 6.9 Component Library -- Custom
|   |     |-- DateInput (all modifier states)
|   |     |-- PlaceInput (idle, searching, results, new place)
|   |     |-- PersonSelect (idle, searching, results, create new)
|   |     |-- TreeNode / PersonNode (all variants)
|   |     |-- ParentChildEdge (confirmed, proposed, disputed)
|   |     |-- PartnerEdge (horizontal, with marriage label)
|   |     |-- TreeMiniMap
|   |     |-- CompletionBar (low, medium, high) + CompletionRing
|   |     |-- EventTimeline (populated, empty, single event)
|   |-- 6.10 Dark Mode Variants (all components)
|
|-- 7. Hi-Fi Mockups-Desktop (1280px)
|   |-- (mirrors wireframe numbering with full styling applied)
|   |-- 7.1 through 7.24 (same screens as Section 3, styled)
|   |-- 7.25 Dashboard / Dark Mode
|   |-- 7.26 Tree View / Dark Mode
|
|-- 8. Hi-Fi Mockups-Mobile (375px)
|   |-- 8.1 through 8.11 (same as Section 4, styled)
|
|-- 9. Hi-Fi Mockups-Tablet (768px)
|   |-- 9.1 through 9.3 (same as Section 5, styled)
|
|-- 10. Interactive Prototypes
|   |-- Prototype 1: Add Person from Tree (click tree node -> detail panel -> add relative -> form -> save -> tree updates)
|   |-- Prototype 2: GEDCOM Import (5-step wizard)
|   |-- Prototype 3: Search -> Select -> View Detail
|
|-- 11. UX Roadmap (Phases 2-5)
|   |-- Phase 2 wireframe sketches (match queue, chat panel)
|   |-- Phase 3 wireframe sketches (document viewer, OCR)
|   |-- Phase 4 wireframe sketches (face tagging, chromosome browser)
|   |-- Phase 5 wireframe sketches (invite, activity feed)
```

---

## 2. Step 0.3R: User Flow Diagrams in Figma

**Estimated time: 1 day** (the markdown flows exist; this is diagramming them visually)

### Deliverables

For each of the 6 flows, create a FigJam-style flow diagram using connected shapes. Each diagram includes:

- **Start node** (rounded green rectangle)
- **Screen/page nodes** (rectangles, labeled with route)
- **Decision diamonds** (yellow)
- **Action labels** on connecting arrows
- **Error/edge-case branches** (red connecting lines to error state rectangles)
- **Annotations** for state transitions (gray callouts)

### Flow 1: Add Person (Manual Entry)

```
Nodes to draw:
  [START] -> [Dashboard or Tree View]
  -> DECISION: "Global or Contextual?"
    -> Global: [Click "Add Person" in sidebar/nav]
      -> [/person/new -- blank form]
    -> Contextual: [Click person on tree] -> [Person Detail Panel]
      -> [Click "Add Father/Mother/Spouse/Child"]
      -> DECISION: "Search existing or Create new?"
        -> Search: [PersonSelect typeahead] -> [Select person] -> [Confirm relationship type] -> [Save]
        -> Create: [/person/new pre-filled with context banner] -> [Fill form]
  -> [Form validation]
    -> DECISION: "Valid?"
      -> Yes: [Save] -> [Person created] -> [Redirect to /person/[id]]
        -> [Optional: "Add Relative" prompt]
      -> No: [Inline errors, focus first error]
  -> [END]

Error branches:
  - Duplicate detected -> [Warning dialog: "Similar person exists"] -> [View existing | Create anyway]
  - Cancel with changes -> [AlertDialog: "Discard changes?"]
  - Circular relationship -> [Error toast: "Cannot add as own ancestor"]
```

### Flow 2: Import GEDCOM

```
Nodes to draw:
  [START] -> [Click "Import" in sidebar] -> [/import]
  -> [Step 1: Upload Zone]
    -> DECISION: "File valid?"
      -> No: [Error: "Not a GEDCOM file"]
      -> Yes: [Show filename + size + encoding]
  -> [Step 2: Processing]
    -> [Progress bar: Parsing -> Validating -> Ready]
    -> [Cancel button available throughout]
  -> [Step 3: Preview]
    -> [Stats: persons, families, events, sources]
    -> [Warnings list (collapsible)]
    -> DECISION: "Blocking errors?"
      -> Yes: [Error list, cannot proceed]
      -> No: [Continue to confirm]
  -> [Step 4: Confirm Import]
    -> ["Import X persons" button]
    -> [Live count during import]
  -> [Step 5: Success Summary]
    -> [Stats card] -> ["View Tree" (primary)] -> [/tree]
  -> [END]

Error branches:
  - File >50MB: [Warning: "Large file, estimated time: ~X minutes"]
  - Transaction failure: [Full rollback notification]
  - Encoding issues: [Info toast: "Re-encoded from [charset]"]
  - Empty file: [Error: "GEDCOM file contains no data"]
  - Existing data in tree: [Warning: "Data already exists. Import will add alongside."]
```

### Flow 3: Navigate Tree

```
Nodes to draw:
  [START] -> [/tree]
  -> [React Flow canvas loaded with auto-layout]
  -> PARALLEL ACTIONS:
    -> Zoom: [Mouse wheel / pinch] -> [Canvas zooms]
    -> Pan: [Click-drag / touch-drag] -> [Canvas pans]
    -> Click node: [Person Detail Sheet opens (right)]
      -> [Panel shows person info]
      -> [Click "Focus"] -> [Tree re-centers, breadcrumb updates]
      -> [Click another person] -> [Panel updates]
    -> Switch view: [View dropdown] -> [Pedigree | Ancestors | Descendants | Hourglass]
    -> Drag node: [Node repositioned] -> [Position saved (debounced 500ms)]
    -> Draw edge: [Drag from handle] -> [Connection dialog] -> [Relationship created as proposed]
    -> Minimap: [Click location] -> [Canvas jumps]
    -> Breadcrumb: [Click ancestor segment] -> [Re-center on that person]
  -> [END]

Edge cases:
  - Empty tree: [Empty state illustration + CTAs]
  - Single person: [Centered node + "Add relative" prompt]
  - Large tree: [Viewport culling active, minimap shows full extent]
  - Keyboard nav: [Arrow keys between nodes, Enter to select, Tab to toolbar]
```

### Flow 4: Search & Filter

```
Nodes to draw:
  [START]
  -> PATH A: Global Search
    -> [Cmd+K or click search bar] -> [Command palette opens]
    -> [Type query (min 2 chars)] -> [Typeahead results (top 8)]
    -> DECISION: "Found?"
      -> Yes: [Click result] -> [Person Detail opens + tree centers]
      -> Partial: [Click "View all results"] -> [/search?q=query]
  -> PATH B: Search Results Page
    -> [/search?q=query]
    -> [Search input at top, pre-filled]
    -> [Filter sidebar: sex, living status, has sources, birth year range]
    -> [Results list with person cards]
    -> [Sort: Relevance | Name A-Z | Birth Date | Last Modified]
    -> [Click result] -> [Person Detail]
  -> [END]

Edge cases:
  - No results: ["No persons match" + "Add new person" CTA]
  - Diacritics: [Show FTS5 handles unicode normalization]
  - Empty query on /search: [Show all persons paginated]
```

### Flow 5: Edit Person

```
Nodes to draw:
  [START]
  -> PATH A: From Detail Panel (inline)
    -> [Person Detail Panel] -> [Click "Edit"] -> [/person/[id]/edit]
  -> PATH B: Direct URL
    -> [/person/[id]/edit] -> [Form pre-populated]
  -> [Edit fields: names, demographics, dates, events, sources, notes]
    -> [Events section: add/remove/reorder]
    -> [Sources section: link or create]
  -> [Click "Save"]
    -> DECISION: "Valid?"
      -> Yes: [Optimistic update] -> [Redirect to /person/[id]] -> [Success toast]
      -> No: [Inline errors, scroll to first]
  -> [END]

Edge cases:
  - Cancel with changes: [AlertDialog: "Unsaved changes. Discard?"]
  - Delete person: [AlertDialog with destructive button, soft delete]
  - Role forbidden (viewer): [Redirect to detail, toast "No permission"]
```

### Flow 6: Link Relationships

```
Nodes to draw:
  [START] -> [Person Detail Panel]
  -> [Click "Add Relative" dropdown]
  -> DECISION: "Which type?"
    -> Add Spouse:
      -> [Modal: "Link spouse for [Name]"]
      -> [Search existing OR create new]
      -> [Select relationship type: married, civil_union, etc.]
      -> [Save] -> [Family record created, tree re-renders]
    -> Add Parent (Father/Mother):
      -> [Search existing OR create new]
      -> DECISION: "Existing family with open parent slot?"
        -> Yes: [Add to existing family]
        -> No: [Create new family]
      -> [Child link created, tree updates]
    -> Add Child:
      -> DECISION: "Multiple spouses?"
        -> Yes: ["Which family?" selector]
        -> No: [Proceed with single family]
      -> [Search existing OR create new]
      -> [Select child relationship type: biological, adopted, etc.]
      -> [Save] -> [Tree updates]
  -> [END]

Edge cases:
  - Already has 2 parents: [Warning: "Will create alternate family group"]
  - Circular: [Block: "Cannot add as own ancestor"]
  - Duplicate relationship: [Block: "Already linked"]
  - Self-link: [Block]
  - Sex mismatch (adding "father" but person is female): [Info notice, don't block]
  - 12 spouses scenario: [All shown in dropdown, scroll if needed]
```

---

## 3. Step 0.4R: Design System in Figma

**Estimated time: 1.5 days**

### 3.1 Color Palette Page

**Frame: "6.1 Color Palette"**

Create swatch grid with the following structure. Each swatch is a 80x80px rounded rectangle with:
- Color fill
- OKLCH value label below
- CSS variable name below
- Contrast ratio against white/black noted

**Light Mode Swatches:**

| Row | Swatches |
|-----|----------|
| Primary | `--primary` oklch(0.55 0.15 250), `--primary-foreground` oklch(0.98 0.005 250) |
| Secondary | `--secondary` oklch(0.65 0.10 150), `--secondary-foreground` oklch(0.98 0.005 150) |
| Accent | `--accent` oklch(0.70 0.12 50), `--accent-foreground` oklch(0.20 0.02 50) |
| Destructive | `--destructive` oklch(0.55 0.20 25), `--destructive-foreground` oklch(0.98 0.005 25) |
| Surfaces | `--background` oklch(0.98 0.005 250), `--card` oklch(1.0 0 0), `--popover`, `--muted` oklch(0.95 0.005 250) |
| Text | `--foreground` oklch(0.15 0.01 250), `--muted-foreground` oklch(0.55 0.01 250) |
| Borders | `--border` oklch(0.90 0.005 250), `--input`, `--ring` |
| Sidebar | `--sidebar-background`, `--sidebar-foreground`, `--sidebar-accent` |

**Dark Mode Swatches (same layout, second frame):**
- All values from the `@media (prefers-color-scheme: dark)` block in design-system.md

### 3.2 Genealogy Semantic Colors Page

**Frame: "6.2 Genealogy Semantic Colors"**

| Category | Swatches |
|----------|----------|
| Sex indicators | `--sex-male` (blue), `--sex-female` (pink), `--sex-unknown` (gray) |
| Validation | `--status-confirmed` (green), `--status-proposed` (blue), `--status-disputed` (amber) |
| Relationship lines | `--line-confirmed` (dark gray), `--line-proposed` (blue), `--line-disputed` (amber) |
| Completion | `--completion-low` (red, <25%), `--completion-medium` (amber, 25-75%), `--completion-high` (green, >75%) |
| Living | `--living-badge` (green) |

Each swatch includes:
- A usage example (e.g., a mini tree node with that border color)
- Dark mode variant alongside

### 3.3 Typography Scale Page

**Frame: "6.3 Typography Scale"**

For each level, show a specimen line of actual text:

| Token | Specimen Text | Size | Weight | Line Height | Usage Label |
|-------|--------------|------|--------|-------------|-------------|
| `text-xs` | "Last modified 3 hours ago" | 12px | 400 | 1rem | Metadata, timestamps |
| `text-sm` | "Given Name" | 14px | 500 | 1.25rem | Form labels, table cells |
| `text-base` | "John was born in Springfield, Illinois on March 15, 1872." | 16px | 400 | 1.5rem | Body text, descriptions |
| `text-lg` | "John William Smith" | 18px | 600 | 1.75rem | Person name in detail panel |
| `text-xl` | "Family Tree" | 20px | 600 | 1.75rem | Page titles |
| `text-2xl` | "456" | 24px | 700 | 2rem | Dashboard stat numbers |
| `text-3xl` | "Welcome to Ancstra" | 30px | 700 | 2.25rem | Landing headings |

Font: Inter (or system-ui fallback). Show both regular and mono specimens.

### 3.4 Spacing & Grid Page

**Frame: "6.4 Spacing & Grid"**

- 8px base unit visualization (ruler with markings at 4, 8, 12, 16, 24, 32, 48, 64px)
- Layout diagram showing:
  - Desktop: sidebar 240px + main content (fluid) + detail panel 400px, top bar 56px
  - Tablet: sidebar 64px + main content + detail panel 50% viewport
  - Mobile: full-width content, bottom tab bar 64px, top bar 48px
- Card padding examples: p-4 (16px), p-6 (24px)
- Form field gap: space-y-4 (16px)
- Page padding: px-6 py-8 desktop, px-4 py-4 mobile

### 3.5 Border Radius & Shadows Page

**Frame: "6.5 / 6.6 Border Radius & Shadows"**

Specimen boxes showing:
- `rounded-md` (6px) -- buttons, inputs
- `rounded-lg` (8px) -- cards, tree nodes
- `rounded-xl` (12px) -- modals, sheets
- `rounded-full` (50%) -- avatars, badges

Shadow specimens:
- `shadow-sm` -- cards
- `shadow-md` -- dropdowns, tree nodes on hover
- `shadow-lg` -- modals, sheets
- `ring-2 ring-primary` -- selected tree node

### 3.6 Icon Set Page

**Frame: "6.7 Icon Set"**

Grid of all 38 Lucide icons from component-inventory.md, each shown at 20px with label below:
- Person: `User`, `UserPlus`, `Users`
- Navigation: `GitBranch`, `Search`, `SlidersHorizontal`, `Home`, `Settings`, `ChevronRight`
- Actions: `Upload`, `Download`, `Pencil`, `Trash2`, `Plus`, `X`
- Data: `FileText`, `Calendar`, `MapPin`, `BookOpen`
- Privacy: `Eye`, `EyeOff`
- Zoom: `ZoomIn`, `ZoomOut`, `Maximize2`
- Theme: `Sun`, `Moon`
- Events: `Baby`, `Cross`, `Heart`, `Shield`, `Ship`, `House`, `ClipboardList`, `Briefcase`
- Feedback: `AlertTriangle`, `CheckCircle`, `XCircle`, `Info`

### 3.7 Base Component Library (shadcn/ui)

**Frame: "6.8 Component Library -- Base"**

For each of the ~28 shadcn/ui components, create a component set in Figma with all variants and states:

#### Button
- **Variants:** default, secondary, destructive, outline, ghost, link
- **Sizes:** default (h-9 px-4), sm (h-8 px-3), lg (h-10 px-6), icon (h-9 w-9)
- **States per variant:** default, hover, active/pressed, focused (ring), disabled, loading (spinner)
- Total frames: 6 variants x 4 sizes x 6 states = 144 (group into variant rows)

#### Input
- **States:** default (empty), placeholder visible, filled, focused (ring), error (red border + message below), disabled (opacity 50%)
- **Variants:** standard, with left icon (MapPin, Search), with right icon (X clear)
- Total frames: ~18

#### Select
- **States:** closed (placeholder), closed (with value), open (dropdown visible), focused, disabled, error
- Show with options list: 5-8 items, scrollable indicator
- Total frames: ~8

#### Textarea
- **States:** empty, filled, focused, error, disabled
- Show resize handle
- Total frames: ~5

#### Sheet (Person Detail Panel)
- **Side:** right (desktop, 400px width), bottom (mobile, via Drawer)
- **States:** closed (not rendered), opening (transition mid-frame), open, closing
- Show overlay backdrop at 50% opacity
- Total frames: ~4

#### Tabs
- **Variants:** default (Overview | Sources | Media | Matches)
- **States per tab:** active (underline + bold), inactive, hover, disabled (tooltip "Coming in Phase 3")
- Total frames: ~4

#### Command (Cmd+K Palette)
- **States:** closed, open (empty input), open (with query, showing results), open (no results)
- Result item: avatar + name + life dates
- Show keyboard shortcut hint
- Total frames: ~4

#### Progress
- **Variants:** determinate (0%, 25%, 50%, 75%, 100%), indeterminate (animated)
- Show with percentage label
- Total frames: ~6

#### Toast / Sonner
- **Variants:** success (green check), error (red X), warning (amber triangle), info (blue i)
- **Positions:** bottom-right stack
- Show dismiss button, optional action button ("Undo")
- Total frames: ~4

#### AlertDialog
- **Variants:** default (confirm action), destructive (delete person)
- Show overlay, title, description, cancel + confirm buttons
- Total frames: ~2

#### Sidebar
- **States:** expanded (240px, icon + label), collapsed (64px, icon only + tooltip)
- **Items:** Dashboard, Tree, Add Person, Import, Export, Settings (with separators)
- **Active state:** bg-accent + 3px left border primary
- Show collapse toggle chevron at bottom
- Total frames: ~4

#### Breadcrumb
- Example: "Tree > Margaret Smith > John Smith"
- Clickable segments, separator chevrons
- Truncation behavior when path is long (ellipsis middle)
- Total frames: ~2

#### Table
- **States:** populated (with rows), empty, loading (skeleton rows)
- Show sort indicators (ascending/descending arrows on column headers)
- Show pagination: "Page 1 of 5" + prev/next buttons
- Total frames: ~3

#### Badge
- **Variants:** default, secondary, outline, destructive
- **Genealogy variants:** sex (M blue, F pink, U gray), validation (proposed amber, disputed red), living (green)
- Total frames: ~10

#### Avatar
- **Variants:** with photo, with initials (2 chars), with fallback icon (User)
- **Sizes:** sm (32px), default (40px), lg (56px)
- **Sex-coded border:** blue (M), pink (F), gray (U)
- Total frames: ~9

#### Skeleton
- **Shapes:** rectangle (card), line (text), circle (avatar), bar (progress)
- Show shimmer animation indication
- Total frames: ~4

#### Accordion
- **States:** all closed, one open, multiple open (if allowed)
- Show chevron rotation animation
- Total frames: ~3

#### RadioGroup
- Example: GEDCOM export privacy mode (Full Tree | Shareable | Ancestors Only)
- **States per radio:** unselected, selected, focused, disabled
- Total frames: ~2

#### Switch
- **States:** off, on, focused, disabled
- Example: "Dark mode" toggle, "Still living" toggle
- Total frames: ~4

#### Checkbox
- **States:** unchecked, checked, indeterminate, focused, disabled
- Example: search filter checkboxes
- Total frames: ~5

#### Popover / Tooltip / Dialog
- Popover: date picker container, place suggestions
- Tooltip: icon button hint, disabled tab explanation
- Dialog: relationship type selection, create source inline
- Total frames: ~6

#### DropdownMenu
- Example: person actions (Edit, Add Spouse, Add Parent, Add Child, separator, Delete)
- Show hover state on items, keyboard focus indicator
- Total frames: ~2

#### Card
- **Variants:** stat card (icon + number + label), person card (avatar + name + dates), action card (icon + title + description)
- Total frames: ~3

### 3.8 Custom Component Library

**Frame: "6.9 Component Library -- Custom"**

#### DateInput (`DateInput`)

**Variants by modifier:**

| Modifier | Layout |
|----------|--------|
| Exact | `[Exact v] [15 Mar 1872____]` + interpreted: "15 March 1872" |
| About | `[About v] [1880____________]` + interpreted: "About 1880" |
| Estimated | `[Est. v] [1845____________]` + interpreted: "Estimated 1845" |
| Before | `[Before v] [Jun 1900_______]` + interpreted: "Before June 1900" |
| After | `[After v] [1850____________]` + interpreted: "After 1850" |
| Between | `[Between v] [Jan 1880___] and [Dec 1885___]` + interpreted: "Between January 1880 and December 1885" |
| Calculated | `[Calc. v] [1790____________]` + interpreted: "Calculated 1790" |

**States per variant:**
- Default (empty, placeholder "Enter date...")
- Filled (value shown, interpreted text below)
- Focused (ring on active input)
- Error (red border, message: "Invalid date format")
- Disabled (opacity 50%)

**Interaction notes:**
- Modifier dropdown opens a Select with 7 options
- Free-text date input accepts multiple formats: "15 Mar 1872", "1880", "Mar 1872", "03/15/1872"
- Optional Calendar popover triggered by calendar icon button (for exact dates only)
- "Between" modifier reveals second date field with "and" label between
- Interpreted text uses `text-xs text-muted-foreground`

**Total frames:** 7 modifiers x 5 states = 35 (group as component set with modifier + state properties)

#### PlaceInput (`PlaceInput`)

**States:**
1. **Idle:** Input with MapPin icon, placeholder "Enter a place..."
2. **Typing/Searching:** Input with text, spinner icon, dropdown appearing
3. **Results shown:** Dropdown with 3-5 place suggestions (hierarchical names), "Add [text] as new place" at bottom
4. **Selected:** Input shows selected place name, small X to clear
5. **Error:** Red border, "Place is required"
6. **Disabled:** Grayed out

**Each result item shows:**
- Place icon (MapPin)
- Hierarchical name: "Springfield, Sangamon, Illinois, USA"
- Place type badge: "City"

**Total frames:** 6 states

#### PersonSelect (`PersonSelect`)

**States:**
1. **Idle:** Input with Search icon, placeholder "Search for a person..."
2. **Searching:** Input with text, spinner, dropdown
3. **Results shown:** Dropdown with person items (Avatar + "John Smith (1845-1923)") + "Create New Person" at bottom with UserPlus icon
4. **Selected:** Shows selected person as chip (Avatar + name + X to remove)
5. **No results:** Dropdown shows "No matching persons" + "Create New Person"
6. **Disabled:** Grayed out

**Total frames:** 6 states

#### TreeNode / PersonNode

**Component properties:**
- `sex`: M | F | U (controls left border color: blue / pink / none)
- `selected`: boolean (controls ring highlight)
- `isLiving`: boolean (name replaced with "Living", dates hidden)
- `hasPhoto`: boolean (avatar shows photo vs initials)
- `completionScore`: 0-100 (controls bar fill + color)
- `validationStatus`: confirmed | proposed | disputed (badge shown for non-confirmed)

**Variants to create:**

| # | Sex | Selected | Living | Photo | Completion | Notes |
|---|-----|----------|--------|-------|------------|-------|
| 1 | M | No | No | No | 80% (green) | Default male, initials avatar |
| 2 | F | No | No | Yes | 60% (amber) | Default female, photo |
| 3 | U | No | No | No | 20% (red) | Unknown sex, low completion |
| 4 | M | Yes | No | No | 80% | Selected state (ring-2 ring-primary) |
| 5 | M | No | Yes | No | -- | Living: name="Living", no dates, no completion bar |
| 6 | F | No | No | No | 45% | Proposed validation badge shown |
| 7 | M | No | No | No | 100% | Full completion |
| 8 | -- | -- | -- | -- | -- | Hover state (shadow-md, slight scale) |
| 9 | -- | -- | -- | -- | -- | Focused state (keyboard, ring + arrow key hints) |

**PersonNode internal layout (120px min-width):**
```
+----------------------------+
| [4px sex-color left border]|
|  +------+                  |
|  |Avatar|  John Smith      |
|  | 32px |  1845 - 1923     |
|  +------+                  |
|  [========--] 80%          |  <- completion bar
+----------------------------+
  [Handle top: target]
  [Handle bottom: source]
```

**Node dimensions:**
- Min width: 120px
- Padding: 8px (p-2)
- Avatar: 32px (w-8 h-8)
- Name: text-sm font-medium
- Dates: text-xs text-muted-foreground
- Completion bar: h-1, full width, rounded-full
- Border: 2px, rounded-lg (8px)
- Left border (sex): 4px

**Total frames:** ~12 variants (using Figma component properties for combinatorial generation)

#### ParentChildEdge

**Variants:**
1. Confirmed: solid line, stroke `--line-confirmed` (#6b7280), strokeWidth 2
2. Proposed: dashed line (8,4), stroke `--line-proposed` (#3b82f6), strokeWidth 2, animated dash
3. Disputed: dotted line (3,3), stroke `--line-disputed` (#f59e0b), strokeWidth 2

Show each as a vertical path from parent handle (bottom) to child handle (top), with smooth step corners.

**Total frames:** 3

#### PartnerEdge

**Variants:** Same 3 validation statuses but rendered as a horizontal line connecting two nodes at the same Y level.
- Optional marriage date label at midpoint: small text "m. 1870"

**Total frames:** 3 (+ 1 with label)

#### TreeMiniMap

**Layout:**
- 160x120px rounded-lg rectangle
- Semi-transparent background (bg-card/80 + backdrop-blur)
- Simplified node dots (2px circles in approximate tree positions)
- Viewport rectangle (dashed border, draggable indicator)
- Position: bottom-right corner of tree canvas, 16px offset

**States:**
1. Default (showing viewport rectangle)
2. Hover (slightly larger, border visible)
3. Dragging viewport (cursor: grabbing)
4. Hidden (toggle off)

**Total frames:** 4

#### CompletionBar

**Variants:**
- Low (<25%): `--completion-low` red bar
- Medium (25-75%): `--completion-medium` amber bar
- High (>75%): `--completion-high` green bar

**Formats:**
- Inline bar (tree node): h-1, full width, no label
- Labeled bar (detail panel): h-2, with "65% complete" label
- Ring (detail header): 40px SVG ring with percentage in center

**Total frames:** 3 levels x 3 formats = 9

#### EventTimeline

**Layout per event:**
```
|
+-- [icon] Event Type -- Date, Place
|          Description (optional)
|          [Source badge] (if sourced)
|
```

**Event types with icons (Lucide):**
- Birth: Baby
- Death: Cross
- Burial: (headstone -- use custom or Box)
- Baptism: Droplet
- Marriage: Heart
- Census: ClipboardList
- Immigration: Ship
- Military: Shield
- Occupation: Briefcase
- Residence: House
- Custom: Tag

**States:**
1. Populated (5-8 events in chronological order)
2. Single event (just birth)
3. Empty ("No events recorded. Add the first event.")
4. With source badges (small BookOpen icon after sourced events)
5. Unknown date events at bottom with "Unknown date" label

**Interaction:** Each event row is hoverable (bg-muted on hover), clickable to edit.
"+ Add Event" button at bottom with Plus icon.

**Total frames:** 5

---

## 4. Step 0.5: Lo-Fi Wireframes

**Estimated time: 3 days**

All wireframes are grayscale (no color, use only black, white, and 3 grays). Use placeholder text but realistic data (not lorem ipsum -- use actual genealogy names and dates). All at actual pixel dimensions.

### Day 9: Dashboard, Tree View, Person Detail Panel

---

### Screen 3.1: Dashboard / Desktop / Default (1280px x 900px)

**Frame contents (top to bottom, left to right):**

**Top Bar (56px, full width):**
- Left: Ancstra logo (text wordmark, 20px)
- Center: Search bar (Command input, 400px wide, placeholder "Search people... Cmd+K")
- Right: Theme toggle (Sun/Moon), User avatar (32px) + display name + chevron dropdown

**Left Sidebar (240px, full height minus top bar):**
- Nav items (icon 20px + label, 40px row height):
  - Dashboard (Home icon) -- ACTIVE (bg-accent, 3px left border primary)
  - Tree (GitBranch icon)
  - Separator line
  - Add Person (UserPlus icon)
  - Separator line
  - Import (Upload icon)
  - Export (Download icon)
  - Separator line
  - Settings (Settings icon)
- Bottom: Collapse button (ChevronLeft icon, 32px)

**Main Content Area (1280 - 240 = 1040px, padded px-6 py-8):**

Row 1 -- Summary Stat Cards (4 cards in a row, equal width):
```
+---------------+  +---------------+  +---------------+  +---------------+
| [Users icon]  |  | [Heart icon]  |  | [Calendar]    |  | [BookOpen]    |
| 847           |  | 312           |  | 2,841         |  | 156           |
| Persons       |  | Families      |  | Events        |  | Sources       |
| +12 this week |  | +4 this week  |  | +89 this week |  | +3 this week  |
+---------------+  +---------------+  +---------------+  +---------------+
```
Each card: rounded-lg, shadow-sm, p-6, icon top-right muted

Row 2 -- Quick Actions (horizontal button strip):
```
[+ Add Person]  [Upload Import GEDCOM]  [GitBranch View Tree]  [Download Export]
```
Buttons: outline variant, icon + label, equal spacing

Row 3 -- Two-column layout:

Left column (60%) -- Recent Persons:
```
Recent Persons                                      [View All ->]
+-----------------------------------------------------+
| [Avatar] Margaret Smith    b.1955  Springfield, IL  |
| [Avatar] John W. Smith    1845-1923  Chicago, IL    |
| [Avatar] Mary Johnson     1850-1910  Cook Co, IL    |
| [Avatar] James Smith      1820-1890  Virginia       |
| [Avatar] Living Smith     Living                     |
+-----------------------------------------------------+
```
Each row: 56px height, avatar 40px, name (font-medium), dates (text-muted), place (text-muted), hover bg-muted

Right column (40%) -- Recent Activity:
```
Recent Activity
+-------------------------------------------+
| Created  Margaret Smith        2 hours ago |
| Updated  John W. Smith         yesterday   |
| Imported 847 persons (GEDCOM)  3 days ago  |
| Created  Mary Johnson          3 days ago  |
+-------------------------------------------+
```
Each row: action badge (Created=green, Updated=blue, Imported=amber), person name clickable, relative timestamp

Row 4 -- Backup Reminder (conditional, dismissible):
```
+--------------------------------------------------------------+
| [AlertTriangle] Last export: 45 days ago. Back up your tree. |
|                                          [Export Now] [Dismiss]|
+--------------------------------------------------------------+
```

---

### Screen 3.2: Dashboard / Desktop / Empty State (1280px x 900px)

**Same top bar and sidebar as 3.1.**

**Main Content Area:**
- Centered vertically and horizontally
- Illustration placeholder (200x200px gray rectangle with tree/family icon)
- Heading: "Welcome to Ancstra" (text-2xl, font-bold)
- Subheading: "Start building your family tree" (text-base, text-muted-foreground)
- Two large CTA cards side by side:

```
+---------------------------+     +---------------------------+
| [Upload icon, 48px]      |     | [UserPlus icon, 48px]    |
|                           |     |                           |
| Import GEDCOM File        |     | Add Your First Person     |
| Upload an existing        |     | Start from scratch with   |
| family tree file          |     | yourself or an ancestor   |
|                           |     |                           |
| [Import GEDCOM ->]        |     | [Add Person ->]           |
+---------------------------+     +---------------------------+
```
Cards: 300px wide, rounded-xl, shadow-sm, p-8, hover shadow-md

- Below cards: "Need help getting started?" link (text-sm, text-muted-foreground)

---

### Screen 3.3: Tree View / Desktop / Default (1280px x 900px)

**Top Bar:** Same as dashboard, but breadcrumb replaces nothing specific here.

**Left Sidebar:** Same, with Tree nav item ACTIVE.

**Main Content: Tree Canvas (full remaining width and height)**

**Tree Toolbar (48px, above canvas, within main content):**
```
[Breadcrumb: Tree > Margaret Smith]  |  [Pedigree v]  [Search person...]  [-] [+] [Fit] [Export v]
```
- Breadcrumb: clickable segments
- View selector: dropdown (Pedigree, Ancestors, Descendants, Hourglass)
- Person search: small input with Search icon
- Zoom controls: minus, plus, fit-to-view (Maximize2)
- Export: dropdown (PDF, PNG, SVG)

**Canvas Area (full remaining space):**
- Background: dot grid pattern (subtle gray dots at 20px intervals)
- Tree layout (dagre, top-to-bottom):

```
Generation 0 (root):
                    +-------------------+
                    | James Smith       |
                    | 1820 - 1890      |
                    | [====----] 45%   |
                    +-------------------+
                           |
              +------------+------------+
              |                         |
    +-----------------+     +-----------------+
    | John W. Smith   | --- | Mary Johnson    |
    | 1845 - 1923    |     | 1850 - 1910    |
    | [========] 80% |     | [======--] 60% |
    +-----------------+     +-----------------+
              |                    |
    +---------+---------+    +----+----+
    |                   |    |         |
+----------+  +----------+  +----------+
| Margaret |  | Robert   |  | Living   |
| Smith    |  | Smith    |  |          |
| b. 1955  |  | 1880-    |  |          |
| [====] % |  | 1950     |  | [--] 10% |
+----------+  +----------+  +----------+
```

- Partner connections: horizontal solid line at same Y level
- Parent-child connections: vertical solid line from bottom handle to top handle
- Sex indicator: left border color (blue for M nodes, pink for F nodes)

**Bottom-right corner: MiniMap (160x120px)**
- Semi-transparent background
- Dot representation of tree
- Viewport rectangle

**Bottom-right: Controls (vertical button strip)**
- Zoom in (+)
- Zoom out (-)
- Fit view (square icon)

**Right side: Person Detail Sheet (NOT open by default)**
- Shown in separate frame (3.7) when a person is clicked

---

### Screen 3.4: Tree View / Empty State

**Same layout as 3.3 but canvas shows:**
- Centered illustration (tree with no leaves, 200x200px)
- "Your tree is empty" (text-xl)
- "Add your first person to get started" (text-muted)
- Two buttons centered:
  - [+ Add Person] (primary)
  - [Upload Import GEDCOM] (outline)
- Sidebar PersonPalette shows "Drag a person onto the canvas" hint

---

### Screen 3.5: Tree View / Single Person

**Canvas shows:**
- Single PersonNode centered
- Dashed-line "ghost" boxes around it suggesting where relatives could go:
  - Above: "Add Parents" (with plus icon)
  - Left/Right: "Add Spouse" (with plus icon)
  - Below: "Add Children" (with plus icon)
- These ghost boxes are interactive -- clicking them triggers the Add Relative flow

---

### Screen 3.6: Tree View / Large Tree (1000+ nodes)

**Canvas shows:**
- Many nodes, most outside viewport (indicated by minimap showing viewport as small rectangle in large field of dots)
- Visible nodes render fully (name, dates, completion bar)
- Nodes at edge of viewport begin to fade/clip
- MiniMap clearly shows full tree extent
- Toolbar shows "1,247 persons" count
- Performance note: viewport culling active, only ~100-200 nodes rendered

---

### Screen 3.7: Person Detail Panel (Sheet, Right) (400px x full height)

**Sheet header (sticky):**
```
+-------------------------------------------+
| [X close]                                 |
|                                           |
| +------+  John William Smith              |
| |Avatar|  b. 15 Mar 1872, Springfield, IL |
| | 56px |  d. 4 Nov 1941, Chicago, IL      |
| +------+  [M] [Living: no]               |
|            [Ring: 80% complete]           |
+-------------------------------------------+
```
- Avatar: 56px, initials "JS", blue left-border (male)
- Name: text-lg font-semibold
- Date line: text-sm text-muted-foreground
- Sex badge: small "M" pill, outline variant
- Completion ring: 40px SVG ring with "80%" center

**Quick Actions Strip (32px icon buttons, horizontal):**
```
[Pencil Edit] [Heart Add Spouse] [User Add Parent] [Baby Add Child] [MoreVertical ...]
```
- More dropdown: Delete person, View full page

**Tabs:**
```
[Overview]  [Sources]  [Media (disabled)]  [Matches (disabled)]
```
- Media tab: disabled, tooltip "Coming in Phase 3"
- Matches tab: disabled, tooltip "Coming in Phase 2"

**Tab Content: Overview**

Section: Names
```
Names
-----
Birth name:    John William Smith
Married name:  -- (none)
AKA:           "Jack"
```

Section: Life Events (EventTimeline component)
```
Life Events
-----------
|
+-- [Baby] Birth -- 15 Mar 1872, Springfield, IL
|
+-- [ClipboardList] Census -- 1880, Cook County, IL
|
+-- [Heart] Marriage -- 12 Jun 1895, Chicago, IL
|          to Mary Johnson
|
+-- [Shield] Military -- 1918
|          [BookOpen source badge]
|
+-- [Cross] Death -- 4 Nov 1941, Chicago, IL
|
[+ Add Event]
```

Section: Family Members
```
Family Members
--------------
Father:   [Avatar] James Smith (1820-1890)     [->]
Mother:   [Avatar] Unknown                      [+ Add]
Spouse:   [Avatar] Mary Johnson (1850-1910)     [->]  (married 1895)
Children:
  [Avatar] Margaret Smith (b. 1955)             [->]
  [Avatar] Robert Smith (1880-1950)             [->]
  [+ Add Child]
```
Each person card: avatar 32px + name + dates, clickable (navigates tree)

Section: Notes
```
Notes
-----
"Served in WWI. Possible immigration from County Cork, Ireland
around 1868 as a child."

[Read only -- click Edit to modify]
```

**Tab Content: Sources (when selected)**
```
Sources (3)
-----------
+------------------------------------------+
| [BookOpen] 1880 US Federal Census        |
| Type: Census record                       |
| Citation: Schedule 1, ED 123, Sheet 4    |
| Confidence: [High]                        |
+------------------------------------------+

+------------------------------------------+
| [BookOpen] Illinois Death Index           |
| Type: Vital record                        |
| Citation: Certificate #12345             |
| Confidence: [High]                        |
+------------------------------------------+

+------------------------------------------+
| [BookOpen] Personal knowledge (family)   |
| Type: Personal knowledge                  |
| Citation: Interview with Margaret, 2020  |
| Confidence: [Medium]                      |
+------------------------------------------+

[+ Add Source Citation]
```

---

### Screen 3.8: Person Create Form (/person/new)

**Full page (main content area, sidebar visible):**

**Page header:**
```
Add New Person
[Optional context banner: "Adding mother of John William Smith"]
```

**Form layout (max-width: 640px, centered):**

Section 1: Basic Information (always visible)
```
Given Name *        [____________________]
Surname *           [____________________]
Sex                 [U - Unknown     v]  (Select: Male, Female, Unknown)
```

Section 2: Dates (always visible)
```
Birth Date          [Exact v] [________________]
                    Interpreted: --
Birth Place         [MapPin] [________________]  (PlaceInput)

Death Date          [Exact v] [________________]
                    Interpreted: --
Death Place         [MapPin] [________________]  (PlaceInput)

[ ] Still living (Switch -- if on, death fields hidden)
```

Section 3: Additional Details (Accordion, collapsed by default -- progressive disclosure)
```
v Additional Details
  +---------------------------------------------+
  | Name Variants                                |
  | [+ Add Name Variant]                        |
  |                                             |
  | Notes                                       |
  | [Textarea, 4 rows]                          |
  +---------------------------------------------+
```

Section 4: Events (Accordion, collapsed)
```
v Events
  +---------------------------------------------+
  | No events yet.                              |
  | [+ Add Event]                               |
  +---------------------------------------------+
```

Section 5: Source Citations (Accordion, collapsed)
```
v Sources
  +---------------------------------------------+
  | "Add a source to document this person"      |
  | [+ Add Source Citation]                     |
  +---------------------------------------------+
```

**Bottom action bar (sticky on scroll):**
```
[Cancel]                           [Save Person]
```
- Cancel: ghost button, triggers unsaved-changes dialog if dirty
- Save: primary button, disabled until required fields filled

---

### Screen 3.9: Person Edit Form (/person/[id]/edit)

**Same layout as 3.8 but:**
- Page header: "Edit John William Smith"
- All fields pre-populated with existing data
- Name variants section shows existing names with edit/delete per row
- Events section shows existing events (editable inline or expandable)
- Sources section shows linked sources
- Bottom bar adds: [Delete Person] (destructive, left-aligned) alongside Cancel and Save

**Delete triggers AlertDialog:**
```
+-----------------------------------------------+
| Delete John William Smith?                     |
|                                                |
| This will remove this person and all their     |
| relationships. This action cannot be undone.   |
|                                                |
|              [Cancel]  [Delete Person]          |
+-----------------------------------------------+
```

---

### Day 10: Person Forms Detail, GEDCOM Import/Export

---

### Screen 3.10: GEDCOM Import / Step 1 Upload

**Page header:** "Import Family Tree"
**Step indicator:** `(1) Upload  -->  (2) Process  -->  (3) Preview  -->  (4) Confirm  -->  (5) Done`
- Step 1 active (bold, primary color)
- Steps 2-5 muted

**Upload zone (centered, max-width 600px):**
```
+---------------------------------------------------+
|                                                   |
|           [Upload icon, 48px, muted]              |
|                                                   |
|     Drag and drop your GEDCOM file here           |
|              or                                   |
|         [Browse Files]  (outline button)          |
|                                                   |
|     Supported: .ged files (GEDCOM 5.5.1)         |
|     Max size: 100MB                               |
|                                                   |
+---------------------------------------------------+
```
- Zone: dashed border (2px), rounded-xl, bg-muted/50, 200px tall
- Drag hover state: border turns primary, bg-primary/5

**After file selected (replaces zone):**
```
+---------------------------------------------------+
| [FileText icon]  ancestry-export-2024.ged         |
|                  4.2 MB                           |
|                  Encoding: UTF-8 (detected)       |
|                                                   |
|    [X Remove]            [Continue ->]            |
+---------------------------------------------------+
```

---

### Screen 3.11: GEDCOM Import / Step 2 Processing

**Step indicator:** Step 2 active

**Processing panel (centered):**
```
+---------------------------------------------------+
| Importing your family tree...                     |
|                                                   |
| [==============-----] 67%                         |
|                                                   |
| Parsing records... 2,841 of 4,200                |
| Found: 847 persons, 312 families                 |
|                                                   |
| Estimated time remaining: ~30 seconds            |
|                                                   |
|                         [Cancel Import]           |
+---------------------------------------------------+
```

**Sub-steps indicator:**
```
[checkmark] Detecting encoding...    (completed)
[checkmark] Parsing records...       (completed)
[spinner]   Validating data...       (in progress)
[ ]         Ready for review         (pending)
```

---

### Screen 3.12: GEDCOM Import / Step 3 Preview

**Step indicator:** Step 3 active

**Summary cards (horizontal row):**
```
+----------+  +----------+  +----------+  +----------+
| 847      |  | 312      |  | 2,841    |  | 156      |
| Persons  |  | Families |  | Events   |  | Sources  |
+----------+  +----------+  +----------+  +----------+
```

**Source software detected:**
```
Exported from: Ancestry.com v2024.1
File encoding: UTF-8
```

**Warnings (collapsible accordion):**
```
v Warnings (12)
  +---------------------------------------------------+
  | [AlertTriangle] 5 persons with dates before 1500  |
  | [AlertTriangle] 3 persons with birth after death   |
  | [AlertTriangle] 2 duplicate name pairs detected    |
  | [AlertTriangle] 2 orphaned children (no parents)   |
  +---------------------------------------------------+
```

**Errors (if any, blocking, red border):**
```
Errors (0)  -- or if errors exist, show red section
```

**Existing data warning (if tree not empty):**
```
+---------------------------------------------------+
| [Info] Your tree already has 23 persons.           |
| Imported data will be added alongside existing     |
| data. Merging is not supported in this version.    |
+---------------------------------------------------+
```

**Bottom actions:**
```
[Cancel]                    [Import 847 Persons ->]
```

---

### Screen 3.13: GEDCOM Import / Step 4 Confirm (during import)

**Step indicator:** Step 4 active

```
+---------------------------------------------------+
| Importing into your tree...                        |
|                                                   |
| [================----] 78%                         |
|                                                   |
| Importing 662 of 847 persons...                   |
| 245 families created                              |
| 1,890 events linked                               |
|                                                   |
|                         [Cancel]                   |
+---------------------------------------------------+
```

---

### Screen 3.14: GEDCOM Import / Step 5 Success

**Step indicator:** Step 5 active (all checkmarks)

```
+---------------------------------------------------+
| [CheckCircle, large, green]                       |
|                                                   |
| Import Complete!                                   |
|                                                   |
| Successfully imported:                            |
|   847 persons                                     |
|   312 families                                    |
|   2,841 events                                    |
|   156 sources                                     |
|                                                   |
| [View Tree ->]  (primary button)                  |
| [View Import Log]  (text link)                    |
+---------------------------------------------------+
```

---

### Screen 3.15: GEDCOM Import / Error States

**Multiple frames:**

Frame A -- Invalid file:
```
+---------------------------------------------------+
| [XCircle, red]                                     |
| This doesn't appear to be a GEDCOM file.          |
| Please upload a .ged file exported from your       |
| genealogy software.                                |
|                                                   |
| [Try Again]                                       |
+---------------------------------------------------+
```

Frame B -- Large file warning:
```
+---------------------------------------------------+
| [AlertTriangle, amber]                             |
| Large file detected (52 MB)                       |
| This may take several minutes to process.         |
| Estimated time: ~5 minutes                        |
|                                                   |
| [Continue Anyway]  [Cancel]                        |
+---------------------------------------------------+
```

Frame C -- Parse error with partial import option:
```
+---------------------------------------------------+
| [AlertTriangle, amber]                             |
| 3 records could not be parsed (lines 1204, 3891,  |
| 5002). 844 of 847 persons can be imported.        |
|                                                   |
| [Download Error Log]                              |
|                                                   |
| [Import What We Can]  [Cancel]                     |
+---------------------------------------------------+
```

Frame D -- Transaction failure:
```
+---------------------------------------------------+
| [XCircle, red]                                     |
| Import failed due to a server error.              |
| No data was imported (rolled back).               |
|                                                   |
| Error: Database write failed at record 423        |
|                                                   |
| [Try Again]  [Contact Support]                     |
+---------------------------------------------------+
```

---

### Screen 3.16: GEDCOM Export / Default

**Page header:** "Export Family Tree"

**Format selector:**
```
Export Format
[GEDCOM 5.5.1  v]  (Select, only option in Phase 1)
```

**Privacy Mode (RadioGroup, 3 options):**
```
Privacy Mode

(o) Full Tree (Private Backup)
    Includes all persons, events, and notes.
    847 persons, including 23 living persons.

( ) Shareable Tree
    Living persons' names and dates are hidden.
    824 deceased persons shown fully, 23 persons as "Living [Surname]".

( ) Ancestors Only
    Only deceased ancestors included.
    612 deceased ancestors exported.
```

Each radio option: card-style with title (font-medium) and description (text-sm text-muted)

**Preview panel:**
```
Export Preview
+-------------------------------------------------+
| Persons: 847 (23 living)                        |
| Families: 312                                   |
| Events: 2,841                                   |
| Sources: 156                                    |
|                                                 |
| File format: GEDCOM 5.5.1                       |
| Encoding: UTF-8 with BOM                        |
| Estimated file size: ~4.2 MB                    |
+-------------------------------------------------+
```

**Bottom actions:**
```
                              [Download Export]
```
Primary button with Download icon.

---

### Screen 3.17: GEDCOM Export / Privacy Preview

**When "Shareable Tree" is selected, show a preview table:**
```
Privacy Preview
+-------------------------------------------------+
| These persons will be hidden:                    |
| +---------------------------------------------+ |
| | Living Smith      b.1955  -> "Living Smith" | |
| | Living Johnson    b.1990  -> "Living Johnson"| |
| | ...21 more                                   | |
| +---------------------------------------------+ |
|                                                 |
| Hidden data: names, birth dates, notes,         |
| recent events (last 100 years)                  |
+-------------------------------------------------+
```

---

### Day 11: Search, Settings, Mobile Variants, Loading/Error States

---

### Screen 3.18: Search Results / With Results

**Page header:** Search input (full width, pre-filled with query)
**URL:** `/search?q=smith`

**Two-column layout:**

Left column (240px) -- Filter Sidebar:
```
Filters

Sex
[x] Male
[x] Female
[ ] Unknown

Living Status
(o) All
( ) Living Only
( ) Deceased Only

Has Sources
[ ] Only persons with sources

Birth Year Range
From: [____]  To: [____]

[Clear All Filters]
```

Right column -- Results:
```
Sort: [Relevance v]                     Showing 1-20 of 47

+---------------------------------------------------+
| [Avatar] John William Smith                        |
| 1845 - 1923 | Chicago, IL                         |
| Father: James Smith | Spouse: Mary Johnson        |
| Last modified: 2 days ago                          |
+---------------------------------------------------+

+---------------------------------------------------+
| [Avatar] Margaret Smith                            |
| b. 1955 | Springfield, IL                          |
| Father: John W. Smith | Spouse: --                |
| Last modified: 3 days ago                          |
+---------------------------------------------------+

... (more results)

[<< Prev]  Page 1 of 3  [Next >>]
```

Each result card: full-width, rounded-lg, p-4, hover bg-muted, cursor pointer

---

### Screen 3.19: Search Results / No Results

**Same layout but right column shows:**
```
+---------------------------------------------------+
|              [Search icon, 48px, muted]           |
|                                                   |
|    No persons match "Zylberstein"                 |
|                                                   |
|    Try adjusting your search or filters.          |
|    [+ Add a new person]                           |
+---------------------------------------------------+
```

---

### Screen 3.20: Search Results / With Filters Active

**Same as 3.18 but:**
- Filter chips shown above results: `[Sex: Male x] [Living: Deceased x] [Clear All]`
- Results filtered accordingly
- Result count updated: "Showing 1-8 of 8"

---

### Screen 3.21: Command Palette (Cmd+K Overlay)

**Overlay on any page (centered, 500px wide, max-height 400px):**
```
+---------------------------------------------------+
| [Search icon] Search people...           [Esc]    |
+---------------------------------------------------+
| Recent                                            |
|   [Avatar] Margaret Smith (b. 1955)               |
|   [Avatar] John W. Smith (1845-1923)              |
+---------------------------------------------------+
| Results for "john"                                |
|   [Avatar] John William Smith (1845-1923)         |
|   [Avatar] John Robert Smith (1880-1950)          |
|   [Avatar] Johnny Smith (1910-1975)               |
|                                                   |
|   View all 12 results ->                          |
+---------------------------------------------------+
```
- Backdrop: semi-transparent overlay
- Input: auto-focused
- Results: instant typeahead (debounced 200ms)
- Each result: clickable, shows avatar + name + dates
- Keyboard: arrow keys to navigate, Enter to select, Esc to close

---

### Screen 3.22: Settings / Profile

**Page header:** "Settings"
**Tabs:** [Profile] [Privacy] [Data]

**Profile tab content:**
```
Display Name     [________________]
Email            [________________]

[Save Changes]
```

---

### Screen 3.23: Settings / Privacy

**Privacy tab content:**
```
Default Export Privacy Mode
[Full Tree (Private)  v]

Living Person Threshold
[100] years (persons born within this many years
without a death date are presumed living)

[Save Changes]
```

---

### Screen 3.24: Settings / Data

**Data tab content:**
```
Database
Location: Local SQLite (~/ancstra.db)
Size: 12.4 MB
Persons: 847

Last GEDCOM Export
March 15, 2026  [Export Now]

Theme
[System v]  (System | Light | Dark)

Danger Zone
+---------------------------------------------------+
| [Trash2] Delete All Data                          |
| Permanently delete all persons, families, events,  |
| and sources. This cannot be undone.               |
|                                     [Delete All]   |
+---------------------------------------------------+
```

---

### Mobile Wireframes (375px x 812px)

### Screen 4.1: Dashboard / Mobile / Default

**Top Bar (48px):**
```
[Ancstra]                          [Search icon]
```

**Content (full width, px-4 py-4):**

Stat cards: 2x2 grid (each card ~170px wide)
```
+--------+ +--------+
| 847    | | 312    |
| Persons| | Families|
+--------+ +--------+
+--------+ +--------+
| 2,841  | | 156    |
| Events | | Sources|
+--------+ +--------+
```

Quick actions: 2x2 grid of icon buttons
```
[+ Add] [Import] [Tree] [Export]
```

Recent persons: vertical card list (full width)

**Bottom Tab Bar (64px):**
```
[Home]  [Tree]  [+Add]  [Search]  [Settings]
```
- Active tab: filled icon + label in primary color
- Inactive: outline icon, muted label
- "+Add" center tab: slightly larger, circle accent background

---

### Screen 4.3: Tree View / Mobile

**Full-screen canvas (375px x entire viewport minus top bar and bottom tabs)**

**Top bar simplified:**
```
[<- Back]  Tree              [Search icon]
```

**Canvas:** Same tree visualization but:
- Nodes slightly smaller (min-width: 100px)
- Touch gestures: pinch to zoom, drag to pan
- Tap node to open bottom sheet

**Floating Action Button (FAB):**
- Bottom-right, above tab bar: 56px circle, primary color, Plus icon
- Tap: opens "Add Person" options (Add new / Add relative of selected)

---

### Screen 4.4: Tree View / Mobile / With Bottom Sheet

**Bottom sheet (Drawer) at 50% viewport height:**
```
[Handle bar]                      [Expand ^]
+-------------------------------------------+
| +------+  John William Smith              |
| |Avatar|  1845 - 1923                     |
| | 40px |  Springfield, IL                 |
| +------+  [M] [80%]                       |
+-------------------------------------------+
| [Edit] [Add Spouse] [Add Parent] [...]    |
+-------------------------------------------+
| Overview | Sources | ...                   |
+-------------------------------------------+
| Life Events                               |
| Birth -- 15 Mar 1872, Springfield         |
| Marriage -- 12 Jun 1895, Chicago          |
| Death -- 4 Nov 1941, Chicago              |
+-------------------------------------------+
```

**Snap points:**
- 50% viewport: shows header + quick actions + tab bar
- 90% viewport: shows full content (scrollable)
- Swipe down to dismiss

---

### Screen 4.5: Person Detail / Mobile (Full Screen)

**When navigating to /person/[id] directly (not from tree):**
- Full-screen page, same content as sheet but takes entire viewport
- Back button in top bar returns to previous page
- Bottom tab bar remains visible

---

### Screen 4.6: Person Create Form / Mobile

**Single column layout, full width:**
- All form fields stack vertically
- Accordion sections for additional details, events, sources
- Sticky bottom bar with Cancel and Save
- Keyboard pushes content up (input visible above keyboard)

---

### Screen 4.7: GEDCOM Import / Mobile

**All 5 steps rendered as full-screen pages:**
- Step indicator simplified to "Step 1 of 5" text
- Upload zone: full width, tap to browse (no drag-and-drop on mobile)
- Progress: full-width bar
- Summary: stacked cards
- Actions: full-width buttons

---

### Screen 4.8: Search Results / Mobile

**Full-screen:**
- Search input at top (full width)
- Filter button (top-right, opens bottom sheet filter panel)
- Results: full-width person cards, vertical scroll
- No sidebar -- filters in bottom sheet

---

### Screen 4.9: Search Filters / Mobile (Bottom Sheet)

**Bottom sheet with filter controls:**
```
[Handle bar]
Filters                         [Clear All]
+-------------------------------------------+
| Sex: [x] Male [x] Female [ ] Unknown     |
| Living: (o) All ( ) Living ( ) Deceased   |
| Has Sources: [ ]                          |
| Birth Year: [____] to [____]             |
+-------------------------------------------+
[Apply Filters]  (primary, full width)
```

---

### Tablet Wireframes (768px)

### Screen 5.1: Tree View / Tablet

- Sidebar: 64px (collapsed, icon-only)
- Canvas: remaining width
- Person detail panel: 50% viewport width (when open)
- Toolbar: same as desktop but search collapses to icon

### Screen 5.2: Dashboard / Tablet

- Sidebar: 64px collapsed
- Stat cards: 2x2 grid
- Recent persons + activity: stacked (single column)

### Screen 5.3: Forms / Tablet

- Sidebar: 64px collapsed
- Form: two-column layout for related fields (given name + surname on same row, birth date + birth place on same row)

---

## 5. Step 0.6: Hi-Fi Mockups

**Estimated time: 3 days**

### Day 12: Tree View (Hero Screen) + Person Detail Panel

Apply full design system to wireframes 3.3 through 3.7:
- OKLCH colors applied (primary blue sidebar active state, sex-indicator borders, completion bar colors)
- Inter font at correct sizes and weights
- shadcn/ui component styling (rounded-lg cards, shadow-sm, ring focus states)
- Dot grid background on tree canvas
- Proper avatar rendering (initials with colored backgrounds)
- Dark mode variant of tree view (3.26: dark background, lighter nodes, adjusted line colors)

**Specific polishing tasks for Tree View:**
- PersonNode: final border-radius, shadow on hover, ring on selected, sex-color left border
- Edges: exact stroke styles with proper OKLCH colors
- MiniMap: frosted glass effect (backdrop-blur + bg-card/80)
- Toolbar: proper button sizing, dropdown styling, separator lines
- Breadcrumb: proper chevron separators, truncation for long paths

**Specific polishing tasks for Person Detail Panel:**
- Sheet animation: slide-in from right, 200ms ease-out
- Avatar: proper initials rendering with sex-coded background tint
- Completion ring: SVG with proper colors and center text
- Tab underline: primary color, 2px, animated slide
- Event timeline: proper vertical line, icon backgrounds, hover states
- Family member cards: proper avatar + name + dates layout with arrow icons

### Day 13: Person Forms + GEDCOM Import Flow

Apply design system to wireframes 3.8 through 3.15:
- Form fields: proper shadcn/ui Input styling (h-9, rounded-md, border, focus ring)
- DateInput: modifier Select + date Input combo, styled interpretation text
- PlaceInput: Command-based with MapPin icon, styled dropdown
- Accordion: proper chevron animation, border styling
- Step indicator: connected dots/circles with lines, active/completed/pending states
- Progress bar: proper height, rounded, animated fill
- Upload zone: dashed border with proper spacing, drag-hover animation
- Error states: proper AlertDialog styling, destructive buttons
- Success state: green CheckCircle animation

### Day 14: Dashboard + Search + Export + Settings + Dark Mode

Apply design system to remaining wireframes:
- Dashboard stat cards: icon placement, number sizing (text-2xl font-bold), trend indicators
- Dashboard empty state: illustration styling, CTA card hover effects
- Search results: proper card styling, filter sidebar, active filter chips
- Command palette: proper overlay, input styling, result item hover
- Export page: radio card styling, preview panel
- Settings: proper tab styling, form sections, danger zone red border

**Dark mode variants to create:**
- Dashboard (7.25)
- Tree View (7.26)
- Person Detail Panel
- Command Palette

For dark mode:
- Background: oklch(0.15 0.01 250) (very dark blue-gray)
- Cards: oklch(0.20 0.01 250)
- Text: oklch(0.93 0.005 250) (near-white)
- Borders: oklch(0.30 0.01 250)
- Primary: oklch(0.70 0.12 250) (brighter blue for contrast)
- Tree nodes: dark card background with lighter borders
- Edges: adjusted colors for dark background visibility
- MiniMap: darker frosted glass
- Completion bar colors: slightly brighter on dark background

---

## 6. Dependency Graph

```
Step 0.3R (Flow Diagrams)  ----+
                               |
Step 0.4R (Design System)  ----+--> Step 0.5 (Lo-Fi Wireframes) --> Step 0.6 (Hi-Fi Mockups)
                               |
                               |    Step 0.5 depends on:
                               |    - Flow diagrams (to know what each screen does)
                               |    - Design system (to know component dimensions, spacing)
                               |
                               |    Step 0.6 depends on:
                               |    - Lo-fi wireframes (layout structure)
                               |    - Design system (colors, typography, component styles)
```

**Parallelizable:**
- 0.3R and 0.4R can run in parallel (they're independent)
- Within 0.5, Day 9/10/11 are sequential (each builds on previous)
- Within 0.6, Day 12/13/14 are sequential (tree view informs detail panel informs forms)

**Critical path:** Design System (0.4R) -> Wireframes (0.5) -> Hi-Fi (0.6)

**Non-blocking:** Flow diagrams (0.3R) can be done anytime before or during wireframes.

---

## 7. State Matrix (All Screens)

### Complete State Inventory

| Screen | Default | Empty | Loading | Error | Saving | Validation Error | Success | Disabled | Hover | Focused | Special States |
|--------|---------|-------|---------|-------|--------|------------------|---------|----------|-------|---------|----------------|
| Dashboard | Stats + recent persons | Empty state CTA | Skeleton cards | Banner + retry | -- | -- | -- | -- | Cards highlight | -- | Backup reminder (conditional) |
| Tree View | Canvas with nodes | Empty illustration + CTAs | Skeleton shimmer nodes | Overlay error + retry | -- | -- | -- | -- | Node shadow, edge glow | Node ring (keyboard) | Single person (ghost boxes), Large tree (minimap prominent), Living-person hidden nodes |
| Person Detail Panel | Full data | -- | Skeleton header + tabs | Error message + retry | -- | -- | -- | -- | Event rows, family cards | Tab focus | Closed, Opening (transition), Panel for living person (privacy block for viewers) |
| Person Create | Empty form, sex=U | -- | -- | Toast "Failed to save" | Button spinner, fields disabled | Inline field errors, first error focused | Redirect + toast "Person added" | -- | -- | Field ring, label highlight | Context banner ("Adding mother of..."), Cancel with unsaved changes dialog |
| Person Edit | Pre-populated form | -- | Skeleton fields | Toast error | Button spinner | Inline errors | Redirect + toast "Changes saved" | Viewer role redirect | -- | Field ring | Unsaved changes guard (beforeunload + AlertDialog), Delete confirmation |
| GEDCOM Import Step 1 | Upload zone | -- | -- | Invalid file error | -- | -- | -- | Continue disabled until file selected | Zone border change on drag-over | Zone ring | File selected (shows name/size), Large file warning |
| GEDCOM Import Step 2 | Progress bar animating | -- | -- | Transaction failure (full rollback msg) | -- | -- | -- | -- | -- | -- | Cancel available |
| GEDCOM Import Step 3 | Stats + warnings | -- | -- | Blocking errors (red section) | -- | -- | -- | Import disabled if blocking errors | Warning rows expand on click | -- | Existing data warning |
| GEDCOM Import Step 4 | Live count progress | -- | -- | Server crash mid-import (rollback msg) | -- | -- | -- | -- | -- | -- | Cancel available |
| GEDCOM Import Step 5 | Success summary | -- | -- | -- | -- | -- | Green check + stats | -- | -- | -- | View Tree CTA, Import Log link |
| GEDCOM Export | Format + privacy selector | Export disabled (empty tree, tooltip) | -- | Toast error + retry | Button spinner "Generating..." | -- | Auto-download + toast | Button disabled if no persons | Radio card hover | Radio focus ring | Privacy preview panel (conditional) |
| Search (no query) | Input focused, recent/suggested | -- | -- | -- | -- | -- | -- | -- | -- | Input ring | -- |
| Search (with results) | Person cards, filter sidebar | -- | Spinner in results area | Banner + retry | -- | -- | -- | -- | Card bg-muted | -- | Filter chips active, sort active |
| Search (no results) | "No results" + CTA | -- | -- | FTS5 error | -- | -- | -- | -- | -- | -- | Spelling suggestion |
| Command Palette | Overlay, results | -- | -- | -- | -- | -- | -- | -- | Result highlight | Arrow key navigation | Recent section, "View all results" link |
| Settings / Profile | Pre-populated form | -- | -- | Inline error + retry | Section spinner | -- | Inline success msg | -- | -- | Field ring | -- |
| Settings / Privacy | Pre-populated form | -- | -- | Inline error | Section spinner | -- | Inline success | -- | -- | -- | -- |
| Settings / Data | DB info, theme | -- | -- | -- | -- | -- | -- | -- | -- | -- | Danger zone (red border), Delete all confirmation dialog |

---

## 8. Responsive Breakpoint Specifications

### Per-Screen Breakpoint Changes

#### Dashboard
| Element | Desktop (>=1280px) | Tablet (768-1279px) | Mobile (<768px) |
|---------|-------------------|-------------------|-----------------|
| Sidebar | 240px expanded | 64px collapsed | Hidden (bottom tabs) |
| Stat cards | 4 in a row | 2x2 grid | 2x2 grid (smaller) |
| Quick actions | Horizontal row | 2x2 grid | 2x2 icon buttons |
| Recent persons + activity | Side by side (60/40) | Stacked | Stacked |
| Page padding | px-6 py-8 | px-4 py-6 | px-4 py-4 |
| Top bar height | 56px | 56px | 48px |
| Bottom tab bar | None | None | 64px fixed bottom |

#### Tree View
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Sidebar | 240px | 64px | Hidden |
| Canvas | Full remaining | Full remaining | Full screen |
| Person detail | 400px Sheet (right) | 50% viewport Sheet | Bottom Drawer (50%/90% snap) |
| Toolbar | Full (breadcrumb + view + search + zoom + export) | Compact (view + zoom, search as icon) | Minimal (view + zoom only, search via top bar) |
| PersonNode min-width | 120px | 120px | 100px |
| MiniMap | 160x120px, bottom-right | 120x90px | Hidden by default, toggle button |
| FAB | None | None | 56px circle, bottom-right |
| Node interactions | Click, drag, hover tooltip | Click, drag, pinch-zoom | Tap, long-press, pinch-zoom |

#### Person Detail Panel
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Container | Sheet right, 400px fixed | Sheet right, 50% viewport | Drawer bottom, snap 50%/90% |
| Avatar size | 56px | 56px | 40px |
| Quick actions | Horizontal strip | Horizontal strip | Scrollable horizontal |
| Tabs | Horizontal | Horizontal | Horizontal (scrollable if needed) |
| Family member cards | 2 per row | 1 per row | 1 per row |

#### Person Forms
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Form max-width | 640px centered | 640px centered | Full width |
| Field layout | Single column (labels above) | Two columns for name fields | Single column |
| DateInput | Modifier + date side by side | Same | Modifier above, date below |
| PlaceInput | Full width | Full width | Full width |
| Accordions | Closed by default | Closed | Closed |
| Bottom action bar | Right-aligned | Right-aligned | Full-width stacked buttons |

#### GEDCOM Import
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Step indicator | Horizontal connected dots | Horizontal dots | "Step X of 5" text |
| Upload zone | 600px wide, drag+drop | 600px, drag+drop | Full width, browse only (no drag) |
| Summary cards | 4 in a row | 2x2 | 2x2 |
| Warnings list | Full width with scroll | Same | Same |

#### Search
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Filter sidebar | 240px left column | 200px left column | Bottom sheet (triggered by "Filter" button) |
| Results | Right column | Right column | Full width below search |
| Filter chips | Above results | Above results | Below search input |
| Sort | Dropdown in results header | Same | Dropdown |
| Pagination | Bottom of results | Same | Same |

#### Settings
| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Layout | Sidebar + form content | Collapsed sidebar + form | Full screen, tabs at top |
| Form width | max-w-lg centered | Same | Full width |

---

## 9. Dark Mode Specifications

### Screens Requiring Dark Mode Variants (Hi-Fi)

**Must have (key screens):**
1. Tree View -- the hero screen; dark mode is critical for extended use
2. Dashboard -- first screen seen; must set dark tone
3. Person Detail Panel -- frequently viewed alongside tree
4. Command Palette -- overlay must work on dark backgrounds

**Should have (complete set):**
5. Person forms -- for consistency during data entry sessions
6. GEDCOM Import -- long-running process, often in evening
7. Search results -- consistent experience

**Nice to have (lower priority):**
8. Settings -- less frequently accessed
9. GEDCOM Export -- infrequent use

### Dark Mode Transformation Rules

| Element Category | Light Mode | Dark Mode | Notes |
|-----------------|------------|-----------|-------|
| Page background | oklch(0.98 0.005 250) | oklch(0.15 0.01 250) | Near-white to near-black |
| Card background | oklch(1.0 0 0) | oklch(0.20 0.01 250) | White to dark gray |
| Card border | oklch(0.90 0.005 250) | oklch(0.30 0.01 250) | Light gray to medium-dark |
| Primary text | oklch(0.15 0.01 250) | oklch(0.93 0.005 250) | Near-black to near-white |
| Muted text | oklch(0.55 0.01 250) | oklch(0.60 0.01 250) | Mid-gray stays mid |
| Primary color | oklch(0.55 0.15 250) | oklch(0.70 0.12 250) | Brighter blue on dark |
| Tree canvas dots | Light gray | oklch(0.25 0.01 250) | Darker dots |
| Tree edges (confirmed) | oklch(0.40 0.05 250) | oklch(0.60 0.05 250) | Lighter on dark |
| PersonNode bg | bg-card (white) | bg-card (dark) | Card token handles this |
| MiniMap | bg-card/80 + blur | bg-card/80 + blur | Same transparency |
| Skeleton shimmer | Light gray pulse | Dark gray pulse | Adjusted animation |
| Overlay (sheets, dialogs) | black/50 | black/60 | Slightly more opaque |
| Focus ring | ring-primary | ring-primary | Both use primary, brightness auto-adjusts |
| Sex male border | oklch(0.60 0.12 240) | oklch(0.70 0.10 240) | Brighter on dark |
| Sex female border | oklch(0.65 0.12 340) | oklch(0.72 0.10 340) | Brighter on dark |
| Completion bar bg (track) | bg-muted | bg-muted (dark) | Token handles it |

### Dark Mode Implementation Notes
- Theme toggle in top bar (Sun/Moon icons) and Settings page
- Three modes: Light, Dark, System (follows prefers-color-scheme)
- shadcn/ui handles dark mode via CSS variables -- swap `:root` values under `.dark` class
- All OKLCH values defined in both light and dark sets
- No component needs special dark mode logic -- CSS variables cascade

---

## 10. Accessibility Checklist Per Screen

### Global (All Screens)

- [ ] All interactive elements reachable via Tab key
- [ ] Visible focus indicators (ring-2 ring-ring ring-offset-2) on all focusable elements
- [ ] Skip-to-main-content link (hidden until focused)
- [ ] ARIA landmark regions: nav, main, aside, footer
- [ ] Color is never the sole indicator of meaning (always paired with text/icon)
- [ ] All images have alt text
- [ ] Form fields have associated labels (htmlFor/id pairing)
- [ ] Error messages linked to fields via aria-describedby
- [ ] Toast notifications use role="status" or role="alert"
- [ ] Animations respect prefers-reduced-motion
- [ ] Min touch target: 44x44px on mobile

### Dashboard
- [ ] Stat cards are not interactive (no Tab stop) unless clickable
- [ ] Recent persons list: each row is a link with descriptive text
- [ ] Activity feed: timestamps use `<time>` element with ISO datetime
- [ ] Empty state CTAs: both "Import" and "Add Person" are keyboard-accessible
- [ ] Backup reminder: dismissible via keyboard (Escape or button)

### Tree View
- [ ] Canvas has role="application" with aria-label="Family tree canvas"
- [ ] Arrow keys navigate between nodes (left/right for siblings, up for parent, down for children)
- [ ] Enter key selects/opens node detail
- [ ] Tab cycles through toolbar controls, then to minimap, then to canvas
- [ ] MiniMap: aria-hidden="true" (decorative; keyboard users use search instead)
- [ ] PersonNode: aria-label="[Name], born [year], died [year], [sex], [completion]% complete"
- [ ] Edges: aria-hidden="true" (relationship info available in detail panel)
- [ ] Zoom controls: aria-label on each button ("Zoom in", "Zoom out", "Fit to view")
- [ ] View selector dropdown: proper aria-expanded, aria-haspopup
- [ ] Empty state: CTA buttons have clear labels
- [ ] Screen reader announcement when tree re-centers on new person
- [ ] Living person nodes: screen reader reads "Living [sex]" not actual name

### Person Detail Panel
- [ ] Sheet: role="dialog", aria-modal="true", aria-labelledby (person name)
- [ ] Close button: aria-label="Close person detail"
- [ ] Focus trapped within sheet when open
- [ ] Focus returns to trigger element when closed
- [ ] Tabs: role="tablist", each tab has role="tab", aria-selected, aria-controls
- [ ] Tab panels: role="tabpanel", aria-labelledby
- [ ] Disabled tabs: aria-disabled="true", title attribute explaining why
- [ ] Quick action buttons: aria-label for icon-only buttons ("Edit person", "Add spouse")
- [ ] Event timeline: each event is a list item in an ordered list
- [ ] Family member cards: each is a link with full descriptive text
- [ ] Completion ring: aria-label="Profile [X]% complete"

### Person Forms
- [ ] All fields have visible labels (not just placeholder text)
- [ ] Required fields marked with asterisk and aria-required="true"
- [ ] DateInput: modifier select has label "Date modifier"
- [ ] DateInput: interpreted text linked via aria-describedby
- [ ] PlaceInput: autocomplete results have role="listbox", items have role="option"
- [ ] Validation errors: field has aria-invalid="true", error message has role="alert"
- [ ] Form submission: focus moves to first error field on validation failure
- [ ] Cancel with unsaved changes: AlertDialog is focus-trapped
- [ ] "Still living" switch: aria-label includes current state

### GEDCOM Import
- [ ] Step indicator: current step announced via aria-current="step"
- [ ] Progress bar: role="progressbar", aria-valuenow, aria-valuemin, aria-valuemax, aria-label
- [ ] File upload zone: role="button" with aria-label "Upload GEDCOM file"
- [ ] Cancel button always accessible during processing
- [ ] Error messages: role="alert"
- [ ] Success summary: role="status"
- [ ] Warning list: expandable items use aria-expanded

### GEDCOM Export
- [ ] RadioGroup: proper radio role, arrow key navigation
- [ ] Privacy preview: updated live region (aria-live="polite") when radio changes
- [ ] Download button: aria-label includes format and privacy mode
- [ ] Disabled state (empty tree): aria-disabled + tooltip

### Search
- [ ] Search input: role="searchbox", aria-label="Search persons"
- [ ] Results: role="list", each result role="listitem" or link
- [ ] Sort selector: aria-label "Sort results"
- [ ] Filter checkboxes: associated labels
- [ ] No results: role="status"
- [ ] Pagination: aria-label="Pagination", current page aria-current="page"

### Command Palette
- [ ] Dialog: role="dialog", aria-modal="true"
- [ ] Input: role="combobox", aria-expanded, aria-controls
- [ ] Results: role="listbox", each item role="option"
- [ ] Active descendant tracked via aria-activedescendant
- [ ] Escape closes, Enter selects
- [ ] Screen reader: result count announced ("8 results found")

### Settings
- [ ] Tab navigation: same aria pattern as person detail tabs
- [ ] Form fields: standard label association
- [ ] Danger zone: Delete button requires confirmation dialog (focus-trapped)

---

## 11. Design Token Mapping

### How Tokens Map to Components

#### PersonNode
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Container bg | `--card` | -- | p-2 (8px) | 2px `--border`, rounded-lg (8px) |
| Left border (M) | `--sex-male` | -- | -- | 4px left |
| Left border (F) | `--sex-female` | -- | -- | 4px left |
| Name text | `--card-foreground` | text-sm, font-medium | -- | -- |
| Date text | `--muted-foreground` | text-xs | -- | -- |
| Completion bar track | `--muted` | -- | h-1 | rounded-full |
| Completion bar fill (low) | `--completion-low` | -- | -- | rounded-full |
| Completion bar fill (mid) | `--completion-medium` | -- | -- | rounded-full |
| Completion bar fill (high) | `--completion-high` | -- | -- | rounded-full |
| Selected ring | `--ring` (primary) | -- | ring-2 ring-offset-2 | -- |
| Hover shadow | -- | -- | -- | shadow-md |

#### Dashboard Stat Card
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Container bg | `--card` | -- | p-6 | rounded-lg, shadow-sm |
| Icon | `--muted-foreground` | -- | top-right, 24px | -- |
| Number | `--card-foreground` | text-2xl, font-bold | -- | -- |
| Label | `--muted-foreground` | text-sm | -- | -- |
| Trend | `--secondary` (green for positive) | text-xs | mt-1 | -- |

#### Sidebar
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Background | `--sidebar-background` | -- | -- | -- |
| Item text | `--sidebar-foreground` | text-sm | py-2 px-3, gap-3 (icon+text) | -- |
| Active item bg | `--sidebar-accent` | font-medium | -- | 3px left `--primary` |
| Hover | `--sidebar-accent` | -- | -- | -- |
| Separator | `--border` | -- | my-2 | -- |

#### DateInput
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Modifier select | standard Select tokens | text-sm | h-9 | rounded-md |
| Date text input | standard Input tokens | text-sm, font-mono | h-9 | rounded-md |
| Interpreted text | `--muted-foreground` | text-xs | mt-1 | -- |
| Error state | `--destructive` | text-xs | -- | border-destructive |
| "Between" label | `--muted-foreground` | text-sm | mx-2 | -- |

#### EventTimeline
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Vertical line | `--border` | -- | left: 12px, w-px | -- |
| Event dot/icon bg | `--muted` | -- | w-6 h-6, rounded-full | -- |
| Event icon | `--muted-foreground` | -- | 14px | -- |
| Event type label | `--foreground` | text-sm, font-medium | -- | -- |
| Date text | `--muted-foreground` | text-sm | -- | -- |
| Place text | `--muted-foreground` | text-sm | -- | -- |
| Source badge | `--secondary` | text-xs | ml-2 | rounded-full |
| Hover row | `--muted` (bg) | -- | py-2 px-3 | rounded-md |
| Add event button | `--muted-foreground` | text-sm | mt-4 | dashed border |

#### GEDCOM Import Step Indicator
| Element | Color Token | Typography | Spacing | Border |
|---------|-------------|------------|---------|--------|
| Active step circle | `--primary` bg, `--primary-foreground` text | text-sm, font-bold | w-8 h-8 | rounded-full |
| Completed step circle | `--primary` bg, `--primary-foreground` checkmark | -- | w-8 h-8 | rounded-full |
| Pending step circle | `--muted` bg, `--muted-foreground` text | text-sm | w-8 h-8 | rounded-full |
| Connecting line (done) | `--primary` | -- | h-0.5 | -- |
| Connecting line (pending) | `--border` | -- | h-0.5 | -- |
| Step label (active) | `--foreground` | text-sm, font-medium | mt-2 | -- |
| Step label (pending) | `--muted-foreground` | text-sm | mt-2 | -- |

---

## 12. Edge Cases and Open Questions

### Edge Cases to Design For

#### Tree Visualization Edge Cases

1. **Person with 12 spouses:** All partner edges render horizontally from the person node. At >3 spouses, the horizontal spread becomes wide. Design decision needed:
   - Option A: Stack spouses vertically beside the person (non-standard but compact)
   - Option B: Horizontal spread with scroll/pan (standard but wide)
   - Option C: Show primary spouse inline, "and 11 more" expandable
   - **Recommendation:** Option B -- horizontal spread is genealogically correct; dagre handles spacing. Users pan to see all.

2. **Tree with 1 person:** Covered in wireframe 3.5. Ghost boxes suggest relative positions. Centered node with prominent "Add relative" prompts.

3. **Tree with 5000+ persons:** Viewport culling renders ~100-200 nodes. MiniMap shows full extent. "Zoom to fit" shows all (very zoomed out, nodes become dots). Search is the primary navigation method. Consider "collapse distant branches" at zoom levels.

4. **Pedigree vs. descendants confusion:** When user switches from Pedigree to Descendants view, dagre re-layouts. Animate the transition? Or instant re-render?
   - **Recommendation:** Instant re-render with fitView animation (300ms). Animating node movement would be disorienting with many nodes.

5. **Circular references (data error):** If GEDCOM import creates a cycle (person is their own ancestor), dagre will infinite-loop. Detection must happen at import time. If found post-import, mark the cycle-causing edge as "disputed" and break the visual cycle.

6. **Half-siblings:** Two children sharing one parent but not the other. Dagre handles this -- they appear as children of different family groups. But visually it may not be obvious they share a parent. Design: show the shared parent in both family groups? Or single parent node with edges to both families?
   - **Recommendation:** Single parent node with edges to multiple family groups. React Flow supports this natively.

7. **Adopted children with both biological and adoptive parents:** Same child in two family groups. Show with different edge styles:
   - Biological parents: solid edge
   - Adoptive parents: dashed edge with "adopted" badge on edge
   - Both family connections visible in tree

8. **Same-sex couples:** Partner edge renders identically regardless of sex combination. No "husband/wife" labels -- use "Partner 1 / Partner 2" or just names.

#### Form Edge Cases

9. **Genealogical date "1731/32" (dual dating):** DateInput must accept and display this. Modifier: "exact". Display: "1731/32". Sort value: 17320101.

10. **Person with no name:** Can a person exist with no given name or surname? In GEDCOM imports, this happens (e.g., "Unknown" entries). Form requires given_name + surname, but GEDCOM import should handle blanks. Display: "[Unknown]" in italics.

11. **Very long names:** "Mary Anne Elizabeth Margaret von Hohenzollern-Sigmaringen" -- PersonNode needs text truncation. Detail panel shows full name. Truncation at ~20 characters with ellipsis on tree nodes.

12. **Place hierarchy depth:** "123 Main St, Springfield, Sangamon County, Illinois, United States of America" -- PlaceInput shows full hierarchical name in dropdown but truncates in the input field after selection.

#### GEDCOM Edge Cases

13. **50MB GEDCOM file:** Browser memory concern. Solution:
    - Stream parsing (read line by line, not load entire file into memory)
    - Show estimated time ("~5 minutes for large files")
    - Web Worker for parsing (don't block UI thread)
    - Progress updates every 100 records

14. **GEDCOM with 0 persons but metadata:** Valid file with HEAD record but no INDI records. Show: "This GEDCOM file contains no person data. It may only contain metadata."

15. **GEDCOM with non-UTF-8 encoding (ANSI, MacRoman):** Auto-detect and convert. Show info toast: "File was re-encoded from Windows-1252 to UTF-8."

16. **Duplicate import:** User imports the same GEDCOM twice. Phase 1: no merge, creates duplicates with warning. Show: "Your tree already has data. Importing will add alongside existing data (no merge)."

#### Search Edge Cases

17. **Search for "Living":** Should this match persons whose name was literally "Living"? Or persons flagged as living? FTS5 searches name fields -- if living persons have their name replaced with "Living" in the search index, this becomes a problem. Solution: FTS5 indexes the real name (not the privacy-filtered display). Living filter is a separate checkbox, not a name search.

18. **Search with special characters:** Names like "O'Brien", "de la Cruz", "Muller/Mueller" -- FTS5 unicode61 tokenizer handles most of these. Ensure apostrophes and hyphens don't break queries.

### Open Questions for the User

1. **Tree view type switching UX:** When switching between Pedigree/Ancestors/Descendants/Hourglass, should the canvas animate the transition or instant-switch with a fitView? Animated transitions look polished but can be disorienting with many nodes.

2. **Person Detail: inline edit vs. separate page?** The user-flows doc mentions both "inline edit" (panel switches to edit mode) and "full edit page" (/person/[id]/edit). Should Phase 1 implement BOTH, or just the full edit page? Inline edit is more complex (form within Sheet with save/cancel) but better UX for quick edits.

3. **Sidebar: always visible or auto-hide?** On tablet (768-1023px), should the sidebar auto-collapse when the person detail panel opens (to give the tree more canvas space)? Or always show the icon-only sidebar?

4. **Tree canvas: drag-to-create-edge in Phase 1?** The spec mentions drawing edges on the canvas to create relationships. This is a power-user feature. Should it be in Phase 1 wireframes, or deferred to Phase 2? It adds complexity to the tree view (connection handles visible, connection mode toggle).

5. **GEDCOM import: merge capability?** Phase 1 plan says "no merge" -- import adds alongside existing data. Should the import UI even mention merging? Or show a "Merge coming in Phase 2" note?

6. **Mobile tree view: should we support drag-to-reposition on touch?** Touch drag is used for panning. Repositioning nodes would require a mode switch (e.g., long-press to enter move mode). Is this worth the complexity for mobile Phase 1?

7. **Empty state illustration style:** Should empty states use:
   - (A) A simple line illustration (minimal, modern)
   - (B) A full-color illustration (warmer, more inviting)
   - (C) Just an icon + text (simplest to implement, no illustration assets needed)

8. **Command palette scope:** Should Cmd+K also offer actions (not just person search)? e.g., "Import GEDCOM", "Add Person", "Export Tree" as action items alongside person search results. This is how shadcn/ui Command works by default.

9. **Tree node photo display:** PersonNode spec shows an avatar with optional photo. For Phase 1, photos/media are "Could Have" (lower priority). Should wireframes show photo slots on tree nodes, or defer photo display entirely until Phase 3?

10. **Settings page breadth:** How much settings UI is needed for Phase 1? The user-stories mark Settings as "Should Have" but Profile/Account as "Could Have." Should wireframes include login/auth UI, or is this truly Phase 4 (auth)?

11. **Person detail panel width on desktop:** Fixed 400px or resizable by dragging the edge? Resizable is more flexible but adds implementation complexity.

12. **Keyboard navigation order on tree page:** What should the Tab order be?
    - Proposed: Top bar -> Sidebar nav -> Tree toolbar -> Canvas (arrow keys within) -> MiniMap controls -> Person detail panel (if open)
    - Or should the tree canvas be Tab-skippable (users use Cmd+K to find people instead)?

---

## Appendix A: Interactive Prototype Specifications

### Prototype 1: Add Person from Tree (Primary Flow)

**Screens connected in sequence:**
1. Tree View (default, with existing nodes) -- click a person node
2. Person Detail Panel opens (slides in from right)
3. Click "Add Mother" in quick actions
4. Dialog opens: "Search existing or Create new?"
5. Click "Create New Person"
6. Person Create Form opens (with context banner: "Adding mother of [Name]")
7. Fill in form fields (show pre-filled sex=F since "mother")
8. Click "Save"
9. Return to Tree View -- new node appears above original person with parent-child edge
10. Person Detail Panel updates to show new mother in "Family Members"

**Interactions to prototype:**
- Sheet slide-in animation (200ms)
- Button hover states
- Dialog open/close
- Form field focus states
- Success toast appearance
- Tree node appearance animation

### Prototype 2: GEDCOM Import (5-Step Wizard)

**Screens connected:**
1. Import Step 1 (upload zone) -- click "Browse Files"
2. File selected state -- click "Continue"
3. Import Step 2 (processing, progress bar animation)
4. Import Step 3 (preview with stats, warnings)
5. Click "Import X Persons"
6. Import Step 4 (live count, progress bar)
7. Import Step 5 (success summary) -- click "View Tree"
8. Tree View with newly imported data

### Prototype 3: Search -> Select -> View Detail

**Screens connected:**
1. Any page -- press Cmd+K
2. Command palette opens
3. Type "smith" -- results appear
4. Click "John William Smith"
5. Command palette closes
6. Tree View centers on John William Smith
7. Person Detail Panel opens with John's data

---

## Appendix B: Component Interaction Patterns

### Hover Interactions
| Component | Hover Effect |
|-----------|-------------|
| PersonNode (tree) | shadow-md, cursor: pointer |
| Sidebar nav item | bg-sidebar-accent |
| Person card (search/dashboard) | bg-muted |
| Button (all variants) | Slightly darker/lighter bg per variant spec |
| Event timeline row | bg-muted, rounded-md |
| Family member card | bg-muted |
| Stat card | Not hoverable (static) |
| Upload zone | Border turns primary, bg-primary/5 |
| Command palette result | bg-accent |

### Click/Tap Interactions
| Component | Click Effect |
|-----------|-------------|
| PersonNode (tree) | Selected state (ring-2 ring-primary), opens detail panel |
| PersonNode double-click | Re-centers tree on this person |
| Sidebar nav item | Navigate to route, active state |
| Person card | Navigate to person or open detail panel |
| Quick action button | Execute action (navigate, open dialog) |
| Tab | Switch tab content, underline animation |
| Accordion header | Expand/collapse, chevron rotation |
| Breadcrumb segment | Re-center tree on that person |
| MiniMap | Jump to clicked location |

### Drag Interactions
| Component | Drag Effect |
|-----------|-------------|
| PersonNode (tree) | Node follows cursor, shadow-lg during drag, position saved on drop |
| Tree canvas background | Pan (move viewport) |
| MiniMap viewport rect | Pan canvas to match |
| Upload zone file drop | Border turns primary, file info appears |
| Sheet/Drawer handle | Resize (mobile only) |

### Keyboard Interactions
| Context | Key | Action |
|---------|-----|--------|
| Global | Cmd+K / Ctrl+K | Open command palette |
| Global | Escape | Close any open overlay (sheet, dialog, command palette) |
| Tree canvas | Arrow Up | Navigate to parent node |
| Tree canvas | Arrow Down | Navigate to first child node |
| Tree canvas | Arrow Left | Navigate to previous sibling |
| Tree canvas | Arrow Right | Navigate to next sibling |
| Tree canvas | Enter | Select node (open detail panel) |
| Tree canvas | + | Zoom in |
| Tree canvas | - | Zoom out |
| Tree canvas | 0 | Fit to view |
| Tree canvas | Delete | Delete selected node (with confirmation) |
| Form | Tab | Next field |
| Form | Shift+Tab | Previous field |
| Form | Enter | Submit form (when on submit button) |
| Dialog | Tab | Cycle through dialog buttons (focus trapped) |
| Command palette | Arrow Up/Down | Navigate results |
| Command palette | Enter | Select result |
| Tabs | Arrow Left/Right | Switch between tabs |

### Touch Interactions (Mobile)
| Gesture | Context | Action |
|---------|---------|--------|
| Tap | PersonNode | Select, open bottom drawer |
| Long press | PersonNode | Enter drag mode (move node) |
| Pinch | Tree canvas | Zoom in/out |
| Two-finger drag | Tree canvas | Pan |
| One-finger drag | Tree canvas | Pan (when no node selected) |
| Swipe down | Bottom drawer | Collapse or dismiss |
| Swipe up | Bottom drawer handle | Expand to 90vh |
| Tap | Bottom tab | Navigate |

---

## Appendix C: Estimated Effort Summary

| Task | Effort | Dependencies |
|------|--------|-------------|
| Step 0.3R: Flow diagrams in Figma | 1 day | Markdown flows (done) |
| Step 0.4R: Design system in Figma | 1.5 days | Markdown design system (done) |
| Step 0.5: Lo-Fi wireframes (desktop + mobile + tablet) | 3 days | 0.3R + 0.4R |
| Step 0.6: Hi-Fi mockups + dark mode + prototypes | 3 days | 0.5 |
| **Total** | **8.5 days** | |

Buffer for iteration/revision: 1.5 days
**Grand total: ~10 working days (2 calendar weeks)**

### Gate Criteria Checklist (Phase 0 -> Phase 1)

- [ ] All Phase 1 screens have approved hi-fi mockups (9 desktop + 11 mobile + 3 tablet = 23+ frames)
- [ ] Design system tokens defined and documented in Figma (colors, typography, spacing, radii, shadows)
- [ ] Component inventory maps to shadcn/ui (28 base + 8 custom = 36 component sets in Figma)
- [ ] User flows cover all Phase 1 features (6 flow diagrams with happy path + edge cases)
- [ ] Mobile responsive considerations documented (375px + 768px variants for all key screens)
- [ ] Dark mode variants for key screens (tree view, dashboard, detail panel, command palette)
- [ ] Empty/loading/error states designed (state matrix covers all screens, ~8 states each)
- [ ] docs/design/ folder has all 8 markdown deliverables (DONE)
- [ ] Interactive prototypes for 3 core flows (add person, GEDCOM import, search-to-detail)
