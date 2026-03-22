# GEDCOM Import/Export

> **Spec for:** GEDCOM 5.5.1 file import (two-step wizard: upload → preview → commit) and export (full + shareable privacy modes).
>
> **Sources:** Skipped during import/export. Deferred to source management feature.

---

## Scope

1. Parse GEDCOM 5.5.1 files using `parse-gedcom` npm package
2. Encoding detection via CHAR header tag (UTF-8, ANSI/Windows-1252, ASCII, UNICODE/UTF-16)
3. Map GEDCOM records to existing DB schema (persons, personNames, families, children, events)
4. Two-step import wizard: upload + parse preview → user confirms → transactional DB insert
5. Living person detection: no DEAT record + born within 100 years → isLiving=true
6. Validation warnings: death before birth, missing names, circular parents
7. Export to GEDCOM 5.5.1 with two privacy modes (full, shareable)
8. All imported records get `validationStatus: 'confirmed'` (auto-trusted per CLAUDE.md)

### Out of Scope
- Source/citation records (SOUR tags skipped, counted in preview)
- Merge/dedup with existing data (imports add alongside)
- GEDCOM 7.0 format
- Vendor-specific custom tags (parsed but ignored)
- Place hierarchy normalization

---

## Parser Layer

### `apps/web/lib/gedcom/parse.ts`

**Encoding detection:**
- Read first ~100 bytes to find `1 CHAR <value>` tag
- ANSI / ASCII → decode as Windows-1252
- UNICODE → decode as UTF-16LE
- UTF-8 (or absent) → decode as UTF-8
- Use `TextDecoder` API for decoding

**Parsing:**
- Takes `File` or `ArrayBuffer`
- Detects encoding, decodes to string
- Runs `parse-gedcom` → returns AST (`{ level, tag, data, tree[] }[]`)
- Returns raw AST for mapper

### `apps/web/lib/gedcom/mapper.ts`

Walks the AST and extracts structured data:

**INDI records → persons + names + events:**
- `NAME` tag: parse `/Surname/` convention, extract `GIVN`, `SURN`, prefix, suffix
- `SEX` tag: M/F → M/F, else U
- `BIRT`, `DEAT`, `MARR`, `BURI`, `RESI`, `OCCU`, `IMMI`, `EMIG`, `MILI`, `EDUC`, `CENS`, `BAPM`, `CHR` → events
- Date parsing: `15 MAR 1845` → dateOriginal + dateSort (via parseDateToSort). `ABT` → dateModifier: 'about'. `BET X AND Y` → dateModifier: 'between' + dateEndSort. `BEF/AFT` → before/after.
- Place: `PLAC` sub-tag → placeText (stored as-is)
- Living detection: no `DEAT` sub-record + birth within 100 years of today → isLiving: true

**FAM records → families + children:**
- `HUSB` → partner1Id (maps XREF to our UUID)
- `WIFE` → partner2Id
- `CHIL` → children links
- `MARR` → marriage event on the family

**XREF ID mapping:**
- Build `Map<string, string>` from GEDCOM XREF (`@I1@`, `@F1@`) → generated UUID
- Used for all cross-references (family→person, event→person)

**Validation warnings:**
- Death date before birth date
- Missing name (INDI without NAME tag)
- Circular parent-child (person is own ancestor)
- SOUR records counted but skipped: "X sources skipped"

**Returns:**
```typescript
interface GedcomImportData {
  persons: { id: string; sex: 'M'|'F'|'U'; isLiving: boolean; notes: string | null; xref: string }[];
  names: { id: string; personId: string; givenName: string; surname: string; nameType: string; isPrimary: boolean }[];
  families: { id: string; partner1Id: string | null; partner2Id: string | null; xref: string }[];
  childLinks: { familyId: string; personId: string }[];
  events: { id: string; eventType: string; dateOriginal: string | null; dateSort: number | null; dateModifier: string | null; dateEndSort: number | null; placeText: string | null; personId: string | null; familyId: string | null }[];
  warnings: { type: string; message: string; xref?: string }[];
  stats: { persons: number; families: number; events: number; skippedSources: number };
}
```

---

## Import Pipeline

### Server Action: `apps/web/app/actions/import-gedcom.ts`

**Phase 1 — Preview** (`previewGedcom(formData: FormData)`):
- Extract file from FormData
- Parse + map (no DB writes)
- Return stats + warnings + existing person count from DB

