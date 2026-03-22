# Lo-Fi Wireframes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 21 lo-fi wireframe HTML pages (15 desktop + 6 mobile) and capture them into the Ancstra Figma file.

**Architecture:** Each wireframe is a standalone HTML page that inherits a shared app shell (sidebar + header + content zone). A shared CSS file provides the desaturated wireframe palette. Desktop wireframes use the 3-zone layout (sidebar | content | optional detail panel). Mobile wireframes use top bar + bottom tabs. Same HTML→Figma capture pipeline as the flow diagrams.

**Tech Stack:** HTML/CSS (static pages), Lucide icons (CDN), Figma MCP (`generate_figma_design`), local HTTP server (`npx serve`)

**Spec:** `docs/superpowers/specs/2026-03-22-lofi-wireframes-design.md`

**Figma File:** `TODiDe7Q8soPIol7zmC0r9` (Ancstr)

---

## File Structure

All wireframe files live in `.superpowers/figma-pages/` alongside the existing flow diagram files. The wireframe shell is a separate CSS file from the flow diagram styles.

```
.superpowers/figma-pages/
  wf-shell.css                  <- wireframe palette + desktop/mobile shell layout
  wf-shell-desktop.html         <- desktop shell template (copy-paste into each desktop wireframe)
  wf-shell-mobile.html          <- mobile shell template (copy-paste into each mobile wireframe)
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

## Figma Capture Workflow

Same as flow diagrams. Every capture task follows this pattern:

1. Add `<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>` to `<head>`
2. Call `generate_figma_design` with `outputMode: "existingFile"`, `fileKey: "TODiDe7Q8soPIol7zmC0r9"` — returns captureId
3. Open: `start "" "http://localhost:3334/{filename}.html#figmacapture={captureId}&figmaendpoint=https%3A%2F%2Fmcp.figma.com%2Fmcp%2Fcapture%2F{captureId}%2Fsubmit&figmadelay=3000"`
4. Wait 10-15 seconds
5. Poll `generate_figma_design` with `captureId` until `completed`

Batch up to 5 captures at a time. Ensure local server is running: `npx serve "D:/projects/ancstra/.superpowers/figma-pages" -l 3334 --no-clipboard`

---

## Task 0: Wireframe Shell CSS

**Files:**
- Create: `.superpowers/figma-pages/wf-shell.css`

- [ ] **Step 1: Write wf-shell.css**

Create the wireframe-specific stylesheet with:

**Wireframe palette** (desaturated, no brand colors):
```css
:root {
  --wf-bg: #ffffff;
  --wf-surface: #f5f6f8;
  --wf-border: #d8dce4;
  --wf-text: #2a2e38;
  --wf-text-muted: #8890a0;
  --wf-placeholder: #b0b8c4;
  --wf-active: #5a6070;
  --wf-highlight: #eceef8;
  --wf-sex-light: #c0c8d4;
  --wf-sex-medium: #9098a8;
  --wf-sex-dark: #687080;
}
```

**Desktop shell classes:**
- `.wf-desktop` — outer container, 1280px wide, flex row
- `.wf-sidebar` — 64px wide, background surface, border-right, flex column, icon nav items
- `.wf-sidebar-expanded` — 240px variant with labels
- `.wf-header` — 56px tall, border-bottom, flex row (toggle + breadcrumb | search trigger + avatar)
- `.wf-content` — flex 1, padding 24px, overflow auto
- `.wf-panel` — 400px wide, border-left, flex column (for tree detail view)
- `.wf-canvas` — full area with light gray background (for tree view)

**Mobile shell classes:**
- `.wf-mobile` — 375px wide, flex column
- `.wf-topbar` — 56px tall, border-bottom (brand icon + title | search icon)
- `.wf-mobile-content` — flex 1, overflow auto
- `.wf-tabbar` — 64px tall, border-top, 5 equal tabs (icon + label)

**Shared wireframe component classes:**
- `.wf-card` — bordered card with padding, rounded-lg
- `.wf-stat` — stat card (large number + label)
- `.wf-input` — form input specimen in grayscale
- `.wf-select` — select dropdown specimen
- `.wf-btn-primary` — primary action button (dark gray)
- `.wf-btn-secondary` — secondary button (bordered)
- `.wf-btn-ghost` — ghost/text button
- `.wf-avatar` — circle with initials
- `.wf-tree-node` — grayscale tree node card with left border + avatar + name + dates + completion bar
- `.wf-badge` — small gray badge
- `.wf-divider` — horizontal separator
- `.wf-tabs` — tab bar with active indicator
- `.wf-empty-state` — centered empty state container

Include Inter font import and Lucide CDN script tag reference in comments.

- [ ] **Step 2: Create wf-shell-desktop.html template**

A copy-paste template containing the desktop shell HTML structure (sidebar + header + content placeholder). Every desktop wireframe (WF-01 through WF-15) starts by copying this template and replacing the content area. Include the Figma capture script in `<head>` so every file is capture-ready from build time.

- [ ] **Step 3: Create wf-shell-mobile.html template**

Same as above for mobile shell (top bar + content + bottom tabs). Used by WF-16 through WF-21. Include Figma capture script.

- [ ] **Step 4: Verify CSS loads**

Create a minimal test page that imports wf-shell.css and renders the desktop shell + a few components. Open in browser to verify.

- [ ] **Step 5: Verify shell renders correctly**

Confirm: sidebar renders at 64px, header at 56px, content fills remaining space. Mobile shell: top bar + content + bottom tabs.

---

## Task 1: WF-01 Dashboard (Quality Gate)

**Files:**
- Create: `.superpowers/figma-pages/wf-01-dashboard.html`

This is the quality gate — validates the wireframe shell renders correctly in Figma capture.

- [ ] **Step 1: Write wf-01-dashboard.html**

Full HTML page using wf-shell.css. Desktop shell (1280px) with sidebar collapsed (64px). No detail panel.

Content per spec:
- **Stats row:** 3 `.wf-stat` cards side by side — "847 Persons", "312 Families", "68% Complete"
- **Quick actions row:** 3 buttons — "+ Add Person" (primary), "Import GEDCOM" (secondary), "New Research Session" (secondary)
- **Recent tree preview:** `.wf-card` containing 4-6 grayscale tree nodes connected with lines (small inline SVG), "View Tree" link
- **Recent activity:** `.wf-card` containing 4-5 list items — "Added John Smith" / "Edited Mary Johnson" etc. with timestamps

Sidebar nav items (icon placeholders): Dashboard (active), Tree, Search, Research, Import. Settings in footer.
Header: sidebar toggle + "Dashboard" breadcrumb | search trigger "Search... Ctrl+K" + avatar circle.

Include Figma capture script in `<head>`.
Include `<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()` at bottom for icons.

- [ ] **Step 2: Preview in browser**

Open `http://localhost:3334/wf-01-dashboard.html`. Verify:
- Sidebar renders at 64px with icon nav
- Header at 56px with search trigger
- Stats, actions, tree preview, activity all visible
- Grayscale palette — no brand colors

