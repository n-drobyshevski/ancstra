# User Flows — Phase 1

7 core task flows for Phase 1 features. Each flow documents the happy path, contextual variants, and error/edge cases.

---

## Flow 1: Add Person (Manual Entry)

Three entry paths: Global (sidebar), Contextual (from tree), Research (from findings).

### Happy Path (Global)
```
Dashboard/Tree → Click "Add Person" → Person Form (empty)
→ Fill required fields (given name, surname, sex)
→ Optionally: dates, places, events, notes
→ Click "Save"
→ Person created → Redirect to person detail
→ Optional: "Add Relative" prompt appears
```

### Contextual Path (From Tree)
```
Tree View → Click person → Person Detail Panel
→ Click "Add Father" / "Add Mother" / "Add Spouse" / "Add Child"
→ Choose: "Search existing" or "Create new"
  → If search: typeahead search → select person → confirm relationship
  → If create: person form pre-filled with relationship context
    → Banner: "Adding mother of [Person Name]"
    → Save → relationship auto-created → tree updates
```

### Research Path (From Research Session)
```
Research Workspace -> Click "Create person from findings"
-> /person/new pre-filled with data from research notes
-> Save -> person created, linked back to research session
```

### Edge Cases
- **Duplicate detection:** If similar name + dates exist, show warning with link to existing person
- **Date validation:** Birth can't be in future; death can't be before birth; parent can't be younger than child
- **Empty required fields:** Inline validation messages below each field
- **Cancel with unsaved changes:** "Discard changes?" confirmation dialog
- **Circular relationship prevention:** Can't add person as their own ancestor

### State Transitions
- Creates `persons` record
- If contextual: creates `families` + `children` records
- Triggers tree re-render if tree view is open

---

## Flow 2: Import GEDCOM

### Happy Path
```
Dashboard/Sidebar → Click "Import" → /import page

Step 1 — Upload:
  → Drag-and-drop or browse for .ged file
  → File selected → show filename + size

Step 2 — Processing:
  → Encoding detection (chardet)
  → Progress bar with status: "Detecting encoding..." → "Parsing records..." → "Validating data..."
  → Percentage indicator

Step 3 — Preview:
  → Statistics: X persons, Y families, Z events, W sources
  → Source software detected: "Exported from: Ancestry.com"
  → Warnings list (collapsible): duplicate names, impossible dates, vendor quirks
  → Errors list (if any, blocking)

Step 4 — Confirm:
  → "Import [X] persons into your tree" button
  → "Cancel" button

Step 5 — Success:
  → Summary: "Successfully imported 847 persons, 312 families, 2,841 events"
  → "View Tree" button (primary)
  → "View Import Log" link
```

### Edge Cases
- **Invalid file format:** Error message: "This doesn't appear to be a GEDCOM file. Please upload a .ged file."
- **Large file (>10MB):** Show estimated processing time, warn about duration
- **Existing data:** Warn about potential duplicates, offer "Add alongside existing data" (no merge in Phase 1)
- **Parse errors:** Show error count, allow "Import what we can" with warning details
- **Encoding issues:** Auto-detect and convert, show notification: "File was re-encoded from [charset] to UTF-8"
- **Transaction failure:** Full rollback, show error, suggest retry
- **Empty file:** "This GEDCOM file contains no data."

### State Transitions
- Creates bulk `persons`, `families`, `children`, `events`, `sources`, `places` records
- All imported with `validation_status = 'confirmed'`
- Creates import log entry

---

## Flow 3: Navigate Tree

### Happy Path
```
Open /tree → Load default view (pedigree centered on root person)
→ Zoom: mouse wheel (desktop) / pinch (mobile)
→ Pan: click-drag (desktop) / drag (mobile)
→ Click person node → Person Detail Panel slides in from right (desktop) / bottom sheet (mobile)
→ Click another person → Panel updates to new person
→ Click "Focus" button on panel → Tree re-centers on that person
→ Switch view: dropdown selector → Pedigree | Ancestors | Descendants | Hourglass
→ Export: button dropdown → PDF | PNG | SVG
```

