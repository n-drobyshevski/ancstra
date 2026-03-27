# Research → Tree Pipeline: Core User Workflow

> **Status:** Design approved
> **Date:** 2026-03-26
> **Scope:** End-to-end workflow from research discovery to tree placement
> **Dependencies:** research-workspace-design, source-citation-management-design, data-model

## Context

Ancstra's core value proposition is the pipeline from research discovery to tree building. A user finds evidence (census records, vital records, newspaper clippings), extracts facts, builds hypotheses about who people are, and then promotes those hypotheses into confirmed tree entries. This spec defines that end-to-end workflow as the baseline for all app functionality.

The workflow must serve two personas simultaneously via adaptive complexity:
- **Casual users** who know their family members and want to enter them directly
- **Serious researchers** who build evidence-based hypotheses from multiple sources

## Design Principles

1. **Facts are atoms** — the smallest unit of genealogical knowledge, each traceable to a source
2. **Factsheets are hypotheses** — curated groupings of facts representing a working theory about an entity
3. **Provenance is encouraged, not enforced** — track sources when available, don't block workflow without them
4. **Two paths, one data model** — quick add and research paths produce identical person/event/source records
5. **The tree is a work canvas** — factsheets and proposed persons can be dragged onto it
6. **Research is iterative** — tree gaps feed back into new research via "Research this person"
7. **Single promotion pathway** — all promotion routes through factsheets. The old `promoteToSource` (research item → source) auto-creates a minimal factsheet behind the scenes, then promotes through the factsheet pipeline. One code path, consistent provenance tracking.

## Two Paths

### Quick Path (Casual Users)

For known family members where the user IS the source.

1. Click "Add Person" on tree canvas or sidebar
2. Fill person form (name, dates, sex, relationships)
3. Person appears on tree — done
4. Optionally add sources later via person detail panel

Creates person + events directly. Source defaults to `personal_knowledge` if none provided.

### Research Path (Evidence-Based)

For building tree entries from discovered evidence.

```
Discovery → Analysis → Promotion → Tree
```

**Discovery Layer:**
1. **Entry points:** search query, paste URL, paste text, bookmarklet capture, AI suggestion, tree gap click
2. **Results:** provider-colored cards with snippets and metadata
3. **Save:** interesting results become `research_items` (status: draft)
4. Items can be **anchored** (linked to a person) or **unanchored** (in the inbox)

**Analysis Layer:**
5. **Fact extraction:** AI auto-extract or manual entry → `research_facts` with source link
6. **Factsheet grouping:** group related facts into factsheets (working hypotheses)
7. **Relationship linking:** relationship facts (parent_name, spouse_name) create edges between factsheets via `factsheet_links`
8. **Conflict resolution:** competing facts flagged; user picks accepted value; alternatives preserved
9. **Duplicate check:** matching engine compares factsheet against existing tree persons

**Promotion Layer:**
10. **Promote:** three modes:
    - **Single promote** — one factsheet → one person
    - **Family unit promote** — cluster of linked factsheets → persons + family + children (atomic transaction)
    - **Merge into existing** — factsheet matches existing person → add new facts/events to that person
11. **Tree placement:** new person(s) appear on canvas; user positions or auto-layout

### Feedback Loop

Tree person nodes show **gap indicators** (missing birth date, no sources, 0 events). Clicking "Research this person" opens the research workspace pre-filtered for that person. Findings flow back through the Analysis → Promotion pipeline.

## New Concepts

### Unanchored Research Inbox

Free exploration (searching "Smiths in Ohio 1850" without a target person) produces research items not linked to any person. These land in an **Inbox** — a triage view on the Research hub page.

- Tab alongside Search and AI Chat
- Badge shows count of unanchored items
- Triage actions: assign to existing person, create factsheet, or dismiss
- Implementation: query `research_items` with no entries in `research_item_persons`

### Factsheet Graph

Factsheets can be connected to each other via relationship facts:

- When fact type is `parent_name`, `spouse_name`, or `child_name`, the system checks for matching factsheets
- If found: suggests creating a `factsheet_link` edge
- If not found: offers to create a new factsheet pre-seeded with the name
- Users can also manually connect factsheets

The factsheet graph enables **family unit promotion** — selecting a cluster of connected factsheets and promoting them as one atomic transaction with relationships pre-wired.

### Conflict Resolution

When multiple facts of the same type exist on a factsheet (e.g., two `birth_date` values from different sources):

1. System flags the conflict automatically
2. User reviews competing claims with their sources
3. User marks one fact as `accepted = true`, others as `accepted = false`
4. AI can suggest resolution (e.g., "Census records are generally more reliable for birth dates")
5. Promotion is blocked until all single-valued fact conflicts are resolved
6. Multi-valued facts (residence, occupation, child_name) are exempt from conflict blocking

### Duplicate Detection at Promotion

Before creating a new person from a factsheet:

1. Matching engine runs against all existing persons (uses `packages/matching/`)
2. Results shown with confidence scores
3. Above 0.95: strong match warning ("This looks like John Smith already in your tree")
4. 0.70–0.95: possible match ("Similar to these people — check before creating")
5. Below 0.70: no match, safe to create
6. User chooses: merge into existing person, or create new

## Data Model Changes

### New Table: `factsheets`

