# Phase 1 Week 2 — Person CRUD + Relationships + Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the person lifecycle (create/read/update/delete), add family/relationship management with context-aware creation, and build full event CRUD — delivering a usable genealogy data entry experience.

**Architecture:** Full-stack vertical slices. Each task delivers working backend + frontend. Shared query helper (`lib/queries.ts`) provides `assemblePersonDetail()` used by both server components and API routes. Context-aware person creation uses URL params (`?relation=spouse&of=<id>`) to auto-link after save.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, better-sqlite3, Zod 4, shadcn/ui, Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-phase1-week2-person-crud-relationships-design.md`

---

## File Structure

All paths relative to project root (`D:/projects/ancstra/`).

```
packages/shared/src/
  types.ts                              — MODIFIED: add Family, Event, PersonDetail, input types, RelationContext

apps/web/
  lib/
    validation.ts                       — MODIFIED: add update/family/event Zod schemas
    queries.ts                          — NEW: assemblePersonDetail, family helper functions

  app/api/
    persons/route.ts                    — MODIFIED: add ?q= search filter to GET
    persons/[id]/route.ts               — MODIFIED: add PUT, DELETE, enhance GET with relationships
    persons/[id]/events/route.ts        — NEW: GET events for person
    families/route.ts                   — NEW: POST create family
    families/[id]/route.ts              — NEW: GET, PUT family
    families/[id]/children/route.ts     — NEW: POST add child to family
    families/[id]/children/[personId]/route.ts — NEW: DELETE unlink child
    events/route.ts                     — NEW: POST create event
    events/[id]/route.ts               — NEW: PUT, DELETE event

  app/actions/
    create-related-person.ts            — NEW: server action for transactional person creation + linking

  components/
    person-detail.tsx                   — REWRITE: full detail with relationships, events, inline edit, delete
    person-form.tsx                     — MODIFIED: edit mode, relation context via server action
    person-link-popover.tsx             — NEW: search + link existing person
    event-form.tsx                      — NEW: add/edit event inline
    event-list.tsx                      — NEW: chronological event display

  app/(auth)/
    person/[id]/page.tsx                — MODIFIED: use assemblePersonDetail
    person/[id]/edit/page.tsx           — NEW: full edit page

  __tests__/
    validation.test.ts                  — MODIFIED: new schema tests
    api/persons.test.ts                 — MODIFIED: update, delete, search tests
    api/families.test.ts                — NEW: family CRUD integration tests
    api/events.test.ts                  — NEW: event CRUD integration tests
```

---

## Task 0: Shared Types + Validation Schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/lib/validation.ts`
- Modify: `apps/web/__tests__/validation.test.ts`

- [ ] **Step 1: Add new types to packages/shared/src/types.ts**

Add after the existing `PaginatedResponse` interface:

```typescript
// Family record with optional assembled partner/children data
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

// Event record
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

export interface CreateFamilyInput {
  partner1Id?: string;
  partner2Id?: string;
  relationshipType?: Family['relationshipType'];
}

export interface CreateEventInput {
  eventType: string;
  dateOriginal?: string;
  dateEndOriginal?: string;
  placeText?: string;
  description?: string;
  dateModifier?: Event['dateModifier'];
  personId?: string;
  familyId?: string;
}

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

// Enhanced person detail with relationships and events
export interface PersonDetail extends Person {
  spouses: PersonListItem[];
  parents: PersonListItem[];
  children: PersonListItem[];
  events: Event[];
}
```

- [ ] **Step 2: Add Zod schemas to apps/web/lib/validation.ts**

Add after the existing `signUpSchema`:

```typescript
export const updatePersonSchema = z.object({
  givenName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  sex: z.enum(['M', 'F', 'U']).optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathPlace: z.string().optional(),
  isLiving: z.boolean().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const createFamilySchema = z.object({
  partner1Id: z.string().optional(),
  partner2Id: z.string().optional(),
  relationshipType: z.enum(['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']).optional(),
}).refine(
  (data) => data.partner1Id || data.partner2Id,
  { message: 'At least one partner must be provided' }
);

export const createEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  dateOriginal: z.string().optional(),
  dateEndOriginal: z.string().optional(),
  placeText: z.string().optional(),
  description: z.string().optional(),
  dateModifier: z.enum(['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']).optional(),
  personId: z.string().optional(),
  familyId: z.string().optional(),
}).refine(
  (data) => data.personId || data.familyId,
  { message: 'Must have personId or familyId' }
);

export const updateEventSchema = z.object({
  eventType: z.string().min(1).optional(),
  dateOriginal: z.string().optional(),
  dateEndOriginal: z.string().optional(),
  placeText: z.string().optional(),
  description: z.string().optional(),
  dateModifier: z.enum(['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const updateFamilySchema = z.object({
  relationshipType: z.enum(['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']).optional(),
  validationStatus: z.enum(['confirmed', 'proposed', 'disputed']).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const addChildSchema = z.object({
  personId: z.string().min(1),
  childOrder: z.number().optional(),
  relationshipToParent1: z.enum(['biological', 'adopted', 'foster', 'step', 'unknown']).optional(),
  relationshipToParent2: z.enum(['biological', 'adopted', 'foster', 'step', 'unknown']).optional(),
});
```

