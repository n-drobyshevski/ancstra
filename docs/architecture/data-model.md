# Data Model

This is the **single source of truth** for the Ancstra database schema. All database design decisions, constraints, indexes, and migration strategies are documented here.

## Design Principles

- **Event-based modeling:** Life events (birth, death, marriage, immigration, etc.) are separate records linked to persons, not columns on the person table. This follows the GEDCOM/Gramps model and is infinitely extensible.
- **Source everything:** Every fact should trace to a source citation. The schema enforces this with `source_citations` linking any entity to sources.
- **Place normalization:** Places are a separate entity with hierarchy (city → county → state → country), enabling deduplication and geocoding.
- **Structured names:** GEDCOM names have given name, surname, prefix, suffix, nickname — stored as parts, not a single string.
- **Genealogical dates:** Support ranges ("between 1880 and 1885"), approximations ("about 1872"), dual dating ("1731/32"), and non-Gregorian calendars.
- **Relationship validation:** AI/API discoveries create `proposed_relationships`. Only editors can validate them into `families`/`children`. This prevents automated noise from corrupting the tree.
- **Soft deletes:** All records support soft deletion (deleted_at timestamp) for GDPR compliance and sync recovery.

## Complete SQLite Schema

```sql
-- ============================================================
-- CORE PERSON AND FAMILY TABLES
-- ============================================================

CREATE TABLE persons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sex TEXT CHECK (sex IN ('M', 'F', 'U')) DEFAULT 'U',
  is_living INTEGER NOT NULL DEFAULT 1,
  privacy_level TEXT CHECK (privacy_level IN ('public', 'private', 'restricted')) DEFAULT 'private',
  notes TEXT,

  -- FamilySearch sync
  fs_person_id TEXT UNIQUE,       -- FamilySearch person ID (e.g., "KWJY-HMD")
  fs_last_sync TEXT,              -- ISO 8601 timestamp of last sync

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT                  -- Soft delete for sync
);

CREATE TABLE person_names (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  name_type TEXT CHECK (name_type IN ('birth', 'married', 'aka', 'immigrant', 'religious')) DEFAULT 'birth',
  prefix TEXT,                     -- "Dr.", "Rev."
  given_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  suffix TEXT,                     -- "Jr.", "III"
  nickname TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_citation_id TEXT REFERENCES source_citations(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE families (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  relationship_type TEXT CHECK (relationship_type IN ('married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown')) DEFAULT 'unknown',

  -- Validation: GEDCOM imports = 'confirmed', AI/API discoveries = 'proposed'
  validation_status TEXT CHECK (validation_status IN ('confirmed', 'proposed', 'disputed')) DEFAULT 'confirmed',
  proposed_relationship_id TEXT REFERENCES proposed_relationships(id),

  fs_family_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT
);

CREATE TABLE children (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  child_order INTEGER,
  relationship_to_parent1 TEXT CHECK (relationship_to_parent1 IN ('biological', 'adopted', 'foster', 'step', 'unknown')) DEFAULT 'biological',
  relationship_to_parent2 TEXT CHECK (relationship_to_parent2 IN ('biological', 'adopted', 'foster', 'step', 'unknown')) DEFAULT 'biological',

  -- Validation: GEDCOM imports = 'confirmed', AI/API discoveries = 'proposed'
  validation_status TEXT CHECK (validation_status IN ('confirmed', 'proposed', 'disputed')) DEFAULT 'confirmed',
  proposed_relationship_id TEXT REFERENCES proposed_relationships(id),

  UNIQUE(family_id, person_id)
);

-- ============================================================
-- EVENTS (extensible life event model)
-- ============================================================

CREATE TABLE events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type TEXT NOT NULL,       -- 'birth', 'death', 'marriage', 'burial', 'immigration',
                                  -- 'emigration', 'census', 'military', 'education',
                                  -- 'occupation', 'residence', 'baptism', 'confirmation',
                                  -- 'naturalization', 'probate', 'will', 'custom'

  -- Genealogical date (see 2.4 for format)
  date_original TEXT,             -- Original date string as entered/imported
  date_sort INTEGER,              -- YYYYMMDD integer for sorting (0 = unknown)
  date_modifier TEXT CHECK (date_modifier IN (
    'exact', 'about', 'estimated', 'before', 'after',
    'between', 'calculated', 'interpreted'
  )) DEFAULT 'exact',
  date_end_sort INTEGER,          -- For ranges: end date as YYYYMMDD

  place_id TEXT REFERENCES places(id),
  description TEXT,

  -- Links to person or family
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  -- Constraint: exactly one of person_id or family_id must be set

  source_citation_id TEXT REFERENCES source_citations(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (
    (person_id IS NOT NULL AND family_id IS NULL) OR
    (person_id IS NULL AND family_id IS NOT NULL)
  )
);

-- ============================================================
-- PLACES (normalized hierarchy)
-- ============================================================

CREATE TABLE places (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,              -- Full display name: "Springfield, Sangamon, Illinois, USA"
  short_name TEXT,                 -- "Springfield"
  parent_place_id TEXT REFERENCES places(id),
  place_type TEXT CHECK (place_type IN (
    'country', 'state', 'province', 'county', 'city',
    'town', 'village', 'township', 'parish', 'district', 'address', 'other'
  )),
  latitude REAL,
  longitude REAL,

  -- FamilySearch place authority
  fs_place_id TEXT UNIQUE,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================
-- SOURCES AND CITATIONS
-- ============================================================

CREATE TABLE sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  publication_date TEXT,
  repository_name TEXT,           -- "National Archives", "FamilySearch"
  repository_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'vital_record', 'census', 'military', 'church', 'newspaper',
    'immigration', 'land', 'probate', 'cemetery', 'photograph',
    'personal_knowledge', 'correspondence', 'book', 'online', 'other'
  )),
  notes TEXT,

  fs_source_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE source_citations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  citation_detail TEXT,           -- Page number, entry number, etc.
  citation_text TEXT,             -- Full formatted citation
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low', 'disputed')) DEFAULT 'medium',

  -- Polymorphic link: which entity does this citation support?
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  person_name_id TEXT REFERENCES person_names(id) ON DELETE CASCADE,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================
-- MEDIA AND DOCUMENTS
-- ============================================================

CREATE TABLE media (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER,              -- bytes
  title TEXT,
  description TEXT,
  date_original TEXT,             -- When the photo/document was created
  date_sort INTEGER,

  -- OCR results
  ocr_text TEXT,                  -- Extracted text from OCR
  ocr_status TEXT CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
  ocr_engine TEXT,                -- 'tesseract' or 'transkribus'

  -- Face detection results
  faces_detected INTEGER DEFAULT 0,
  face_detection_status TEXT CHECK (face_detection_status IN ('pending', 'completed', 'skipped')) DEFAULT 'pending',

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Separate link tables for media (replacing invalid union column pattern)
CREATE TABLE media_persons (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, person_id)
);

CREATE TABLE media_events (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, event_id)
);

CREATE TABLE media_sources (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, source_id)
);

-- Face detection data
CREATE TABLE face_regions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,  -- NULL = unidentified

  -- Bounding box (normalized 0-1 coordinates)
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,

  -- Face embedding for matching (128-dim vector stored as JSON array)
  embedding TEXT,
  confidence REAL,                -- Detection confidence 0-1

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================
-- AUDIT TRAIL
-- ============================================================

CREATE TABLE change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,      -- 'person', 'family', 'event', 'source', etc.
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  changes TEXT,                   -- JSON diff: {"field": {"old": ..., "new": ...}}
  user_id TEXT,                   -- Who made the change (for multi-user)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================
-- MATCHING AND SYNC
-- ============================================================

CREATE TABLE match_candidates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,    -- 'familysearch', 'nara', 'chronicling_america'
  external_id TEXT NOT NULL,
  external_data TEXT NOT NULL,    -- JSON blob of the external record
  match_score REAL NOT NULL,      -- 0-1 probability
  match_status TEXT CHECK (match_status IN ('pending', 'accepted', 'rejected', 'maybe')) DEFAULT 'pending',
  reviewed_at TEXT,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(person_id, source_system, external_id)
);

-- ============================================================
-- RELATIONSHIP VALIDATION & EVIDENCE
-- ============================================================

-- AI/API-discovered relationships land here before editor validation
CREATE TABLE proposed_relationships (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- What relationship is proposed
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent_child', 'partner', 'sibling')),
  person1_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  -- Where did this proposal come from?
  source_type TEXT NOT NULL CHECK (source_type IN (
    'familysearch', 'nara', 'ai_suggestion', 'record_match', 'ocr_extraction', 'user_proposal'
  )),
  source_detail TEXT,           -- e.g., FamilySearch record ID, match candidate ID
  confidence REAL,              -- 0-1 from matching engine or AI

  -- Validation state
  status TEXT NOT NULL CHECK (status IN ('pending', 'validated', 'rejected', 'needs_info')) DEFAULT 'pending',
  validated_by TEXT,            -- user_id of editor who validated
  validated_at TEXT,
  rejection_reason TEXT,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Editor-provided evidence for each validated relationship link
CREATE TABLE relationship_justifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Which relationship does this justify? (exactly one must be set)
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  child_link_id TEXT REFERENCES children(id) ON DELETE CASCADE,

  -- Justification content
  justification_text TEXT NOT NULL,

  -- Optional linked source citation (birth cert, census record, etc.)
  source_citation_id TEXT REFERENCES source_citations(id),

  -- Who provided this justification
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (
    (family_id IS NOT NULL AND child_link_id IS NULL) OR
    (family_id IS NULL AND child_link_id IS NOT NULL)
  )
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Person lookups
CREATE INDEX idx_persons_fs_id ON persons(fs_person_id) WHERE fs_person_id IS NOT NULL;
CREATE INDEX idx_persons_living ON persons(is_living);
CREATE INDEX idx_persons_deleted ON persons(deleted_at) WHERE deleted_at IS NOT NULL;

-- Name search
CREATE INDEX idx_person_names_person ON person_names(person_id);
CREATE INDEX idx_person_names_surname ON person_names(surname COLLATE NOCASE);
CREATE INDEX idx_person_names_given ON person_names(given_name COLLATE NOCASE);
CREATE INDEX idx_person_names_primary ON person_names(person_id) WHERE is_primary = 1;

-- Family lookups
CREATE INDEX idx_families_partner1 ON families(partner1_id);
CREATE INDEX idx_families_partner2 ON families(partner2_id);
CREATE INDEX idx_children_family ON children(family_id);
CREATE INDEX idx_children_person ON children(person_id);

-- Event lookups
CREATE INDEX idx_events_person ON events(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_events_family ON events(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_place ON events(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX idx_events_date_sort ON events(date_sort) WHERE date_sort > 0;

-- Place lookups
CREATE INDEX idx_places_parent ON places(parent_place_id);
CREATE INDEX idx_places_name ON places(name COLLATE NOCASE);
CREATE INDEX idx_places_fs_id ON places(fs_place_id) WHERE fs_place_id IS NOT NULL;

-- Source lookups
CREATE INDEX idx_sources_title ON sources(title COLLATE NOCASE);
CREATE INDEX idx_source_citations_source ON source_citations(source_id);
CREATE INDEX idx_source_citations_person ON source_citations(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_source_citations_event ON source_citations(event_id) WHERE event_id IS NOT NULL;

-- Media lookups
CREATE INDEX idx_media_ocr_status ON media(ocr_status) WHERE ocr_status != 'skipped';
CREATE INDEX idx_media_persons_person ON media_persons(person_id);
CREATE INDEX idx_face_regions_media ON face_regions(media_id);
CREATE INDEX idx_face_regions_person ON face_regions(person_id) WHERE person_id IS NOT NULL;

-- Match candidates
CREATE INDEX idx_match_candidates_person ON match_candidates(person_id);
CREATE INDEX idx_match_candidates_status ON match_candidates(match_status) WHERE match_status = 'pending';

-- Proposed relationships
CREATE INDEX idx_proposed_rels_status ON proposed_relationships(status) WHERE status = 'pending';
CREATE INDEX idx_proposed_rels_person1 ON proposed_relationships(person1_id);
CREATE INDEX idx_proposed_rels_person2 ON proposed_relationships(person2_id);

-- Relationship justifications
CREATE INDEX idx_justifications_family ON relationship_justifications(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_justifications_child ON relationship_justifications(child_link_id) WHERE child_link_id IS NOT NULL;

-- Validation status on families/children
CREATE INDEX idx_families_validation ON families(validation_status) WHERE validation_status != 'confirmed';
CREATE INDEX idx_children_validation ON children(validation_status) WHERE validation_status != 'confirmed';

-- Audit trail
CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id);
CREATE INDEX idx_change_log_date ON change_log(created_at);

-- Compound indexes for performance optimization (ADR-006)
CREATE INDEX idx_events_person_date ON events(person_id, date_sort);
CREATE INDEX idx_children_person_family ON children(person_id, family_id);

-- ============================================================
-- FULL-TEXT SEARCH (FTS5)
-- ============================================================

CREATE VIRTUAL TABLE fts_persons USING fts5(
  person_id UNINDEXED,
  given_name,
  surname,
  notes,
  content='',                     -- External content mode
  tokenize='unicode61 remove_diacritics 2'  -- Handle accented characters
);

CREATE VIRTUAL TABLE fts_places USING fts5(
  place_id UNINDEXED,
  name,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE fts_sources USING fts5(
  source_id UNINDEXED,
  title,
  author,
  citation_text,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE fts_media USING fts5(
  media_id UNINDEXED,
  title,
  description,
  ocr_text,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);
```

