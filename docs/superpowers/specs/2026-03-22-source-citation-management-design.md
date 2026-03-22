# Source/Citation Management

> **Spec for:** Reusable source records, polymorphic citations linking sources to persons/events/families/names, dedicated sources page, and inline citation UI on entity pages.

---

## Scope

1. Two new DB tables: `sources` and `source_citations` (matching data model doc)
2. Source CRUD API (create, list with search, get, update, delete)
3. Citation CRUD API (create with polymorphic entity link, list by entity, delete)
4. Dedicated sources page at `/sources` (table with search + add/edit)
5. Inline citation UI on person detail, event list, and family sections
6. Confidence levels: high/medium/low/disputed, default medium
7. Sidebar nav item for Sources

---

## Schema (New Drizzle Tables)

### `sources` table

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  publication_date TEXT,
  repository_name TEXT,
  repository_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'vital_record', 'census', 'military', 'church', 'newspaper',
    'immigration', 'land', 'probate', 'cemetery', 'photograph',
    'personal_knowledge', 'correspondence', 'book', 'online', 'other'
  )),
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `source_citations` table

```sql
CREATE TABLE source_citations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  citation_detail TEXT,
  citation_text TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low', 'disputed')) DEFAULT 'medium',
  -- Polymorphic links (at least one must be set)
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  person_name_id TEXT REFERENCES person_names(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
```

Indexes: `source_citations(source_id)`, `source_citations(person_id)`, `source_citations(event_id)`, `source_citations(family_id)`.

---

## Types (`packages/shared/src/types.ts`)

```typescript
export interface Source {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publicationDate: string | null;
  repositoryName: string | null;
  repositoryUrl: string | null;
  sourceType: 'vital_record' | 'census' | 'military' | 'church' | 'newspaper' |
    'immigration' | 'land' | 'probate' | 'cemetery' | 'photograph' |
    'personal_knowledge' | 'correspondence' | 'book' | 'online' | 'other' | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  citationCount?: number;
}

export interface Citation {
  id: string;
  sourceId: string;
  source?: Source;
  citationDetail: string | null;
  citationText: string | null;
  confidence: 'high' | 'medium' | 'low' | 'disputed';
  personId: string | null;
  eventId: string | null;
  familyId: string | null;
  personNameId: string | null;
  createdAt: string;
}

export interface CreateSourceInput {
  title: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  repositoryName?: string;
  repositoryUrl?: string;
  sourceType?: Source['sourceType'];
  notes?: string;
}

export interface CreateCitationInput {
  sourceId: string;
  citationDetail?: string;
  citationText?: string;
  confidence?: Citation['confidence'];
  personId?: string;
  eventId?: string;
  familyId?: string;
  personNameId?: string;
}
```

---

## Validation Schemas

```
createSourceSchema: title required (min 1), all others optional, sourceType enum if provided
updateSourceSchema: all fields optional, at least one required
createCitationSchema: sourceId required, confidence optional (default medium),
  at least one of personId/eventId/familyId/personNameId required
```

---

## API Routes

### Sources

**`POST /api/sources`** — Create source. Validate, insert, return Source with 201.

**`GET /api/sources`** — List sources with optional `?q=` search on title. Includes citation count per source. Paginated.

**`GET /api/sources/[id]`** — Get single source with citation count.

**`PUT /api/sources/[id]`** — Update source fields. Return updated.

**`DELETE /api/sources/[id]`** — Hard delete source (cascades to citations).

### Citations

**`POST /api/citations`** — Create citation. Validate sourceId exists, validate entity link exists. Insert with confidence default 'medium'. Return Citation with assembled source.

**`GET /api/citations`** — List citations filtered by entity: `?personId=X` or `?eventId=X` or `?familyId=X`. Returns citations with source data joined. No filter = 400 error.

**`DELETE /api/citations/[id]`** — Hard delete citation.

---

## UI — Sources Page (`/sources`)