- [ ] **Step 3: Add validation tests**

Add to `apps/web/__tests__/validation.test.ts`:

```typescript
import { updatePersonSchema, createFamilySchema, createEventSchema } from '../lib/validation';

describe('updatePersonSchema', () => {
  it('accepts partial update', () => {
    expect(updatePersonSchema.safeParse({ givenName: 'Jane' }).success).toBe(true);
  });
  it('rejects empty object', () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
  });
});

describe('createFamilySchema', () => {
  it('accepts two partners', () => {
    expect(createFamilySchema.safeParse({ partner1Id: 'a', partner2Id: 'b' }).success).toBe(true);
  });
  it('accepts single partner', () => {
    expect(createFamilySchema.safeParse({ partner1Id: 'a' }).success).toBe(true);
  });
  it('rejects no partners', () => {
    expect(createFamilySchema.safeParse({}).success).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('accepts valid event with personId', () => {
    expect(createEventSchema.safeParse({ eventType: 'residence', personId: 'a' }).success).toBe(true);
  });
  it('rejects missing eventType', () => {
    expect(createEventSchema.safeParse({ personId: 'a' }).success).toBe(false);
  });
  it('rejects missing personId and familyId', () => {
    expect(createEventSchema.safeParse({ eventType: 'birth' }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run __tests__/validation.test.ts
```

Expected: All tests pass (existing 7 + new 8 = 15).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts apps/web/lib/validation.ts apps/web/__tests__/validation.test.ts
git commit -m "feat: shared types + Zod schemas for families, events, person update"
```

---

## Task 1: Shared Query Helper (assemblePersonDetail)

**Files:**
- Create: `apps/web/lib/queries.ts`

This is the single source of truth for assembling a person with all relationships and events. Used by both the server component page and the API route.

- [ ] **Step 1: Create apps/web/lib/queries.ts**

```typescript
import { createDb, persons, personNames, events, families, children } from '@ancstra/db';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import type { PersonDetail, PersonListItem, Event as EventType } from '@ancstra/shared';

type Database = ReturnType<typeof createDb>;

function getPersonListItem(db: Database, personId: string): PersonListItem | null {
  const [person] = db
    .select({ id: persons.id, sex: persons.sex, isLiving: persons.isLiving })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .all();
  if (!person) return null;

  const [name] = db
    .select({ givenName: personNames.givenName, surname: personNames.surname })
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)))
    .all();

  // Get birth/death dates
  const evts = db
    .select({ eventType: events.eventType, dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), sql`${events.eventType} IN ('birth', 'death')`))
    .all();

  return {
    id: person.id,
    givenName: name?.givenName ?? '',
    surname: name?.surname ?? '',
    sex: person.sex,
    isLiving: person.isLiving,
    birthDate: evts.find((e) => e.eventType === 'birth')?.dateOriginal ?? null,
    deathDate: evts.find((e) => e.eventType === 'death')?.dateOriginal ?? null,
  };
}