## Genealogical Date Handling

Genealogical dates are far more complex than standard ISO dates. The system supports:

| Date Type | Example | `date_original` | `date_sort` | `date_modifier` | `date_end_sort` |
|-----------|---------|-----------------|-------------|-----------------|-----------------|
| Exact | 15 Mar 1872 | "15 Mar 1872" | 18720315 | exact | NULL |
| About | about 1880 | "ABT 1880" | 18800101 | about | NULL |
| Before | before Jun 1900 | "BEF Jun 1900" | 19000601 | before | NULL |
| After | after 1850 | "AFT 1850" | 18500101 | after | NULL |
| Range | between 1880 and 1885 | "BET 1880 AND 1885" | 18800101 | between | 18850101 |
| Estimated | estimated 1845 | "EST 1845" | 18450101 | estimated | NULL |
| Dual dating | 1731/32 | "1731/32" | 17320101 | exact | NULL |

```typescript
// packages/shared/dates/genealogical-date.ts

export interface GenealogicalDate {
  original: string;          // As entered/imported
  sortValue: number;         // YYYYMMDD for sorting
  modifier: DateModifier;
  endSortValue?: number;     // For ranges
  calendar?: 'gregorian' | 'julian' | 'hebrew' | 'french_republican';
}

export type DateModifier =
  | 'exact' | 'about' | 'estimated' | 'before'
  | 'after' | 'between' | 'calculated' | 'interpreted';

export function parseGedcomDate(gedcomDate: string): GenealogicalDate {
  // Handle GEDCOM date formats: "15 MAR 1872", "ABT 1880",
  // "BET 1880 AND 1885", "BEF JUN 1900", etc.
  const modifierMap: Record<string, DateModifier> = {
    'ABT': 'about', 'EST': 'estimated', 'CAL': 'calculated',
    'BEF': 'before', 'AFT': 'after', 'BET': 'between', 'INT': 'interpreted',
  };

  let modifier: DateModifier = 'exact';
  let dateStr = gedcomDate.trim().toUpperCase();

  for (const [prefix, mod] of Object.entries(modifierMap)) {
    if (dateStr.startsWith(prefix)) {
      modifier = mod;
      dateStr = dateStr.slice(prefix.length).trim();
      break;
    }
  }

  // Handle "BET date1 AND date2"
  let endSortValue: number | undefined;
  if (modifier === 'between' && dateStr.includes('AND')) {
    const [start, end] = dateStr.split('AND').map(s => s.trim());
    endSortValue = dateStringToSortValue(end);
    dateStr = start;
  }

  return {
    original: gedcomDate,
    sortValue: dateStringToSortValue(dateStr),
    modifier,
    endSortValue,
  };
}

function dateStringToSortValue(dateStr: string): number {
  // Parse "DD MON YYYY", "MON YYYY", "YYYY" into YYYYMMDD integer
  const months: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
  };

  const parts = dateStr.trim().split(/\s+/);

  if (parts.length === 1) {
    // Year only
    return parseInt(parts[0]) * 10000 + 101;  // YYYY0101
  } else if (parts.length === 2) {
    // Month Year
    const month = months[parts[0]] || '01';
    return parseInt(parts[1]) * 10000 + parseInt(month) * 100 + 1;
  } else if (parts.length === 3) {
    // Day Month Year
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '01';
    return parseInt(parts[2]) * 10000 + parseInt(month) * 100 + parseInt(day);
  }

  return 0; // Unknown
}
```

