# Factsheet UI Components

> **Status:** Design approved
> **Date:** 2026-03-27
> **Scope:** UI for factsheet management across 3 integration points
> **Dependencies:** research-to-tree-pipeline-design, research-workspace-design, research-ux-improvements

## Context

The factsheet pipeline backend (schema, queries, API routes) is complete. Users need a way to interact with factsheets: create them, assign facts, resolve conflicts, link related factsheets, and promote to the tree. This spec covers the UI components for all 3 integration points.

## Design Principles

1. **Heritage Modern style** — 90% neutral palette, color only for status signals (draft=amber, ready=green, promoted=indigo, dismissed=gray, conflict=red)
2. **Progressive disclosure** — collapse complex workflows (promote) into expandable steps
3. **Provenance visible** — every fact shows its source research item
4. **Confident empty states** — numbered steps + primary CTA, no illustrations
5. **Keyboard accessible** — focus rings, arrow-key navigation in lists, roving tabindex
6. **Mobile responsive** — stack vertically on small screens

## Integration Point 1: Person Workspace — Factsheets Tab

Added as 8th tab in `/research/person/[id]` alongside Board, Matrix, Conflicts, Timeline, Canvas, Hints, Proof.

### Layout

2-column grid matching the board tab pattern:

```
[280px sidebar]  [1fr detail]
┌──────────────┬─────────────────────────┐
│ Factsheet    │ Factsheet Detail        │
│ List         │                         │
│              │ - Notes (editable)      │
│ [+ New]      │ - Facts (with source)   │
│              │ - Linked Factsheets     │
│ • John Smith │ - Promote Section       │
│   draft · 5f │                         │
│ • Mary Smith │                         │
│   ready · 3f │                         │
└──────────────┴─────────────────────────┘
```

Mobile (< 768px): stacked vertically. Factsheet list is full-width. Tapping a factsheet navigates to full-screen detail with back button.

### Tab Badge