### Tree Toolbar
```
[Pedigree ▾] [Search person...] [−] [+] [⊞ Fit] [↓ Export ▾]
```

### Person Node Display
```
┌──────────────────────┐
│ 👤  John Smith       │  ← avatar/initials + full name
│ 1845 – 1923         │  ← birth-death years
│ ████████░░ 80%      │  ← completion bar
└──────────────────────┘
   │ (color-coded left border = sex indicator)
   │ (solid line = confirmed, dashed = proposed, dotted = disputed)
```

### Edge Cases
- **Empty tree:** Illustration + "Add your first person" CTA + "Import GEDCOM" secondary CTA
- **Single person:** Show that node centered + "Add a relative" prompt arrows
- **Large tree (1000+ nodes):** Viewport culling, level-of-detail (collapse distant branches), "Zoom to fit" button
- **No root person set:** Prompt to select a root person from existing persons
- **Mobile:** Full-screen canvas, person detail opens as bottom sheet (60% height), floating "+" FAB for add person
- **Relationship lines:** Solid = confirmed, dashed = proposed (Phase 2), dotted = disputed

### State Transitions
- Read-only (no DB changes from tree navigation)
- Updates URL params: `?view=pedigree&focus=personId`
- Stores last-viewed person in localStorage for "recent persons"

---

## Flow 4: Search & Filter

### Global Search (Typeahead)
```
Any page → Click search bar (or press Cmd+K / Ctrl+K)
→ Command palette opens
→ Type name → Typeahead shows top 8 results
→ Each result: avatar/initials, full name, life dates (e.g., "1845–1923")
→ Click result → Navigate to person detail OR center tree on them
→ "View all results" link at bottom → /search?q=[query]
```

### Full Search Results Page
```
/search?q=[query]
→ Search input at top (pre-filled)
→ Filter sidebar (left, desktop) or filter button (mobile):
  → Sex: checkboxes (Male, Female, Unknown)
  → Living Status: radio (All, Living Only, Deceased Only)
  → Has Sources: checkbox
  → Birth Year Range: from–to number inputs
→ Results list (right):
  → Person cards: avatar, name, life dates, parent/spouse count, last modified
  → Sort: Relevance | Name A-Z | Birth Date | Last Modified
  → Pagination at bottom
```

### Edge Cases
- **No results:** "No persons match '[query]'" + "Add a new person" CTA
- **Partial/fuzzy matches:** FTS5 handles prefix matching; show with relevance ranking
- **Diacritics:** "Müller" matches "Mueller" (FTS5 unicode61 tokenizer)
- **Empty query:** Show all persons (paginated)
- **Mobile:** Filters in bottom sheet triggered by "Filter" button; results in scrollable list

### State Transitions
- Read-only (no DB changes)
- Updates URL: `/search?q=[query]&sex=M&living=deceased&sort=name`
- Adds clicked result to "recent persons" in localStorage

---

## Flow 5: Edit Person

### Inline Edit (From Detail Panel)
```
Person Detail Panel → Click "Edit" button
→ Panel switches to edit mode (fields become editable)
→ Modify fields
→ Click "Save" → Optimistic update → Success toast
→ Panel returns to view mode with updated data
→ Click "Cancel" → Revert changes → Back to view mode
```

### Full Edit Page
```
/person/[id]/edit → Full form pre-populated with existing data
→ All sections: name variants, demographics, dates, events, sources, notes
→ Events section: add/remove/reorder events
→ Sources section: link existing source or create new
→ Click "Save" → Redirect to /person/[id]
→ "Delete Person" button (destructive, bottom of form)
```