## Living Person Filter

```typescript
// packages/shared/privacy/living-filter.ts

const LIVING_THRESHOLD_YEARS = 100;

export function isPresumablyLiving(person: {
  birthDateSort?: number;
  deathDateSort?: number;
  isLiving: boolean;
}): boolean {
  // Explicit flag takes precedence
  if (!person.isLiving) return false;

  // If death date exists, they're not living
  if (person.deathDateSort && person.deathDateSort > 0) return false;

  // If no birth date, assume living (conservative)
  if (!person.birthDateSort || person.birthDateSort === 0) return true;

  // If born more than 100 years ago with no death date, presume deceased
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birthDateSort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
}

export function filterForPrivacy<T extends { isLiving: boolean }>(
  persons: T[],
  viewerRole: 'owner' | 'admin' | 'editor' | 'viewer'
): T[] {
  if (viewerRole === 'owner' || viewerRole === 'admin') return persons;

  return persons.map(p => {
    if (isPresumablyLiving(p as any)) {
      return { ...p, given_name: 'Living', surname: '', notes: null } as T;
    }
    return p;
  });
}
```

## Recursive CTEs for Genealogical Queries

### Ancestor Query

```sql
WITH RECURSIVE ancestors AS (
  -- Base case: start person
  SELECT p.id, pn.given_name, pn.surname, 0 AS generation
  FROM persons p
  JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
  WHERE p.id = :person_id

  UNION ALL

  -- Recursive case: find parents via children → families → partners
  SELECT p.id, pn.given_name, pn.surname, a.generation + 1
  FROM ancestors a
  JOIN children c ON c.person_id = a.id
  JOIN families f ON f.id = c.family_id
  JOIN persons p ON p.id IN (f.partner1_id, f.partner2_id)
  JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
  WHERE p.id != a.id  -- Prevent self-reference
)
SELECT * FROM ancestors ORDER BY generation;
```