Client component at `app/(auth)/sources/page.tsx`:
- Search input (debounced, `?q=` on API)
- shadcn Table: Title (link), Type badge, Repository, Citations count
- Pagination (Previous/Next)
- "Add Source" button → opens source form modal/inline
- Click source title → edit modal/inline

### Source Form Component (`components/source-form.tsx`)
- Title (required), Author, Publisher, Publication Date, Repository Name, Repository URL
- Source Type dropdown (15 options)
- Notes textarea
- Create or Edit mode (same component)

---

## UI — Inline Citations on Entity Pages

### Citation List Component (`components/citation-list.tsx`)
- Props: `{ personId?, eventId?, familyId? }` — fetches citations for that entity
- Each citation: source title (link to source), citation detail, confidence badge
- Delete [×] button per citation
- "Add Citation" button → opens citation form

### Citation Form Component (`components/citation-form.tsx`)
- Props: `{ personId?, eventId?, familyId?, onSave }` — pre-fills entity link
- Source selector: type-ahead search of existing sources, or "Create new" inline
- Citation detail (text input — page number, entry)
- Citation text (textarea — formatted citation)
- Confidence dropdown (high/medium/low/disputed, default medium)
- Save button

### Integration Points
- **Person detail page**: Add "Sources" card section after Events card. Renders `CitationList` with `personId`.
- **Event list**: Each event row shows citation count badge. Expandable to show `CitationList` with `eventId`.
- **Family card on person detail**: Optional — show citation count per family relationship. Can defer to keep scope manageable.

---

## Sidebar

Add "Sources" nav item with `Bookmark` icon between Research and Import.

---

## File Structure

```
packages/db/src/
  schema.ts                         — ADD: sources + sourceCitations tables + indexes

packages/shared/src/
  types.ts                          — ADD: Source, Citation, CreateSourceInput, CreateCitationInput

apps/web/
  lib/
    validation.ts                   — ADD: createSourceSchema, updateSourceSchema, createCitationSchema

  app/api/
    sources/route.ts                — POST, GET (list with search + citation count)
    sources/[id]/route.ts           — GET, PUT, DELETE
    citations/route.ts              — POST, GET (by entity)
    citations/[id]/route.ts         — DELETE

  app/(auth)/
    sources/page.tsx                — Sources list page

  components/
    source-form.tsx                 — Create/edit source form
    citation-form.tsx               — Add citation (search source + details)
    citation-list.tsx               — Display citations for an entity
    person-detail.tsx               — MODIFY: add Sources section
    app-sidebar.tsx                 — MODIFY: add Sources nav item

  __tests__/
    api/sources.test.ts             — Source CRUD integration tests
    api/citations.test.ts           — Citation CRUD + polymorphic linking tests
    validation.test.ts              — ADD: source + citation schema tests
```

---

## Schema Migration

Run `pnpm db:generate` + `pnpm db:migrate` after adding tables to schema.ts. Seed data: optionally add a sample source + citation linking to existing seed persons.

---

## Tests

### `__tests__/api/sources.test.ts`
- POST creates source, returns with id
- GET lists sources with citation count
- GET with ?q= filters by title
- PUT updates source fields
- DELETE removes source and cascading citations

### `__tests__/api/citations.test.ts`
- POST creates citation linking source to person
- POST creates citation linking source to event
- GET ?personId= returns citations with source data
- GET ?eventId= returns citations for event
- DELETE removes citation
- POST rejects citation without entity link
- POST rejects citation with invalid sourceId

### `__tests__/validation.test.ts` (additions)
- createSourceSchema: valid, missing title rejected
- createCitationSchema: valid, missing sourceId rejected, missing entity rejected

---

## Out of Scope
- Media attachments on sources (deferred)
- FamilySearch source ID linking (`fs_source_id` column exists but not used yet)
- GEDCOM SOUR import (deferred — mapper currently skips sources)
- Bulk citation management
- Citation formatting templates (Chicago, MLA, etc.)