export function assemblePersonDetail(db: Database, personId: string): PersonDetail | null {
  // 1. Person + primary name
  const [person] = db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .all();
  if (!person) return null;

  const [primaryName] = db
    .select()
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)))
    .all();

  // 2. Spouses: families where person is partner → other partner
  const familiesAsPartner = db
    .select()
    .from(families)
    .where(
      and(
        or(eq(families.partner1Id, personId), eq(families.partner2Id, personId)),
        isNull(families.deletedAt)
      )
    )
    .all();

  const spouses: PersonListItem[] = [];
  for (const fam of familiesAsPartner) {
    const otherId = fam.partner1Id === personId ? fam.partner2Id : fam.partner1Id;
    if (!otherId) continue;
    const spouse = getPersonListItem(db, otherId);
    if (spouse) spouses.push(spouse);
  }

  // 3. Parents: families where person is child → extract partners
  const childRecords = db
    .select()
    .from(children)
    .where(eq(children.personId, personId))
    .all();

  const parents: PersonListItem[] = [];
  for (const child of childRecords) {
    const [fam] = db
      .select()
      .from(families)
      .where(and(eq(families.id, child.familyId), isNull(families.deletedAt)))
      .all();
    if (!fam) continue;
    if (fam.partner1Id && !parents.some((p) => p.id === fam.partner1Id)) {
      const p = getPersonListItem(db, fam.partner1Id);
      if (p) parents.push(p);
    }
    if (fam.partner2Id && !parents.some((p) => p.id === fam.partner2Id)) {
      const p = getPersonListItem(db, fam.partner2Id);
      if (p) parents.push(p);
    }
  }

  // 4. Children: families where person is partner → children from those families
  const childrenList: PersonListItem[] = [];
  for (const fam of familiesAsPartner) {
    const famChildren = db
      .select()
      .from(children)
      .where(eq(children.familyId, fam.id))
      .all();
    for (const fc of famChildren) {
      const c = getPersonListItem(db, fc.personId);
      if (c && !childrenList.some((existing) => existing.id === c.id)) {
        childrenList.push(c);
      }
    }
  }

  // 5. All events, sorted by dateSort
  const personEvents = db
    .select()
    .from(events)
    .where(eq(events.personId, personId))
    .orderBy(sql`${events.dateSort} ASC NULLS LAST`)
    .all();

  const eventList: EventType[] = personEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    dateOriginal: e.dateOriginal,
    dateSort: e.dateSort,
    dateModifier: e.dateModifier,
    dateEndSort: e.dateEndSort,
    placeText: e.placeText,
    description: e.description,
    personId: e.personId,
    familyId: e.familyId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  const birthEvent = personEvents.find((e) => e.eventType === 'birth');
  const deathEvent = personEvents.find((e) => e.eventType === 'death');

  return {
    id: person.id,
    sex: person.sex,
    isLiving: person.isLiving,
    privacyLevel: person.privacyLevel,
    notes: person.notes,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    givenName: primaryName?.givenName ?? '',
    surname: primaryName?.surname ?? '',
    prefix: primaryName?.prefix,
    suffix: primaryName?.suffix,
    birthDate: birthEvent?.dateOriginal,
    birthPlace: birthEvent?.placeText,
    deathDate: deathEvent?.dateOriginal,
    deathPlace: deathEvent?.placeText,
    spouses,
    parents,
    children: childrenList,
    events: eventList,
  };
}

// Find families where a person is linked as a child. Returns familyIds.
export function findFamiliesAsChild(db: Database, personId: string): string[] {
  return db
    .select({ familyId: children.familyId })
    .from(children)
    .where(eq(children.personId, personId))
    .all()
    .map((r) => r.familyId);
}

// Find non-deleted families where a person is a partner. Returns familyIds.
export function findFamiliesAsPartner(db: Database, personId: string): string[] {
  return db
    .select({ id: families.id })
    .from(families)
    .where(
      and(
        or(eq(families.partner1Id, personId), eq(families.partner2Id, personId)),
        isNull(families.deletedAt)
      )
    )
    .all()
    .map((r) => r.id);
}