### Descendant Query

```sql
WITH RECURSIVE descendants AS (
  SELECT p.id, pn.given_name, pn.surname, 0 AS generation
  FROM persons p
  JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
  WHERE p.id = :person_id

  UNION ALL

  SELECT p.id, pn.given_name, pn.surname, d.generation + 1
  FROM descendants d
  JOIN families f ON d.id IN (f.partner1_id, f.partner2_id)
  JOIN children c ON c.family_id = f.id
  JOIN persons p ON p.id = c.person_id
  JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
)
SELECT * FROM descendants ORDER BY generation;
```

### Relationship Path Between Two People

```sql
WITH RECURSIVE path AS (
  SELECT id, id AS start_id, CAST(id AS TEXT) AS path, 0 AS depth
  FROM persons WHERE id = :person1_id

  UNION ALL

  SELECT
    CASE
      WHEN p.id = f.partner1_id THEN f.partner2_id
      WHEN p.id = f.partner2_id THEN f.partner1_id
      ELSE c2.person_id
    END AS id,
    p.start_id,
    p.path || ',' || CASE
      WHEN p.id = f.partner1_id THEN f.partner2_id
      WHEN p.id = f.partner2_id THEN f.partner1_id
      ELSE c2.person_id
    END,
    p.depth + 1
  FROM path p
  -- Navigate through family connections
  LEFT JOIN children c ON c.person_id = p.id
  LEFT JOIN families f ON f.id = c.family_id OR p.id IN (f.partner1_id, f.partner2_id)
  LEFT JOIN children c2 ON c2.family_id = f.id AND c2.person_id != p.id
  WHERE p.depth < 20  -- Max traversal depth
    AND INSTR(p.path, CASE
      WHEN p.id = f.partner1_id THEN f.partner2_id
      WHEN p.id = f.partner2_id THEN f.partner1_id
      ELSE c2.person_id
    END) = 0  -- Prevent cycles
)
SELECT * FROM path WHERE id = :person2_id ORDER BY depth LIMIT 1;
```

