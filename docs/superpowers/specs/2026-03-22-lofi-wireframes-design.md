# Lo-Fi Wireframes — Design Spec

> 21 component wireframes (15 desktop + 6 mobile) for Phase 1 screens.
> Real component shapes in desaturated palette. Same HTML-to-Figma capture pipeline.

---

## Context

All user flows (7) and design system frames (14) are complete in Figma. This spec covers the next step: lo-fi wireframes that show actual page layouts with real components, typography, and spacing — but no brand colors.

**Figma File:** `TODiDe7Q8soPIol7zmC0r9`
**Depends on:** `docs/superpowers/specs/2026-03-22-figma-artifacts-design.md`, `docs/design/style-philosophy.md`

---

## App Shell

The persistent layout that wraps every page. All wireframes inherit this structure.

### Desktop Shell

```
+--+-----------------------------------------------------+
|  | [=] Dashboard    Search... Ctrl+K           (avatar) | <- Header 56px
|  +------------------------------------------+----------+
|S |                                           |  Detail  |
|i |                                           |  Panel   |
|d |           Page Content                    |  400px   |
|e |           (fluid width)                   | (optional|
|b |                                           |  only on |
|a |                                           |  tree)   |
|r |                                           |          |
|64|                                           |          |
+--+------------------------------------------+----------+
```

**Sidebar (64px collapsed / 240px expanded):**
- Collapsed by default (icon-only, 64px)
- Expandable to 240px with labels via toggle button or SidebarRail hover
- Nav items: Dashboard (Home icon), Tree (GitBranch), Search (Search), Research (BookOpen), Import (Upload)
- Footer: Settings (Settings icon)
- Active item: highlighted background + primary icon color
- Logo: "A" in primary-colored rounded square, top of sidebar

**Header (56px, inside SidebarInset):**
- Left: sidebar toggle button + breadcrumb/page title
- Right: search trigger ("Search... Ctrl+K" in bordered input) + user avatar circle
- Border-bottom separates from content

**Content zone:**
- Fluid width between sidebar and optional detail panel
- Page-specific padding (24px default)
- No max-width constraint (content fills available space)

**Detail panel (400px, Tree View only):**
- Right-side Sheet component, visible only when a person is selected on the tree
- Resizable via drag on left edge (min 300px, max 500px, persisted)
- Header: avatar + name + dates + close button
- Tabs: Overview | Sources | Media* | Matches* (disabled future tabs with tooltip)
- All other pages: panel not rendered, content uses full width

### Mobile Shell

```
+-------------------------------+
| [A] Dashboard             [Q] | <- Top bar 56px
+-------------------------------+
|                               |
|        Page Content           |
|        (full width)           |
|                               |
+-------------------------------+
| Home  Tree  Search  Rsch  Set | <- Bottom tabs 64px
+-------------------------------+
```

**Top bar (56px):**
- Left: brand icon (28px rounded square) + page title (14px semibold)
- Right: search icon button
- No sidebar on mobile

**Bottom tab bar (64px):**
- 5 tabs: Home (Home icon), Tree (GitBranch), Search (Search), Research (BookOpen), Settings (Settings)
- Active tab: primary-colored icon + label
- Import/Export: accessed from Dashboard quick actions or Settings > Data tab

**Content:** full viewport width, scrollable

---

## Wireframe Visual Treatment

### Palette (desaturated)

```css
--wf-bg:          #ffffff;
--wf-surface:     #f5f6f8;
--wf-border:      #d8dce4;
--wf-text:        #2a2e38;
--wf-text-muted:  #8890a0;
--wf-placeholder:  #b0b8c4;
--wf-active:      #5a6070;
--wf-highlight:   #eceef8;
```

