# Component Inventory

Mapping of Ancstra UI needs to shadcn/ui components and custom components that need building.

---

## shadcn/ui Components to Install

| UI Need | shadcn/ui Component | Customization Notes |
|---------|-------------------|---------------------|
| Save, cancel, add buttons | **Button** | Variants: default, secondary, destructive, outline, ghost. Sizes: default, sm, lg, icon |
| Person form fields | **Input** | Standard text input for names, places |
| Dropdown selectors | **Select** | Sex, event type, name type, date modifier, relationship type |
| Long text (notes) | **Textarea** | Person notes, source citation text |
| Person detail panel | **Sheet** | Side: right, width: 400px (desktop). Side: bottom (mobile) |
| View type selector | **Tabs** | Pedigree / Ancestors / Descendants / Hourglass. Also person detail tabs |
| Global search | **Command** (cmdk) | Cmd+K trigger, typeahead results with person avatars |
| Import progress | **Progress** | Determinate progress bar with percentage |
| Toast notifications | **Sonner** | Success (save), error (validation), warning (import issues) |
| Delete/discard confirmation | **AlertDialog** | Destructive confirmation with cancel |
| Navigation sidebar | **Sidebar** | Collapsible, icons + labels, active state |
| Tree path navigation | **Breadcrumb** | Dashboard > Tree > Person Name |
| Person list/results | **Table** | Search results, import preview stats |
| Form validation | **Form** | React Hook Form + Zod integration |
| Action menus | **DropdownMenu** | Person actions (edit, delete, add relative), export options |
| Tree node hover info | **Tooltip** | Quick person info on hover |
| Status indicators | **Badge** | Living status, validation status, sex |
| Person photos | **Avatar** | Photo with initials fallback |
| Date selection | **Calendar** + **Popover** | Base for genealogical date input (needs extension) |
| Loading states | **Skeleton** | Tree loading, person detail loading, search results loading |
| Form sections | **Accordion** | Collapsible form sections on mobile (events, sources) |
| Radio selections | **RadioGroup** | GEDCOM export privacy mode selector |
| Toggle options | **Switch** | Theme toggle, "Still living" toggle |
| Checkbox options | **Checkbox** | Search filters (sex, has sources) |
| File upload area | **Card** (custom styled) | GEDCOM import dropzone (custom, styled as card) |
| Separators | **Separator** | Section dividers in person detail |
| Pop-up content | **Popover** | Date picker, place suggestions |
| Modal dialogs | **Dialog** | Relationship type selection, create source inline |

**Total: ~28 shadcn/ui components**

Install command (Phase 1 Week 1):
```bash
pnpm dlx shadcn@latest add button input select textarea sheet tabs command progress sonner alert-dialog sidebar breadcrumb table form dropdown-menu tooltip badge avatar calendar popover skeleton accordion radio-group switch checkbox separator dialog card
```

---

## Custom Components to Build

Components not available in shadcn/ui that need custom implementation.

### 1. Genealogical Date Input (`DateInput`)

**Purpose:** Handle genealogical dates with modifiers (about, before, after, between, estimated, calculated)

**Structure:**
```
┌─────────────┬──────────────────────────────┐
│ Exact     ▾ │ 15 Mar 1872                  │
└─────────────┴──────────────────────────────┘
  Interpreted: 15 March 1872

┌─────────────┬──────────────────┬─────┬──────────────────┐
│ Between   ▾ │ Jan 1880         │ and │ Dec 1885         │
└─────────────┴──────────────────┴─────┴──────────────────┘
  Interpreted: between January 1880 and December 1885
```

**Behaviors:**
- Modifier dropdown: Exact, About, Estimated, Before, After, Between, Calculated
- Free-text date input: accepts "15 Mar 1872", "1880", "Mar 1872", "abt 1880"
- "Between" shows two date fields
- Helper text showing parsed interpretation
- Outputs: `date_original` (display string), `date_sort` (ISO for sorting), `date_modifier` (enum)

**Built with:** Select (modifier) + Input (date text) + Popover (optional Calendar)

### 2. Place Autocomplete (`PlaceInput`)

**Purpose:** Search existing places with free-text fallback

**Structure:**
```
┌──────────────────────────────────────┐
│ 🔍 Springfield, Sangamon, Illinois  │
├──────────────────────────────────────┤
│ Springfield, Sangamon, Illinois, USA │ ← existing place
│ Springfield, Clark, Ohio, USA        │ ← existing place
│ + Add "Springfield" as new place     │ ← create new
└──────────────────────────────────────┘
```

**Behaviors:**
- Typeahead search against `places` table
- Shows hierarchical place name (city, county, state, country)
- "Add new" option for places not yet in database
- Returns `place_id` (existing) or creates new `places` record

**Built with:** Command (typeahead) + Popover

### 3. Person Search/Select (`PersonSelect`)

**Purpose:** Search and select existing persons (for relationship linking)

**Structure:**
```
┌──────────────────────────────────────┐
│ 🔍 Search for a person...           │
├──────────────────────────────────────┤
│ 👤 John Smith (1845–1923)           │
│ 👤 John William Smith (1872–1950)   │
│ + Create New Person                  │
└──────────────────────────────────────┘
```

**Behaviors:**
- FTS5 search against persons
- Results show avatar, full name, life dates
- "Create new" option opens person form
- Returns `person_id`

**Built with:** Command (typeahead) + Avatar + Popover