## Performance Optimization Tables

### Closure Table (Pre-Computed Ancestor/Descendant Pairs)

Pre-computes all ancestor-descendant relationships, eliminating recursive CTEs for the most common genealogical queries. See [ADR-006](decisions/006-closure-table.md) for rationale.

```sql
-- ============================================================
-- CLOSURE TABLE (ancestor/descendant pre-computation)
-- ============================================================

CREATE TABLE ancestor_paths (
  ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,  -- generation distance (1 = parent-child, 2 = grandparent, etc.)
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_ancestor_paths_descendant ON ancestor_paths(descendant_id);
CREATE INDEX idx_ancestor_paths_depth ON ancestor_paths(depth);
```

**Usage examples:**

```sql
-- All ancestors of person X (replaces 15-line recursive CTE)
SELECT p.*, ap.depth AS generation
FROM ancestor_paths ap
JOIN persons p ON p.id = ap.ancestor_id
WHERE ap.descendant_id = :personId
ORDER BY ap.depth;

-- Common ancestor between two people (replaces 30-line path-finding CTE)
SELECT ap1.ancestor_id, ap1.depth AS depth1, ap2.depth AS depth2
FROM ancestor_paths ap1
JOIN ancestor_paths ap2 ON ap1.ancestor_id = ap2.ancestor_id
WHERE ap1.descendant_id = :person1Id AND ap2.descendant_id = :person2Id
ORDER BY (ap1.depth + ap2.depth)
LIMIT 1;
```