**Phase 2 — Commit** (`commitGedcomImport(data: GedcomImportData)`):
- Wrap in `db.transaction()` for atomicity
- Insertion order (respects FKs):
  1. Insert persons (id, sex, isLiving, notes, createdBy, validationStatus='confirmed')
  2. Insert person_names (isPrimary=true, nameType='birth')
  3. Insert families (partner1Id, partner2Id from XREF map)
  4. Insert children links
  5. Insert events (with dateSort computed)
- All records: `createdBy = session.user.id`, `validationStatus = 'confirmed'`
- Return: `{ imported: { persons, families, events }, warnings }`

---

## Import UI

### Route: `app/(auth)/import/page.tsx`

Single page with client component managing two-step flow.

**Step 1 — Upload:**
- Drag-and-drop zone + file input (accepts `.ged`)
- On file select: calls Phase 1 server action
- Loading spinner during parsing

**Step 2 — Preview & Confirm:**
- Stats: X persons, Y families, Z events, N sources skipped
- Warnings list (collapsible if >5)
- Note if existing data: "You already have X persons (import adds alongside, not merge)"
- Cancel button → reset to step 1
- Confirm button → calls Phase 2 → redirect to `/tree`

### Component: `apps/web/components/gedcom-import.tsx`

Client component (`'use client'`). Manages upload state, preview data, loading states, error handling.

---

## Export

### Serializer: `apps/web/lib/gedcom/serialize.ts`

Converts DB data → GEDCOM 5.5.1 string:
- Maps UUIDs → sequential XREFs (`@I1@`, `@I2@`, `@F1@`)
- HEAD record: SOUR Ancstra, GEDC 5.5.1 LINEAGE-LINKED, CHAR UTF-8
- INDI records: NAME (with `/Surname/` convention), GIVN, SURN, SEX, events as sub-records
- FAM records: HUSB/WIFE refs, CHIL refs, MARR event
- TRLR record
- UTF-8 BOM prepended for Windows compatibility

### Privacy modes:
- **Full:** All persons and events included
- **Shareable:** Filter out persons where `isLiving = true` and their personal events. Family links to living persons use placeholder `INDI` with just "Living" as name.

### Server Action: `apps/web/app/actions/export-gedcom.ts`

- Fetch all tree data from DB
- Apply privacy filter based on mode parameter
- Serialize to GEDCOM string
- Return as downloadable `.ged` file

### Export UI: `app/(auth)/export/page.tsx`

- Radio buttons: Full backup / Shareable (hides living persons)
- Stats: X persons to export (Y living hidden in shareable mode)
- "Download .ged" button → triggers server action → browser download

---

## File Structure

```
apps/web/
  lib/gedcom/
    parse.ts              — Encoding detection + parse-gedcom wrapper
    mapper.ts             — AST → GedcomImportData (persons/families/events/warnings)
    serialize.ts          — DB data → GEDCOM 5.5.1 string

  app/actions/
    import-gedcom.ts      — Server action: preview + commit phases
    export-gedcom.ts      — Server action: fetch + serialize + download

  app/(auth)/
    import/page.tsx       — Import page (two-step wizard)
    export/page.tsx       — Export page (mode select + download)

  components/
    gedcom-import.tsx     — Client component: upload + preview + confirm flow

  __tests__/
    gedcom/mapper.test.ts     — Name parsing, date conversion, event mapping, living detection, warnings
    gedcom/serialize.test.ts  — DB data → GEDCOM string validation
```

### New Dependency
- `parse-gedcom` — GEDCOM 5.5.1 AST parser

### No Schema Changes
Uses existing tables: persons, personNames, families, children, events.

---

## Tests

### `__tests__/gedcom/mapper.test.ts`
- Parses GEDCOM NAME `/Smith/` → surname "Smith"
- Parses GEDCOM NAME `John /Smith/ Jr` → givenName "John", surname "Smith", suffix "Jr"
- Maps GEDCOM date `15 MAR 1845` → dateOriginal + dateSort 18450315
- Maps `ABT 1850` → dateModifier 'about', dateSort 18500101
- Maps `BET 1880 AND 1885` → dateModifier 'between', dateSort 18800101, dateEndSort 18850101
- Maps `BIRT` tag → eventType 'birth'
- Detects living person (no DEAT, born 1980)
- Warns on death before birth
- Warns on missing name
- Counts skipped SOUR records

### `__tests__/gedcom/serialize.test.ts`
- Serializes person with name using `/Surname/` convention
- Serializes family with HUSB/WIFE/CHIL references
- Includes HEAD and TRLR records
- Shareable mode omits living persons
- Output is valid GEDCOM structure (correct levels/tags)
