# Information Architecture — Ancstra

> Phase 1 scope. Last updated: 2026-03-21.

This document defines the navigational structure, content hierarchy, taxonomies, and UI state inventory for Ancstra. It is the single source of truth for product and frontend decisions in Phase 1.

---

## 1. Site Map

All routes live under the authenticated layout (`(auth)` route group). Unauthenticated visitors are redirected to `/login`.

```
/ (root redirect → /dashboard)
│
├── /login
│
└── (auth) ─ authenticated shell
    │
    ├── /dashboard
    │   └── [summary cards, recent persons, quick actions]
    │
    ├── /tree
    │   ├── ?view=pedigree       — default; family-chart pedigree view
    │   ├── ?view=ancestors      — Topola ancestors-only chart
    │   ├── ?view=descendants    — Topola descendants-only chart
    │   └── ?view=hourglass      — Topola hourglass (ancestors + descendants)
    │       └── &focus=:personId — re-centers chart on the specified person
    │
    ├── /person
    │   ├── /new                 — blank create form
    │   └── /[id]                — read-only person detail page
    │       └── /edit            — edit form for existing person
    │
    ├── /import                  — GEDCOM file upload + progress + summary
    │
    ├── /export                  — GEDCOM export options + download
    │
    ├── /search                  — full-text search results (standalone page)
    │
    ├── /research                — research session list (card grid)
    │   └── /[id]                — research session detail + notes workspace
    │
    └── /settings
        ├── /profile             — display name, email, password
        ├── /privacy             — living-person threshold, default privacy level
        └── /data                — database backup, reset, Turso sync status
```

### Route Parameters and Query Strings

| Route | Parameter | Values | Notes |
|---|---|---|---|
| `/tree` | `?view` | `pedigree` (default), `ancestors`, `descendants`, `hourglass` | Persisted in localStorage as last-used view |
| `/tree` | `?focus` | person UUID | Optional; omitting focuses on tree root |
| `/person/[id]` | `[id]` | person UUID | 404 if person does not exist or is soft-deleted |
| `/person/[id]/edit` | `[id]` | person UUID | 403 if viewer role; 404 for unknown person |
| `/search` | `?q` | URL-encoded query string | Populated automatically from Cmd+K global search |

---

## 2. Navigation Patterns

