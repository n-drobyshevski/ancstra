# Phase 0 Figma Artifacts — User Flows & Design System

> Spec for creating Figma design artifacts in the existing Ancstra file.
> Covers user flow diagrams (6 flows) and design system foundations + custom components.

---

## Context

All markdown deliverables for Phase 0 are complete (user-flows.md, design-system.md, component-inventory.md, figma-design-sprint.md). This spec covers translating those markdown specs into visual Figma artifacts inside the existing Ancstra design file.

**Figma File:** `TODiDe7Q8soPIol7zmC0r9`
**Source Docs:** `docs/design/user-flows.md`, `docs/design/design-system.md`, `docs/design/component-inventory.md`, `docs/design/figma-design-sprint.md`

---

## Approach

1. Build each section as a standalone HTML page with SVG diagrams and styled specimens
2. Preview in browser for iteration
3. Capture into Figma via `generate_figma_design` MCP tool with `outputMode: existingFile`
4. One capture per section (12 content captures + placeholder pages)

---

## Visual Style: A4 Ancstra Branded

All diagrams and specimens use the Ancstra design system palette:

| Element | Fill | Stroke | Text |
|---------|------|--------|------|
| Start/End node | `#e8f5e9` | `#4caf50` 1.5px | `#2e7d32` Inter 600 |
| Screen/Page node | `#e3f2fd` | `#5c7cba` 1.5px | `#1a3a5c` Inter 500 |
| Decision diamond | `#fff8e1` | `#f9a825` 1.5px | `#e65100` Inter 500 |
| Error/Edge case | `#ffebee` | `#ef5350` 1px | `#c62828` Inter 400 |
| Annotation | `#f5f5f5` | `#bdbdbd` 1px dashed | `#757575` Inter 400 |
| Action label (pill) | `#fff8e1` | `#f9a825` 1px | `#e65100` Inter 500 |
| Branch label (pill) | context color bg | context border | context text |
| Connector lines | — | `#b0bec5` 1.5px | — |
| Arrow heads | `#90a4ae` fill | — | — |

- Font: Inter (system-ui fallback)
- Screen nodes have a "SCREEN" type label in small caps above the route name
- Screen nodes have a 4px colored left accent bar (primary blue)
- Border radius: 8px for screens, 17px (pill) for start/end, 4px for labels
- Background: white (`#ffffff`) or near-white (`#fafbfd`)

---

## Figma File Structure

12 pages, following the sprint plan numbering:

```
Ancstra Design
 0. Cover                    ← placeholder (title frame only)
 1. Research                 ← placeholder
 2. User Flows               ← 6 flow diagram frames (ACTIVE)
 3. Wireframes-Desktop       ← placeholder
 4. Wireframes-Mobile        ← placeholder
 5. Wireframes-Tablet        ← placeholder
 6. Design System            ← 14 frames: 6 foundation + 8 custom (ACTIVE)
 7. Hi-Fi Desktop            ← placeholder
 8. Hi-Fi Mobile             ← placeholder
 9. Hi-Fi Tablet             ← placeholder
10. Prototypes               ← placeholder
11. UX Roadmap               ← placeholder
```

---

## Page 2: User Flows — 6 Frames

Scope: Happy paths + key decision branches. Error branches deferred to pass 2.

### Frame 2.1: Add Person (Manual Entry) — ~1200x900

Source: `docs/design/user-flows.md` Flow 1

**Nodes:**
```
[START]
  → [Dashboard or Tree View]                    SCREEN
  → <Global or Contextual?>                     DECISION
    → Global path:
      → [Click "Add Person" in sidebar]         ACTION
      → [/person/new — blank form]              SCREEN
    → Contextual path:
      → [Click person on tree]                  ACTION
      → [Person Detail Panel]                   SCREEN
      → [Click "Add Father/Mother/Spouse/Child"] ACTION
      → <Search existing or Create new?>        DECISION
        → Search: [PersonSelect] → [Select] → [Confirm relationship]
        → Create: [/person/new pre-filled with context]
  → [Form validation passes]                    ACTION
  → [Person created]                            SCREEN /person/[id]
  → [Optional: "Add Relative" prompt]           ANNOTATION
[END]
```

