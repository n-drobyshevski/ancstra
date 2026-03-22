# GEDCOM Parsing & Interchange

> Phase: 1 | Status: Not Started
> Depth: implementation-ready
> Dependencies: [ADR-003 (Gramps as reference)](../architecture/decisions/003-gramps-reference-only.md)
> Data model: [data-model.md](../architecture/data-model.md)

## Overview

GEDCOM (GEnealogical Data COMmunication) is the 1996-era text format that remains the only universal genealogy data interchange standard. It is notoriously difficult to parse correctly due to vendor-specific extensions, encoding variations, and malformed files. This spec details a robust import/export system that handles all major genealogy software variants.

## Requirements

- [ ] Parse GEDCOM files from major vendors (Ancestry, RootsMagic, Legacy, FamilySearch, MyHeritage, Gramps, FamilyTreeMaker)
- [ ] Detect and convert character encodings (UTF-8, ANSEL, ASCII, UTF-16LE)
- [ ] Normalize vendor-specific extensions (Ancestry `_APID`, RootsMagic `_WEBTAG`, etc.)
- [ ] Import persons, names, families, children, events, places, sources, media references
- [ ] Validate imported data and warn on issues (missing fields, invalid dates, circular references)
- [ ] Import within a single database transaction (all-or-nothing, no partial imports)
- [ ] Export GEDCOM with optional filtering (exclude living persons, include/exclude media/notes)
- [ ] Round-trip fidelity: import → export → re-import should preserve data integrity
- [ ] Support progress callbacks for UI feedback during large imports
- [ ] Comprehensive error/warning reporting

## Design

### Parser Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    GEDCOM Import Pipeline                   │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Read &   │→ │ Topola   │→ │ Vendor   │→ │ Validate  │  │
│  │ Detect   │  │ Parser   │  │ Dialect  │  │ & Warn    │  │
│  │ Encoding │  │ (core)   │  │ Fixes    │  │           │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────┬─────┘  │
│                                                   │        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────┴─────┐  │
│  │ FTS      │← │ Insert   │← │ Map to   │← │ Resolve   │  │
│  │ Index    │  │ (txn)    │  │ Schema   │  │ Places    │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Read file and detect encoding (UTF-8, ANSEL, ASCII, UTF-16LE)
2. Parse with Topola library (handles GEDCOM 5.5.1 and 7.0 syntax)
3. Detect dialect (Ancestry, RootsMagic, etc.) and apply vendor-specific fixes
4. Validate data and collect warnings
5. Resolve place names and deduplicate
6. Map GEDCOM tags to schema columns
7. Insert all data in single transaction
8. Rebuild FTS indexes
9. Return stats and warnings

### Type Definitions

```typescript
// packages/gedcom/parser/types.ts

export interface GedcomImportResult {
  success: boolean;
  stats: {
    personsImported: number;
    familiesImported: number;
    eventsImported: number;
    sourcesImported: number;
    mediaImported: number;
    placesImported: number;
  };
  warnings: GedcomWarning[];
  errors: GedcomError[];
  duration: number;            // ms
}

export interface GedcomWarning {
  line: number;
  tag: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface GedcomError {
  line: number;
  tag: string;
  message: string;
  fatal: boolean;
}

export interface GedcomExportOptions {
  version: '5.5.1' | '7.0';
  filterLiving: boolean;        // Strip living persons
  includeMedia: boolean;        // Include media references
  includeNotes: boolean;
  charset: 'UTF-8' | 'ANSEL';
}

export type GedcomDialect =
  | 'ancestry' | 'rootsmagic' | 'legacy' | 'ftm'
  | 'myheritage' | 'gramps' | 'familysearch' | 'generic';
```

### Vendor Dialect Handling

Each genealogy software produces slightly different GEDCOM output. Detect and fix:

| Vendor | Issue | Fix |
|--------|-------|-----|
| **Ancestry** | Uses custom `_APID` tags for record links | Parse and store in `match_candidates` table |
| **RootsMagic** | Custom `_WEBTAG`, `_TODO` tags | Preserve as notes, ignore in parsing |
| **Legacy** | Non-standard date formats (e.g., "JAN 1 1900") | Normalize through date parser |
| **FamilyTreeMaker** | ANSEL encoding default | Detect and convert to UTF-8 |
| **MyHeritage** | Duplicate INDI records with same ID | Deduplicate on import (keep latest) |
| **Gramps** | Extended event types with `_TYPE` subtags | Map to our event_type enum |
| **FamilySearch** | Uses standard GEDCOM but with FS-specific extensions | Accept standard tags, ignore FS extensions |