- [ ] **Step 3: Capture to Figma**

Follow the Figma Capture Workflow. Validate capture quality.

- [ ] **Step 4: Checkpoint — confirm shell quality**

If capture looks good, proceed. If not, adjust wf-shell.css before building remaining screens.

---

## Task 2: Desktop Wireframes WF-02 through WF-08

**Files:**
- Create: `.superpowers/figma-pages/wf-02-dashboard-empty.html`
- Create: `.superpowers/figma-pages/wf-03-tree-populated.html`
- Create: `.superpowers/figma-pages/wf-04-tree-empty.html`
- Create: `.superpowers/figma-pages/wf-05-tree-detail.html`
- Create: `.superpowers/figma-pages/wf-06-person-create.html`
- Create: `.superpowers/figma-pages/wf-07-person-edit.html`
- Create: `.superpowers/figma-pages/wf-08-import.html`

All 7 can be built in parallel. Each uses the desktop shell from wf-shell.css.

**Prerequisite:** Ensure local HTTP server is running. Follow the Figma Capture Workflow for all captures.

- [ ] **Step 1: Build wf-02-dashboard-empty.html**

Desktop shell. Content: centered `.wf-empty-state` with heading "Start building your tree.", numbered steps (1. Add yourself, 2. Add your parents, 3. Keep going), primary CTA "Add your first person", secondary link "Import a GEDCOM file". No stats, no activity.

- [ ] **Step 2: Build wf-03-tree-populated.html**