### 4. Tree Person Node (`TreeNode`)

**Purpose:** Person card rendered on the family tree visualization

**Structure:**
```
┌──────────────────────────┐
│ ■ 👤 John Smith          │  ← sex indicator + avatar + name
│   1845 – 1923            │  ← life dates
│   ████████░░ 80%         │  ← completion bar
└──────────────────────────┘
```

**States:**
- Default (normal appearance)
- Hover (shadow, cursor pointer)
- Selected (ring highlight, connected to detail panel)
- Focused (tree centered on this node)
- Living (name shown, dates may be hidden depending on privacy)

**Built with:** Custom SVG/HTML element for family-chart integration

### 5. Relationship Line (`RelationshipLine`)

**Purpose:** Visual line connecting tree nodes with validation status

**Styles:**
- Solid line (`stroke-dasharray: none`) — confirmed relationship
- Dashed line (`stroke-dasharray: 8 4`) — proposed relationship (Phase 2)
- Dotted line (`stroke-dasharray: 2 2`) — disputed relationship

**Colors:** Use `--line-confirmed`, `--line-proposed`, `--line-disputed` tokens

**Built with:** SVG path elements within family-chart

### 6. Mini-Map (`TreeMiniMap`)

**Purpose:** Small overview of the full tree with viewport rectangle

**Structure:**
```
┌─────────────────┐
│  ·  ·  ·  ·     │
│  ·  ┌──┐ ·  ·   │  ← viewport rectangle
│  ·  └──┘ ·      │
│  ·  ·  ·  ·  ·  │
└─────────────────┘
```

**Behaviors:**
- Shows simplified tree layout (dots for nodes)
- Highlights current viewport as a draggable rectangle
- Click to jump to location
- Semi-transparent overlay in bottom-right corner
- Toggle visible/hidden

**Built with:** Canvas or SVG, positioned absolute in tree container

### 7. Completion Indicator (`CompletionBar`)

**Purpose:** Show how complete a person's data is

**Calculation:** Percentage based on filled fields:
- Has given name (+10%), has surname (+10%)
- Has sex (+10%), has birth date (+15%), has birth place (+10%)
- Has death date or is living (+15%), has death place (+5%)
- Has at least one event (+10%), has at least one source (+15%)

**Variants:**
- Progress bar (tree node, inline)
- Progress ring (person detail header)

**Colors:** `--completion-low` (<25%), `--completion-medium` (25-75%), `--completion-high` (>75%)

**Built with:** Progress (shadcn) or custom SVG ring

### 8. Event Timeline (`EventTimeline`)

**Purpose:** Chronological display of a person's life events in the detail panel

**Structure:**
```
│
├─ 🎂 Birth — 15 Mar 1845, Springfield, IL
│
├─ ⛪ Baptism — 20 Mar 1845, First Baptist Church
│
├─ 💍 Marriage — 12 Jun 1870, Chicago, IL
│     to Mary Johnson
│
├─ 🏠 Residence — 1880, Cook County, IL
│     Census record
│
├─ ✝️ Death — 23 Nov 1923, Chicago, IL
│
├─ ⚰️ Burial — 26 Nov 1923, Oak Ridge Cemetery
│
```

**Behaviors:**
- Chronologically sorted by `date_sort`
- Icon per event type (Lucide icons)
- Show date (with modifier), place, and optional description
- Click event to edit inline
- "Add Event" button at bottom

**Built with:** Custom component with Lucide icons, card-style entries

---

## Icon Mapping (Lucide)

| Concept | Icon | Usage |
|---------|------|-------|
| Person | `User` | Single person reference |
| Add person | `UserPlus` | Create new person |
| People/family | `Users` | Family groups, collaboration |
| Tree/relationships | `GitBranch` | Tree navigation |
| Search | `Search` | Global search, search pages |
| Filter | `SlidersHorizontal` | Filter controls |
| Upload | `Upload` | GEDCOM import |
| Download | `Download` | GEDCOM export |
| File | `FileText` | GEDCOM files, documents |
| Calendar/date | `Calendar` | Date fields |
| Place/location | `MapPin` | Place fields |
| Source/book | `BookOpen` | Sources, citations |
| Edit | `Pencil` | Edit mode |
| Delete | `Trash2` | Delete actions |
| Add | `Plus` | Add event, add source |
| Close | `X` | Close panel, dismiss |
| Privacy/living | `Eye` / `EyeOff` | Living person toggle |
| Home/dashboard | `Home` | Dashboard nav |
| Settings | `Settings` | Settings page |
| Navigate | `ChevronRight` | Breadcrumbs, nav |
| Zoom in | `ZoomIn` | Tree zoom |
| Zoom out | `ZoomOut` | Tree zoom |
| Fit to screen | `Maximize2` | Tree fit view |
| Theme light | `Sun` | Theme toggle |
| Theme dark | `Moon` | Theme toggle |
| Birth | `Baby` | Birth event |
| Death | `Cross` | Death event (or custom) |
| Marriage | `Heart` | Marriage event |
| Military | `Shield` | Military events |
| Immigration | `Ship` | Immigration events |
| Residence | `House` | Residence events |
| Census | `ClipboardList` | Census events |
| Occupation | `Briefcase` | Occupation events |
| Warning | `AlertTriangle` | Import warnings |
| Success | `CheckCircle` | Import success, save confirmation |
| Error | `XCircle` | Validation errors |
| Info | `Info` | Helper text, tooltips |
