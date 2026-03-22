# Phase 1 Week 2 — Person CRUD + Relationships + Events

> **Spec for:** Full person lifecycle (create/read/update/delete), family/relationship management, event CRUD, context-aware person creation, inline editing on detail page.
>
> **Sources deferred** to Week 3.

---

## Scope

1. Person update (PUT) + soft-delete (DELETE)
2. Inline quick-edit on person detail page
3. Full edit page at `/person/[id]/edit`
4. Full event CRUD (any event type) with chronological display
5. Family CRUD (create/read/update partnerships)
6. Child linking/unlinking on families
7. Context-aware person creation (`/person/new?relation=spouse&of=<id>`)
8. Link-existing-person search popover on detail page
9. Enhanced person detail showing relationships + events
10. Simple `LIKE` search on persons (FTS5 deferred)

---

## Shared Types (`packages/shared/src/types.ts`)

### New Types

```typescript
export interface Family {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  relationshipType: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown';
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
  partner1?: PersonListItem | null;
  partner2?: PersonListItem | null;
  children?: PersonListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  eventType: string;
  dateOriginal: string | null;
  dateSort: number | null;
  dateModifier: 'exact' | 'about' | 'estimated' | 'before' | 'after' | 'between' | 'calculated' | 'interpreted' | null;
  dateEndSort: number | null;
  placeText: string | null;
  description: string | null;
  personId: string | null;
  familyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFamilyInput {
  partner1Id?: string;
  partner2Id?: string;
  relationshipType?: Family['relationshipType'];
}
// Refinement: at least one of partner1Id or partner2Id must be provided

export interface UpdatePersonInput {
  givenName?: string;
  surname?: string;
  sex?: 'M' | 'F' | 'U';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving?: boolean;
  notes?: string;
}

export interface CreateEventInput {
  eventType: string;
  dateOriginal?: string;
  dateEndOriginal?: string;  // for "between X and Y" range dates
  placeText?: string;
  description?: string;
  dateModifier?: Event['dateModifier'];
  personId?: string;
  familyId?: string;
}
// dateSort and dateEndSort are computed server-side from dateOriginal/dateEndOriginal

export interface UpdateEventInput {
  eventType?: string;
  dateOriginal?: string;
  dateEndOriginal?: string;
  placeText?: string;
  description?: string;
  dateModifier?: Event['dateModifier'];
}

export interface RelationContext {
  relation: 'spouse' | 'father' | 'mother' | 'child';
  ofPersonId: string;
}

// Enhanced person detail with relationships
export interface PersonDetail extends Person {
  spouses: PersonListItem[];
  parents: PersonListItem[];
  children: PersonListItem[];
  events: Event[];
}
```

---

## Validation Schemas (`apps/web/lib/validation.ts`)

### New Schemas

```typescript
updatePersonSchema: {
  givenName?: string (min 1 if present),
  surname?: string (min 1 if present),
  sex?: enum M/F/U,
  birthDate?: string, birthPlace?: string,
  deathDate?: string, deathPlace?: string,
  isLiving?: boolean, notes?: string
}
// Refine: at least one field must be present

createFamilySchema: {
  partner1Id?: string (uuid),
  partner2Id?: string (uuid),
  relationshipType?: enum (married, civil_union, domestic_partner, unmarried, unknown)
}
// Refine: at least one of partner1Id or partner2Id must be provided

createEventSchema: {
  eventType: string (min 1),
  dateOriginal?: string,
  dateEndOriginal?: string,
  placeText?: string,
  description?: string,
  dateModifier?: enum,
  personId?: string,
  familyId?: string
}
// Refine: must have personId or familyId
// dateSort and dateEndSort computed server-side

updateEventSchema: partial of createEventSchema (at least one field)
```

---

## API Routes

### Person Updates

**`PUT /api/persons/[id]`**
- Auth required
- Validate body with `updatePersonSchema`
- Check person exists and not soft-deleted
- **Wrap in `db.transaction()`** — multi-table update must be atomic
- Update `persons` table fields (sex, isLiving, notes, updatedAt)
- Update primary `person_names` record (givenName, surname) if provided
- Upsert birth event: if birthDate/birthPlace provided, find existing birth event → update or create
- Upsert death event: same logic for death
- Return assembled `Person`