// Find existing family where childId is already linked, or create a new family
// with parentId as the given partner role. Returns the familyId.
export function findOrCreateFamilyForChild(
  db: Database,
  childId: string,
  parentId: string,
  parentRole: 'partner1' | 'partner2'
): string {
  // Check if child already belongs to a family
  const existingFamilyIds = findFamiliesAsChild(db, childId);
  if (existingFamilyIds.length > 0) {
    // Add parent to existing family
    const famId = existingFamilyIds[0];
    const col = parentRole === 'partner1' ? families.partner1Id : families.partner2Id;
    db.update(families)
      .set({ [parentRole === 'partner1' ? 'partner1Id' : 'partner2Id']: parentId, updatedAt: new Date().toISOString() })
      .where(eq(families.id, famId))
      .run();
    return famId;
  }
  // Create new family with parent + add child
  const now = new Date().toISOString();
  const famId = crypto.randomUUID();
  db.insert(families).values({
    id: famId,
    ...(parentRole === 'partner1' ? { partner1Id: parentId } : { partner2Id: parentId }),
    createdAt: now,
    updatedAt: now,
  }).run();
  db.insert(children).values({
    id: crypto.randomUUID(),
    familyId: famId,
    personId: childId,
    createdAt: now,
  }).run();
  return famId;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries.ts
git commit -m "feat: assemblePersonDetail shared query helper + family finders"
```

---

## Task 2: Person Update + Delete API Routes

**Files:**
- Modify: `apps/web/app/api/persons/route.ts` (wrap existing POST in transaction)
- Modify: `apps/web/app/api/persons/[id]/route.ts`
- Modify: `apps/web/__tests__/api/persons.test.ts`

- [ ] **Step 0: Wrap existing POST /api/persons in db.transaction()**

The existing `POST /api/persons` in `apps/web/app/api/persons/route.ts` does multi-table inserts (person + name + events) without a transaction. Wrap the insert block (lines 31-83) in `db.transaction((tx) => { ... })` replacing `db.insert` calls with `tx.insert`. This aligns with the spec's convention that all multi-table writes must be atomic.

- [ ] **Step 1: Add PUT and DELETE to apps/web/app/api/persons/[id]/route.ts**

Replace the existing GET handler with the enhanced version and add PUT + DELETE. The full file:

- Import `updatePersonSchema` from `@/lib/validation`
- Import `assemblePersonDetail` from `@/lib/queries`
- **GET**: Use `assemblePersonDetail()` to return `PersonDetail` (replaces inline assembly)
- **PUT**: Validate with `updatePersonSchema`, wrap in transaction, update person + name + upsert birth/death events, return assembled person
- **DELETE**: Set `deletedAt`, return `{ success: true }`

Key implementation details for PUT:
```typescript
// Inside the transaction:
// 1. Update persons table (only set fields that were provided)
const personUpdates: Record<string, unknown> = { updatedAt: now };
if (data.sex !== undefined) personUpdates.sex = data.sex;
if (data.isLiving !== undefined) personUpdates.isLiving = data.isLiving;
if (data.notes !== undefined) personUpdates.notes = data.notes;
db.update(persons)
  .set(personUpdates)
  .where(eq(persons.id, id))
  .run();

// 2. Update primary name if provided
if (data.givenName || data.surname) {
  db.update(personNames)
    .set({
      ...(data.givenName && { givenName: data.givenName }),
      ...(data.surname && { surname: data.surname }),
    })
    .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
    .run();
}

// 3. Upsert birth event
if (data.birthDate !== undefined || data.birthPlace !== undefined) {
  const [existing] = db.select().from(events)
    .where(and(eq(events.personId, id), eq(events.eventType, 'birth'))).all();
  if (existing) {
    db.update(events).set({
      dateOriginal: data.birthDate ?? existing.dateOriginal,
      dateSort: data.birthDate ? parseDateToSort(data.birthDate) : existing.dateSort,
      placeText: data.birthPlace ?? existing.placeText,
      updatedAt: now,
    }).where(eq(events.id, existing.id)).run();
  } else {
    db.insert(events).values({
      id: crypto.randomUUID(), personId: id, eventType: 'birth',
      dateOriginal: data.birthDate ?? null,
      dateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
      placeText: data.birthPlace ?? null, createdAt: now, updatedAt: now,
    }).run();
  }
}
// 4. Same pattern for death event
```

- [ ] **Step 2: Add integration tests for update + delete**

Add to `apps/web/__tests__/api/persons.test.ts`:

```typescript
it('updates person name and sex', () => {
  const id = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: true });
  db.update(persons).set({ updatedAt: new Date().toISOString() }).where(eq(persons.id, id)).run();
  db.update(personNames)
    .set({ givenName: 'Jonathan' })
    .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
    .run();
  const [name] = db.select().from(personNames)
    .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true))).all();
  expect(name.givenName).toBe('Jonathan');
});

it('upserts birth event on update', () => {
  const id = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: true });
  // No birth event exists yet, insert one
  db.insert(events).values({
    id: crypto.randomUUID(), personId: id, eventType: 'birth',
    dateOriginal: '1850', dateSort: 18500101,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }).run();
  // Update it
  db.update(events).set({ dateOriginal: '15 Mar 1850', dateSort: 18500315 })
    .where(and(eq(events.personId, id), eq(events.eventType, 'birth'))).run();
  const [birth] = db.select().from(events)
    .where(and(eq(events.personId, id), eq(events.eventType, 'birth'))).all();
  expect(birth.dateOriginal).toBe('15 Mar 1850');
  expect(birth.dateSort).toBe(18500315);
});