```typescript
// packages/gedcom/parser/dialect-detector.ts

export function detectDialect(header: string): GedcomDialect {
  // Check SOUR tag in GEDCOM header
  if (header.includes('ANCESTRY')) return 'ancestry';
  if (header.includes('RootsMagic')) return 'rootsmagic';
  if (header.includes('LEGACY')) return 'legacy';
  if (header.includes('FTM') || header.includes('Family Tree Maker')) return 'ftm';
  if (header.includes('MyHeritage')) return 'myheritage';
  if (header.includes('Gramps')) return 'gramps';
  if (header.includes('FAMILYSEARCH') || header.includes('FamilySearch')) return 'familysearch';
  return 'generic';
}

export function applyDialectFixes(
  records: ParsedGedcomRecord[],
  dialect: GedcomDialect
): ParsedGedcomRecord[] {
  switch (dialect) {
    case 'ancestry':
      return records.map(r => ({
        ...r,
        // Preserve Ancestry-specific _APID tags as external references
        customTags: r.customTags?.filter(t => t.startsWith('_APID')),
      }));
    case 'myheritage':
      // Deduplicate records with same INDI/FAM IDs
      return deduplicateByGedcomId(records);
    default:
      return records;
  }
}
```

### GEDCOM-to-Schema Field Mapping

| GEDCOM Tag | Schema Table | Schema Column(s) | Notes |
|------------|-------------|-------------------|-------|
| `INDI` | `persons` | id, sex | Unique person record |
| `NAME` | `person_names` | given_name, surname, prefix, suffix | Can have multiple per person |
| `SEX` | `persons` | sex | M/F/U (unknown) |
| `BIRT` | `events` | event_type='birth', date_*, place_id | Life event |
| `DEAT` | `events` | event_type='death', date_*, place_id | Life event |
| `BURI` | `events` | event_type='burial', date_*, place_id | Life event |
| `BAPM` / `CHR` | `events` | event_type='baptism', date_*, place_id | Baptism/christening |
| `MARR` | `events` | event_type='marriage', family_id, date_*, place_id | Marriage event |
| `DIV` | `events` | event_type='divorce', family_id, date_*, place_id | Divorce event |
| `FAM` | `families` | id, partner1_id, partner2_id | Family unit |
| `HUSB` | `families` | partner1_id | Husband/partner 1 reference |
| `WIFE` | `families` | partner2_id | Wife/partner 2 reference |
| `CHIL` | `children` | family_id, person_id | Child reference |
| `SOUR` | `sources` / `source_citations` | title, citation_detail, citation_text | Source and citation |
| `PLAC` | `places` | name, parent_place_id | Parsed into hierarchy |
| `OBJE` | `media` | file_path, mime_type, title | Media/document reference |
| `NOTE` | various | notes fields | Comments and notes |
| `RESI` | `events` | event_type='residence', date_*, place_id | Residence event |
| `OCCU` | `events` | event_type='occupation', date_*, place_id | Occupation event |
| `IMMI` | `events` | event_type='immigration', date_*, place_id | Immigration event |
| `EMIG` | `events` | event_type='emigration', date_*, place_id | Emigration event |
| `NATU` | `events` | event_type='naturalization', date_*, place_id | Naturalization event |
| `CENS` | `events` | event_type='census', date_*, place_id | Census event |
| `MILI` | `events` | event_type='military', date_*, place_id | Military service event |

### Character Encoding Detection