Shows count of non-dismissed factsheets for the current person. Badge uses `bg-muted text-muted-foreground` (not colored — factsheets aren't urgent like conflicts).

### Components

#### FactsheetList (sidebar)

- Header: "Factsheets" label + "+ New" button (primary small)
- Cards sorted: draft first, then ready, then promoted, then dismissed (faded, collapsible)
- Each card shows:
  - Title (text-sm font-medium, line-clamp-1)
  - Status badge (amber=draft, green=ready, indigo=promoted, gray=dismissed)
  - Summary line: "{N} facts · {N} links · {N} conflicts" in text-xs text-muted-foreground
- Selected card: `border-primary bg-accent/5`
- Keyboard: arrow keys navigate, Enter selects
- Empty state: "No factsheets yet. Group your extracted facts into hypotheses." + "Create First Factsheet" button + 4-step guide

#### FactsheetDetail (main area)

**Header row:**
- Title (text-lg font-semibold) + status badge
- Actions: "Promote to Tree" button (outline, green tint) + overflow menu (⋯: rename, dismiss, delete)
- "Promote" button disabled with tooltip when factsheet has unresolved conflicts

**Notes section:**
- Editable text area, `bg-muted/50 border-border rounded-lg p-3`
- Label: "NOTES" in text-xs text-muted-foreground uppercase
- Auto-save on blur (debounced 500ms)

**Facts section:**
- Header: "FACTS ({count})" + "+ Assign facts" link
- Each fact row: `bg-muted/30 border-border/50 rounded-md px-3 py-2`
  - Left: fact type label (text-xs text-muted-foreground uppercase) + fact value (text-sm)
  - Right: confidence badge (green=high, amber=medium, red=low)
  - Below: "From: {research item title}" in text-xs text-muted-foreground, clickable (navigates to item detail)
  - Conflict facts: red border-left-3, red background tint, "⚠ conflict" tag + inline Accept/Reject buttons
  - Accepted facts: green border-left-3, "✓ accepted" tag
  - Rejected facts: strikethrough value, opacity-50
  - Relationship facts (parent_name, spouse_name, child_name): "→ linked" indicator if a factsheet_link exists, clickable to navigate to linked factsheet
- "+ Assign facts" opens a dropdown listing ungrouped facts for the current person, with checkboxes for multi-select + "Assign" button

**Linked Factsheets section:**
- Header: "LINKED FACTSHEETS ({count})" + "+ Link" + suggestion count if any
- Each link: pill showing relationship type badge (spouse/parent/sibling) + factsheet title + status badge
- Clickable: selects the linked factsheet in the sidebar
- "+ Link" opens a dropdown of other factsheets for the person, with relationship type selector
- Suggestion indicator: "💡 {N} suggestions" — clicking shows suggested links from relationship facts

**Promote Section (progressive disclosure):**
- Collapsible accordion at bottom of detail, collapsed by default
- Header: "Promote to Tree" + "Create a person from this hypothesis" + expand chevron

Expanded, 3 steps:

**Step 1 — Readiness:**
- Checklist showing pass/fail:
  - "✓ {N} facts assigned" or "✗ No facts assigned"
  - "✓ No conflicts" or "✗ {N} unresolved conflicts — resolve above"
- All must pass to proceed. Failed items are red with explanation.

**Step 2 — Duplicate Check** (disabled until step 1 passes):
- "Check for Matches" button → calls `/api/research/factsheets/[id]/duplicates`
- Loading state: spinner + "Checking for matches..."
- Results:
  - No matches: "✓ No duplicates found" in green
  - Matches found: card per match showing name, dates, place, match score (%), "Merge into this" button
  - Score ≥ 0.95: amber warning "Strong match — likely the same person"
  - Score 0.70–0.95: "Possible match — review before creating"

**Step 3 — Confirm & Create** (disabled until step 2 complete):
- Two mode cards side by side:
  - "Create New Person" — "Add to tree as new entry"
  - "Merge into Existing" — "Add facts to {matched person name}" (only if match selected in step 2)
- Preview: "Will create: {N} person(s) · {N} events · {N} sources · {N} citations"
- "Confirm" button (primary, green) + "Cancel" link
- Loading state on confirm: button shows spinner, disabled
- Success: toast "Person created — view in tree" with link, factsheet status updates to 'promoted'
- For family unit promotion (multiple linked factsheets): show "Promote as family unit" option in step 3 that lists all connected factsheets and previews the full creation (persons + families + children)

#### CreateFactsheetDialog

- Triggered by "+ New" button in sidebar
- Inline form (not modal): appears at top of sidebar list
- Fields: title (required), entity type (person/couple/family_unit, default person)
- Save/Cancel buttons
- On save: new factsheet selected, detail panel shows empty state for that factsheet

## Integration Point 2: Research Hub — Inbox Tab

Added as 3rd tab in `/research` alongside Search and AI Chat.

### Tab

- Label: "Inbox"
- Badge: count of unanchored items, `bg-amber-500/20 text-amber-500` (only shown when > 0)
- Fetches count from `/api/research/inbox?count=true`

### Layout

Full-width card list:

```
┌─────────────────────────────────────────────┐
│ Unanchored Items                            │
│ Research items not linked to any person.     │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 1890 US Census — Smiths in Ohio         │ │
│ │ web search · 2 hours ago                │ │
│ │ [Assign to person] [Create factsheet]   │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Immigration record — S.S. Krakow 1903   │ │
│ │ pasted URL · 1 day ago                  │ │
│ │ [Assign to person] [Create factsheet]   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Components

#### InboxTab

- Header: "Unanchored Items" (text-lg font-semibold) + subtitle
- Fetches from `/api/research/inbox`
- Pagination: load more on scroll (offset-based)

#### InboxItemCard

Each card:
- Title (text-sm font-medium)
- Metadata line: discovery method + relative time (text-xs text-muted-foreground)
- 3 action buttons (right-aligned on desktop, stacked below on mobile):
  - "Assign to person" — opens person search popover (reuse existing PersonLinkPopover)
  - "Create factsheet" — first opens person search popover to select which person, then creates a factsheet, assigns the item to that person, assigns item's facts to the factsheet, navigates to `/research/person/[personId]?tab=factsheets`
  - "Dismiss" — ghost button, sets item status to dismissed
- On assign: item disappears from inbox (refetch)
- On create factsheet: creates factsheet, assigns item's facts, navigates to `/research/person/[personId]?tab=factsheets`

#### Empty state

"Inbox is empty. When you search without selecting a person first, saved items appear here for triage." + "Go to Search" outline button.

## Integration Point 3: Research Hub — Search Tab Updates

Minimal changes to the existing search tab:

- When a search result is saved as a research item WITHOUT a person context, it goes to the inbox (already works — no person link means unanchored)
- No UI changes needed in search results themselves

## Skeleton & Loading States

| Component | Loading State |
|-----------|--------------|
| Factsheet list | 3 skeleton cards (pulse animation, matching card dimensions) |
| Factsheet detail | Skeleton for header + 4 fact row placeholders + 2 link pill placeholders |
| Facts section | Individual fact rows show skeleton when fact assignment is processing |
| Promote step 2 | Spinner + "Checking for matches..." text |
| Promote confirm | Button shows spinner, all inputs disabled |
| Inbox | 3 skeleton cards |
| Inbox count badge | Skeleton dot until count loads |

## Error States

| Scenario | Behavior |
|----------|----------|
| Factsheet load fails | Error card: "Failed to load factsheet" + retry button |
| Fact assignment fails | Toast: "Failed to assign fact" + retry |
| Promote fails | Error message inline in step 3: "{error}" + retry button |
| Duplicate check fails | Error in step 2: "Could not check for duplicates" + retry |
| Inbox load fails | Error card with retry |
| Network offline | Disabled promote button + "Offline — promote requires connection" tooltip |

## Keyboard & Accessibility

- Factsheet list: `role="listbox"`, arrow keys navigate, Enter selects
- Fact rows: focusable, Tab navigates between facts
- Accept/Reject buttons: keyboard accessible, focus-visible ring
- Promote steps: accordion pattern with `aria-expanded`, Enter toggles
- All status badges: `aria-label` describing the status
- Conflict warnings: `role="alert"` on unresolved conflict indicators
- Screen reader: factsheet summary announced on selection ("John Smith hypothesis, draft, 5 facts, 1 conflict")

## Mobile Behavior (< 768px)

- Factsheet list: full-width, replaces the 2-column layout
- Tapping a factsheet: pushes to detail view (full screen), back button returns to list
- Promote section: full-width, steps stack vertically
- Inbox cards: actions stack below title/metadata
- Touch targets: all buttons ≥ 44px height

## New Files

```
apps/web/components/research/factsheets/
  factsheets-tab.tsx          — Tab wrapper, fetches factsheets for person
  factsheet-list.tsx          — Sidebar list with cards
  factsheet-card.tsx          — Individual factsheet card
  factsheet-detail.tsx        — Main detail view
  factsheet-facts.tsx         — Facts section with provenance
  factsheet-fact-row.tsx      — Individual fact row (with conflict/accepted states)
  factsheet-links.tsx         — Linked factsheets section
  factsheet-promote.tsx       — Progressive promote accordion
  factsheet-promote-step.tsx  — Individual promote step
  create-factsheet-form.tsx   — Inline create form
  assign-facts-popover.tsx    — Fact multi-select assignment popover

apps/web/components/research/inbox/
  inbox-tab.tsx               — Tab wrapper, fetches unanchored items
  inbox-item-card.tsx         — Individual inbox item card

apps/web/components/research/workspace/
  workspace-tabs.tsx          — UPDATE: add Factsheets tab with badge
```

## API Calls Map

| Component | API Route | Method |
|-----------|-----------|--------|
| FactsheetList | `/api/research/factsheets?personId=X` | GET |
| FactsheetDetail | `/api/research/factsheets/[id]` | GET |
| CreateFactsheet | `/api/research/factsheets` | POST |
| UpdateFactsheet | `/api/research/factsheets/[id]` | PUT |
| DeleteFactsheet | `/api/research/factsheets/[id]` | DELETE |
| AssignFact | `/api/research/factsheets/[id]/facts` | POST |
| RemoveFact | `/api/research/factsheets/[id]/facts` | DELETE |
| GetLinks | `/api/research/factsheets/[id]/links` | GET |
| CreateLink | `/api/research/factsheets/[id]/links` | POST |
| SuggestLinks | `/api/research/factsheets/[id]/links?suggest=true` | GET |
| DetectConflicts | `/api/research/factsheets/[id]/conflicts` | GET |
| ResolveConflict | `/api/research/factsheets/[id]/conflicts` | POST |
| CheckDuplicates | `/api/research/factsheets/[id]/duplicates` | GET |
| Promote | `/api/research/factsheets/[id]/promote` | POST |
| InboxList | `/api/research/inbox` | GET |
| InboxCount | `/api/research/inbox?count=true` | GET |

## Verification

1. **Empty state:** Open factsheets tab with 0 factsheets → see numbered guide + "Create First Factsheet" CTA
2. **Create:** Click "+ New" → fill title → save → factsheet appears in list, selected, detail shows empty facts
3. **Assign facts:** Click "+ Assign facts" → select 3 facts → assign → facts appear in detail with provenance labels
4. **Conflict:** Assign two birth_date facts with different values → red conflict indicators appear → accept one → accepted fact shows green border, rejected shows strikethrough
5. **Link:** Click "+ Link" → select another factsheet → relationship type → link appears as pill
6. **Promote blocked:** Click promote with unresolved conflict → step 1 shows red "✗ unresolved conflict"
7. **Promote success:** Resolve conflict → step 1 passes → check duplicates → no matches → choose "Create New" → confirm → toast "Person created" → factsheet status changes to promoted
8. **Inbox:** Save a search result without person context → appears in inbox with count badge → assign to person → disappears from inbox
9. **Mobile:** Resize to 375px → list is full-width → tap factsheet → full-screen detail → back returns to list
10. **Keyboard:** Tab through factsheet list → arrow keys navigate → Enter selects → Tab into facts → Tab to Accept/Reject buttons
