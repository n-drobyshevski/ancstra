# Source/Citation Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable source records and polymorphic citations that link sources to persons, events, families, and names — with a dedicated sources page, inline citation UI on entity pages, and confidence levels.

**Architecture:** Two new Drizzle tables (`sources`, `sourceCitations`) added to the existing schema. Source CRUD and citation CRUD as separate API route sets. Citations fetched by entity ID (polymorphic query). UI components for source management (form, table) and citation management (form, list) integrated into existing person detail page.

**Tech Stack:** Drizzle ORM, better-sqlite3, Zod, Next.js 16, shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-source-citation-management-design.md`

---

## File Structure

All paths relative to project root (`D:/projects/ancstra/`).

```
packages/db/src/
  schema.ts                         — ADD: sources + sourceCitations tables + indexes

packages/shared/src/
  types.ts                          — ADD: Source, Citation, CreateSourceInput, CreateCitationInput

apps/web/
  lib/
    validation.ts                   — ADD: createSourceSchema, updateSourceSchema, createCitationSchema

  app/api/
    sources/route.ts                — POST create, GET list (with ?q= search + citation count)
    sources/[id]/route.ts           — GET, PUT, DELETE
    citations/route.ts              — POST create, GET (by entity ?personId= or ?eventId= or ?familyId=)
    citations/[id]/route.ts         — DELETE

  app/(auth)/
    sources/page.tsx                — Sources list page (search + table + add/edit)

  components/
    source-form.tsx                 — Create/edit source form
    citation-form.tsx               — Add citation (search source + details + confidence)
    citation-list.tsx               — Display citations for an entity
    person-detail.tsx               — MODIFY: add Sources card section
    app-sidebar.tsx                 — MODIFY: add Sources nav item

  __tests__/
    validation.test.ts              — ADD: source + citation schema tests
    api/sources.test.ts             — Source CRUD integration tests
    api/citations.test.ts           — Citation CRUD + polymorphic linking tests
```

---

## Task 0: Schema + Types + Validation

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/lib/validation.ts`
- Modify: `apps/web/__tests__/validation.test.ts`

- [ ] **Step 1: Add Drizzle tables to packages/db/src/schema.ts**

Add after the `events` table:

```typescript
// ==================== SOURCES ====================
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  author: text('author'),
  publisher: text('publisher'),
  publicationDate: text('publication_date'),
  repositoryName: text('repository_name'),
  repositoryUrl: text('repository_url'),
  sourceType: text('source_type', {
    enum: ['vital_record', 'census', 'military', 'church', 'newspaper',
      'immigration', 'land', 'probate', 'cemetery', 'photograph',
      'personal_knowledge', 'correspondence', 'book', 'online', 'other']
  }),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== SOURCE CITATIONS ====================
export const sourceCitations = sqliteTable('source_citations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  citationDetail: text('citation_detail'),
  citationText: text('citation_text'),
  confidence: text('confidence', {
    enum: ['high', 'medium', 'low', 'disputed']
  }).notNull().default('medium'),
  personId: text('person_id').references(() => persons.id, { onDelete: 'cascade' }),
  eventId: text('event_id').references(() => events.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  personNameId: text('person_name_id').references(() => personNames.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_citations_source').on(table.sourceId),
  index('idx_citations_person').on(table.personId),
  index('idx_citations_event').on(table.eventId),
  index('idx_citations_family').on(table.familyId),
]);
```

- [ ] **Step 2: Run migration**

```bash
cd D:/projects/ancstra/packages/db && pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 3: Add types to packages/shared/src/types.ts**

Add after existing types:

```typescript
export type SourceType = 'vital_record' | 'census' | 'military' | 'church' | 'newspaper' |
  'immigration' | 'land' | 'probate' | 'cemetery' | 'photograph' |
  'personal_knowledge' | 'correspondence' | 'book' | 'online' | 'other';