it('soft-deletes a person', () => {
  const id = createPerson({ givenName: 'ToDelete', surname: 'Person', sex: 'U', isLiving: false });
  db.update(persons).set({ deletedAt: new Date().toISOString() }).where(eq(persons.id, id)).run();
  const result = db.select().from(persons)
    .where(and(eq(persons.id, id), isNull(persons.deletedAt))).all();
  expect(result).toHaveLength(0);
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/persons/[id]/route.ts apps/web/__tests__/api/persons.test.ts
git commit -m "feat(api): person PUT update + DELETE soft-delete + enhanced GET with relationships"
```

---

## Task 3: Search Filter on Person List

**Files:**
- Modify: `apps/web/app/api/persons/route.ts`
- Modify: `apps/web/__tests__/api/persons.test.ts`

- [ ] **Step 1: Add ?q= search filter to GET /api/persons**

In the existing GET handler in `apps/web/app/api/persons/route.ts`, after parsing `page` and `pageSize`, add:

```typescript
const q = searchParams.get('q');
```

Then modify the query to add a WHERE clause when `q` is present:

```typescript
const whereClause = q
  ? and(
      isNull(persons.deletedAt),
      sql`(${personNames.givenName} LIKE ${'%' + q + '%'} OR ${personNames.surname} LIKE ${'%' + q + '%'})`
    )
  : isNull(persons.deletedAt);
```

Use `whereClause` in both the rows query and the count query. The count query also needs the join when filtering.

- [ ] **Step 2: Add search test**

```typescript
it('filters persons by name with ?q= parameter', () => {
  createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
  createPerson({ givenName: 'Bob', surname: 'Jones', sex: 'M', isLiving: true });
  createPerson({ givenName: 'Charlie', surname: 'Smith', sex: 'M', isLiving: true });

  // Search for "Smith" by surname — should match Alice and Charlie
  const smithRows = db.select({ id: persons.id, givenName: personNames.givenName })
    .from(persons)
    .innerJoin(personNames, sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`)
    .where(and(isNull(persons.deletedAt), sql`(${personNames.surname} LIKE '%Smith%' OR ${personNames.givenName} LIKE '%Smith%')`))
    .all();
  expect(smithRows).toHaveLength(2);
});

it('filters persons by given name with ?q= parameter', () => {
  createPerson({ givenName: 'Alice', surname: 'Smith', sex: 'F', isLiving: true });
  createPerson({ givenName: 'Bob', surname: 'Jones', sex: 'M', isLiving: true });

  const aliceRows = db.select({ id: persons.id })
    .from(persons)
    .innerJoin(personNames, sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`)
    .where(and(isNull(persons.deletedAt), sql`(${personNames.surname} LIKE '%Alice%' OR ${personNames.givenName} LIKE '%Alice%')`))
    .all();
  expect(aliceRows).toHaveLength(1);
});
```

- [ ] **Step 3: Run tests, commit**

```bash
cd apps/web && npx vitest run
git add apps/web/app/api/persons/route.ts apps/web/__tests__/api/persons.test.ts
git commit -m "feat(api): add ?q= search filter to GET /api/persons"
```

---

## Task 4: Family CRUD API Routes

**Files:**
- Create: `apps/web/app/api/families/route.ts`
- Create: `apps/web/app/api/families/[id]/route.ts`
- Create: `apps/web/app/api/families/[id]/children/route.ts`
- Create: `apps/web/app/api/families/[id]/children/[personId]/route.ts`
- Create: `apps/web/__tests__/api/families.test.ts`

- [ ] **Step 1: Create POST /api/families**

`apps/web/app/api/families/route.ts`:
- Auth check
- Validate with `createFamilySchema`
- Check provided person(s) exist and aren't soft-deleted
- Check no duplicate non-deleted family for this pair (check both directions)
- Insert family record with `validationStatus: 'confirmed'`
- Return family with partner details assembled using `getPersonListItem`

- [ ] **Step 2: Create GET/PUT /api/families/[id]**

`apps/web/app/api/families/[id]/route.ts`:
- **GET**: Return family + partner1 + partner2 (as PersonListItem) + children array
- **PUT**: Update `relationshipType` or `validationStatus`, return updated family

- [ ] **Step 3: Create POST /api/families/[id]/children**

`apps/web/app/api/families/[id]/children/route.ts`:
- Auth check
- Validate with `addChildSchema`
- Check family exists, person exists, no duplicate link
- Insert children record
- Return `{ success: true }`

- [ ] **Step 4: Create DELETE /api/families/[id]/children/[personId]**

`apps/web/app/api/families/[id]/children/[personId]/route.ts`:
- Auth check
- Delete the children record (hard delete — it's a link)
- Return `{ success: true }`

- [ ] **Step 5: Write family integration tests**

`apps/web/__tests__/api/families.test.ts` — same in-memory SQLite pattern. Add `families` and `children` table DDL to the shared setup. Tests:

```typescript
describe('Family CRUD (integration)', () => {
  it('creates family linking two persons', () => { ... });
  it('rejects duplicate family for same pair', () => { ... });
  it('allows single-partner family', () => { ... });
  it('retrieves family with partners and children', () => { ... });
  it('adds child to family', () => { ... });
  it('rejects duplicate child link', () => { ... });
  it('removes child from family', () => { ... });
});
```

- [ ] **Step 6: Run tests, commit**

```bash
cd apps/web && npx vitest run
git add apps/web/app/api/families/ apps/web/__tests__/api/families.test.ts
git commit -m "feat(api): family CRUD — create, read, update + child link/unlink"
```

---

## Task 5: Event CRUD API Routes

**Files:**
- Create: `apps/web/app/api/events/route.ts`
- Create: `apps/web/app/api/events/[id]/route.ts`
- Create: `apps/web/app/api/persons/[id]/events/route.ts`
- Create: `apps/web/__tests__/api/events.test.ts`

- [ ] **Step 1: Create POST /api/events**

`apps/web/app/api/events/route.ts`:
- Auth check
- Validate with `createEventSchema`
- Compute `dateSort` via `parseDateToSort(dateOriginal)` if provided
- Compute `dateEndSort` via `parseDateToSort(dateEndOriginal)` if provided
- If both dateOriginal and dateEndOriginal present, auto-set `dateModifier: 'between'`
- Insert event, return Event object with 201

- [ ] **Step 2: Create PUT/DELETE /api/events/[id]**

`apps/web/app/api/events/[id]/route.ts`:
- **PUT**: Validate with `updateEventSchema`, recompute dateSort/dateEndSort if dates changed, return updated Event
- **DELETE**: Hard delete, return `{ success: true }`

- [ ] **Step 3: Create GET /api/persons/[id]/events**

`apps/web/app/api/persons/[id]/events/route.ts`:
- Auth check
- Return all events for person, ordered by `dateSort ASC NULLS LAST`

- [ ] **Step 4: Write event integration tests**

`apps/web/__tests__/api/events.test.ts`:

```typescript
describe('Event CRUD (integration)', () => {
  it('creates event with dateSort computed', () => { ... });
  it('creates event with between modifier and dateEndSort', () => { ... });
  it('lists events sorted chronologically', () => { ... });
  it('updates event and recomputes dateSort', () => { ... });
  it('deletes event', () => { ... });
});
```

- [ ] **Step 5: Run tests, commit**

```bash
cd apps/web && npx vitest run
git add apps/web/app/api/events/ apps/web/app/api/persons/[id]/events/ apps/web/__tests__/api/events.test.ts
git commit -m "feat(api): event CRUD — create, read, update, delete with dateSort computation"
```

---

## Task 6: Enhanced Person Detail Page

**Files:**
- Rewrite: `apps/web/components/person-detail.tsx`
- Modify: `apps/web/app/(auth)/person/[id]/page.tsx`

- [ ] **Step 1: Update person/[id]/page.tsx to use assemblePersonDetail**

Replace the inline query with:

```typescript
import { assemblePersonDetail } from '@/lib/queries';
import { createDb } from '@ancstra/db';

// In the server component:
const db = createDb();
const person = assemblePersonDetail(db, id);
if (!person) notFound();
```

Pass `person` (now `PersonDetail`) to the component.

- [ ] **Step 2: Rewrite person-detail.tsx**

Make it a client component (`'use client'`) to support inline editing and interactions. Receives `person: PersonDetail` as prop.

Sections:
1. **Header**: Name + badges + Edit link (`/person/${person.id}/edit`) + Delete button (with `AlertDialog` confirmation)
2. **Vital Info Card**: Birth/death display. "Quick Edit" button toggles inputs inline. Save calls `PUT /api/persons/[id]`, refreshes page with `router.refresh()`.
3. **Family Card**: Three sub-sections:
   - Spouses: each as a link to `/person/[id]`, with [×] unlink button
   - Parents: same pattern
   - Children: same pattern
   - Action buttons: "+ Add Spouse", "+ Add Father", "+ Add Mother", "+ Add Child" → link to `/person/new?relation=X&of=<id>`
   - "Link existing person" button → opens `PersonLinkPopover`
4. **Events Card**: Renders `EventList` component with the person's events
5. **Footer**: timestamps, back link

Install `alert-dialog` component:
```bash
cd apps/web && pnpm dlx shadcn@latest add alert-dialog
```

- [ ] **Step 3: Verify the page renders**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/person-detail.tsx apps/web/app/\(auth\)/person/\[id\]/page.tsx apps/web/components/ui/alert-dialog.tsx
git commit -m "feat(ui): enhanced person detail — relationships, events, inline edit, delete"
```

---

## Task 7: Event Form + Event List Components

**Files:**
- Create: `apps/web/components/event-form.tsx`
- Create: `apps/web/components/event-list.tsx`

- [ ] **Step 1: Create event-form.tsx**

Client component. Props: `personId: string`, optional `event` for edit mode, `onSave` callback.

Fields:
- Event type: `<select>` with options (birth, death, marriage, divorce, residence, occupation, immigration, emigration, military, education, census, burial, baptism, other)
- Date: `<Input>` placeholder "15 Mar 1845"
- Date modifier: `<select>` (exact, about, estimated, before, after, between) — collapsed by default
- Place: `<Input>`
- Description: `<Textarea>`
- Save/Cancel buttons

On submit: `POST /api/events` (create) or `PUT /api/events/[id]` (edit).

- [ ] **Step 2: Create event-list.tsx**

Client component. Props: `events: Event[]`, `personId: string`.

- Renders events chronologically
- Each event: type badge, date, place, description
- Birth/death events: display only (no edit/delete controls)
- Other events: [✎] edit button (expands inline EventForm), [×] delete (with confirmation)
- Empty state: "No events recorded"
- "+ Add Event" button at bottom → expands inline EventForm

- [ ] **Step 3: Verify types compile, commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/event-form.tsx apps/web/components/event-list.tsx
git commit -m "feat(ui): EventForm + EventList components for event CRUD"
```

---

## Task 8: Person Edit Page + Enhanced Person Form

**Files:**
- Modify: `apps/web/components/person-form.tsx`
- Create: `apps/web/app/actions/create-related-person.ts`
- Create: `apps/web/app/(auth)/person/[id]/edit/page.tsx`

- [ ] **Step 1: Enhance person-form.tsx for edit mode**

Add optional `person` prop for pre-filling fields in edit mode:
- When `person` is set: pre-fill all fields, button says "Save Changes", submit does `PUT /api/persons/[person.id]`
- When `person` is unset: existing create behavior

- [ ] **Step 2: Create server action for context-aware creation**

Create `apps/web/app/actions/create-related-person.ts` — a server action that handles person creation + relationship linking in a single `db.transaction()` for atomicity. This avoids the risk of orphaned persons from multi-request client-side flows.

```typescript
'use server';
import { createDb, persons, personNames, events, families, children } from '@ancstra/db';
import { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { findOrCreateFamilyForChild, findFamiliesAsPartner } from '@/lib/queries';
import { redirect } from 'next/navigation';

export async function createRelatedPerson(formData: FormData) {
  const relation = formData.get('relation') as string | null;
  const ofPersonId = formData.get('ofPersonId') as string | null;
  // ... parse remaining form fields, validate with createPersonSchema ...

  const db = createDb();
  const now = new Date().toISOString();
  const personId = crypto.randomUUID();

  // All-or-nothing: create person + link in single transaction
  db.transaction((tx) => {
    // Insert person, name, birth/death events (same as POST /api/persons)
    // ... (reuse same insert logic) ...

    // Link relationship if context provided
    if (relation && ofPersonId) {
      if (relation === 'spouse') {
        tx.insert(families).values({ id: crypto.randomUUID(), partner1Id: ofPersonId, partner2Id: personId, createdAt: now, updatedAt: now }).run();
      } else if (relation === 'father') {
        findOrCreateFamilyForChild(tx, ofPersonId, personId, 'partner1');
      } else if (relation === 'mother') {
        findOrCreateFamilyForChild(tx, ofPersonId, personId, 'partner2');
      } else if (relation === 'child') {
        const partnerFams = findFamiliesAsPartner(tx, ofPersonId);
        if (partnerFams.length > 0) {
          tx.insert(children).values({ id: crypto.randomUUID(), familyId: partnerFams[0], personId, createdAt: now }).run();
        } else {
          const famId = crypto.randomUUID();
          tx.insert(families).values({ id: famId, partner1Id: ofPersonId, createdAt: now, updatedAt: now }).run();
          tx.insert(children).values({ id: crypto.randomUUID(), familyId: famId, personId, createdAt: now }).run();
        }
      }
    }
  });

  redirect(ofPersonId ? `/person/${ofPersonId}` : `/person/${personId}`);
}
```

- [ ] **Step 3: Add relation context UI to person-form.tsx**

Read URL search params `relation` and `of` via `useSearchParams()`:
- Show context banner: "Creating [relation] of [person name]"
- Pre-fill sex based on relation type (father→M, mother→F, spouse→opposite of target)
- Fetch target person name via `GET /api/persons/[of]` on mount
- When relation context is present, submit via the `createRelatedPerson` server action instead of `POST /api/persons`
- Hidden form fields pass `relation` and `ofPersonId` to the server action

- [ ] **Step 4: Create person/[id]/edit/page.tsx**

Server component:
```typescript
import { notFound } from 'next/navigation';
import { createDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { PersonForm } from '@/components/person-form';
import { EventList } from '@/components/event-list';

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createDb();
  const person = assemblePersonDetail(db, id);
  if (!person) notFound();

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">
      <h1 className="text-xl font-semibold">Edit {person.givenName} {person.surname}</h1>
      <PersonForm person={person} />
      <div>
        <h2 className="text-lg font-medium mb-4">Events</h2>
        <EventList events={person.events} personId={person.id} />
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Manage relationships on the <a href={`/person/${person.id}`} className="text-primary underline">detail page</a>.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify types compile, commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/person-form.tsx apps/web/app/actions/create-related-person.ts apps/web/app/\(auth\)/person/\[id\]/edit/
git commit -m "feat(ui): person edit page + context-aware creation with transactional linking"
```

---

## Task 9: Person Link Popover

**Files:**
- Create: `apps/web/components/person-link-popover.tsx`

Install popover component if not already present:
```bash
cd apps/web && pnpm dlx shadcn@latest add popover
```

- [ ] **Step 1: Create person-link-popover.tsx**

Client component. Props: `personId: string`, `onLinked?: () => void`.

- "Link existing person" button → opens Popover
- Inside popover: relation type dropdown (Spouse / Father / Mother / Child) + search input
- Debounced search (300ms) → `GET /api/persons?q=<term>&pageSize=5`
- Results list: name + sex + birth date, [+] button to link
- On link click:
  - Spouse: `POST /api/families { partner1Id: personId, partner2Id: selectedId }`
  - Father: Find/create family for child (personId), set selectedId as partner1
  - Mother: Same, partner2
  - Child: Find family where personId is partner, add selectedId as child. If no family, create one.
- After link: close popover, call `onLinked()` (which triggers `router.refresh()`)

- [ ] **Step 2: Integrate into person-detail.tsx**

Add the `PersonLinkPopover` to the Family Card section alongside the "+ Add" buttons.

- [ ] **Step 3: Verify types compile, commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/person-link-popover.tsx apps/web/components/person-detail.tsx apps/web/components/ui/popover.tsx
git commit -m "feat(ui): PersonLinkPopover — search and link existing persons as relatives"
```

---

## Task 10: Final Verification + Commit

- [ ] **Step 1: Type check everything**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run all tests**

```bash
cd apps/web && npx vitest run
```

Expected: All tests pass (validation + persons + families + events).

- [ ] **Step 3: Manual smoke test**

```bash
cd apps/web && pnpm dev
```

Test flow:
1. Log in → Dashboard
2. Create person "John Smith" (M, birth 15 Mar 1845, Springfield IL)
3. On detail page: see name, badges, birth event
4. Click "Edit" → full edit page, change surname to "Smithson", save
5. Back on detail: name is "John Smithson"
6. Click "+ Add Spouse" → create form with banner "Creating spouse of John Smithson", sex pre-filled Female
7. Create "Mary Johnson" → redirects back to John's detail, Mary shown as spouse
8. Click "+ Add Child" → create "William Smithson" → shown as child
9. On John's detail: use "Link existing person" → search for existing person → link
10. Add a "Residence" event via "+ Add Event"
11. Delete John → confirm → redirected to dashboard

- [ ] **Step 4: Final commit if any loose changes**

```bash
git status
# If clean: done. If changes: commit with appropriate message.
```

---

## Summary

| Task | Description | Depends On |
|------|-------------|-----------|
| 0 | Shared types + Zod schemas + tests | — |
| 1 | assemblePersonDetail query helper | 0 |
| 2 | Person PUT/DELETE + enhanced GET | 0, 1 |
| 3 | Search filter (?q=) on person list | 0 |
| 4 | Family CRUD API routes + tests | 0 |
| 5 | Event CRUD API routes + tests | 0 |
| 6 | Enhanced person detail page | 1, 2, 4, 5 |
| 7 | EventForm + EventList components | 5 |
| 8 | Person edit page + context-aware form | 1, 2, 4, 7 |
| 9 | PersonLinkPopover | 3, 4 |
| 10 | Final verification | All |

**Critical path:** 0 → 1 → 2 → 6 → 8

**Parallelizable:** Tasks 3, 4, 5 can run in parallel after Task 0. Tasks 7 and 9 can run in parallel after their deps.