### Frame 2.2: Import GEDCOM — ~1200x700

Source: `docs/design/user-flows.md` Flow 2

**Nodes:**
```
[START]
  → [Click "Import" in sidebar]                 ACTION
  → [/import — Step 1: Upload Zone]             SCREEN
  → [Step 2: Processing — progress bar]         SCREEN
  → [Step 3: Preview — stats + warnings]        SCREEN
  → [Step 4: Confirm Import]                    SCREEN
  → [Step 5: Success Summary]                   SCREEN
  → ["View Tree" button]                        ACTION
  → [/tree]                                     SCREEN
[END]
```

Linear 5-step wizard. Mostly sequential with minimal branching.

### Frame 2.3: Navigate Tree — ~1400x800

Source: `docs/design/user-flows.md` Flow 3

**Nodes:**
```
[START]
  → [/tree — canvas loaded with auto-layout]    SCREEN
  → PARALLEL ACTIONS (fan-out layout):
    → Zoom (mouse wheel / pinch)
    → Pan (click-drag / touch-drag)
    → Click node → [Person Detail Sheet]        SCREEN
      → [Click "Focus"] → tree re-centers
    → Switch view dropdown → Pedigree | Ancestors | Descendants | Hourglass
    → Drag node → position saved (debounced)
    → Minimap click → canvas jumps
    → Breadcrumb click → re-center
[END]
```

Hub-and-spoke layout with /tree as the central node and parallel actions radiating out.

### Frame 2.4: Search & Filter — ~1200x800

Source: `docs/design/user-flows.md` Flow 4

**Nodes:**
```
[START]
  → PATH A: Global Search
    → [Cmd+K or click search bar]               ACTION
    → [Command palette opens]                    SCREEN
    → [Type query — typeahead results (top 8)]   SCREEN
    → <Found?>                                   DECISION
      → Yes: [Click result] → [Person Detail + tree centers]
      → Partial: ["View all results"] → PATH B
  → PATH B: Search Results Page
    → [/search?q=query]                          SCREEN
    → [Filter sidebar + results list + sort]     SCREEN
    → [Click result] → [Person Detail]           SCREEN
[END]
```

Two parallel paths converging at Person Detail.

### Frame 2.5: Edit Person — ~1200x700

Source: `docs/design/user-flows.md` Flow 5

**Nodes:**
```
[START]
  → PATH A: From Detail Panel
    → [Person Detail Panel]                      SCREEN
    → [Click "Edit"]                             ACTION
  → PATH B: Direct URL
    → [/person/[id]/edit]                        SCREEN
  → [Form pre-populated: names, dates, events, sources, notes]
  → [Click "Save"]                               ACTION
  → <Valid?>                                     DECISION
    → Yes: [Optimistic update → /person/[id] → success toast]
    → No: [Inline errors, scroll to first]
[END]
```

Two entry paths converging at edit form.

### Frame 2.6: Link Relationships — ~1400x900

Source: `docs/design/user-flows.md` Flow 6

**Nodes:**
```
[START]
  → [Person Detail Panel]                        SCREEN
  → [Click "Add Relative" dropdown]              ACTION
  → <Which type?>                                DECISION
    → Add Spouse:
      → [Modal: "Link spouse for [Name]"]        SCREEN
      → [Search existing OR create new]
      → [Select relationship type]
      → [Save → family record → tree re-renders]
    → Add Parent (Father/Mother):
      → [Search existing OR create new]
      → <Existing family with open slot?>        DECISION
        → Yes: add to existing
        → No: create new family
      → [Child link created → tree updates]
    → Add Child:
      → <Multiple spouses?>                      DECISION
        → Yes: ["Which family?" selector]
        → No: proceed
      → [Search existing OR create new]
      → [Select child relationship type]
      → [Save → tree updates]
[END]
```