### 2.1 Desktop Layout (lg: 1024px and above)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP BAR (56px)                                                        │
│  [Ancstra logo]          [Global Search  Cmd+K]        [User Menu ▼] │
├──────────┬───────────────────────────────────────┬────────────────────┤
│ SIDEBAR  │                                       │ DETAIL PANEL       │
│ 240px    │  MAIN CONTENT AREA                    │ 400px              │
│ (expand) │  (fluid, scrollable)                  │ (Sheet — slides in │
│          │                                       │  when a person is  │
│  Dashboard                                       │  selected on tree  │
│  Tree                                            │  or search result) │
│  ─────── │                                       │                    │
│  Add     │                                       │  [PersonDetail]    │
│  Person  │                                       │                    │
│  ─────── │                                       │                    │
│ Import/  │                                       │                    │
│ Export   │                                       │                    │
│  ─────── │                                       │                    │
│ Settings │                                       │                    │
│          │                                       │                    │
│  ↤ [<<]  │                                       │                    │
└──────────┴───────────────────────────────────────┴────────────────────┘
```

**Sidebar behavior:**
- Expanded state: 240px, shows icon + label for each nav item.
- Collapsed state: 64px, shows icon only with tooltip on hover.
- Toggle: chevron button at the bottom of the sidebar.
- Active item: highlighted with `bg-accent` and a 3px left border in the primary color.
- State is persisted in localStorage (`ancstra:sidebar:collapsed`).

**Top bar:**
- Fixed at the top; `z-50`.
- Global search triggers a shadcn/ui `CommandDialog` (Cmdk palette).
- User menu: avatar + display name; items: Profile, Settings, Sign out.

**Right panel (Person Detail Sheet):**
- shadcn/ui `Sheet` positioned at `side="right"`, width 400px.
- Opens when: a person node is clicked on the tree, a search result is selected, or a person card on the dashboard is clicked.
- Does not navigate away from the current page; the URL does not change.
- Closeable via the X button or pressing Escape.
- On the `/person/[id]` page, the detail panel is the main content, not a Sheet.

### 2.2 Tablet Layout (md: 768px to lg: 1023px)

- Sidebar collapses to 64px (icon-only) by default.
- Right panel takes 50% viewport width instead of a fixed 400px.
- Top bar global search collapses to an icon-only button that opens the CommandDialog.

### 2.3 Mobile Layout (below md: 768px)

```
┌───────────────────────────────────┐
│ TOP BAR (48px)                    │
│  [Ancstra]             [Search]   │
├───────────────────────────────────┤
│                                   │
│  MAIN CONTENT AREA                │
│  (full width, scrollable)         │
│                                   │
│                                   │
│                                   │
│                                   │
│                                   │
└───────────────────────────────────┘
│ BOTTOM TAB BAR (64px)             │
│  [Home] [Tree] [Search] [Research] [Settings] │
└───────────────────────────────────┘
```

**Bottom tab bar:**
- Fixed at the bottom; `z-50`; 64px height.
- Five tabs: Home (home icon), Tree (git-branch icon), Search (search icon), Research (book-open icon), Settings (settings icon).
- Active tab: filled icon + label in primary color.
- "Add Person" accessed via: floating "+" FAB on tree view, Dashboard quick actions, or person detail "Add Relative" button. Not a dedicated tab — research is more frequently used.
- Import/Export accessed from Dashboard or Settings > Data.

**Mobile person detail:**
- Uses a shadcn/ui `Drawer` (bottom sheet) rather than a side Sheet.
- Slides up to 90vh; handle bar at top; snap points at 50% and 90%.
- Same content as desktop detail panel.

### 2.4 Responsive Breakpoints

Tailwind CSS v4 default breakpoints apply throughout:

| Token | Min-width | Typical use in Ancstra |
|---|---|---|
| `sm` | 640px | Two-column form layouts, card grids (2 col) |
| `md` | 768px | Sidebar switches from bottom nav; search expands in top bar |
| `lg` | 1024px | Full sidebar at 240px; right panel appears |
| `xl` | 1280px | Tree canvas gets more breathing room |
| `2xl` | 1536px | Max content width capped (tree still fluid) |

---

## 3. Content Hierarchy — Person Detail Panel

The panel is divided into a fixed header, an action strip, and a tabbed body. The same structure is used in the side Sheet on desktop, the bottom Drawer on mobile, and as the primary content of the `/person/[id]` page.

```
┌────────────────────────────────────────────────┐
│ HEADER                                          │
│  ┌──────┐  Given Surname                        │
│  │Avatar│  b. 15 Mar 1872, Springfield, IL      │
│  │ 56px │  d. 4 Nov 1941, Chicago, IL           │
│  └──────┘  [M badge]  [Living indicator]        │
│            [Validation: confirmed / proposed]   │
├────────────────────────────────────────────────┤
│ QUICK ACTIONS (icon buttons, 32px)             │
│  [Edit]  [Add Spouse]  [Add Parent]            │
│  [Add Child]  [More ▼]                         │
├────────────────────────────────────────────────┤
│ TABS                                            │
│  [Overview]  [Sources]  [Media*]  [Matches*]   │
│  (* = Phase 3+ / Phase 2+ — tab shown but      │
│       disabled with tooltip in Phase 1)         │
├────────────────────────────────────────────────┤
│ TAB: Overview                                   │
│                                                 │
│  Names                                          │
│  ─────                                          │
│  Birth name:    John William Doe                │
│  Married name:  — (none)                        │
│  AKA:           "Jack"                          │
│                                                 │
│  Life Events (chronological timeline)           │
│  ──────────────────────────────────             │
│  1872  Birth     Springfield, IL                │
│  1890  Census    Cook County, IL                │
│  1895  Marriage  Chicago, IL                    │
│  1918  Military  [source badge]                 │
│  1941  Death     Chicago, IL                    │
│                                                 │
│  Family Members                                 │
│  ──────────────                                 │
│  Father:   [Person card]                        │
│  Mother:   [Person card]                        │
│  Spouse:   [Person card]  (married 1895)        │
│  Children: [Person card]  [Person card]  [+Add] │
│                                                 │
│  Notes                                          │
│  ─────                                          │
│  [Free text, read-only; Edit to modify]         │
│                                                 │
├────────────────────────────────────────────────┤
│ TAB: Sources                                    │
│                                                 │
│  [Source card]                                  │
│   Title, author, type badge                     │
│   Citation detail                               │
│   Confidence: High / Medium / Low               │
│  [+ Add Source Citation]                        │
│                                                 │
├────────────────────────────────────────────────┤
│ TAB: Media  (Phase 3+)                          │
│  [Disabled — "Coming in Phase 3"]              │
│                                                 │
├────────────────────────────────────────────────┤
│ TAB: Matches  (Phase 2+)                        │
│  [Disabled — "Coming in Phase 2"]              │
└────────────────────────────────────────────────┘
```

**Header composition:**
- Avatar: 56px circle; initials fallback (given + surname first letters); sex-coded border color (blue = M, pink = F, gray = U).
- Name: primary `person_names` record where `is_primary = 1`; prefix + given + surname + suffix.
- Date line: birth event date + place short name; death event date + place short name if present.
- Sex badge: small pill; "M", "F", or "U"; `variant="outline"`.
- Living indicator: amber dot + "Living" label if `isPresumablyLiving()` returns true; hidden otherwise.
- Validation badge: "Proposed" (amber) or "Disputed" (red) badges on the family record if applicable; absent for confirmed records.

**Quick actions:**
- Edit: navigates to `/person/[id]/edit`.
- Add Spouse / Add Parent / Add Child: opens a CommandDialog for searching existing persons or creating new.
- More menu: Delete person (soft delete, confirms with dialog), View full page (if currently in Sheet).

---

## 4. Genealogy Taxonomy

These are the canonical UI-facing terms used across labels, filters, badges, and form selects. Database enum values are shown alongside display labels.

### 4.1 Relationship Types

Used in family member lists, quick-add buttons, and relationship linking UI.

| Display Label | DB value / context | Notes |
|---|---|---|
| Parent | `children.relationship_to_parent1/2` context | Shown as "Father" or "Mother" when sex is known |
| Child | inverse of parent lookup | Shown as "Son" or "Daughter" when sex is known |
| Spouse | `families.relationship_type` | See partnership types below |
| Sibling | derived from shared `family_id` in `children` | Read-only; computed, not stored directly |

Partnership sub-types (displayed on family relationship line):

| Display Label | DB value |
|---|---|
| Married | `married` |
| Civil union | `civil_union` |
| Domestic partner | `domestic_partner` |
| Unmarried partner | `unmarried` |
| Unknown | `unknown` |

Child relationship types (shown as small badge on child card):

| Display Label | DB value |
|---|---|
| Biological | `biological` |
| Adopted | `adopted` |
| Foster | `foster` |
| Step | `step` |
| Unknown | `unknown` |

### 4.2 Event Types

Used in the event timeline, add-event type selector, and filters.

**Vital events** (always shown first in timeline):

| Display Label | DB value | Icon hint |
|---|---|---|
| Birth | `birth` | sunrise |
| Death | `death` | sunset |
| Burial | `burial` | headstone |
| Baptism | `baptism` | droplet |

**Family events** (attached to `families`, not `persons`):

| Display Label | DB value |
|---|---|
| Marriage | `marriage` |
| Divorce | `divorce` |

**Civil and legal events**:

| Display Label | DB value |
|---|---|
| Census | `census` |
| Immigration | `immigration` |
| Emigration | `emigration` |
| Naturalization | `naturalization` |
| Military service | `military` |
| Probate | `probate` |

**Life events**:

| Display Label | DB value |
|---|---|
| Occupation | `occupation` |
| Residence | `residence` |

**Custom** (free-label event):

| Display Label | DB value |
|---|---|
| Other / Custom | `custom` |

Events are always displayed in ascending `date_sort` order within the timeline. Events with `date_sort = 0` (unknown date) appear at the end with an "Unknown date" label.

### 4.3 Name Types

Used in the Names section of the Overview tab and the edit form name list.

| Display Label | DB value | Usage context |
|---|---|---|
| Birth name | `birth` | Default; the name at birth |
| Married name | `married` | Name taken at marriage |
| Also known as | `aka` | Nicknames, aliases |
| Immigrant name | `immigrant` | Anglicized or translated name |
| Religious name | `religious` | Baptismal or confirmation name |

Only one name per person may have `is_primary = 1`. That name is displayed in the panel header and tree nodes.

### 4.4 Date Modifiers

Displayed inline before the date value in the event timeline and person header.

| Display Label | DB value | Example rendering |
|---|---|---|
| (none) | `exact` | "15 Mar 1872" |
| About | `about` | "About 1880" |
| Estimated | `estimated` | "Est. 1845" |
| Before | `before` | "Before Jun 1900" |
| After | `after` | "After 1850" |
| Between | `between` | "1880 – 1885" |
| Calculated | `calculated` | "Calc. 1790" |
| Interpreted | `interpreted` | "Int. 1731/32" |

Date modifier labels use `text-muted-foreground` and are visually lighter than the date value itself to reduce noise while remaining accessible.

### 4.5 Validation Statuses

Used as badges on family records, proposed-relationship notices, and the dashboard notification list.

| Display Label | DB value | Badge variant | Meaning |
|---|---|---|---|
| Confirmed | `confirmed` | (no badge shown) | Manually entered or GEDCOM imported; trusted |
| Proposed | `proposed` | amber `outline` | AI/API-discovered; awaiting editor review |
| Disputed | `disputed` | red `outline` | Flagged as potentially incorrect |

The "Confirmed" status is intentionally badge-free to keep the UI clean for the overwhelmingly common case.

### 4.6 Source Types

Used in the source type selector on source creation forms and as filter chips on the Sources tab.

**Records:**

| Display Label | DB value |
|---|---|
| Vital record | `vital_record` |
| Census record | `census` |
| Military record | `military` |
| Church record | `church` |
| Immigration record | `immigration` |
| Land record | `land` |
| Probate record | `probate` |
| Cemetery record | `cemetery` |

**Documents:**

| Display Label | DB value |
|---|---|
| Newspaper | `newspaper` |
| Book / Publication | `book` |
| Correspondence | `correspondence` |
| Online source | `online` |

**Personal:**

| Display Label | DB value |
|---|---|
| Photograph | `photograph` |
| Personal knowledge | `personal_knowledge` |

**Fallback:**

| Display Label | DB value |
|---|---|
| Other | `other` |

---

## 5. State Inventory

Each screen must handle at least the four base states: **default** (data loaded, normal interaction), **empty** (no data exists yet), **loading** (async fetch in progress), and **error** (fetch or action failed). Additional states are noted per screen.

### /dashboard

| State | Trigger | UI treatment |
|---|---|---|
| Default | Tree has at least one person | Summary cards with counts; recent persons grid; quick-action buttons |
| Empty | No persons in tree yet | Full-width empty state illustration + primary CTA "Add your first person" + secondary CTA "Import GEDCOM" |
| Loading | Initial page load | Skeleton cards in place of summary stats and recent persons |
| Error | API fetch failed | Inline error banner with retry button; cached data shown if available |

### /tree

| State | Trigger | UI treatment |
|---|---|---|
| Default | Tree loaded, at least one person | Interactive chart with zoom/pan controls; person nodes clickable |
| Empty | No persons in tree | Centered empty state: "Your tree is empty" + "Add first person" button |
| Loading | Chart data fetch | Full-canvas skeleton with shimmer nodes in approximate tree shape |
| Error | Chart data fetch failed | Error overlay on canvas with retry; sidebar navigation still functional |
| No focus person | `focus` param missing or invalid | Tree renders from computed root (person with most descendants); breadcrumb shows "Tree root" |
| Living-person hidden | `is_living = true` + viewer role | Node renders as "Living [sex]" placeholder; detail panel blocked |

### /person/new

| State | Trigger | UI treatment |
|---|---|---|
| Default | Fresh form | All fields empty; sex defaults to "U"; primary name row pre-populated |
| Saving | Form submitted | Submit button shows spinner; inputs disabled |
| Validation error | Zod schema failure | Inline field errors beneath each invalid input; focus moves to first error |
| Save error | API returned 4xx/5xx | Toast notification "Failed to save person" + error detail; form remains editable |
| Success | Person created | Redirect to `/person/[id]`; success toast "Person added" |

### /person/[id]

| State | Trigger | UI treatment |
|---|---|---|
| Default | Person found and loaded | Full detail panel as primary content |
| Loading | Person fetch in progress | Skeleton: avatar circle, name block, three skeleton lines in header; tab content skeletons |
| Not found | UUID not in database or soft-deleted | Full-page 404 with "Return to tree" link |
| Forbidden | Viewer role + living person | Full-page privacy notice "This person's details are private"; no data shown |
| Error | Unexpected fetch failure | Inline error state with retry button |

### /person/[id]/edit

| State | Trigger | UI treatment |
|---|---|---|
| Default | Edit form loaded | All fields pre-populated from existing record |
| Loading | Fetching existing data | Skeleton form fields |
| Saving | Form submitted | Submit button spinner; fields disabled |
| Validation error | Zod failure | Inline field errors; scroll to first error |
| Save error | API failure | Toast error; form remains editable with current values |
| Success | Save confirmed | Redirect to `/person/[id]`; success toast "Changes saved" |
| Unsaved changes guard | User navigates away with unsaved edits | Browser `beforeunload` prompt + shadcn/ui `AlertDialog` confirmation |
| Forbidden | Viewer role | Redirect to `/person/[id]`; toast "You do not have permission to edit" |

### /import

| State | Trigger | UI treatment |
|---|---|---|
| Default (idle) | Page loaded, no file selected | Drag-and-drop zone + file picker button; supported format note |
| File selected | File chosen but not yet uploaded | File name + size shown; encoding detected; "Import" button enabled |
| Parsing | File submitted, server parsing GEDCOM | Step indicator: Parsing → Validating → Importing; animated progress bar |
| Conflict detected | Duplicate names / conflicting dates found | Warning list with resolution options (skip, overwrite, merge); user must confirm |
| Importing | Database inserts in progress | Live count: "Importing 1,204 of 3,812 persons..." |
| Success | Import complete | Summary: persons / families / events / sources imported; link to `/tree` |
| Error (file) | Invalid file, encoding failure, parse error | Error message with specific line/record reference; link to download error log |
| Error (server) | Server crash during import | Error notice; partial imports are rolled back (transaction) |

### /export

| State | Trigger | UI treatment |
|---|---|---|
| Default | Page loaded | Format selector (GEDCOM 5.5.1); privacy mode selector; download button |
| Generating | Download triggered | Button spinner "Generating..."; large trees show estimated time |
| Ready | File generated | Auto-download starts; toast "Export ready"; manual download link as fallback |
| Error | Export failed | Toast error with detail; retry button |
| Empty tree | No persons to export | Export button disabled; tooltip "Add people to your tree first" |

### /search

| State | Trigger | UI treatment |
|---|---|---|
| Default (no query) | Page loaded without `?q` | Search input focused; suggested searches or recent history |
| Loading | Query submitted, fetching | Spinner in results area; input remains editable |
| Results | Query returned matches | Person cards in ranked order; match excerpt with highlighted terms |
| No results | Query returned zero matches | "No results for [query]" + spelling suggestion if FTS5 returns alternative tokens |
| Error | FTS5 query failed | Inline error banner; retry button |

### Person Detail Panel (Sheet / Drawer)

The Sheet and Drawer share the same content component. States apply in addition to the full-page `/person/[id]` states.

| State | Trigger | UI treatment |
|---|---|---|
| Closed | No person selected | Panel not rendered |
| Opening | Person clicked | Sheet slides in with CSS transition (200ms ease-out) |
| Default | Person data loaded | Full panel content as described in Section 3 |
| Loading | Data fetch in progress | Header skeleton + tab content skeleton visible inside panel |
| Error | Fetch failed | Error message inside panel; retry link; panel remains open |

### /settings

| State | Trigger | UI treatment |
|---|---|---|
| Default | Settings loaded | Form pre-populated with current values |
| Saving | Any settings form submitted | Section submit button shows spinner |
| Save success | Settings updated | Inline success message beneath the saved section |
| Save error | API failure | Inline error message with retry |

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Data Model](../architecture/data-model.md)
- [Phase 1 Plan](../phases/phase-1-core.md)
- [Tree Visualization Spec](../specs/tree-visualization.md)
- [GEDCOM Import Spec](../specs/gedcom-import.md)