### Edge Cases
- **Validation failures:** Inline error messages, scroll to first error
- **Cancel with changes:** "You have unsaved changes. Discard?" confirmation dialog
- **Delete person:** "Delete [Name]? This will also remove their relationships. This action cannot be undone." AlertDialog with destructive button
- **Unsaved changes indicator:** Show dot/badge in page title or tab
- **Concurrent edit (Phase 5):** Last-write-wins with conflict notification toast

### State Transitions
- Updates `persons`, `person_names`, `events` records
- Optimistic UI update via React Query mutation
- Triggers tree re-render if tree is open
- Creates `change_log` entry

---

## Flow 6: Link Relationships

### Add Spouse
```
Person Detail → "Add Relative" dropdown → "Add Spouse"
→ Modal/sheet opens: "Link spouse for [Person Name]"
→ Search existing persons (typeahead) OR "Create New Person" button
  → If existing: select person → confirm relationship type (married, civil union, domestic, unknown)
  → If new: person create form → save → auto-link
→ Family record created → both person details updated → tree re-renders
```

### Add Parent
```
Person Detail → "Add Relative" → "Add Father" / "Add Mother"
→ Search existing OR create new
→ Select/create person
→ System checks: does person already have a family with a matching parent slot?
  → If yes: add to existing family
  → If no: create new family record
→ Child link added → tree updates
```

### Add Child
```
Person Detail → "Add Relative" → "Add Child"
→ If person has multiple spouses: "Which family?" selector
→ Search existing person OR create new
→ Child record created with family link
→ Choose relationship type: biological, adopted, foster, step, unknown
→ Tree updates
```

### Edge Cases
- **Person already has two parents:** Warning: "[Name] already has two parents. Adding a third will create an alternate family group." Allow but warn.
- **Circular relationship:** Detect and prevent: "Cannot add [Name] as their own ancestor."
- **Duplicate relationship:** "[Name] is already linked as spouse of [Name]." Prevent duplicate.
- **Self-link:** Prevent linking a person to themselves
- **Sex mismatch:** If adding "father" but selected person is female, show info notice (don't block — handles data entry errors and edge cases)

### State Transitions
- Creates or updates `families` record
- Creates `children` record (for parent-child links)
- Updates both persons' relationship data
- Triggers tree re-render
- Creates `change_log` entries

---

## Flow 7: Research Session

### Happy Path
```
Sidebar -> Click "Research" -> /research (session list)

Step 1 -- Choose session:
  -> "New Session" button -> Enter title, optional person tag -> Create
  OR
  -> Select existing session from list -> Open

Step 2 -- Research workspace:
  -> /research/[id] -- split pane workspace
  -> Paste URLs, transcriptions, quotes into notes area
  -> Tag findings to specific persons (optional)
  -> Notes auto-save

Step 3 -- Create person from findings:
  -> Click "Create person from findings" button
  -> /person/new pre-filled with data extracted from notes
  -> Save -> person created, linked back to research session
  -> Return to research workspace
```

### Edge Cases
- **Empty session list:** "No research sessions yet. Start one to organize your findings." + "New Session" CTA
- **Tagging to nonexistent person:** Offer to create the person first, then tag
- **Large notes:** Auto-save with debounce (500ms), no character limit
- **Session deletion:** "Delete this session? Notes and tags will be removed. Persons created from this session will not be affected." AlertDialog

### State Transitions
- Creates `research_sessions` record (title, person_tag, created_at)
- Creates `research_notes` records (session_id, content, url, created_at)
- Creates `research_tags` records (note_id, person_id)
- "Create person from findings" triggers person creation flow (Flow 1) with pre-filled data
- Links created person back to research session via `research_person_links`

### Phase 1 Scope
Research workspace is a **structured notepad** in Phase 1:
- Create/list/delete sessions
- Free-text notes with URL pasting
- Tag notes to persons
- "Create person from findings" button

AI-powered features (auto-extraction, web search, record matching) are deferred to Phase 2.