Three-branch decision tree, most complex flow.

---

## Page 6: Design System — 14 Frames

### Foundations (6 frames)

#### Frame 6.1: Color Palette — ~1400x600

Source: `docs/design/design-system.md` Core Tokens

Light and dark mode side by side. Each swatch: 80x80px rounded rectangle with:
- Color fill
- CSS variable name (e.g. `--primary`)
- OKLCH value (e.g. `oklch(0.55 0.15 250)`)

**Rows:** Primary (2), Secondary (2), Accent (2), Destructive (2), Surfaces (4), Text (2), Borders (3), Sidebar (3) = 20 swatches x 2 modes = 40 swatches total.

#### Frame 6.2: Semantic Colors — ~1200x500

Source: `docs/design/design-system.md` Genealogy-Specific Semantic Colors

**Categories with mini usage examples:**
- Sex indicators: blue/pink/gray — show as TreeNode left border examples
- Validation statuses: green/blue/amber — show as relationship line segments
- Completion: red/amber/green — show as progress bar segments
- Living badge: green — show as badge specimen

Light + dark variants side by side.

#### Frame 6.3: Typography Scale — ~1200x500

Source: `docs/design/design-system.md` Typography

7 levels with real specimen text:

| Token | Specimen | Size | Weight | Line Height | Usage |
|-------|----------|------|--------|-------------|-------|
| text-xs | "Last modified 3 hours ago" | 12px | 400 | 1rem | Metadata |
| text-sm | "Given Name" | 14px | 500 | 1.25rem | Form labels |
| text-base | "John was born in Springfield..." | 16px | 400 | 1.5rem | Body |
| text-lg | "John William Smith" | 18px | 600 | 1.75rem | Person name |
| text-xl | "Family Tree" | 20px | 600 | 1.75rem | Page titles |
| text-2xl | "456" | 24px | 700 | 2rem | Dashboard stats |
| text-3xl | "Welcome to Ancstra" | 30px | 700 | 2.25rem | Landing |

Plus font stack info and mono specimen.

#### Frame 6.4: Spacing & Grid — ~1400x600

Source: `docs/design/design-system.md` Spacing & Layout

- 4px base unit ruler (markings at 4, 8, 12, 16, 24, 32, 48, 64px)
- Layout diagrams for 3 breakpoints:
  - Desktop: sidebar 240px + main (fluid) + detail panel 400px, top bar 56px
  - Tablet: sidebar 64px + main + detail panel 50%
  - Mobile: full-width, bottom tab bar 64px, top bar 56px
- Spacing token examples: card padding, form gaps, page padding

#### Frame 6.5: Border Radius & Shadows — ~1000x400

Source: `docs/design/design-system.md` Border Radius + Shadows

Specimen boxes:
- `rounded-md` (6px) — buttons, inputs
- `rounded-lg` (8px) — cards, tree nodes
- `rounded-xl` (12px) — modals, sheets
- `rounded-full` (50%) — avatars, badges

Shadow specimens:
- `shadow-sm` — cards
- `shadow-md` — dropdowns, hover
- `shadow-lg` — modals
- `ring-2 ring-primary` — selected state

#### Frame 6.6: Icon Set — ~1200x500

Source: `docs/design/component-inventory.md` Icon Mapping

Grid of 38 Lucide icons at 20px with labels. Grouped:
- Person (3): User, UserPlus, Users
- Navigation (6): GitBranch, Search, SlidersHorizontal, Home, Settings, ChevronRight
- Actions (6): Upload, Download, Pencil, Trash2, Plus, X
- Data (4): FileText, Calendar, MapPin, BookOpen
- Privacy (2): Eye, EyeOff
- Zoom (3): ZoomIn, ZoomOut, Maximize2
- Theme (2): Sun, Moon
- Events (8): Baby, Cross, Heart, Shield, Ship, House, ClipboardList, Briefcase
- Feedback (4): AlertTriangle, CheckCircle, XCircle, Info