```sql
CREATE TABLE factsheets (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  entity_type      TEXT NOT NULL DEFAULT 'person'
                   CHECK (entity_type IN ('person', 'couple', 'family_unit')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'ready', 'promoted', 'merged', 'dismissed')),
  notes            TEXT,
  promoted_person_id TEXT REFERENCES persons(id),
  promoted_at      TEXT,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_factsheets_status ON factsheets(status);
CREATE INDEX idx_factsheets_created_by ON factsheets(created_by);
CREATE INDEX idx_factsheets_promoted_person ON factsheets(promoted_person_id);
```

### New Table: `factsheet_links`

```sql
CREATE TABLE factsheet_links (
  id                TEXT PRIMARY KEY,
  from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
  to_factsheet_id   TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
                    CHECK (relationship_type IN ('parent_child', 'spouse', 'sibling')),
  source_fact_id    TEXT REFERENCES research_facts(id),
  -- Directionality: for parent_child, from=parent, to=child
  -- For spouse/sibling, order is arbitrary (alphabetical by id)
  confidence        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (confidence IN ('high', 'medium', 'low')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_factsheet_links_from ON factsheet_links(from_factsheet_id);
CREATE INDEX idx_factsheet_links_to ON factsheet_links(to_factsheet_id);
CREATE UNIQUE INDEX idx_factsheet_links_unique
  ON factsheet_links(from_factsheet_id, to_factsheet_id, relationship_type);
```

### Modified Table: `research_facts`

Add two columns:

```sql
ALTER TABLE research_facts ADD COLUMN factsheet_id TEXT REFERENCES factsheets(id);
ALTER TABLE research_facts ADD COLUMN accepted INTEGER; -- null=unresolved, 1=accepted, 0=rejected

CREATE INDEX idx_research_facts_factsheet ON research_facts(factsheet_id);
```

A fact can exist without a factsheet (ungrouped). The `accepted` column is used only when multiple facts of the same single-valued type exist on the same factsheet.

### No Changes Required

- `research_items` — unanchored inbox is a query, not a schema change
- `research_item_persons` — M:N already supports 0 person links
- `persons`, `families`, `children`, `events`, `sources`, `source_citations` — unchanged; promotion creates standard records

## Promotion Transaction

### Single Factsheet → Person

```
BEGIN TRANSACTION
  1. Validate: all single-valued fact conflicts resolved (accepted != null)
  2. Run matching engine against existing persons
  3. If user chose "merge into existing":
     → Update existing person with new facts
     → Create events for date/place facts not already present
     → Create source from research_item (if not already promoted)
     → Create source_citations linking facts to person/events
  4. If user chose "create new":
     → INSERT person (from name/sex facts)
     → INSERT person_names (primary + alternates)
     → INSERT events (birth, death, marriage, etc. from date/place facts)
     → INSERT source (from research_item metadata)
     → INSERT source_citations (linking source to person/events)
  5. UPDATE factsheet: status='promoted', promoted_person_id=X, promoted_at=now
  6. UPDATE research_facts: link to source_citation_id where applicable
COMMIT
```

### Family Unit → Multiple Persons + Relationships

```
BEGIN TRANSACTION
  1. For each factsheet in the cluster:
     → Execute single promotion steps 1-6
  2. For each factsheet_link in the cluster:
     → If spouse: INSERT family (partner1_id, partner2_id, relationship_type)
     → If parent_child: find/create family, INSERT children record
     → If sibling: ensure shared family exists, INSERT children records
  3. Rebuild ancestor_paths closure table for new persons
  4. Rebuild person_summary for new persons
COMMIT
```

## Factsheet Status Lifecycle

```
draft → ready → promoted
  ↓                ↓
  └→ dismissed    merged (into existing person)
```

- **draft**: working hypothesis, facts being collected
- **ready**: user marked as ready for promotion (all conflicts resolved)
- **promoted**: successfully created a new person
- **merged**: facts merged into an existing person
- **dismissed**: user decided this hypothesis was wrong

## UI Integration Points

### Research Hub (`/research`)

- **Search tab** — existing search + AI chat
- **Inbox tab** (new) — unanchored research items, triage actions
- Badge on Inbox tab showing unanchored count

### Person Research Workspace (`/research/person/[id]`)

- Existing tabs: board, matrix, conflicts, canvas, timeline, hints, proof
- **Factsheets tab** (new) — list of factsheets for this person, create new, link facts
- Factsheet detail: grouped facts, linked factsheets (graph edges), conflict indicators, promote button

### Tree View (`/tree`)

- **Gap indicators** on person nodes (missing dates, no sources)
- **"Research this person"** context menu action → navigates to `/research/person/[id]`
- **Drag-drop zone** — factsheets from sidebar can be dragged onto canvas to trigger promotion
- **Quick add** — "Add Person" button triggers the quick path form

### Person Detail (`/person/[id]`)

- **Source provenance** — each fact shows its source lineage (research_item → factsheet → source_citation)
- **"Research this person"** button → `/research/person/[id]`

## Verification

1. **Quick path:** Create person via "Add Person" form → verify person appears on tree with events
2. **Research path:** Search → save result → extract facts → create factsheet → group facts → promote → verify person on tree with source citations
3. **Conflict resolution:** Create factsheet with two birth_date facts → verify promotion blocked → resolve conflict → verify promotion succeeds
4. **Duplicate detection:** Create factsheet matching existing person → verify match shown with confidence → merge → verify no duplicate created
5. **Family unit:** Create 3 linked factsheets (parents + child) → promote as unit → verify family record + child link created atomically
6. **Inbox:** Search without person context → save result → verify appears in Inbox → assign to person → verify moved out of Inbox
7. **Feedback loop:** View person on tree with gap indicators → click "Research this person" → verify navigates to research workspace with person context