- **No brand colors.** All components rendered in grayscale.
- **Sex indicator borders:** light gray (#c0c8d4) / medium gray (#9098a8) / dark gray (#6870808) instead of blue/pink/gray.
- **Completion bars:** single gray tone, width varies.
- **Badges:** gray background with dark text.

### Component Treatment

- **Real typography:** Inter font at actual scale sizes (12-30px)
- **Real spacing:** 4px grid, actual padding/gap values
- **Real component shapes:** tree nodes, inputs, dropdowns, badges, progress bars — all rendered with their actual dimensions but in grayscale
- **Real content:** genealogy names and dates, not lorem ipsum
- **Annotations:** optional small labels outside the frame edge pointing to key layout elements

---

## Screen Specifications — Desktop (15)

### WF-01: Dashboard (default)

**Frame:** 1280px wide

**Layout:**
- App shell with sidebar collapsed (64px)
- No detail panel (full-width content)

**Content:**
- **Stats row** (3 cards): Persons count (847), Families count (312), Completion (68%) — each in a bordered card with large number + label
- **Quick actions row** (3 buttons): "+ Add Person" (primary), "Import GEDCOM" (secondary), "New Research Session" (secondary)
- **Recent tree preview** (card): small embedded tree visualization with 4-6 nodes, "View Tree" link
- **Recent activity** (list): 4-5 items showing recent edits ("Added John Smith", "Edited Mary Johnson", etc.) with timestamps

### WF-02: Dashboard (empty state)

**Frame:** 1280px wide

**Layout:** same shell

**Content:**
- **Centered empty state:**
  - Heading: "Start building your tree." (text-xl, semibold)
  - Numbered steps:
    1. Add yourself
    2. Add your parents
    3. Keep going
  - Primary CTA: "Add your first person" button
  - Secondary: "Import a GEDCOM file" text link
- No stats, no activity, no tree preview

### WF-03: Tree View (populated)

**Frame:** 1280px wide

**Layout:**
- App shell with sidebar collapsed
- No detail panel (full-width canvas)

**Content:**
- **Toolbar** (48px, floating at top of canvas): View selector tabs (Pedigree | Ancestors | Descendants | Hourglass), person search input ("Search person..."), spacer, zoom controls (-, +, fit), export dropdown
- **Tree canvas** (full remaining area): 8-10 tree nodes connected with lines. Mix of male/female/unknown nodes. Dagre auto-layout (top-down). Nodes show: avatar initials + name + dates + completion bar (all in grayscale)
- **Minimap** (140x90px, bottom-right corner): simplified dot view with viewport rectangle
- **Floating "+" button** (bottom-left): add person to canvas

### WF-04: Tree View (empty state)

**Frame:** 1280px wide

**Layout:** same shell, full canvas

**Content:**
- Centered in canvas:
  - Heading: "Your family tree is empty"
  - Two CTAs side by side: "Add your first person" (primary button), "Import GEDCOM" (secondary button)
- No toolbar, no minimap

### WF-05: Tree View + Person Detail Panel

**Frame:** 1280px wide

**Layout:**
- App shell with sidebar collapsed
- Detail panel open (400px, right side)
- Canvas occupies remaining width (~836px)

**Canvas (left):** Same as WF-03 but narrower. One node visually highlighted (selected state: ring outline).

**Detail Panel (right, 400px):**
- Header: avatar (44px circle) + name (text-lg semibold) + dates (text-sm muted) + close X button
- Completion ring (44px) in top-right of header
- Tabs: Overview | Sources | Media* | Matches* (disabled future tabs with tooltip) (border-bottom active indicator)
- Overview tab content:
  - Relationships section: Father, Mother, Spouse(s), Children — each as a linked name
  - "Add Relative" dropdown button
  - "Edit" button, "Focus on Tree" button
- Resize handle on left edge (3px drag zone)

### WF-06: Person Create Form

**Frame:** 1280px wide

**Layout:** App shell, no detail panel. Content centered at max-width 720px.

**Content:**
- Page title: "Add New Person"
- **Required section:**
  - Given Name input + Surname input (side by side)
  - Sex select (Male / Female / Unknown)
- **Dates section:**
  - Birth: DateInput component (modifier select + date input + helper text)
  - Birth place: PlaceInput component (search with autocomplete)
  - Death: DateInput component
  - Death place: PlaceInput component
  - "Still living" toggle switch
- **Events section** (collapsible):
  - "Add Event" button, event rows when expanded
- **Notes section:**
  - Textarea
- **Sources section** (collapsible):
  - "Link Source" button
- **Footer:** "Save" primary button + "Cancel" ghost button

### WF-07: Person Edit Form

**Frame:** 1280px wide

**Layout:** Same as WF-06

**Content:** Same form structure as WF-06 but:
- Page title: "Edit John Smith"
- All fields pre-populated with data
- Events section expanded with 2-3 existing events
- "Delete Person" destructive button at bottom (separated by divider)

### WF-08: GEDCOM Import (5-step wizard)

**Frame:** 1280px wide, taller (~1400px to show all 5 steps)

**Layout:** App shell, content centered at max-width 640px.

**Content (vertical scroll, all 5 steps visible):**
- Step indicator at top: 1 — 2 — 3 — 4 — 5 (horizontal dots/line with labels)
- **Step 1 — Upload:** dashed border dropzone (large), "Drag and drop or browse" text, file type note
- **Step 2 — Processing:** progress bar (60%), status text "Parsing records...", cancel button
- **Step 3 — Preview:** stats card (X persons, Y families, Z events, W sources), warnings list (collapsible, 2-3 items), detected source software
- **Step 4 — Confirm:** summary sentence "Import 847 persons into your tree?", "Import" primary button, "Cancel" secondary
- **Step 5 — Success:** checkmark icon, summary stats, "View Tree" primary button, "View Import Log" link

### WF-09: GEDCOM Export + Privacy Preview

**Frame:** 1280px wide

**Layout:** App shell, content centered at max-width 640px.

**Content:**
- Page title: "Export Tree"
- **Format selector:** radio group — GEDCOM 5.5.1 (selected), GEDCOM 7.0 (coming soon, disabled)
- **Privacy mode:** 3 radio cards:
  - "Full tree (private)" — includes all records
  - "Shareable tree" — strips living persons
  - "Ancestors only" — deceased ancestors only
- **Preview section:** "This export will include:" — person count, family count, "X living persons will be [included/excluded]"
- **Download button:** primary, "Download .ged file"

### WF-10: Search Results

**Frame:** 1280px wide

**Layout:** App shell, no detail panel.

**Content:**
- **Search input** at top (full width, pre-filled with query, focused)
- **Two-column layout below:**
  - **Filter sidebar (240px, left):** Sex checkboxes (Male, Female, Unknown), Living status radio (All, Living, Deceased), Has Sources checkbox, Birth year range (from-to inputs)
  - **Results (right, fluid):** Sort dropdown (Relevance | Name A-Z | Birth Date), 6-8 person result cards. Each card: avatar + name (semibold) + dates + parent info + "last modified" timestamp. Pagination at bottom.

### WF-11: Command Palette (Ctrl+K overlay)

**Frame:** 1280px wide (shows behind the overlay dimmed)

**Content:**
- **Dimmed backdrop** over the full page
- **Centered modal** (540px wide, max 400px tall):
  - Search input at top (auto-focused, placeholder "Search persons, actions...")
  - **Results grouped:**
    - "Persons" group: 3-4 person results (avatar + name + dates)
    - "Research" group: 1-2 matching research sessions (if query matches session title)
    - "Actions" group: "Add Person", "Import GEDCOM", "New Research Session", "Settings"
  - Keyboard hint at bottom: arrow keys to navigate, Enter to select, Esc to close

### WF-12: Research Sessions (card grid)

**Frame:** 1280px wide

**Layout:** App shell, no detail panel.

**Content:**
- Page title: "Research" + search input + "+ New Session" button
- **Card grid (3 columns):** 4-5 session cards. Each card: title (semibold), note count + last edited, person tags (small badges), preview snippet of first note
- **Empty slot:** dashed border card with "+" icon and "New Session" text

### WF-13: Research Session Detail

**Frame:** 1280px wide

**Layout:** App shell, no detail panel. Content at max-width 800px centered.

**Content:**
- **Breadcrumb:** Research / Smith family origins
- **Header:** session title (text-xl bold), tagged person badge, "Tag Person" secondary button, "Create Person from Findings" primary button
- **Notes list:** 3-4 note cards, each with:
  - Note title (semibold) + timestamp (muted, right-aligned)
  - Note content text (2-3 lines)
  - Source URL (if present, styled as link)
- **"+ Add Note"** dashed button at bottom

### WF-14: Settings

**Frame:** 1280px wide

**Layout:** App shell, no detail panel. Content centered at max-width 720px.

**Content:**
- Page title: "Settings"
- **3 tabs:** Privacy | Data | Theme
- **Privacy tab (default):**
  - "Living person threshold" — number input (default 100 years)
  - "Default export privacy" — radio (Full / Shareable / Ancestors only)
- **Data tab:**
  - "Backup database" — button + last backup date
  - "Import GEDCOM" — button (links to /import)
  - "Export GEDCOM" — button (links to /export)
  - "Reset database" — destructive button with warning
- **Theme tab:**
  - Radio group: Light / Dark / System
  - Preview swatch of current theme

### WF-15: Person Detail Page (standalone)

**Frame:** 1280px wide

**Layout:** App shell, no detail panel. Content centered at max-width 800px.

**Content:**
This is the full-page view at `/person/[id]` — the destination after creating a person, or when navigating from search results. Uses the same content structure as the tree's detail panel but as primary page content (not a sheet).

- **Header:** large avatar (56px) + name (text-xl bold) + dates + completion ring (56px)
- **Action bar:** "Edit" button, "Add Relative" dropdown, "View on Tree" link
- **Tabs:** Overview | Sources | Media* | Matches* (disabled future tabs with tooltip)
- **Overview tab:**
  - Event timeline (chronological, using EventTimeline component)
  - Relationships section: cards for Father, Mother, Spouse(s), Children — each clickable
  - Notes section
- **Sources tab:** list of linked sources with citation text

> Note: This screen shares content structure with WF-05's detail panel. The difference is layout context — here it's the main page content, not a side sheet.

---

## Screen Specifications — Mobile (6)

> **Note on mobile Import and Settings:** These screens reflow to single-column on mobile using the same content as their desktop versions (WF-08, WF-14). No separate mobile wireframes — the mobile shell (top bar + bottom tabs) wraps the same content at 375px width. The 5-step import wizard stacks vertically; settings tabs become an accordion on mobile.

### WF-16: Mobile Tree View

**Frame:** 375px wide

**Layout:** Mobile shell (top bar + bottom tabs)

**Content:**
- Full-screen tree canvas with 4-5 visible nodes
- Floating "+" FAB (56px circle, bottom-right, above tab bar)
- No toolbar (pinch to zoom, tap node to select)
- When node tapped: bottom sheet rises with person summary + "View Detail" button

### WF-17: Mobile Person Detail

**Frame:** 375px wide, tall (~800px)

**Layout:** Full-screen drawer (90vh), slide up from bottom. No bottom tabs visible.

**Content:**
- Drag handle at top (centered bar)
- Person header: avatar + name + dates + completion ring
- Tabs: Overview | Sources | Media* | Matches* (disabled future tabs with tooltip)
- Single-column content
- "Edit" button + "Add Relative" button in header actions
- Swipe down or X to dismiss

### WF-18: Mobile Person Create Form

**Frame:** 375px wide, tall (~900px)

**Layout:** Mobile shell, no bottom tabs (full-screen form mode)

**Content:**
- Top bar: "< Back" + "Add Person" title
- Single-column form: all fields stacked
- DateInput components at full width
- Events section collapsed (accordion)
- Sticky "Save" button at bottom (fixed, always visible)

### WF-19: Mobile Search Results

**Frame:** 375px wide

**Layout:** Mobile shell (top bar + bottom tabs)

**Content:**
- Search input (full width, top)
- "Filter" button (right of search) — opens filter bottom sheet when tapped
- Stacked person result cards (full width, 1-column)
- Filter bottom sheet (shown partially): sex checkboxes, living radio, year range

### WF-20: Mobile Research Sessions

**Frame:** 375px wide

**Layout:** Mobile shell (top bar + bottom tabs)

**Content:**
- "Research" title + "+ New" button in top bar
- Stacked session cards (1-column, full width)
- Each card: title, note count, person tags, snippet

### WF-21: Mobile Dashboard

**Frame:** 375px wide

**Layout:** Mobile shell (top bar + bottom tabs)

**Content:**
- Stats row: 3 horizontal stat cards (scrollable overflow)
- Quick actions: 2 buttons stacked ("Add Person", "Import")
- Recent activity: 3-4 items in a list

---

## Figma Organization

- Desktop wireframes (WF-01 through WF-15): page "3. Wireframes-Desktop"
- Mobile wireframes (WF-16 through WF-21): page "4. Wireframes-Mobile"

---

## File Structure

```
.superpowers/figma-pages/
  wf-shell.css               <- shared wireframe palette + shell layout classes
  wf-shell-desktop.html      <- desktop shell partial (sidebar + header)
  wf-shell-mobile.html       <- mobile shell partial (top bar + bottom tabs)
  wf-01-dashboard.html
  wf-02-dashboard-empty.html
  wf-03-tree-populated.html
  wf-04-tree-empty.html
  wf-05-tree-detail.html
  wf-06-person-create.html
  wf-07-person-edit.html
  wf-08-import.html
  wf-09-export.html
  wf-10-search.html
  wf-11-command-palette.html
  wf-12-research-sessions.html
  wf-13-research-detail.html
  wf-14-settings.html
  wf-15-person-detail.html
  wf-16-mobile-tree.html
  wf-17-mobile-detail.html
  wf-18-mobile-form.html
  wf-19-mobile-search.html
  wf-20-mobile-research.html
  wf-21-mobile-dashboard.html
```

---

## Execution

Same pipeline as flow diagrams: build HTML → preview in browser → capture to Figma.

1. Build `wf-shell.css` with wireframe palette + shell layout
2. Build WF-01 (Dashboard) as quality gate — validate shell renders correctly in Figma
3. Build remaining 13 desktop wireframes
4. Build 6 mobile wireframes
5. Capture all 20 to Figma

Desktop wireframes can be built in parallel. Mobile wireframes can be built in parallel with desktop.