Desktop shell, full-width canvas (no detail panel). Content:
- `.wf-canvas` background
- Floating toolbar (48px) at top: view tabs (Pedigree active | Ancestors | Descendants | Hourglass), person search input, spacer, zoom buttons (-, +, fit), export button
- 8-10 `.wf-tree-node` elements positioned in a top-down hierarchy with SVG connector lines between them. Mix of male/female/unknown (different gray border shades). Each node: avatar initials + name + dates + completion bar
- Minimap (140x90px) bottom-right: light box with dots and viewport rectangle
- Floating "+" button bottom-left

- [ ] **Step 3: Build wf-04-tree-empty.html**

Desktop shell, full-width canvas. Content: centered empty state "Your family tree is empty" with two CTAs: "Add your first person" (primary), "Import GEDCOM" (secondary). No toolbar, no minimap.

- [ ] **Step 4: Build wf-05-tree-detail.html**

Desktop shell with `.wf-panel` (400px right). Canvas ~816px left with tree nodes (one highlighted with ring outline). Detail panel:
- Header: 44px avatar + "John Smith" (text-lg) + "1845 - 1923" (muted) + close X + completion ring (44px)
- Tabs: Overview (active) | Sources | Media* | Matches* (last two grayed out with "Phase 2/3" tooltip text)
- Overview content: event timeline (3-4 events — enhancement over spec, which doesn't list events in WF-05 but they belong here for consistency with WF-15/WF-17), relationships section (Father, Mother, Spouse, Children as linked names), "Add Relative" dropdown, "Edit" button, "Focus on Tree" link
- Resize handle on left edge (3px visual indicator)

- [ ] **Step 5: Build wf-06-person-create.html**

Desktop shell, no panel. Content centered at max-width 720px:
- Title: "Add New Person"
- Required section: Given Name + Surname inputs (side by side), Sex select (M/F/U)
- Dates section: Birth DateInput (modifier select + date input + helper), Birth PlaceInput (search input), Death DateInput, Death PlaceInput, "Still living" toggle
- Events section (collapsed, with "Add Event" button)
- Notes: textarea
- Sources section (collapsed, with "Link Source" button)
- Footer: "Save" primary + "Cancel" ghost

Use `.wf-input`, `.wf-select` classes from shell CSS.

- [ ] **Step 6: Build wf-07-person-edit.html**

Same as WF-06 but:
- Title: "Edit John Smith"
- All fields pre-populated with sample data
- Events section expanded with 2-3 events (Birth, Marriage, Residence)
- "Delete Person" destructive button at bottom separated by divider

- [ ] **Step 7: Build wf-08-import.html**

Desktop shell, content centered at max-width 640px. Taller frame (~1400px). All 5 wizard steps visible vertically:
- Step indicator: dots/line showing steps 1-5
- Step 1 Upload: dashed border dropzone, "Drag and drop or browse" text
- Step 2 Processing: progress bar at 60%, "Parsing records..." text, cancel button
- Step 3 Preview: stats card (847 persons, 312 families, 2841 events, 156 sources), collapsible warnings list (2-3 items), "Exported from: Ancestry.com" detected
- Step 4 Confirm: "Import 847 persons into your tree?" + Import button + Cancel
- Step 5 Success: checkmark, summary stats, "View Tree" primary button, "View Import Log" link

- [ ] **Step 8: Preview all 7 in browser**

Verify each renders correctly with consistent shell layout.

- [ ] **Step 9: Capture all 7 to Figma**

All files already include the Figma capture script (included at build time in `<head>`). Generate 5 capture IDs, open 5 pages, poll. Then generate 2 more, open, poll. Total: 7 captures.

---

## Task 3: Desktop Wireframes WF-09 through WF-15

**Files:**
- Create: `.superpowers/figma-pages/wf-09-export.html`
- Create: `.superpowers/figma-pages/wf-10-search.html`
- Create: `.superpowers/figma-pages/wf-11-command-palette.html`
- Create: `.superpowers/figma-pages/wf-12-research-sessions.html`
- Create: `.superpowers/figma-pages/wf-13-research-detail.html`
- Create: `.superpowers/figma-pages/wf-14-settings.html`
- Create: `.superpowers/figma-pages/wf-15-person-detail.html`

All 7 can be built in parallel.

**Prerequisite:** Ensure local HTTP server is running. Follow the Figma Capture Workflow for all captures.

- [ ] **Step 1: Build wf-09-export.html**

Desktop shell, content centered at max-width 640px:
- Title: "Export Tree"
- Format: radio group — GEDCOM 5.5.1 (selected), GEDCOM 7.0 (disabled, "coming soon")
- Privacy mode: 3 radio cards — "Full tree (private)" / "Shareable tree" / "Ancestors only", each with description
- Preview: "This export will include: 847 persons, 312 families. 23 living persons will be excluded."
- "Download .ged file" primary button

- [ ] **Step 2: Build wf-10-search.html**

Desktop shell, no panel. Two-column layout:
- Search input full width at top (pre-filled with "Smith", focused)
- Left column (240px): filter sidebar — Sex checkboxes (Male checked, Female checked, Unknown), Living status radio (All selected), Has Sources checkbox, Birth year range (from: 1800, to: 1900)
- Right column (fluid): sort dropdown (Relevance selected), 6 person result cards. Each card: avatar + name (semibold) + dates + "Son of William Smith" + "Last modified 2d ago". Pagination: "1 2 3 ... 12 Next"

- [ ] **Step 3: Build wf-11-command-palette.html**

Desktop shell with dimmed backdrop overlay (semi-transparent dark). Centered modal (540px wide):
- Search input auto-focused, placeholder "Search persons, actions..."
- Results grouped:
  - "Persons" heading: 3 results (avatar + "John Smith 1845-1923" / "John William Smith 1872-1950" / "Mary Johnson 1850-1930")
  - "Research" heading: 1 result ("Smith family origins — 3 notes")
  - "Actions" heading: "Add Person", "Import GEDCOM", "New Research Session", "Settings"
- Footer: "↑↓ Navigate  ↵ Select  Esc Close"

- [ ] **Step 4: Build wf-12-research-sessions.html**

Desktop shell, no panel. Full-width content:
- Header: "Research" title + search input (200px) + "+ New Session" primary button
- Card grid (3 columns, gap 16px): 4 session cards + 1 empty "New Session" dashed card
- Each card: title (semibold), "3 notes · Last edited 2h ago", person tag badges, snippet of first note (2 lines, truncated)

- [ ] **Step 5: Build wf-13-research-detail.html**

Desktop shell, content centered at max-width 800px:
- Breadcrumb: "Research / Smith family origins"
- Header: "Smith family origins" (text-xl bold), person tag badge "John Smith", "Tag Person" secondary button, "Create Person from Findings" primary button
- Notes list: 3 note cards — each with title + timestamp + content (2-3 lines) + optional source URL
- "+ Add Note" dashed button at bottom

- [ ] **Step 6: Build wf-14-settings.html**

Desktop shell, content centered at max-width 720px:
- Title: "Settings"
- 3 tabs: Privacy (active) | Data | Theme
- Privacy tab: "Living person threshold" number input (100), "Default export privacy" radio (Full/Shareable/Ancestors)
- Show Data tab content below (separated by note "Data tab would show:"): Backup button + date, Import/Export buttons, Reset database destructive button
- Show Theme tab content below: Light/Dark/System radio

- [ ] **Step 7: Build wf-15-person-detail.html**

Desktop shell, no panel. Content centered at max-width 800px:
- Header: 56px avatar + "John William Smith" (text-xl bold) + "1845 - 1923" + completion ring (56px)
- Action bar: "Edit" button, "Add Relative" dropdown, "View on Tree" link
- Tabs: Overview (active) | Sources | Media* | Matches*
- Overview: event timeline (5 events using EventTimeline-like layout — Birth, Baptism, Marriage, Residence, Death), relationships section (Father: William Smith, Mother: Elizabeth Brown, Spouse: Mary Johnson, Children: William Jr, Sarah, Robert), notes section
- Sources tab hint below: "2 sources linked"

- [ ] **Step 8: Preview all 7 in browser**

- [ ] **Step 9: Capture all 7 to Figma**

All files already include the Figma capture script (included at build time). Generate 5 + 2 capture IDs, open, poll.

---

## Task 4: Mobile Wireframes WF-16 through WF-21

**Files:**
- Create: `.superpowers/figma-pages/wf-16-mobile-tree.html`
- Create: `.superpowers/figma-pages/wf-17-mobile-detail.html`
- Create: `.superpowers/figma-pages/wf-18-mobile-form.html`
- Create: `.superpowers/figma-pages/wf-19-mobile-search.html`
- Create: `.superpowers/figma-pages/wf-20-mobile-research.html`
- Create: `.superpowers/figma-pages/wf-21-mobile-dashboard.html`

All 6 can be built in parallel. Each uses the mobile shell from wf-shell.css (375px wide).

**Prerequisite:** Ensure local HTTP server is running. Follow the Figma Capture Workflow for all captures.

- [ ] **Step 1: Build wf-16-mobile-tree.html**

Mobile shell (375px). Top bar: brand icon + "Tree". Bottom tabs: Home, Tree (active), Search, Research, Settings.
Content: full-screen tree canvas with 4-5 nodes, floating "+" FAB (56px circle) bottom-right above tab bar. No toolbar. Note below canvas: "Pinch to zoom, tap node to select".

- [ ] **Step 2: Build wf-17-mobile-detail.html**

Mobile shell (375px), but bottom tabs hidden. Full-screen drawer (90vh) slid up from bottom:
- Drag handle bar at top center
- Person header: avatar + "John Smith" + "1845-1923" + completion ring
- Tabs: Overview | Sources | Media* | Matches*
- Single-column overview content: event timeline (3 events), relationships list, "Edit" + "Add Relative" buttons
- Frame height ~800px to show full drawer

- [ ] **Step 3: Build wf-18-mobile-form.html**

Mobile shell (375px), bottom tabs hidden (full-screen form mode).
Top bar: "< Back" + "Add Person" title.
Content: single-column form — Given Name input, Surname input, Sex select, Birth DateInput (full width), Birth PlaceInput, Death DateInput, Death PlaceInput, "Still living" toggle, Events accordion (collapsed), Notes textarea.
Sticky footer: "Save" primary button (full width, fixed at bottom).
Frame height ~900px.

- [ ] **Step 4: Build wf-19-mobile-search.html**

Mobile shell (375px). Top bar: brand icon + "Search". Bottom tabs with Search active.
Content: search input (full width) + "Filter" button right of it. 4 stacked person result cards (full width). Filter bottom sheet shown partially overlapping from bottom (40% height): sex checkboxes, living radio, year range inputs.

- [ ] **Step 5: Build wf-20-mobile-research.html**

Mobile shell (375px). Top bar: brand icon + "Research" + "+ New" small button. Bottom tabs with Research active.
Content: stacked session cards (1-column, full width). 3 cards: title, "3 notes · 2h ago", person tags, snippet.

- [ ] **Step 6: Build wf-21-mobile-dashboard.html**

Mobile shell (375px). Top bar: brand icon + "Home". Bottom tabs with Home active.
Content: horizontal scrollable stats row (3 stat cards, overflow-x scroll), 2 stacked action buttons ("Add Person" primary, "Import" secondary), recent activity list (3 items with timestamps).

- [ ] **Step 7: Preview all 6 in browser**

- [ ] **Step 8: Capture all 6 to Figma**

All files already include the Figma capture script (included at build time). Generate 5 + 1 capture IDs, open, poll.

---

## Task 5: Final Verification

- [ ] **Step 1: Count captured frames**

Use `get_metadata` on the Figma file to verify 21 new wireframe frames exist (in addition to the 21 flow + design system frames from earlier).

- [ ] **Step 2: Report completion**

Summary:
- 21 wireframe frames captured (15 desktop + 6 mobile)
- Desktop frames: "3. Wireframes-Desktop" page
- Mobile frames: "4. Wireframes-Mobile" page
- Note: pages need manual reorganization in Figma (captures create auto-named pages)
- Link to Figma file for review

---

## Summary

| Task | Screens | Parallelizable |
|------|---------|----------------|
| 0: Shell CSS | 0 (foundation) | No (prerequisite) |
| 1: WF-01 Dashboard | 1 (quality gate) | No (must validate first) |
| 2: WF-02 through WF-08 | 7 | Yes (all independent) |
| 3: WF-09 through WF-15 | 7 | Yes (all independent, parallel with Task 2) |
| 4: WF-16 through WF-21 | 6 mobile | Yes (all independent, parallel with Tasks 2-3) |
| 5: Verification | 0 | No (requires all captures) |

**Critical path:** Task 0 → Task 1 (quality gate) → Tasks 2+3+4 in parallel → Task 5

**Total screens:** 21