export interface Source {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publicationDate: string | null;
  repositoryName: string | null;
  repositoryUrl: string | null;
  sourceType: SourceType | null;
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
  sourceType?: SourceType;
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

- [ ] **Step 4: Add Zod schemas to apps/web/lib/validation.ts**

```typescript
const sourceTypeEnum = z.enum([
  'vital_record', 'census', 'military', 'church', 'newspaper',
  'immigration', 'land', 'probate', 'cemetery', 'photograph',
  'personal_knowledge', 'correspondence', 'book', 'online', 'other',
]);

export const createSourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().optional(),
  publisher: z.string().optional(),
  publicationDate: z.string().optional(),
  repositoryName: z.string().optional(),
  repositoryUrl: z.string().optional(),
  sourceType: sourceTypeEnum.optional(),
  notes: z.string().optional(),
});

export const updateSourceSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  publicationDate: z.string().optional(),
  repositoryName: z.string().optional(),
  repositoryUrl: z.string().optional(),
  sourceType: sourceTypeEnum.optional(),
  notes: z.string().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const createCitationSchema = z.object({
  sourceId: z.string().min(1, 'Source is required'),
  citationDetail: z.string().optional(),
  citationText: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low', 'disputed']).optional(),
  personId: z.string().optional(),
  eventId: z.string().optional(),
  familyId: z.string().optional(),
  personNameId: z.string().optional(),
}).refine(
  (data) => data.personId || data.eventId || data.familyId || data.personNameId,
  { message: 'At least one entity link (personId, eventId, familyId, or personNameId) is required' }
);
```

- [ ] **Step 5: Add validation tests**

Add to `apps/web/__tests__/validation.test.ts`:

```typescript
import { createSourceSchema, createCitationSchema } from '../lib/validation';

describe('createSourceSchema', () => {
  it('accepts valid source', () => {
    expect(createSourceSchema.safeParse({ title: 'Census 1880' }).success).toBe(true);
  });
  it('rejects missing title', () => {
    expect(createSourceSchema.safeParse({}).success).toBe(false);
  });
  it('accepts source with all fields', () => {
    expect(createSourceSchema.safeParse({
      title: 'Census', author: 'US Gov', sourceType: 'census',
    }).success).toBe(true);
  });
});

describe('createCitationSchema', () => {
  it('accepts citation with personId', () => {
    expect(createCitationSchema.safeParse({ sourceId: 's1', personId: 'p1' }).success).toBe(true);
  });
  it('rejects missing sourceId', () => {
    expect(createCitationSchema.safeParse({ personId: 'p1' }).success).toBe(false);
  });
  it('rejects missing entity link', () => {
    expect(createCitationSchema.safeParse({ sourceId: 's1' }).success).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run __tests__/validation.test.ts
cd D:/projects/ancstra && git add packages/db/src/schema.ts packages/shared/src/types.ts apps/web/lib/validation.ts apps/web/__tests__/validation.test.ts
git commit -m "feat(sources): schema + types + Zod schemas for sources and citations"
```

---

## Task 1: Source CRUD API + Tests

**Files:**
- Create: `apps/web/app/api/sources/route.ts`
- Create: `apps/web/app/api/sources/[id]/route.ts`
- Create: `apps/web/__tests__/api/sources.test.ts`

- [ ] **Step 1: Create POST/GET /api/sources**

`apps/web/app/api/sources/route.ts`:
- **POST**: Auth, validate with `createSourceSchema`, insert source, return 201
- **GET**: Auth, optional `?q=` LIKE search on title, paginated, include citation count per source via subquery or join. Return `{ items, total, page, pageSize }`

Citation count: use a LEFT JOIN or subquery: `SELECT sources.*, COUNT(source_citations.id) as citationCount FROM sources LEFT JOIN source_citations ON ...`

- [ ] **Step 2: Create GET/PUT/DELETE /api/sources/[id]**

`apps/web/app/api/sources/[id]/route.ts`:
- **GET**: Auth, find source by id, include citation count, 404 if not found
- **PUT**: Auth, validate with `updateSourceSchema`, update fields, return updated source
- **DELETE**: Auth, hard delete (CASCADE deletes citations), return `{ success: true }`

- [ ] **Step 3: Write integration tests**

`apps/web/__tests__/api/sources.test.ts` — in-memory SQLite with `sources` and `source_citations` table DDL.

Tests:
- POST creates source with title and type
- GET lists sources with citation count
- GET with ?q= filters by title
- PUT updates source title
- DELETE removes source (and would cascade citations)

- [ ] **Step 4: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
cd D:/projects/ancstra && git add apps/web/app/api/sources/ apps/web/__tests__/api/sources.test.ts
git commit -m "feat(api): source CRUD — create, list, get, update, delete with citation count"
```

---

## Task 2: Citation CRUD API + Tests

**Files:**
- Create: `apps/web/app/api/citations/route.ts`
- Create: `apps/web/app/api/citations/[id]/route.ts`
- Create: `apps/web/__tests__/api/citations.test.ts`

- [ ] **Step 1: Create POST/GET /api/citations**

`apps/web/app/api/citations/route.ts`:
- **POST**: Auth, validate with `createCitationSchema`, verify sourceId exists, insert citation with default confidence 'medium', return Citation with source joined
- **GET**: Auth, require at least one of `?personId=`, `?eventId=`, `?familyId=` — return 400 if none provided. Query citations matching the entity, JOIN sources to include source data. Return array of Citations.

- [ ] **Step 2: Create DELETE /api/citations/[id]**

`apps/web/app/api/citations/[id]/route.ts`:
- **DELETE**: Auth, find citation, hard delete, return `{ success: true }`

- [ ] **Step 3: Write integration tests**

`apps/web/__tests__/api/citations.test.ts` — needs sources + source_citations + persons + events + families DDL.

Tests:
- POST creates citation linking source to person
- POST creates citation linking source to event
- GET ?personId= returns citations with source data
- GET ?eventId= returns citations for event
- GET without entity filter returns 400
- DELETE removes citation
- POST rejects missing entity link
- POST rejects invalid sourceId (source not found)

- [ ] **Step 4: Run tests + commit**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
cd D:/projects/ancstra && git add apps/web/app/api/citations/ apps/web/__tests__/api/citations.test.ts
git commit -m "feat(api): citation CRUD — polymorphic create, entity-filtered list, delete"
```

---

## Task 3: Sources Page + Source Form

**Files:**
- Create: `apps/web/app/(auth)/sources/page.tsx`
- Create: `apps/web/components/source-form.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 1: Create source-form.tsx**

Client component. Props: `{ source?: Source; onSave?: () => void; onCancel?: () => void }`.
- Title (required), Author, Publisher, Publication Date, Repository Name, Repository URL
- Source Type: `<select>` with 15 options
- Notes: `<Textarea>`
- Create mode: POST to `/api/sources`, Edit mode: PUT to `/api/sources/[id]`
- Save/Cancel buttons

- [ ] **Step 2: Create sources/page.tsx**

Client component at `app/(auth)/sources/page.tsx`:
- Search input (debounced 300ms) → `GET /api/sources?q=<term>`
- shadcn Table: Title, Type badge, Repository, Citations count
- Pagination (Previous/Next)
- "Add Source" button → toggles inline `SourceForm` at top
- Click source → toggles inline edit `SourceForm`
- Delete button per row

Pattern matches the existing `/persons` page.

- [ ] **Step 3: Add Sources to sidebar**

Modify `apps/web/components/app-sidebar.tsx`:
- Add `Bookmark` import from lucide-react
- Add `{ title: 'Sources', href: '/sources', icon: Bookmark }` between Research and Import in navItems

- [ ] **Step 4: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/source-form.tsx "apps/web/app/(auth)/sources/page.tsx" apps/web/components/app-sidebar.tsx
git commit -m "feat(ui): sources page with search + CRUD + sidebar nav item"
```

---

## Task 4: Citation Form + Citation List Components

**Files:**
- Create: `apps/web/components/citation-form.tsx`
- Create: `apps/web/components/citation-list.tsx`

- [ ] **Step 1: Create citation-form.tsx**

Client component. Props: `{ personId?, eventId?, familyId?, onSave?: () => void; onCancel?: () => void }`.
- Source selector: text input with debounced search → `GET /api/sources?q=<term>&pageSize=5`. Results dropdown showing source titles. Click to select. Or "Create new source" button that expands inline `SourceForm`.
- Citation detail: `<Input>` (page number, entry number)
- Citation text: `<Textarea>` (formatted citation)
- Confidence: `<select>` (high/medium/low/disputed, default medium)
- Hidden fields: personId/eventId/familyId from props
- On save: POST to `/api/citations` → call `onSave()`

- [ ] **Step 2: Create citation-list.tsx**

Client component. Props: `{ personId?, eventId?, familyId?, onUpdate?: () => void }`.
- Fetches citations on mount: `GET /api/citations?personId=X` (or eventId/familyId)
- Each citation: source title (bold), citation detail (muted), confidence badge (high=green, medium=blue, low=yellow, disputed=red)
- Delete [×] button per citation → `DELETE /api/citations/[id]` → refetch
- "Add Citation" button → toggles inline `CitationForm`
- Empty state: "No citations"

- [ ] **Step 3: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/citation-form.tsx apps/web/components/citation-list.tsx
git commit -m "feat(ui): CitationForm + CitationList for inline citation management"
```

---

## Task 5: Integrate Citations into Person Detail

**Files:**
- Modify: `apps/web/components/person-detail.tsx`

- [ ] **Step 1: Add Sources card to person-detail.tsx**

Read the current file. Add a new card section after the Events card:

```tsx
import { CitationList } from '@/components/citation-list';

// In the JSX, after the Events Card:
<Card>
  <CardHeader>
    <CardTitle className="text-base">Sources</CardTitle>
  </CardHeader>
  <CardContent>
    <CitationList personId={person.id} onUpdate={() => router.refresh()} />
  </CardContent>
</Card>
```

This shows all citations attached directly to this person. Event-level citations are visible when expanding events (the `CitationList` can also be used with `eventId` inside `EventList` in a future enhancement).

- [ ] **Step 2: Type check + commit**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
cd D:/projects/ancstra && git add apps/web/components/person-detail.tsx
git commit -m "feat(ui): integrate citations into person detail page"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Type check**

```bash
cd D:/projects/ancstra/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
cd D:/projects/ancstra/apps/web && npx vitest run
```

Expected: All tests pass (82 existing + ~6 validation + ~5 sources + ~8 citations = ~101).

- [ ] **Step 3: Manual smoke test**

```bash
cd D:/projects/ancstra/apps/web && pnpm dev
```

1. Navigate to `/sources` → empty state
2. Click "Add Source" → fill title "1880 US Census", type "census" → save
3. Source appears in table with 0 citations
4. Navigate to person detail page
5. Sources section shows "No citations"
6. Click "Add Citation" → search "1880" → select the source → add detail "Page 5, Line 12" → confidence "high" → save
7. Citation appears with source title, detail, green "High" badge
8. Back to `/sources` → census source now shows 1 citation
9. Delete citation → gone. Delete source → gone.

- [ ] **Step 4: Commit any remaining changes**

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | Schema + types + validation schemas + tests | — |
| 1 | Source CRUD API + integration tests | 0 |
| 2 | Citation CRUD API + integration tests | 0 |
| 3 | Sources page + source form + sidebar | 1 |
| 4 | Citation form + citation list components | 1, 2 |
| 5 | Integrate citations into person detail | 4 |
| 6 | Final verification | All |

**Critical path:** 0 → 1 → 3, 0 → 2 → 4 → 5

**Parallelizable:** Tasks 1 and 2 after Task 0. Tasks 3 and 4 after their respective deps.