**`DELETE /api/persons/[id]`**
- Auth required
- Check person exists and not already deleted
- Set `deletedAt = now`
- **Cascade behavior:** Soft-deleted persons remain in DB (FK references preserved). The `assemblePersonDetail` helper filters out soft-deleted persons when assembling spouse/parent/child arrays. Families with both partners soft-deleted are effectively orphaned but not cleaned up (no data loss).
- Return `{ success: true }`

### Enhanced Person Detail

**`GET /api/persons/[id]`** (enhanced)
- Current: returns person + primary name + birth/death events
- Add: `spouses[]`, `parents[]`, `children[]`, `events[]`
- Query logic:
  1. Get person + primary name (existing)
  2. Get all families where person is partner1 or partner2 → extract other partner as spouse
  3. Get all families where person is in children table → extract partners as parents
  4. Get all children records in families where person is a partner → extract persons as children
  5. Get all events for this person, ordered by dateSort

### Search Enhancement

**`GET /api/persons`** (enhanced)
- Add optional `?q=<term>` parameter
- When present: filter on the joined `person_names` table: `WHERE (person_names.given_name LIKE '%term%' OR person_names.surname LIKE '%term%')`
- Case-insensitive via SQLite default `LIKE` behavior
- Used by the link-existing-person popover

### Family CRUD

**`POST /api/families`**
- Auth required
- Validate with `createFamilySchema`
- Check provided person(s) exist and aren't soft-deleted
- Check no duplicate non-deleted family exists for this pair (either direction, `WHERE deletedAt IS NULL`)
- Insert family record
- Return `Family` with partner details populated

**`GET /api/families/[id]`**
- Auth required
- Return family with partner1, partner2 (as PersonListItem), children array

**`PUT /api/families/[id]`**
- Auth required
- Update relationshipType or validationStatus
- Return updated Family

**`POST /api/families/[id]/children`**
- Auth required
- Body: `{ personId, childOrder?, relationshipToParent1?, relationshipToParent2? }`
- Check person exists, family exists, no duplicate link
- Insert children record
- Return `{ success: true }`

