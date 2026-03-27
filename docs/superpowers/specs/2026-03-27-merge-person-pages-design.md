# Merge /person and /research/person into Unified Person Page

**Date:** 2026-03-27
**Status:** Approved

## Problem

Two separate pages exist for the same person — `/person/[id]` (record management: vitals, family, events, biography, citations) and `/research/person/[id]` (research workspace: board, matrix, conflicts, timeline, canvas, hints, proof, factsheets). This creates redundancy, duplicate data fetching, and forces users to context-switch URLs.

## Decision

Merge both pages into a single unified page at `/person/[id]`. The research workspace's tab-based shell becomes the container. Three new tabs absorb the record management features. The `/research/person` route becomes a redirect.

## Route & Data Flow

**Canonical route:** `/person/[id]` — server component fetches `assemblePersonDetail(db, id)` and passes full `PersonData` to `WorkspaceShell`.

**Deleted routes:**
- `app/(auth)/research/person/[id]/` — rewritten as redirect to `/person/{id}` (preserving `?view=` param)
- `app/(auth)/person/[id]/edit/` — editing moves to Record tab

**Kept routes:**
- `app/(auth)/person/new/` — unchanged

**Data contract:** `WorkspaceShell` receives an expanded `PersonData` interface:

```typescript
interface PersonData {
  id: string;
  givenName: string;
  surname: string;
  birthDate: string | null;
  deathDate: string | null;
  sex: string;
  prefix: string | null;
  suffix: string | null;
  privacyLevel: string;
  isLiving: boolean;
  notes: string | null;
  spouses: RelatedPerson[];
  parents: RelatedPerson[];
  children: RelatedPerson[];
  events: PersonEvent[];
}
```

Research tabs continue fetching their own data via client hooks. Record, Timeline (events portion), and other CRUD tabs use the server-passed data.

## Tab Structure

11 tabs in this order:

| # | Tab | Icon | Source | Data |
|---|---|---|---|---|
| 1 | **Record** (new) | `UserPen` | Built from person-detail vitals + family card | Server `PersonData` |
| 2 | Board | `LayoutGrid` | Existing | Client hooks |
| 3 | Matrix | `Table2` | Existing | Client hooks |
| 4 | Conflicts | `GitCompareArrows` | Existing | Client hooks |
| 5 | **Timeline** (enhanced) | `Clock` | Existing + EventList merge | Client hooks + server events |
| 6 | Canvas | `PenTool` | Existing | Client hooks |
| 7 | Hints | `BookOpen` | Existing | Client hooks |
| 8 | Proof | `FileText` | Existing | Client hooks |
| 9 | Factsheets | `Layers` | Existing | Client hooks |
| 10 | **Biography** (new) | `BookMarked` | Lifted from person-detail | Client fetches (AI endpoints) |
| 11 | **Citations** (new) | `Quote` | Lifted from person-detail | Client fetches |

**Default tab:** Record (`?view=` absent defaults to `record` instead of `board`).

**Tab badges:** Conflicts (red, count), Hints (secondary, count), Factsheets (muted, count) — unchanged.

## New Components

### Record Tab — `components/research/record/record-tab.tsx`

Three cards in a single scrollable view:

**Vitals Card** — View/edit toggle:
- View mode: name, sex badge, living badge, birth/death dates+places, notes
- Edit mode: form fields for givenName, surname, prefix, suffix, sex, birthDate, birthPlace, deathDate, deathPlace, isLiving, notes
- Saves via `PUT /api/persons/{id}`, triggers `router.refresh()`

**Family Card** — Spouses, parents, children lists:
- Each person links to `/person/{id}`
- Quick-add buttons: "+ Add Spouse", "+ Add Father", "+ Add Mother", "+ Add Child" (link to `/person/new?relation=...&of={id}`)
- `PersonLinkPopover` for linking existing persons

**Danger Zone** — Delete person with `AlertDialog` confirmation:
- `DELETE /api/persons/{id}`, redirect to `/persons`

Props: receives full `PersonData` from `WorkspaceShell`. No client fetches needed.

### Enhanced Timeline Tab — `components/research/timeline/timeline-tab.tsx`

Extends existing read-only timeline:

- Interleaves `events` (server data, sorted by `dateSort`) alongside research `facts` (client hook, sorted by `factDate`), merged into a single chronological list. Events get a blue left-border, facts get a neutral left-border, so users can distinguish data sources at a glance
- Inline "Add Event" button — opens `EventForm`
- Each event row gets edit/delete icons (except protected birth/death events)
- Edit opens inline `EventForm`, delete shows confirmation
- Events mutate via `POST/PUT/DELETE /api/events`
- Gap detection and conflict indicators preserved

Props: receives `personId` (existing) + `events` array from `WorkspaceShell`.

### Biography Tab — `components/research/biography/biography-tab.tsx`

Direct lift of `BiographyTab` from person-detail:

- Biography section: generate/edit/regenerate AI biography (streaming from `/api/ai/biography`)
- Historical context section: toggle for AI-generated world events
- Tone/length/focus options dialog unchanged

Props: receives `personId` + `personName`.

### Citations Tab — `components/research/citations/citations-tab.tsx`

Direct lift of `CitationList` + `CitationForm` from person-detail:

- List citations with source title, confidence badge, detail, text
- Add citation with source search/create, confidence selector
- Delete with confirmation

Props: receives `personId`.

## WorkspaceShell Changes

**Header:**
- Keeps: Avatar, name, dates, "Search Sources", "Ask AI"
- Adds: "Edit" button (outline, pencil icon) — navigates to `?view=record`

**Tab routing:** 3 new cases added to the `activeView` conditional:
- `record` → `<RecordTab person={person} />`
- `biography` → `<BiographyTab personId={person.id} personName={...} />`
- `citations` → `<CitationsTab personId={person.id} />`

Enhanced existing case:
- `timeline` → `<TimelineTab personId={person.id} events={person.events} />`

**WorkspaceTabs:** `WorkspaceView` type expands from 8 to 11 values. Tabs array gets 3 new entries.

## Migration & Cleanup

### Files to delete
- `components/person-detail.tsx` — functionality split across Record, Biography, Citations tabs
- `app/(auth)/person/[id]/edit/page.tsx` — editing moves to Record tab

### Files to create
- `components/research/record/record-tab.tsx`
- `components/research/biography/biography-tab.tsx`
- `components/research/citations/citations-tab.tsx`
- New `app/(auth)/person/[id]/page.tsx` — renders `WorkspaceShell` with full `PersonData`

### Files to rewrite
- `app/(auth)/research/person/[id]/page.tsx` — becomes redirect to `/person/{id}`

### Files to modify
- `components/research/workspace/workspace-shell.tsx` — expanded props, new tab cases, default to `record`
- `components/research/workspace/workspace-tabs.tsx` — 3 new tabs, expanded `WorkspaceView` type
- `components/research/timeline/timeline-tab.tsx` — accept `events` prop, inline CRUD, interleave events with facts

### Components moved (not rewritten)
- `PersonLinkPopover` → `research/record/` or re-imported in place
- `BiographyTab`, `BiographyOptions`, `BiographyViewer` → `research/biography/`
- `CitationList`, `CitationForm` → `research/citations/`
- `EventForm` → `research/timeline/`

### Link updates
- All ~20 existing `/person/{id}` links: **no changes needed** (canonical route unchanged)
- 2 links to `/research/person/{id}` (tree-context-menu.tsx, item-sidebar.tsx): update to `/person/{id}`