```typescript
// packages/gedcom/parser/encoding.ts

export function detectAndNormalizeEncoding(buffer: Buffer): string {
  // Check for BOM (Byte Order Mark)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString('utf-8');  // UTF-8 with BOM
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.slice(2).toString('utf-16le');  // UTF-16LE with BOM
  }

  // Check GEDCOM CHAR tag in header
  const headerStr = buffer.slice(0, 1024).toString('ascii');
  const charMatch = headerStr.match(/1\s+CHAR\s+(\S+)/);
  const charset = charMatch?.[1]?.toUpperCase();

  switch (charset) {
    case 'ANSEL':
      return convertAnselToUtf8(buffer);
    case 'UTF-8':
    case 'UNICODE':
      return buffer.toString('utf-8');
    case 'ASCII':
      return buffer.toString('ascii');
    default:
      // Default to UTF-8, which handles ASCII as a subset
      return buffer.toString('utf-8');
  }
}

function convertAnselToUtf8(buffer: Buffer): string {
  // ANSEL is a character encoding used primarily in GEDCOM 5.5
  // Map ANSEL high bytes to Unicode equivalents
  // Key mappings: diacritical combining marks (0xE0-0xFE)
  // Full implementation uses a lookup table of ~100 character mappings
  // For production: use 'ansel-to-unicode' npm package
  throw new Error('ANSEL conversion: use ansel-to-unicode package');
}
```

### Import Transaction Safety

```typescript
// packages/gedcom/parser/importer.ts

export async function importGedcom(
  filePath: string,
  db: DrizzleDatabase,
  options?: { onProgress?: (pct: number) => void }
): Promise<GedcomImportResult> {
  const startTime = Date.now();
  const warnings: GedcomWarning[] = [];
  const errors: GedcomError[] = [];

  // 1. Read and detect encoding
  const buffer = await fs.readFile(filePath);
  const content = detectAndNormalizeEncoding(buffer);

  // 2. Parse with Topola
  const parsed = convertGedcom(content); // Topola's parser
  const dialect = detectDialect(content.slice(0, 500));

  // 3. Apply dialect fixes
  const fixed = applyDialectFixes(parsed.indis, dialect);

  // 4. Map to schema and insert in a single transaction
  const stats = {
    personsImported: 0,
    familiesImported: 0,
    eventsImported: 0,
    sourcesImported: 0,
    mediaImported: 0,
    placesImported: 0
  };

  await db.transaction(async (tx) => {
    // Phase 1: Insert all persons (without family references)
    const gedcomIdToDbId = new Map<string, string>();

    for (let i = 0; i < fixed.length; i++) {
      const indi = fixed[i];
      try {
        const personId = await insertPerson(tx, indi, gedcomIdToDbId);
        gedcomIdToDbId.set(indi.id, personId);
        stats.personsImported++;
      } catch (e) {
        errors.push({
          line: indi.line || 0,
          tag: 'INDI',
          message: `Failed to import ${indi.id}: ${e}`,
          fatal: false
        });
      }

      options?.onProgress?.((i / fixed.length) * 50); // 0-50%
    }

    // Phase 2: Insert families and children (using mapped IDs)
    for (let i = 0; i < parsed.fams.length; i++) {
      const fam = parsed.fams[i];
      try {
        await insertFamily(tx, fam, gedcomIdToDbId);
        stats.familiesImported++;
      } catch (e) {
        errors.push({
          line: fam.line || 0,
          tag: 'FAM',
          message: `Failed to import family ${fam.id}: ${e}`,
          fatal: false
        });
      }

      options?.onProgress?.(50 + (i / parsed.fams.length) * 30); // 50-80%
    }

    // Phase 3: Insert sources, media, update FTS indexes
    // ... (sources, media, FTS rebuild)

    options?.onProgress?.(100);
  });

  return {
    success: errors.filter(e => e.fatal).length === 0,
    stats,
    warnings,
    errors,
    duration: Date.now() - startTime,
  };
}
```

### Export with Living Person Filtering