**Maintenance:** Rebuilt fully after GEDCOM import. Updated incrementally on parent-child link changes via `packages/db/queries/closure-table.ts`.

### Person Summary Table (Denormalized Display Data)

Eliminates JOINs for tree node rendering. One row per person with all display-relevant data.

```sql
CREATE TABLE person_summary (
  person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  birth_place_name TEXT,
  sex TEXT,
  is_living INTEGER,
  father_id TEXT,
  mother_id TEXT,
  spouse_ids TEXT,                  -- JSON array of person IDs
  child_ids TEXT,                   -- JSON array of person IDs
  ancestor_count INTEGER DEFAULT 0,
  descendant_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  completion_score INTEGER DEFAULT 0,  -- 0-100 based on filled fields
  updated_at TEXT
);
```

**Maintenance:** Updated via application-level hooks after mutations to persons, person_names, events, families, or children. Rebuilt fully after GEDCOM import.

### Tree Layout Positions (React Flow Canvas)

Stores user-customized node positions for the interactive tree canvas. See [ADR-005](decisions/005-react-flow-viz.md).

```sql
CREATE TABLE tree_layouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  layout_name TEXT NOT NULL DEFAULT 'default',
  x REAL NOT NULL,
  y REAL NOT NULL,
  UNIQUE(person_id, layout_name)
);

CREATE INDEX idx_tree_layouts_person ON tree_layouts(person_id);
CREATE INDEX idx_tree_layouts_name ON tree_layouts(layout_name);
```

**Usage:** Auto-layout via dagre provides initial positions. Manual drag-to-reposition saves to this table. Multiple layouts supported ("default", "pedigree_view", "research_workspace", "presentation").

---

## Proposed Persons (AI Discovery Staging)

AI-discovered persons are staged in a separate table, never inserted directly into `persons`. This keeps the main tree clean while allowing AI to propose new people for user review.

```sql
CREATE TABLE proposed_persons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  -- Extracted person data
  given_name TEXT,
  surname TEXT,
  sex TEXT CHECK(sex IN ('M','F','U')) DEFAULT 'U',
  birth_date_original TEXT,
  birth_date_sort INTEGER,
  birth_place_name TEXT,
  death_date_original TEXT,
  death_date_sort INTEGER,
  death_place_name TEXT,
  additional_data TEXT, -- JSON for any extra extracted fields

  -- Proposal metadata
  source_type TEXT NOT NULL CHECK(source_type IN ('familysearch','nara','ai_suggestion','record_match','web_search','newspaper')),
  source_detail TEXT,          -- URL or record reference
  source_record_text TEXT,     -- original record text for reference
  confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','needs_info')),

  -- Link to existing tree
  related_person_id TEXT REFERENCES persons(id), -- the person this discovery relates to
  proposed_relationship_type TEXT CHECK(proposed_relationship_type IN ('parent_child','partner','sibling')),

  -- Audit
  accepted_person_id TEXT REFERENCES persons(id), -- set when accepted, points to created person
  rejection_reason TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_proposed_persons_status ON proposed_persons(status);
CREATE INDEX idx_proposed_persons_related ON proposed_persons(related_person_id);
```

**Workflow:** AI research → creates `proposed_persons` entry → user reviews in validation queue → accepts (creates real person + relationship) or rejects (with reason). Accepted proposals link back via `accepted_person_id`.

---

## Migration Strategy

- **Tool:** Drizzle Kit (`drizzle-kit generate` for SQL migrations, `drizzle-kit push` for dev)
- **Strategy:** Sequential numbered migrations in `packages/db/migrations/`
- **Turso compatibility:** All migrations must be compatible with libsql (a superset of SQLite)
- **Rollback:** Each migration has an `up` and `down` script
- **Seeding:** Test data generator in `packages/db/seed/` for development and testing

---

## Related Documentation

- [Architecture Overview](overview.md) — System design, monorepo structure
- [AI Strategy](ai-strategy.md) — Claude integration, context injection, cost tracking