### Custom Components (8 frames)

#### Frame 6.7: DateInput — ~800x400

Source: `docs/design/component-inventory.md` Custom Component 1

States shown:
1. Exact date: `[Exact ▾] [15 Mar 1872]` → "Interpreted: 15 March 1872"
2. Between: `[Between ▾] [Jan 1880] [and] [Dec 1885]`
3. About: `[About ▾] [1880]`
4. Before/After variants

Built with: Select (modifier) + Input (date text) + helper text below.

#### Frame 6.8: PlaceInput — ~800x400

Source: `docs/design/component-inventory.md` Custom Component 2

States:
1. Idle: empty input with search icon
2. Searching: input with typed text, loading indicator
3. Results: dropdown with hierarchical place names
4. "Add new place" option at bottom of dropdown

#### Frame 6.9: PersonSelect — ~800x400

Source: `docs/design/component-inventory.md` Custom Component 3

States:
1. Idle: "Search for a person..." placeholder
2. Results: dropdown with avatar + name + life dates per result
3. "Create New Person" option at bottom

#### Frame 6.10: TreeNode / PersonNode — ~1000x500

Source: `docs/design/component-inventory.md` Custom Component 4

Variant matrix:
- Sex: Male (blue left border), Female (pink), Unknown (gray)
- States: Default, Hover (shadow-md), Selected (ring-2 ring-primary), Living (name shown, dates may be hidden)
- Each shows: avatar/initials + name + life dates + completion bar
- 3 sex x 4 states = 12 variants

#### Frame 6.11: Relationship Lines — ~800x300

Source: `docs/design/component-inventory.md` Custom Component 5

Three line types with labels:
- Confirmed: solid, `--line-confirmed` color
- Proposed: dashed (`stroke-dasharray: 8 4`), `--line-proposed` color
- Disputed: dotted (`stroke-dasharray: 2 2`), `--line-disputed` color

Show as connecting two mini TreeNode specimens.

#### Frame 6.12: TreeMiniMap — ~600x400

Source: `docs/design/component-inventory.md` Custom Component 6

- Simplified tree (dots for nodes, thin lines for connections)
- Viewport rectangle (draggable, semi-transparent blue)
- Position: bottom-right corner overlay
- Show in context within a larger tree frame

#### Frame 6.13: CompletionBar + CompletionRing — ~800x300

Source: `docs/design/component-inventory.md` Custom Component 7

Bar variant (for tree nodes):
- Low (<25%): red `--completion-low`
- Medium (25-75%): amber `--completion-medium`
- High (>75%): green `--completion-high`

Ring variant (for person detail header):
- Same thresholds, circular progress indicator
- Percentage text in center

#### Frame 6.14: EventTimeline — ~800x500

Source: `docs/design/component-inventory.md` Custom Component 8

5 events with Lucide icons:
- Birth (Baby) — 15 Mar 1845, Springfield, IL
- Baptism (Cross) — 20 Mar 1845, First Baptist Church
- Marriage (Heart) — 12 Jun 1870, Chicago, IL — "to Mary Johnson"
- Residence (House) — 1880, Cook County, IL — "Census record"
- Death (Cross) — 23 Nov 1923, Chicago, IL

Plus "Add Event" button at bottom.

---

## Pass 2 (Deferred)

After pass 1 is captured and reviewed:

- Error/edge-case branches added to all 6 flow diagrams
- State transition annotations on flows
- shadcn/ui base component variants (optional — CLI kit available)
- Dark mode variants for all custom components
- Additional TreeNode states (focused, drag preview)

---

## Execution Order

1. Create Figma placeholder pages (0-11)
2. Build + capture Flow 2.1 (Add Person) — validate capture quality
3. Build + capture remaining flows (2.2-2.6)
4. Build + capture design system foundations (6.1-6.6)
5. Build + capture custom components (6.7-6.14)
6. Review all frames in Figma, adjust as needed