```typescript
// packages/gedcom/exporter/export.ts

export async function exportGedcom(
  db: DrizzleDatabase,
  options: GedcomExportOptions
): Promise<string> {
  const lines: string[] = [];

  // Header
  lines.push('0 HEAD');
  lines.push(`1 SOUR ANCSTRA`);
  lines.push(`2 VERS 1.0`);
  lines.push(`1 CHAR ${options.charset}`);
  lines.push(`1 GEDC`);
  lines.push(`2 VERS ${options.version}`);

  // Query all persons
  let persons = await db.select().from(personsTable).all();

  // Filter living persons if requested
  if (options.filterLiving) {
    persons = persons.filter(p => !isPresumablyLiving(p));
  }

  // Export each person as INDI record
  for (const person of persons) {
    lines.push(`0 @I${person.id}@ INDI`);

    // Names
    const names = await db.select().from(personNamesTable)
      .where(eq(personNamesTable.person_id, person.id)).all();
    for (const name of names) {
      const fullName = formatGedcomName(name);
      lines.push(`1 NAME ${fullName}`);
      if (name.is_primary) {
        lines.push(`2 GIVN ${name.given_name}`);
        lines.push(`2 SURN ${name.surname}`);
      }
    }

    // Sex
    if (person.sex) {
      lines.push(`1 SEX ${person.sex}`);
    }

    // Events (birth, death, etc.)
    const events = await db.select().from(eventsTable)
      .where(eq(eventsTable.person_id, person.id)).all();
    for (const event of events) {
      const tag = eventTypeToGedcomTag(event.event_type);
      lines.push(`1 ${tag}`);
      if (event.date_original) {
        lines.push(`2 DATE ${event.date_original}`);
      }
      if (event.place_id) {
        const place = await db.select().from(placesTable)
          .where(eq(placesTable.id, event.place_id)).get();
        if (place) {
          lines.push(`2 PLAC ${place.name}`);
        }
      }
    }

    // Notes
    if (person.notes && options.includeNotes) {
      lines.push(`1 NOTE ${person.notes}`);
    }
  }

  // Export families
  const families = await db.select().from(familiesTable).all();
  for (const family of families) {
    lines.push(`0 @F${family.id}@ FAM`);
    if (family.partner1_id) {
      lines.push(`1 HUSB @I${family.partner1_id}@`);
    }
    if (family.partner2_id) {
      lines.push(`1 WIFE @I${family.partner2_id}@`);
    }

    // Children
    const children = await db.select().from(childrenTable)
      .where(eq(childrenTable.family_id, family.id)).all();
    for (const child of children) {
      lines.push(`1 CHIL @I${child.person_id}@`);
    }
  }

  lines.push('0 TRLR'); // Trailer
  return lines.join('\n');
}
```

### Round-Trip Testing

Test suite validates import/export quality:

**Canonical test files:**
- GEDCOM samples from Ancestry, RootsMagic, Gramps, FamilySearch
- Official GEDCOM 5.5.1 torture test file
- Edge cases: empty files, files with only headers, 50K+ individuals, circular references

**Round-trip test:**
1. Import GEDCOM → export → re-import → compare
2. Key metrics:
   - Person count matches
   - Name accuracy (given/surname preserved)
   - Date preservation (with modifiers)
   - Relationship integrity (families/children)

**Encoding tests:**
- Files in UTF-8, ANSEL, ASCII, UTF-16LE

## Edge Cases & Error Handling

- **Malformed GEDCOM:** Parser errors are non-fatal; continue with warnings
- **Missing parent/spouse references:** Create orphan records; warn about broken links
- **Circular references:** Detect cycles in family trees; log as warning
- **Duplicate INDI/FAM IDs:** Keep first occurrence; log others as duplicates
- **Invalid dates:** Parse as "unknown" (date_sort = 0); warn about invalid format
- **Encoding errors:** Fall back to UTF-8 with replacement characters
- **File too large (>500MB):** Stream parsing instead of loading entire file into memory

## Open Questions

1. **Should we auto-deduplicate persons with same name/dates?** Currently: no (user responsibility). Consider Phase 2.
2. **How many ANSEL mappings do we need?** Currently: defer to `ansel-to-unicode` package. Acceptable?
3. **Should we validate family relationships (e.g., child too old)?** Currently: no validation. Warn instead?
4. **How to handle media file paths in GEDCOM?** Currently: store relative paths; user must ensure files exist. Better approach?

## Implementation Notes

**Phase 1 deliverables:**
- Topola-based parser wrapper
- Dialect detection and fixes
- Character encoding detection/conversion
- GEDCOM-to-schema mapping
- Transaction-safe import
- Basic export (living filter, format options)
- Comprehensive test suite

**Libraries to use:**
- `topola-viewer` (GEDCOM parsing)
- `ansel-to-unicode` (ANSEL encoding conversion)
- `fastest-levenshtein` (for deduplication logic)
- Drizzle ORM (database transactions)

**Test coverage:**
- Vendor dialect handling (Ancestry, RootsMagic, etc.)
- Encoding detection (UTF-8, ANSEL, ASCII, UTF-16LE)
- Round-trip fidelity (import → export → re-import)
- Edge cases (circular refs, missing parents, duplicates)
- Performance (import 50K persons in <10 seconds)