**`DELETE /api/families/[id]/children/[personId]`**
- Auth required
- Remove the children record (hard delete — it's a link, not data)
- Return `{ success: true }`

### Event CRUD

**`POST /api/events`**
- Auth required
- Validate with `createEventSchema`
- Compute `dateSort` via `parseDateToSort(dateOriginal)` if provided
- Insert event
- Return `Event`

**`GET /api/persons/[id]/events`**
- Auth required
- Return all events where `personId = id`, ordered by `dateSort ASC NULLS LAST`

**`PUT /api/events/[id]`**
- Auth required
- Validate with `updateEventSchema`
- Recompute `dateSort` if `dateOriginal` changed
- Return updated `Event`

**`DELETE /api/events/[id]`**
- Auth required
- Hard delete (events are owned data, not top-level entities)
- Return `{ success: true }`

---

## Shared Query Helper (`apps/web/lib/queries.ts`)

```typescript
export async function assemblePersonDetail(db: Database, personId: string): Promise<PersonDetail | null>
```

Used by both the server component (`person/[id]/page.tsx`) and the API route (`GET /api/persons/[id]`). Single source of truth. Queries:

1. Person + primary name (WHERE `deletedAt IS NULL`)
2. Families where person is partner → extract other partner as spouse (exclude soft-deleted partners, skip NULL partners)
3. Children table where personId matches → find family → extract non-NULL, non-deleted partners as parents
4. Families where person is partner → children from those families (exclude soft-deleted children)
5. All events for person, sorted by `dateSort ASC NULLS LAST`

Returns `null` if person not found or soft-deleted.

**Note:** The return type changes from `Person` to `PersonDetail`. The existing `person-detail.tsx` component and tests will be updated to expect the new shape. The `PersonDetail` type extends `Person`, so all existing fields are preserved — only new arrays are added.

---

## Frontend Components

### Enhanced `person-detail.tsx`

Server-rendered with client islands for interactivity.

**Sections:**
1. **Header** — Name, sex badge, living badge, [Edit] (links to `/person/[id]/edit`), [Delete] (with confirmation dialog)
2. **Vital Info Card** — Birth/death inline. Click "Edit" → fields become inputs → Save/Cancel. Uses `PUT /api/persons/[id]` via fetch.
3. **Family Card** — Three subsections:
   - Spouses: listed with link to their detail page, [×] to unlink
   - Parents: listed, [×] to unlink
   - Children: listed, [×] to unlink
   - Actions: "+ Add Spouse/Father/Mother/Child" → `/person/new?relation=X&of=<id>`, "Link existing" → opens `PersonLinkPopover`
4. **Events Card** — Chronological list of all events. Each shows type badge, date, place, description. [✎] for inline edit, [×] for delete. "+ Add Event" opens inline `EventForm`.
5. **Footer** — timestamps, back link

### New `person-link-popover.tsx`

Client component. Uses shadcn `Popover`.

- Dropdown to select relation type (Spouse / Father / Mother / Child)
- Text input with debounced search → `GET /api/persons?q=<term>&pageSize=5`
- Results list with [+] button to link
- On link: POST to appropriate family/children endpoint, close popover, refresh page via `router.refresh()`

### New `event-form.tsx`

Client component for add/edit events.

- Event type: select dropdown (birth, death, marriage, divorce, residence, occupation, immigration, emigration, military, education, census, burial, baptism, other)
- Date: text input (free-form genealogical dates)
- Date modifier: select dropdown (exact, about, estimated, before, after, between) — defaults to "exact", collapsible/advanced option
- Place: text input
- Description: textarea
- Save → `POST /api/events` or `PUT /api/events/[id]`
- `dateModifier` is auto-set to "between" if both date and end date are provided

### New `event-list.tsx`

Display component for chronological events.

- Groups by dateSort, shows type as badge
- Birth/death events shown but not deletable
- Other events have edit/delete controls
- Empty state: "No events recorded"

### Enhanced `person-form.tsx`

- **Edit mode:** Accepts optional `person` prop. When present, pre-fills all fields, changes button to "Save Changes", submits PUT instead of POST.
- **Relation context:** Reads `?relation=` and `&of=` from URL search params. Shows context banner ("Creating spouse of John Smith"). Pre-fills sex if applicable. On save, creates person then creates family/child link, then redirects back to `/person/<of-id>`.

### New `/person/[id]/edit/page.tsx`

Server component that:
1. Fetches person detail with `assemblePersonDetail()`
2. Renders `PersonForm` in edit mode with person data
3. Below the form: `EventList` with inline add/edit
4. Below events: read-only relationship summary with link to detail page

---

## Context-Aware Creation Logic

When `PersonForm` detects `?relation=X&of=Y`:

| relation | Sex pre-fill | After person created |
|---|---|---|
| `spouse` | Opposite of Y's sex | `POST /api/families { partner1Id: Y, partner2Id: newId }` |
| `father` | M | Find family where Y is child → add as partner1. If no family, create family + add Y as child. |
| `mother` | F | Same but partner2 |
| `child` | — | Find family where Y is partner → `POST /api/families/[fam]/children { personId: newId }`. If no family, create family with Y as partner1 + add new person as child. |

**"Find or create family" helpers** (`lib/queries.ts`):
```typescript
// Find existing family where childId is already linked, or create a new family with parentId as a partner
export function findOrCreateFamilyForChild(db, childId: string, parentId: string, parentRole: 'partner1' | 'partner2'): string // returns familyId

// Find families where personId is a partner. Returns array (person may have multiple partnerships).
// Context-aware creation uses the first result, or creates a new family if none exist.
export function findFamiliesAsPartner(db, personId: string): string[] // returns familyIds
```

**Redirect after save:** Goes to `/person/<of-id>` (the person you started from), not the newly created person.

---

## Search on Persons List

Enhance `GET /api/persons` with `?q=` parameter. The filter applies to the already-joined `person_names` table:

```sql
WHERE (person_names.given_name LIKE '%term%' OR person_names.surname LIKE '%term%')
  AND persons.deleted_at IS NULL
```

Case-insensitive via SQLite default `LIKE` behavior. Used by `PersonLinkPopover`. Full FTS5 deferred.

---

## Testing

### New/Enhanced Test Files

**`__tests__/validation.test.ts`** — add tests for:
- `updatePersonSchema` — partial valid, empty rejected
- `createFamilySchema` — valid, missing partner rejected
- `createEventSchema` — valid, missing eventType rejected, must have personId or familyId

**`__tests__/api/persons.test.ts`** — add:
- PUT updates person name and returns updated data
- PUT upserts birth/death events
- DELETE soft-deletes and excludes from queries
- GET with `?q=` filters by name

**`__tests__/api/families.test.ts`** — new:
- POST creates family linking two persons
- POST rejects duplicate family
- GET returns family with partners and children
- POST children links a child
- DELETE children unlinks a child

**`__tests__/api/events.test.ts`** — new:
- POST creates event with dateSort computed
- GET returns events sorted chronologically
- PUT updates event and recomputes dateSort
- DELETE removes event

All integration tests use in-memory SQLite (same pattern as Week 1).

---

## File Structure (New/Modified)

```
packages/shared/src/
  types.ts                              — MODIFIED: add Family, Event, PersonDetail, inputs

apps/web/
  lib/
    validation.ts                       — MODIFIED: add update/family/event schemas
    queries.ts                          — NEW: assemblePersonDetail, findOrCreateFamily helpers

  app/api/
    persons/[id]/route.ts               — MODIFIED: add PUT, DELETE, enhanced GET
    persons/[id]/events/route.ts         — NEW: GET events for person
    families/route.ts                    — NEW: POST create family
    families/[id]/route.ts              — NEW: GET, PUT family
    families/[id]/children/route.ts     — NEW: POST add child
    families/[id]/children/[personId]/route.ts — NEW: DELETE unlink child
    events/route.ts                     — NEW: POST create event
    events/[id]/route.ts               — NEW: PUT, DELETE event

  components/
    person-detail.tsx                   — MODIFIED: relationships, events, inline edit, delete
    person-form.tsx                     — MODIFIED: edit mode, relation context
    person-link-popover.tsx             — NEW: search + link existing person
    event-form.tsx                      — NEW: add/edit event
    event-list.tsx                      — NEW: chronological event display

  app/(auth)/
    person/[id]/page.tsx                — MODIFIED: fetch full detail with relationships
    person/[id]/edit/page.tsx           — NEW: full edit page

  __tests__/
    validation.test.ts                  — MODIFIED: new schema tests
    api/persons.test.ts                 — MODIFIED: update, delete, search tests
    api/families.test.ts                — NEW: family CRUD tests
    api/events.test.ts                  — NEW: event CRUD tests
```

---

## Conventions

**Error responses:** All endpoints follow the Week 1 pattern:
- `401 { error: "Unauthorized" }` — no session
- `400 { error: "Validation failed", issues: ZodIssue[] }` — invalid input
- `404 { error: "Not found" }` — resource missing or soft-deleted
- `409 { error: "..." }` — conflict (e.g., duplicate family)

**Place handling:** `placeText` is free-form text for now. The schema has no `places` table yet — place normalization (`placeId` FK) is deferred. This is a conscious stopgap.

**Transaction wrapping:** All multi-table writes (PUT person, context-aware creation + linking) must use `db.transaction()` for atomicity.

---

## Out of Scope (Deferred)

- Source/citation management → Week 3
- FTS5 full-text search → Week 3+
- Place normalization/hierarchy → later
- Closure table / person_summary → Week 5-6 (tree viz)
- Media attachments → later
- Proposed relationships / AI staging → Phase 2
- Rate limiting → later
- Server-side protection against deleting birth/death events (UI-only guard for now)
