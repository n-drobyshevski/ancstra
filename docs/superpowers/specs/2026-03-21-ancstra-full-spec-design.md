# Ancstra: AI-Powered Personal Genealogy App — Full Implementation Spec

**Version:** 1.0
**Date:** 2026-03-21
**Author:** Solo Developer + Claude (AI Co-developer)
**Source:** Enhanced from `first_research.md`

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Data Model & Database](#2-data-model--database)
3. [GEDCOM Parsing & Interchange](#3-gedcom-parsing--interchange)
4. [Tree Visualization](#4-tree-visualization)
5. [FamilySearch API & Sync](#5-familysearch-api--sync)
6. [AI Research Assistant](#6-ai-research-assistant)
7. [Document Processing & OCR](#7-document-processing--ocr)
8. [Record Matching Engine](#8-record-matching-engine)
9. [Photo Analysis & Enhancement](#9-photo-analysis--enhancement)
10. [DNA Data System](#10-dna-data-system)
11. [Collaboration & Multi-User](#11-collaboration--multi-user)
12. [Frontend Architecture](#12-frontend-architecture)
13. [API Routes, Testing & DevOps](#13-api-routes-testing--devops)
14. [Python Dependency Evaluation](#14-python-dependency-evaluation)
- [Appendix A: System-Phase Cross-Reference](#appendix-a-system-phase-cross-reference)
- [Appendix B: Revised Timeline](#appendix-b-revised-timeline)
- [Appendix C: Bug Fixes from Research Doc](#appendix-c-bug-fixes-from-research-doc)

---

## 1. System Overview & Architecture

### 1.1 Vision

A privacy-first, AI-powered genealogy tool that acts as a personal research command center. It searches across free data sources (FamilySearch's 66B records, NARA, Chronicling America), keeps data locally owned in SQLite, and uses Claude AI to break through research walls — all for $0/month in hosting costs.

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser/PWA)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Tree     │  │ Research │  │ Document │  │ DNA     │ │
│  │ Viewer   │  │ Assistant│  │ Manager  │  │ Browser │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐│
│  │              Zustand (Client State)                  ││
│  │              React Query (Server Cache)              ││
│  └──────────────────────┬───────────────────────────────┘│
└─────────────────────────┼────────────────────────────────┘
                          │ HTTP / Server Actions
┌─────────────────────────┼────────────────────────────────┐
│              Next.js 15 App Router (Server)              │
│  ┌──────────────────────┴───────────────────────────────┐│
│  │                 API Route Handlers                   ││
│  │  /api/persons  /api/families  /api/search  /api/ai   ││
│  └──────┬────────────┬────────────┬─────────────┬───────┘│
│         │            │            │             │        │
│  ┌──────┴──┐  ┌──────┴──┐  ┌─────┴────┐  ┌────┴──────┐ │
│  │ Drizzle │  │ GEDCOM  │  │ Matching │  │ Vercel    │ │
│  │ ORM     │  │ Parser  │  │ Engine   │  │ AI SDK    │ │
│  └────┬────┘  └─────────┘  └──────────┘  └─────┬─────┘ │
│       │                                         │       │
│  ┌────┴────┐                              ┌─────┴─────┐ │
│  │ SQLite  │                              │ Claude    │ │
│  │ (local) │                              │ API       │ │
│  │ Turso   │                              └───────────┘ │
│  │ (web)   │                                            │
│  └─────────┘                                            │
│                                                         │
│  External APIs:                                         │
│  ┌─────────────┐ ┌──────┐ ┌────────────┐ ┌───────────┐ │
│  │FamilySearch │ │ NARA │ │Chronicling │ │Transkribus│ │
│  │API          │ │ API  │ │America API │ │OCR API    │ │
│  └─────────────┘ └──────┘ └────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Deployment Modes

| Mode | Database | Hosting | Use Case |
|------|----------|---------|----------|
| **Local Development** | SQLite via better-sqlite3 | `next dev` on localhost | Primary development |
| **Local Production** | SQLite via better-sqlite3 | `next start` on localhost | Personal daily use |
| **Web (Family Sharing)** | Turso (edge SQLite) | Vercel free tier | Share with family members |

The transition from local to web requires only changing the database driver (better-sqlite3 → @libsql/client). Drizzle ORM abstracts this.

### 1.4 Monorepo Structure

```
ancstra/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── app/                # App Router pages and layouts
│       │   ├── (auth)/         # Auth-required route group
│       │   │   ├── tree/       # Tree viewer pages
│       │   │   ├── research/   # AI research assistant
│       │   │   ├── documents/  # Document/media management
│       │   │   ├── dna/        # DNA analysis views
│       │   │   └── settings/   # User/app settings
│       │   ├── api/            # API route handlers
│       │   └── layout.tsx      # Root layout
│       ├── components/         # React components
│       │   ├── tree/           # Tree visualization components
│       │   ├── persons/        # Person detail components
│       │   ├── research/       # AI chat components
│       │   ├── documents/      # Document viewer/upload
│       │   └── ui/             # shadcn/ui base components
│       ├── lib/                # App-specific utilities
│       └── public/             # Static assets
├── packages/
│   ├── db/                     # Database schema, migrations, queries
│   │   ├── schema/             # Drizzle ORM schema definitions
│   │   ├── migrations/         # Drizzle Kit migrations
│   │   ├── queries/            # Reusable query builders
│   │   └── seed/               # Test data and seed scripts
│   ├── gedcom/                 # GEDCOM parsing and export
│   │   ├── parser/             # Topola-based parser + vendor dialects
│   │   ├── exporter/           # GEDCOM serialization
│   │   └── mapping/            # GEDCOM ↔ schema field mapping
│   ├── matching/               # Record matching engine
│   │   ├── comparators/        # Jaro-Winkler, date, place comparators
│   │   ├── blocking/           # Candidate blocking strategies
│   │   └── scorer/             # Fellegi-Sunter scoring
│   ├── ai/                     # AI integration layer
│   │   ├── tools/              # Claude tool definitions
│   │   ├── prompts/            # System prompts and templates
│   │   └── context/            # Tree context injection
│   ├── ocr/                    # OCR processing
│   │   ├── tesseract/          # tesseract.js wrapper
│   │   ├── transkribus/        # Transkribus API client
│   │   └── preprocessing/      # Image preprocessing with Sharp
│   ├── dna/                    # DNA file parsing and analysis
│   │   ├── parsers/            # Provider-specific file parsers
│   │   └── analysis/           # cM estimation, relationship calc
│   └── shared/                 # Shared types, utils, constants
│       ├── types/              # TypeScript type definitions
│       ├── dates/              # Genealogical date handling
│       └── privacy/            # Living-person filter logic
├── docs/                       # Documentation
├── tests/                      # E2E and integration tests
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo config
├── package.json
└── tsconfig.json               # Root TypeScript config
```

**Build tooling:** pnpm (workspaces) + Turborepo (task orchestration)

### 1.5 Architecture Decision Records

#### ADR-001: SQLite over Neo4j

**Context:** Family trees are natural graphs. Neo4j is a graph database.
**Decision:** Use SQLite with recursive CTEs.
**Rationale:** SQLite handles 10K+ person trees without issue. Recursive CTEs cover ancestor/descendant queries efficiently. Zero operational overhead — no Java, no server process. The entire database is one portable file. If graph queries are ever needed, PostgreSQL + Apache AGE can be added without a separate database.
**Consequence:** Complex path-finding queries ("all paths between two people") require custom code rather than Cypher.

#### ADR-002: JS/TS over Python Sidecar

**Context:** The research doc proposed FastAPI for OCR, NLP, DNA analysis.
**Decision:** Use JS/TS for everything possible. Python only via cloud APIs or subprocess for truly unavoidable tools.
**Rationale:** Single runtime reduces deployment complexity, debugging surface, and operational overhead. tesseract.js (same engine as Python Tesseract), face-api.js (TensorFlow.js), and Replicate cloud APIs cover all Python-dependent features.
**Consequence:** Record matching quality may be lower initially than Splink. Upgrade path exists (see Section 8).
**Full evaluation:** See Section 14.

#### ADR-003: Gramps Web API — Reject as Runtime, Study as Reference

**Context:** Gramps has 20+ years of genealogy data logic.
**Decision:** Do not use Gramps Web API as a runtime dependency. Study its schema design and validation rules as reference when designing our own TypeScript data layer.
**Rationale:** Adding a Python runtime dependency contradicts ADR-002. Gramps' schema is well-designed but tightly coupled to its Python data model. Our schema borrows concepts (event-based modeling, source citations, place hierarchy) but implements them natively in Drizzle ORM.
**Consequence:** More upfront schema design work. Full ownership and control of the data layer.

#### ADR-004: Local-First Architecture

**Context:** User wants local-first with web deployment as a later option.
**Decision:** SQLite via better-sqlite3 for local, Turso (libsql) for web. Drizzle ORM abstracts the driver difference.
**Rationale:** Zero hosting cost for personal use. Data sovereignty. Web deployment is a driver swap, not an architecture change.
**Consequence:** Must design for offline-capable PWA from the start. Sync strategy needed when web-deployed.

---

## 2. Data Model & Database

### 2.1 Design Principles

- **Event-based modeling:** Life events (birth, death, marriage, immigration, etc.) are separate records linked to persons, not columns on the person table. This follows the GEDCOM/Gramps model and is infinitely extensible.
- **Source everything:** Every fact should trace to a source citation. The schema enforces this with `source_citations` linking any entity to sources.
- **Place normalization:** Places are a separate entity with hierarchy (city → county → state → country), enabling deduplication and geocoding.
- **Structured names:** GEDCOM names have given name, surname, prefix, suffix, nickname — stored as parts, not a single string.
- **Genealogical dates:** Support ranges ("between 1880 and 1885"), approximations ("about 1872"), dual dating ("1731/32"), and non-Gregorian calendars.

### 2.2 Complete SQLite Schema

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

### 2.3 Corrected Recursive CTEs

The research doc's ancestor CTE (line 57-58) had a bug: `SELECT id FROM ancestors` returns all accumulated rows. Here are the corrected queries:

```sql
-- Ancestor query (corrected)
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

-- Descendant query
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

-- Relationship path between two people
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

### 2.4 Genealogical Date Handling

Genealogical dates are far more complex than standard ISO dates. The system must handle:

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

### 2.5 Living Person Filter

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

### 2.6 Migration Strategy

- **Tool:** Drizzle Kit (`drizzle-kit generate` for SQL migrations, `drizzle-kit push` for dev)
- **Strategy:** Sequential numbered migrations in `packages/db/migrations/`
- **Turso compatibility:** All migrations must be compatible with libsql (a superset of SQLite)
- **Rollback:** Each migration has an `up` and `down` script
- **Seeding:** Test data generator in `packages/db/seed/` for development and testing

---

## 3. GEDCOM Parsing & Interchange

### 3.1 Overview

GEDCOM (GEnealogical Data COMmunication) is a 1996-era text format that remains the only universal interchange standard for genealogy data. It is notoriously difficult to parse correctly due to vendor-specific extensions, encoding variations, and malformed files. This section details a robust import/export system.

### 3.2 Parser Architecture

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
```

### 3.3 Vendor Dialect Handling

Each genealogy software produces slightly different GEDCOM output. Common issues:

| Vendor | Issue | Fix |
|--------|-------|-----|
| **Ancestry** | Uses custom `_APID` tags for record links | Parse and store in `match_candidates` |
| **RootsMagic** | Custom `_WEBTAG`, `_TODO` tags | Preserve as notes |
| **Legacy** | Non-standard date formats | Normalize through date parser |
| **FamilyTreeMaker** | ANSEL encoding default | Detect and convert to UTF-8 |
| **MyHeritage** | Duplicate INDI records with same ID | Deduplicate on import |
| **Gramps** | Extended event types with `_TYPE` subtags | Map to our event_type enum |

```typescript
// packages/gedcom/parser/dialect-detector.ts

export type GedcomDialect =
  | 'ancestry' | 'rootsmagic' | 'legacy' | 'ftm'
  | 'myheritage' | 'gramps' | 'familysearch' | 'generic';

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

### 3.4 GEDCOM-to-Schema Field Mapping

| GEDCOM Tag | Schema Table | Schema Column(s) |
|------------|-------------|-------------------|
| `INDI` | `persons` | id, sex |
| `NAME` | `person_names` | given_name, surname, prefix, suffix |
| `SEX` | `persons` | sex |
| `BIRT` | `events` | event_type='birth', date_*, place_id |
| `DEAT` | `events` | event_type='death', date_*, place_id |
| `BURI` | `events` | event_type='burial' |
| `BAPM` / `CHR` | `events` | event_type='baptism' |
| `MARR` | `events` | event_type='marriage', family_id |
| `DIV` | `events` | event_type='divorce', family_id |
| `FAM` | `families` | id, partner1_id, partner2_id |
| `HUSB` | `families` | partner1_id |
| `WIFE` | `families` | partner2_id |
| `CHIL` | `children` | family_id, person_id |
| `SOUR` | `sources` / `source_citations` | title, citation_detail |
| `PLAC` | `places` | name (parsed into hierarchy) |
| `OBJE` | `media` | file_path, mime_type, title |
| `NOTE` | various | notes fields |
| `RESI` | `events` | event_type='residence' |
| `OCCU` | `events` | event_type='occupation' |
| `IMMI` | `events` | event_type='immigration' |
| `EMIG` | `events` | event_type='emigration' |
| `NATU` | `events` | event_type='naturalization' |
| `CENS` | `events` | event_type='census' |
| `MILI` | `events` | event_type='military' |

### 3.5 Character Encoding

```typescript
// packages/gedcom/parser/encoding.ts

export function detectAndNormalizeEncoding(buffer: Buffer): string {
  // Check for BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString('utf-8');
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.slice(2).toString('utf-16le');
  }

  // Check GEDCOM CHAR tag
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
  // For production: use a library like 'ansel-to-unicode'
  throw new Error('ANSEL conversion: use ansel-to-unicode package');
}
```

### 3.6 Import Transaction Safety

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
  const stats = { personsImported: 0, familiesImported: 0,
    eventsImported: 0, sourcesImported: 0,
    mediaImported: 0, placesImported: 0 };

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
          line: indi.line || 0, tag: 'INDI',
          message: `Failed to import ${indi.id}: ${e}`, fatal: false
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
          line: fam.line || 0, tag: 'FAM',
          message: `Failed to import family ${fam.id}: ${e}`, fatal: false
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
    stats, warnings, errors,
    duration: Date.now() - startTime,
  };
}
```

### 3.7 Export with Living Person Filtering

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

  // Filter living persons
  if (options.filterLiving) {
    persons = persons.filter(p => !isPresumablyLiving(p));
  }

  // Export each person as INDI record
  for (const person of persons) {
    lines.push(`0 @I${person.id}@ INDI`);
    // ... names, events, sources
  }

  // Export families
  // ... families, children

  lines.push('0 TRLR'); // Trailer
  return lines.join('\n');
}
```

### 3.8 Round-Trip Fidelity Testing

To ensure import/export quality, the test suite includes:

1. **Canonical test files:** GEDCOM samples from Ancestry, RootsMagic, Gramps, FamilySearch, and the official GEDCOM 5.5.1 torture test file
2. **Round-trip test:** Import a GEDCOM → export it → re-import → compare data. Key metrics: person count match, name accuracy, date preservation, relationship integrity
3. **Encoding tests:** Files in UTF-8, ANSEL, ASCII, UTF-16LE
4. **Edge cases:** Empty files, files with only a header, files with 50K+ individuals, files with circular references (yes, they exist in the wild)

---

## 4. Tree Visualization

### 4.1 Library Roles

| Library | Role | Chart Types | Interaction |
|---------|------|-------------|-------------|
| **family-chart** | Primary interactive viewer | Pedigree, family group | Click, zoom, pan, drag |
| **Topola** | Specialized views + export | Ancestors, descendants, hourglass, relatives, fancy | View-only, PDF/PNG/SVG export |

Both libraries are confirmed active and well-maintained (verified via context7).

### 4.2 Data Adapter Interface

Both libraries expect different data formats. A unified adapter converts from our SQLite schema:

```typescript
// packages/db/queries/tree-data.ts

export interface TreePerson {
  id: string;
  name: string;
  birthYear?: number;
  deathYear?: number;
  sex: 'M' | 'F' | 'U';
  photoUrl?: string;
  isLiving: boolean;
}

export interface TreeFamily {
  id: string;
  partner1Id?: string;
  partner2Id?: string;
  childIds: string[];
  marriageYear?: number;
}

export interface TreeData {
  persons: Map<string, TreePerson>;
  families: Map<string, TreeFamily>;
  rootPersonId: string;
}

// Adapter for family-chart library
export function toFamilyChartData(tree: TreeData): FamilyChartDatum[] {
  const data: FamilyChartDatum[] = [];

  for (const [id, person] of tree.persons) {
    const parentFamily = findParentFamily(id, tree.families);
    const spouseFamilies = findSpouseFamilies(id, tree.families);

    data.push({
      id,
      data: {
        'first name': person.name.split(' ')[0],
        'last name': person.name.split(' ').slice(1).join(' '),
        birthday: person.birthYear?.toString() || '',
        deathday: person.deathYear?.toString() || '',
        gender: person.sex === 'M' ? 'male' : person.sex === 'F' ? 'female' : 'other',
        avatar: person.photoUrl || '',
      },
      rels: {
        father: parentFamily ? findFather(parentFamily, tree.persons) : undefined,
        mother: parentFamily ? findMother(parentFamily, tree.persons) : undefined,
        spouses: spouseFamilies.map(f =>
          f.partner1Id === id ? f.partner2Id : f.partner1Id
        ).filter(Boolean) as string[],
        children: spouseFamilies.flatMap(f => f.childIds),
      },
    });
  }

  return data;
}

// Adapter for Topola (expects GEDCOM JSON from convertGedcom)
export function toTopolaData(tree: TreeData): TopolaJsonGedcom {
  // Convert our tree data to Topola's expected format
  // Topola uses its own internal representation from GEDCOM JSON
  return {
    indis: Array.from(tree.persons.entries()).map(([id, p]) => ({
      id,
      firstName: p.name.split(' ')[0],
      lastName: p.name.split(' ').slice(1).join(' '),
      sex: p.sex,
      birth: p.birthYear ? { date: { year: p.birthYear } } : undefined,
      death: p.deathYear ? { date: { year: p.deathYear } } : undefined,
      famc: findParentFamilyId(id, tree.families),
      fams: findSpouseFamilyIds(id, tree.families),
    })),
    fams: Array.from(tree.families.entries()).map(([id, f]) => ({
      id,
      husb: f.partner1Id,
      wife: f.partner2Id,
      children: f.childIds,
    })),
  };
}
```

### 4.3 Component Architecture

```
TreePage
├── TreeToolbar
│   ├── ChartTypeSelector (pedigree | descendants | hourglass | family)
│   ├── SearchPersonInput (navigate to person)
│   ├── ZoomControls
│   └── ExportButton (PDF, PNG, SVG)
├── InteractiveTreeView (client component)
│   ├── FamilyChartWrapper (when chartType = pedigree | family)
│   │   └── family-chart D3 rendering
│   └── TopolaWrapper (when chartType = descendants | hourglass | ancestors)
│       └── Topola SVG rendering
├── PersonDetailPanel (slide-out)
│   ├── PersonHeader (name, photo, life dates)
│   ├── EventsList (birth, death, marriage, etc.)
│   ├── SourcesList (attached citations)
│   ├── MediaGallery (photos, documents)
│   ├── MatchCandidates (FamilySearch hints)
│   └── PersonActions (edit, merge, delete)
└── MiniMap (overview of large trees)
```

### 4.4 Custom Node Rendering

```typescript
// apps/web/components/tree/PersonNode.tsx

interface PersonNodeProps {
  person: TreePerson;
  isSelected: boolean;
  completionScore: number;  // 0-100, based on filled fields
}

export function PersonNode({ person, isSelected, completionScore }: PersonNodeProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 p-2 rounded-lg border-2 min-w-[120px]",
      isSelected ? "border-primary bg-primary/5" : "border-border bg-card",
      person.sex === 'M' ? "border-l-blue-500 border-l-4" :
      person.sex === 'F' ? "border-l-pink-500 border-l-4" : ""
    )}>
      {person.photoUrl ? (
        <Avatar src={person.photoUrl} size="sm" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <UserIcon className="w-4 h-4" />
        </div>
      )}
      <span className="text-sm font-medium text-center leading-tight">
        {person.isLiving ? 'Living' : person.name}
      </span>
      {!person.isLiving && (
        <span className="text-xs text-muted-foreground">
          {person.birthYear && `${person.birthYear}`}
          {person.birthYear && person.deathYear && ' – '}
          {person.deathYear && `${person.deathYear}`}
        </span>
      )}
      {/* Completion indicator */}
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${completionScore}%` }}
        />
      </div>
    </div>
  );
}
```

### 4.5 Relationship Link Visualization

Links between persons in the tree reflect their validation status:

| Status | Line Style | Color | Meaning |
|--------|-----------|-------|---------|
| `confirmed` | Solid line | Default (gray/black) | Validated relationship with justification |
| `proposed` | Dashed line | Blue | AI/API-discovered, pending editor review |
| `disputed` | Dotted line | Amber/yellow | Conflicting evidence, under investigation |

Additional visual indicators:
- **Justification badge:** Small shield/checkmark icon on confirmed links showing evidence count (e.g., "3 sources")
- **Pending proposal badge:** Person nodes with pending proposals show a notification dot
- **Clicking a link** opens the justification panel in the PersonDetailPanel sidebar, showing all evidence and the validation history

```typescript
// apps/web/components/tree/RelationshipLink.tsx

interface RelationshipLinkProps {
  validationStatus: 'confirmed' | 'proposed' | 'disputed';
  justificationCount: number;
}

// SVG line styles based on validation status:
// confirmed: stroke-dasharray="none"
// proposed:  stroke-dasharray="8,4" stroke="#3b82f6"
// disputed:  stroke-dasharray="3,3" stroke="#f59e0b"
```

### 4.6 Performance Strategy for Large Trees

- **Viewport culling:** Only render nodes visible in the current viewport + 1 screen buffer
- **Level-of-detail:** Distant nodes show simplified boxes; nearby nodes show full detail with photos
- **Lazy loading:** Load person details on demand (click or hover), not upfront
- **Debounced zoom/pan:** Throttle re-renders during zoom/pan interactions
- **Web Workers:** Offload tree layout calculations to a Web Worker for 1000+ node trees
- **Pagination:** For descendants view, load generation-by-generation with "load more" buttons

### 4.6 Print and Export

| Format | Library | Use Case |
|--------|---------|----------|
| **PDF** | Topola (built-in) | High-quality printable charts |
| **PNG** | Topola (built-in) or html-to-image | Sharing on social media |
| **SVG** | Topola (built-in) | Scalable vector for printing |
| **GEDCOM** | Our exporter (Section 3) | Data interchange |

---

## 7. Document Processing & OCR

### 7.1 Architecture

All OCR runs in JS/TS -- no Python required. tesseract.js uses the same Tesseract engine compiled to WASM. Transkribus for handwriting is a REST API.

```
Upload (drag-drop / camera)
  |
  v
Preprocessing (Sharp: resize, rotate, denoise, normalize)
  |
  v
OCR Engine Selection
  |--- Printed text --> tesseract.js (WASM, same quality as Python Tesseract)
  |--- Handwriting  --> Transkribus REST API (50-100 free credits/month)
  |
  v
Claude API (entity extraction: names, dates, places, relationships)
  |
  v
Review UI (confirm/correct extracted entities)
  |
  v
Auto-link to tree persons (matching engine from Section 8)
```

### 7.2 Image Preprocessing with Sharp

```typescript
// packages/ocr/preprocessing/prepare-image.ts

import sharp from 'sharp';

export async function preprocessForOcr(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate()                    // Auto-rotate from EXIF
    .grayscale()                 // Better OCR accuracy
    .normalize()                 // Fix faded contrast
    .sharpen({ sigma: 1.5 })    // Help OCR on blurry scans
    .toBuffer();
}
```

### 7.3 OCR with tesseract.js

```typescript
// packages/ocr/tesseract/ocr-engine.ts

import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;    // 0-100
  engine: 'tesseract' | 'transkribus';
  duration: number;      // ms
}

export async function ocrWithTesseract(
  imageBuffer: Buffer,
  language = 'eng',
  onProgress?: (pct: number) => void
): Promise<OcrResult> {
  const start = Date.now();
  const worker = await Tesseract.createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress * 100);
    },
  });

  const { data } = await worker.recognize(imageBuffer);
  await worker.terminate();

  return {
    text: data.text,
    confidence: data.confidence,
    engine: 'tesseract',
    duration: Date.now() - start,
  };
}
```

### 7.4 Transkribus for Handwriting

Transkribus offers a REST API (language-agnostic, no Python needed) with 50-100 free credits/month.

```typescript
// packages/ocr/transkribus/handwriting-ocr.ts

export async function ocrWithTranskribus(imageBuffer: Buffer): Promise<OcrResult> {
  const start = Date.now();

  // 1. Upload image
  const uploadRes = await fetch('https://transkribus.eu/TrpServer/rest/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TRANSKRIBUS_API_KEY}`,
      'Content-Type': 'image/jpeg',
    },
    body: imageBuffer,
  });
  const { uploadId } = await uploadRes.json();

  // 2. Start recognition and poll for result
  // ... (standard REST polling pattern)

  return { text: result.text, confidence: 0, engine: 'transkribus', duration: Date.now() - start };
}
```

### 7.5 AI Entity Extraction

After OCR, Claude extracts structured genealogical entities from the raw text:

```typescript
// packages/ai/tools/entity-extraction.ts

export interface ExtractedEntities {
  persons: { name: string; role?: string; age?: string; confidence: number }[];
  events: { type: string; date?: string; place?: string; confidence: number }[];
  relationships: { person1: string; person2: string; type: string; confidence: number }[];
}

const EXTRACTION_PROMPT = `Extract structured genealogical data from this OCR text.
Return JSON with persons (name, role, age), events (type, date, place),
and relationships (person1, person2, type). Be conservative -- only extract
data you're confident about. Mark confidence 0-1.

Document type: {documentType}
OCR Text: {ocrText}`;
```

---

## 8. Record Matching Engine

### 8.1 Overview

The highest-impact AI feature. Built in TypeScript (per ADR-002) instead of Splink (Python). Implements the Fellegi-Sunter probabilistic record linkage model.

### 8.2 Pipeline

```
1. BLOCKING: Reduce O(n^2) by grouping records sharing a key
   (first 3 chars of surname)
   |
2. COMPARISON: Compare each pair using:
   - Jaro-Winkler (names) with nickname awareness
   - Date tolerance (+-3 years)
   - Place matching (hierarchical)
   |
3. SCORING: Weighted Fellegi-Sunter model
   |
4. CLASSIFICATION:
   > 0.95 --> auto-accept
   0.70-0.95 --> human review
   < 0.70 --> reject
```

### 8.3 Name Comparison with Genealogy Awareness

```typescript
// packages/matching/comparators/name-comparator.ts

import jaroWinkler from 'jaro-winkler';

const NICKNAME_MAP: Record<string, string[]> = {
  'william': ['bill', 'billy', 'will', 'willy', 'liam'],
  'elizabeth': ['betty', 'beth', 'liz', 'lizzy', 'eliza', 'bess', 'bessie'],
  'margaret': ['maggie', 'meg', 'peggy', 'marge', 'greta'],
  'james': ['jim', 'jimmy', 'jamie'],
  'robert': ['bob', 'bobby', 'rob', 'robbie', 'bert'],
  'richard': ['dick', 'rick', 'ricky', 'rich'],
  'john': ['jack', 'johnny', 'jon'],
  'joseph': ['joe', 'joey'],
  'thomas': ['tom', 'tommy'],
  'charles': ['charlie', 'chuck'],
  'edward': ['ed', 'eddie', 'ted', 'teddy', 'ned'],
  'henry': ['harry', 'hal', 'hank'],
  'catherine': ['kate', 'kathy', 'cathy', 'katie', 'kitty'],
  'mary': ['molly', 'polly', 'mae', 'mamie', 'maria'],
  'sarah': ['sally', 'sadie'],
  'ann': ['annie', 'anna', 'nancy', 'nan'],
  'dorothy': ['dot', 'dottie', 'dolly'],
};

export function compareNames(name1: string, name2: string): { similarity: number; method: string } {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return { similarity: 1.0, method: 'exact' };

  const jw = jaroWinkler(n1, n2);
  const nickMatch = isNicknameVariant(n1, n2);
  const sxMatch = soundex(n1) === soundex(n2);

  let score = jw;
  if (nickMatch) score = Math.max(score, 0.90);
  if (sxMatch && score < 0.85) score = Math.max(score, 0.85);

  return { similarity: score, method: nickMatch ? 'nickname' : sxMatch ? 'soundex' : 'jaro-winkler' };
}
```

### 8.4 Scoring

```typescript
// packages/matching/scorer/fellegi-sunter.ts

const FIELD_WEIGHTS = {
  surname: 0.25, givenName: 0.20, birthDate: 0.20,
  birthPlace: 0.15, deathDate: 0.10, deathPlace: 0.10,
};

export function scoreMatch(local: PersonWithDetails, external: ExternalRecord): {
  score: number;
  classification: 'match' | 'review' | 'non-match';
} {
  let score = 0, totalWeight = 0;

  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const result = compareField(field, local, external);
    if (result) {
      score += result.similarity * weight;
      totalWeight += weight;
    }
  }

  score = totalWeight > 0 ? score / totalWeight : 0;

  return {
    score,
    classification: score >= 0.95 ? 'match' : score >= 0.70 ? 'review' : 'non-match',
  };
}
```

### 8.5 Integration with Relationship Validation

When the matching engine finds a match that implies a relationship (e.g., census records showing parent-child linkage, marriage records), it creates a `proposed_relationship` rather than directly modifying `families`/`children`:

```typescript
// packages/matching/output/propose-from-match.ts

export async function createProposalFromMatch(
  db: DrizzleDatabase,
  match: MatchScore,
  localPerson: PersonWithDetails,
  externalRecord: ExternalRecord
): Promise<string> {
  // Determine relationship type from the external record context
  const relType = inferRelationshipType(externalRecord);
  if (!relType) return; // Not a relationship record

  return db.insert(proposedRelationships).values({
    relationship_type: relType.type,
    person1_id: relType.person1Id,
    person2_id: relType.person2Id,
    source_type: 'record_match',
    source_detail: JSON.stringify({
      matchScore: match.overallScore,
      externalId: externalRecord.id,
      sourceSystem: externalRecord.source,
    }),
    confidence: match.overallScore,
    status: 'pending',
  }).returning().then(r => r[0].id);
}
```

The existing `match_candidates` table remains for **record-level** matches (e.g., "this census entry might be about person X"). The `proposed_relationships` table is for **person-level relationship proposals** (e.g., "person X appears to be the father of person Y").

### 8.6 Upgrade Path to Splink

If TS matcher quality is insufficient after Phase 2 evaluation:
1. Wrap Splink in a Docker container, call via HTTP
2. The `packages/matching/` package exports a `MatchingEngine` interface -- both backends implement it

---

## 9. Photo Analysis & Enhancement

### 9.1 Tool Selection (JS + Cloud APIs)

| Feature | Tool | Runtime |
|---------|------|---------|
| Face detection | face-api.js (TensorFlow.js) | Node.js |
| Face recognition | face-api.js (ArcFace model) | Node.js |
| Face clustering | Custom agglomerative on embeddings | Node.js |
| Face restoration | Replicate API (GFPGAN) | Cloud (~$0.01/image) |
| Photo upscaling | Replicate API (Real-ESRGAN) | Cloud (~$0.01/image) |
| Colorization | Replicate API (DDColor) | Cloud (optional) |

### 9.2 Face Detection

```typescript
// apps/web/lib/photos/face-detection.ts

import * as faceapi from 'face-api.js';

export async function detectFaces(imageBuffer: Buffer): Promise<{
  bbox: { x: number; y: number; width: number; height: number };
  embedding: Float32Array;  // 128-dim descriptor for matching
  confidence: number;
}[]> {
  const img = await loadImage(imageBuffer);
  const detections = await faceapi
    .detectAllFaces(img)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map(d => ({
    bbox: normalizeBox(d.detection.box, img.width, img.height),
    embedding: d.descriptor,
    confidence: d.detection.score,
  }));
}
```

### 9.3 Cloud Enhancement via Replicate

```typescript
// apps/web/lib/photos/enhance.ts

export async function restoreFace(imageUrl: string): Promise<string> {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'gfpgan-v1.4',
      input: { img: imageUrl, version: 'v1.4', scale: 2 },
    }),
  });
  return await pollForResult(res);
}
```

---

## 10. DNA Data System

### 10.1 Scope

Initial implementation:
- Parse raw DNA files from all major providers (simple CSV/TSV formats)
- Encrypted storage (separate SQLCipher database)
- cM-based relationship estimation (pure TS math, no external tools)
- Chromosome browser visualization (D3.js)
- Link DNA profiles to tree persons

Deferred: IBD segment detection (needs PLINK), population genetics (needs scikit-allel).

### 10.2 File Parsers

```typescript
// packages/dna/parsers/parse-23andme.ts
// Format: rsid\tchromosome\tposition\tgenotype (comments start with #)

export function parse23andMe(content: string): DnaSnp[] {
  return content.split('\n')
    .filter(line => !line.startsWith('#') && line.trim())
    .map(line => {
      const [rsid, chromosome, position, genotype] = line.split('\t');
      return { rsid, chromosome, position: parseInt(position), genotype };
    });
}

// Similar parsers for AncestryDNA (CSV), MyHeritage (CSV), FTDNA (CSV)
```

### 10.3 Encrypted Storage

DNA data is stored in a **separate encrypted SQLite database** using SQLCipher -- never co-mingled with the main genealogy database.

```typescript
// packages/dna/storage/dna-database.ts

import Database from 'better-sqlite3';

export function createDnaDatabase(path: string, key: string) {
  const db = new Database(path);
  db.pragma(`key = '${key}'`);  // SQLCipher encryption

  db.exec(`
    CREATE TABLE IF NOT EXISTS dna_kits (
      id TEXT PRIMARY KEY, person_id TEXT, provider TEXT NOT NULL,
      snp_count INTEGER NOT NULL, import_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dna_snps (
      kit_id TEXT REFERENCES dna_kits(id),
      rsid TEXT, chromosome TEXT, position INTEGER, genotype TEXT,
      PRIMARY KEY (kit_id, rsid)
    );
    CREATE INDEX IF NOT EXISTS idx_snps_chr ON dna_snps(kit_id, chromosome, position);
  `);
  return db;
}
```

### 10.4 Relationship Estimation (cM Lookup)

```typescript
// packages/dna/analysis/relationship-estimator.ts

// Based on DNA Painter's shared cM project data
const CM_RANGES = [
  { min: 3400, max: 3700, rels: ['Parent/Child', 'Full Sibling'] },
  { min: 1700, max: 3400, rels: ['Grandparent', 'Aunt/Uncle', 'Half Sibling'] },
  { min: 800, max: 1700, rels: ['1st Cousin', 'Great-Grandparent', 'Great-Aunt/Uncle'] },
  { min: 200, max: 800, rels: ['2nd Cousin', '1st Cousin Once Removed'] },
  { min: 20, max: 200, rels: ['3rd-4th Cousin'] },
  { min: 6, max: 20, rels: ['5th-6th Cousin'] },
];

export function estimateRelationship(sharedCm: number): string[] {
  const match = CM_RANGES.find(r => sharedCm >= r.min && sharedCm <= r.max);
  return match?.rels || (sharedCm > 3700 ? ['Identical Twin'] : ['Distant Relative']);
}
```

### 10.5 Chromosome Browser

Built with D3.js -- horizontal bars for chromosomes 1-22 + X, with colored segments showing shared DNA regions. Hover shows segment details.

---

## 11. Collaboration & Multi-User

### 11.1 Authentication

```typescript
// NextAuth.js configuration

// Phase 1: Credentials provider (local use)
// Phase 5: Add Google/Apple OAuth for family members

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Verify against local users table
        // Hash comparison with bcrypt
      },
    }),
    // Phase 5: GoogleProvider, AppleProvider
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.treeId = user.treeId; }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.treeId = token.treeId;
      return session;
    },
  },
};
```

### 11.2 Role-Based Access Control

| Permission | Owner | Admin | Editor | Viewer |
|-----------|-------|-------|--------|--------|
| View tree | Yes | Yes | Yes | Yes (living filtered) |
| Edit persons | Yes | Yes | Submit for review | No |
| Delete persons | Yes | Yes | No | No |
| Import GEDCOM | Yes | Yes | No | No |
| Export GEDCOM | Yes | Yes | Yes (living filtered) | No |
| AI research | Yes | Yes | Yes | No |
| **Validate relationships** | **Yes** | **Yes** | **Yes** | **No** |
| **Add justifications** | **Yes** | **Yes** | **Yes** | **No** |
| **View validation queue** | **Yes** | **Yes** | **Yes** | **No** |
| DNA data | Yes | No | No | No |
| Manage users | Yes | Yes | No | No |
| App settings | Yes | No | No | No |

### 11.3 Multi-Tenant Architecture

When deployed to web (Vercel + Turso), each family gets its own Turso database:

```
Family A --> turso://ancstra-family-abc123.turso.io
Family B --> turso://ancstra-family-def456.turso.io
```

Benefits: complete data isolation, independent backup/restore, no row-level security complexity.

### 11.4 Contribution Workflow (Phase 5)

```
Editor submits change
  |
  v
Change queued as "pending_review" in change_log
  |
  v
Admin/Owner receives notification
  |
  v
Review: Accept | Reject | Request Changes
  |
  v
If accepted: apply change, update tree, notify editor
```

### 11.5 Family Invitation Flow

```
Owner clicks "Invite Family Member"
  |
  v
Enter email + role (viewer/editor)
  |
  v
System generates invite link (JWT token, 7-day expiry)
  |
  v
Recipient clicks link --> creates account --> assigned role
  |
  v
Can now access the family tree with role-based permissions
```

### 11.6 Relationship Validation Workflow

The core data-integrity feature. AI and external APIs auto-discover potential relationships, but only editors can confirm them into the tree.

#### Data Collection Phase

```
FamilySearch API hints     ──┐
Record matching engine     ──┤
AI entity extraction (OCR) ──┼──→ proposed_relationships (status: 'pending')
AI research assistant      ──┤
Newspaper search           ──┘
```

All automated discoveries create entries in `proposed_relationships` — they **never** directly modify `families` or `children`. GEDCOM imports are the sole exception: they write directly to `families`/`children` with `validation_status = 'confirmed'`.

#### Validation Queue

Editors see a validation queue showing all pending proposals, sorted by confidence (highest first):

```typescript
// apps/web/app/(auth)/validate/page.tsx

// Validation queue shows:
// - Proposed relationship type (parent-child, partner, sibling)
// - Both persons involved (names, life dates, photos)
// - Source system and confidence score
// - Existing relationships for both people (to detect conflicts)
// - Supporting evidence from the source system
// - Count of pending proposals (badge in sidebar nav)
```

#### Editor Decision Flow

```
Editor reviews proposed relationship
  |
  ├── VALIDATE
  │   |
  │   v
  │   Editor writes justification:
  │   - Free text explaining the evidence
  │   - Optionally attaches source citations (birth cert, census, etc.)
  │   |
  │   v
  │   System:
  │   - Creates family/children record (validation_status = 'confirmed')
  │   - Links proposed_relationship_id for provenance tracking
  │   - Creates relationship_justification record
  │   - Sets proposed_relationships.status = 'validated'
  │   - Logs in change_log and activity feed
  │
  ├── REJECT
  │   |
  │   v
  │   Editor writes rejection reason
  │   - Sets proposed_relationships.status = 'rejected'
  │   - Relationship does NOT appear in tree
  │   - Logged in activity feed
  │
  └── NEEDS INFO
      |
      v
      Sets proposed_relationships.status = 'needs_info'
      - Stays in queue with "needs research" flag
      - Can be assigned to AI assistant for deeper investigation
      - Editor can add a note about what's needed
```

#### Validation API

```typescript
// apps/web/app/api/relationships/proposed/[id]/validate/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session, 'editor')) return unauthorized();

  const { justificationText, sourceCitationId } = await request.json();

  await db.transaction(async (tx) => {
    // 1. Get the proposed relationship
    const proposal = await tx.select().from(proposedRelationships)
      .where(eq(proposedRelationships.id, params.id)).get();

    if (!proposal || proposal.status !== 'pending') {
      throw new Error('Proposal not found or already processed');
    }

    // 2. Create the actual relationship (family or children record)
    let familyId: string | undefined;
    let childLinkId: string | undefined;

    if (proposal.relationship_type === 'partner') {
      const family = await tx.insert(families).values({
        partner1_id: proposal.person1_id,
        partner2_id: proposal.person2_id,
        validation_status: 'confirmed',
        proposed_relationship_id: proposal.id,
      }).returning();
      familyId = family[0].id;
    } else if (proposal.relationship_type === 'parent_child') {
      // person1 = parent, person2 = child
      // Find or create family for the parent
      const family = await findOrCreateParentFamily(tx, proposal.person1_id);
      const child = await tx.insert(children).values({
        family_id: family.id,
        person_id: proposal.person2_id,
        validation_status: 'confirmed',
        proposed_relationship_id: proposal.id,
      }).returning();
      childLinkId = child[0].id;
    }

    // 3. Create the justification
    await tx.insert(relationshipJustifications).values({
      family_id: familyId,
      child_link_id: childLinkId,
      justification_text: justificationText,
      source_citation_id: sourceCitationId || null,
      author_id: session.user.id,
    });

    // 4. Mark proposal as validated
    await tx.update(proposedRelationships)
      .set({
        status: 'validated',
        validated_by: session.user.id,
        validated_at: new Date().toISOString(),
      })
      .where(eq(proposedRelationships.id, params.id));

    // 5. Log the change
    await logChange(tx, 'proposed_relationship', proposal.id, 'update', {
      status: { old: 'pending', new: 'validated' },
    }, session.user.id);
  });

  return Response.json({ success: true });
}
```

#### Adding Justifications to Existing Links

Editors can also add justifications to relationships that were already confirmed (e.g., from GEDCOM import), to strengthen the evidence chain:

```typescript
// POST /api/relationships/:id/justifications
// Works for both family_id and child_link_id
// Multiple justifications per relationship are allowed
// Each justification can reference a different source citation
```

---

## 12. Frontend Architecture

### 12.1 Server/Client Component Boundaries

```
Server Components (default):
  - Page layouts, data fetching, person lists
  - Static tree statistics, source lists
  - GEDCOM import/export triggers

Client Components ('use client'):
  - Tree visualization (D3/Canvas interactions)
  - AI chat interface (streaming responses)
  - Document viewer (zoom, pan, annotate)
  - DNA chromosome browser (D3 interactions)
  - Form inputs with validation
  - Search with live filtering
```

### 12.2 State Management

| State Type | Tool | Scope |
|-----------|------|-------|
| Server data (persons, events, sources) | React Query (TanStack Query) | Cached, auto-refetched |
| UI state (selected person, sidebar open) | Zustand | Client-side, ephemeral |
| Form state | React Hook Form | Per-form |
| URL state (filters, current view) | Next.js searchParams | URL-synced |

```typescript
// apps/web/lib/stores/tree-store.ts

import { create } from 'zustand';

interface TreeStore {
  selectedPersonId: string | null;
  chartType: 'pedigree' | 'descendants' | 'hourglass' | 'family';
  zoomLevel: number;
  sidebarOpen: boolean;

  selectPerson: (id: string | null) => void;
  setChartType: (type: TreeStore['chartType']) => void;
  setZoomLevel: (level: number) => void;
  toggleSidebar: () => void;
}

export const useTreeStore = create<TreeStore>((set) => ({
  selectedPersonId: null,
  chartType: 'pedigree',
  zoomLevel: 1,
  sidebarOpen: false,

  selectPerson: (id) => set({ selectedPersonId: id, sidebarOpen: id !== null }),
  setChartType: (chartType) => set({ chartType }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

### 12.3 Data Fetching with React Query

```typescript
// apps/web/lib/queries/persons.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePerson(personId: string) {
  return useQuery({
    queryKey: ['person', personId],
    queryFn: () => fetch(`/api/persons/${personId}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; updates: Partial<Person> }) =>
      fetch(`/api/persons/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['person', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tree'] });
    },
  });
}

export function useTreeData(rootPersonId: string, generations = 5) {
  return useQuery({
    queryKey: ['tree', rootPersonId, generations],
    queryFn: () =>
      fetch(`/api/tree?root=${rootPersonId}&generations=${generations}`).then(r => r.json()),
    staleTime: 30 * 1000,  // 30 seconds
  });
}
```

### 12.4 PWA Strategy

```typescript
// apps/web/public/sw.js (Service Worker)

// Cache strategy:
// - Static assets (JS, CSS, images): Cache-first, update in background
// - API data: Network-first, fall back to cache
// - Tree data: Cache with revalidation on focus

// Offline capabilities:
// - View cached tree data
// - Queue edits in IndexedDB
// - Sync queued edits when online
```

```typescript
// apps/web/next.config.js

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({ /* Next.js config */ });
```

### 12.5 Internationalization (i18n)

Genealogy is inherently international. The app must handle:
- UI labels in user's language
- Locale-aware date formatting (DD/MM/YYYY vs MM/DD/YYYY)
- Historical place names in original languages
- Name diacritics (umlauts, accents, cedillas)

```typescript
// apps/web/i18n.ts (using next-intl)

export const locales = ['en', 'de', 'fr', 'es', 'pt', 'pl', 'it', 'sv', 'no', 'da'] as const;
export const defaultLocale = 'en';

// Date formatting for genealogy
import { formatDate } from 'next-intl';

// Must support: "15 Mar 1872", "about 1880", "between 1880 and 1885"
// These are GEDCOM dates, not locale dates -- display as-is with context
```

---

## 13. API Routes, Testing & DevOps

### 13.1 API Route Design

All routes under `/api/` using Next.js App Router route handlers.

#### Person Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/persons` | List persons (paginated, filterable) | Viewer+ |
| GET | `/api/persons/:id` | Get person with names, events, sources | Viewer+ |
| POST | `/api/persons` | Create person | Editor+ |
| PATCH | `/api/persons/:id` | Update person | Editor+ |
| DELETE | `/api/persons/:id` | Soft-delete person | Admin+ |
| GET | `/api/persons/:id/ancestors` | Get ancestor tree | Viewer+ |
| GET | `/api/persons/:id/descendants` | Get descendant tree | Viewer+ |
| GET | `/api/persons/:id/hints` | Get match candidates | Editor+ |

#### Family Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/families` | List families | Viewer+ |
| GET | `/api/families/:id` | Get family with partners and children | Viewer+ |
| POST | `/api/families` | Create family | Editor+ |
| PATCH | `/api/families/:id` | Update family | Editor+ |
| DELETE | `/api/families/:id` | Soft-delete family | Admin+ |

#### Event Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/events` | Create event for person or family | Editor+ |
| PATCH | `/api/events/:id` | Update event | Editor+ |
| DELETE | `/api/events/:id` | Delete event | Admin+ |

#### Source Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/sources` | List sources | Viewer+ |
| POST | `/api/sources` | Create source | Editor+ |
| POST | `/api/sources/citations` | Create citation linking source to entity | Editor+ |

#### Media Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/media` | List media items | Viewer+ |
| POST | `/api/media/upload` | Upload media file | Editor+ |
| POST | `/api/media/:id/ocr` | Trigger OCR processing | Editor+ |
| POST | `/api/media/:id/faces` | Trigger face detection | Editor+ |

#### Search Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/search` | Full-text search across tree | Viewer+ |
| POST | `/api/search/familysearch` | Search FamilySearch records | Editor+ |
| POST | `/api/search/nara` | Search NARA catalog | Editor+ |

#### AI Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/ai/chat` | AI research assistant (streaming) | Editor+ |
| GET | `/api/ai/usage` | Get AI usage/cost stats | Admin+ |

#### GEDCOM Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/gedcom/import` | Import GEDCOM file | Admin+ |
| GET | `/api/gedcom/export` | Export GEDCOM file | Admin+ |

#### Relationship Validation Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/relationships/proposed` | List pending proposed relationships (filterable by status) | Editor+ |
| GET | `/api/relationships/proposed/:id` | Get proposed relationship with person details | Editor+ |
| POST | `/api/relationships/proposed/:id/validate` | Validate with justification text + optional source citation | Editor+ |
| POST | `/api/relationships/proposed/:id/reject` | Reject with reason | Editor+ |
| PATCH | `/api/relationships/proposed/:id` | Update status (e.g., needs_info) | Editor+ |
| GET | `/api/relationships/:id/justifications` | Get all justifications for a family or child link | Viewer+ |
| POST | `/api/relationships/:id/justifications` | Add justification to an existing confirmed link | Editor+ |
| GET | `/api/relationships/stats` | Validation queue stats (pending/validated/rejected counts) | Editor+ |

#### Sync Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/sync/familysearch/connect` | Initiate FamilySearch OAuth | Admin+ |
| POST | `/api/sync/familysearch/pull` | Pull updates from FamilySearch | Admin+ |
| GET | `/api/sync/status` | Get sync status | Viewer+ |

#### DNA Routes

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/dna/upload` | Upload raw DNA file | Owner |
| GET | `/api/dna/kits` | List DNA kits | Owner |
| GET | `/api/dna/compare/:kit1/:kit2` | Compare two kits | Owner |

### 13.2 Standard Response Format

```typescript
// Success
{ "data": T, "meta": { "total": number, "page": number, "limit": number } }

// Error
{ "error": { "code": string, "message": string, "details"?: object } }
```

### 13.3 Testing Strategy

| Type | Tool | Coverage Target | What |
|------|------|----------------|------|
| **Unit** | Vitest | 80%+ | Business logic, date parsing, name comparison, matching scorer |
| **Integration** | Vitest + test DB | 70%+ | API routes, database queries, GEDCOM import/export |
| **E2E** | Playwright | Critical paths | Import GEDCOM, view tree, search, AI chat, export |
| **Round-trip** | Vitest | 100% of test files | GEDCOM import -> export -> reimport -> compare |
| **Performance** | Vitest bench | Regression | Tree queries at 1K, 10K, 100K persons |

```typescript
// Example: GEDCOM round-trip test
// tests/gedcom/round-trip.test.ts

import { describe, it, expect } from 'vitest';

describe('GEDCOM round-trip fidelity', () => {
  it('preserves person count after import-export-reimport', async () => {
    const original = await fs.readFile('tests/fixtures/sample.ged', 'utf-8');
    const db1 = createTestDatabase();

    const import1 = await importGedcom(original, db1);
    const exported = await exportGedcom(db1, { version: '5.5.1', filterLiving: false });
    const db2 = createTestDatabase();
    const import2 = await importGedcom(exported, db2);

    expect(import2.stats.personsImported).toBe(import1.stats.personsImported);
    expect(import2.stats.familiesImported).toBe(import1.stats.familiesImported);
  });
});
```

### 13.4 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 13.5 Error Tracking and Monitoring

- **Error tracking:** Sentry free tier (5K events/month)
- **Logging:** Structured JSON logs via `pino`
- **Performance:** Web Vitals tracking (built into Next.js)
- **Database:** Query timing via Drizzle logger

---

## 14. Python Dependency Evaluation

### 14.1 Decision Matrix

| Tool | Purpose | Python-Only? | JS Alternative | Decision |
|------|---------|-------------|----------------|----------|
| **Splink** | Record linkage | Yes | Custom TS matcher (jaro-winkler + fastest-levenshtein npm) | **TS for MVP**. Upgrade to Splink sidecar if quality < 80% precision |
| **Tesseract** | Printed OCR | No | tesseract.js (same engine, WASM) | **JS** -- identical quality |
| **OpenCV** | Image preprocess | Partial | sharp (Node.js) for resize/rotate/normalize | **sharp** for common ops |
| **DeepFace** | Face recognition | Yes | face-api.js (TensorFlow.js) | **JS** -- good enough for detection + basic recognition |
| **GFPGAN** | Face restoration | Yes | Replicate cloud API | **Cloud API** (~$0.01/image) |
| **Real-ESRGAN** | Image upscaling | Yes | Replicate cloud API | **Cloud API** (~$0.01/image) |
| **CodeFormer** | Face restoration | Yes | Replicate cloud API | **Cloud API** |
| **DDColor** | Colorization | Yes | Replicate cloud API | **Cloud API** (optional feature) |
| **Transkribus** | Handwriting OCR | N/A | REST API (language-agnostic) | **HTTP from TS** |
| **PLINK** | DNA IBD detection | C++ binary | Subprocess if needed | **Defer**. Basic cM estimation is pure TS math |
| **scikit-allel** | Pop genetics | Yes | None | **Defer** -- not needed for MVP |
| **Gramps Web API** | Data layer | Yes | Native TS data layer | **Reject** as runtime dep. Study schema as reference |

### 14.2 Conclusion

**Zero Python dependencies for Phases 1-3.** Phase 4 photo enhancement uses cloud APIs (Replicate) instead of local Python. The only scenario requiring Python is if Splink's quality is needed AND the TS matcher proves insufficient -- evaluated after Phase 2 with real data.

### 14.3 If Python Sidecar is Ever Needed

Architecture:
- Thin FastAPI service in `services/python-sidecar/`
- Docker container for deployment
- HTTP communication with Next.js app
- Health check endpoint at `/health`
- Graceful degradation: app works without it, Python-dependent features show "unavailable"

---

## Appendix A: System-Phase Cross-Reference

| System | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|--------|---------|---------|---------|---------|---------|
| Data Model (Sec 2) | **Primary** | Extend | Extend | Extend | Extend |
| GEDCOM (Sec 3) | **Primary** | - | - | - | 7.0 support |
| Visualization (Sec 4) | **Primary** | Extend (link styles) | - | - | Maps, narratives |
| FamilySearch (Sec 5) | - | **Primary** | - | - | Bidirectional sync |
| AI Assistant (Sec 6) | - | **Primary** | Extend | - | Narratives |
| Document/OCR (Sec 7) | - | - | **Primary** | - | - |
| Record Matching (Sec 8) | - | **Primary** | Extend | - | - |
| **Relationship Validation (Sec 11.6)** | - | **Primary** | Extend | - | Extend |
| Photo Analysis (Sec 9) | - | - | - | **Primary** | - |
| DNA (Sec 10) | - | - | - | **Primary** | - |
| Collaboration (Sec 11) | - | - | - | - | **Primary** |
| Frontend Arch (Sec 12) | **Primary** | Extend | Extend | Extend | Extend |
| API/Testing (Sec 13) | **Primary** | Extend | Extend | Extend | Extend |

---

## Appendix B: Revised Timeline

| Phase | Research Doc Estimate | Revised Estimate | Change Reason |
|-------|---------------------|-----------------|---------------|
| Phase 1: Core + GEDCOM | 6 weeks | **8 weeks** | GEDCOM vendor dialects harder than estimated; add PWA foundation, testing infra |
| Phase 2: AI Search + Matching | 8 weeks | **10 weeks** | Building TS matcher from scratch (not integrating Splink); FamilySearch OAuth + sync |
| Phase 3: Document OCR | 8 weeks | **7 weeks** | tesseract.js simplifies; Transkribus is a REST API call |
| Phase 4: Photos + DNA | 8 weeks | **8 weeks** | Cloud APIs simplify photo work; DNA parsing is straightforward |
| Phase 5: Collaboration | 10 weeks | **8 weeks** | Tightly scoped; migration map visualization is optional |
| **Total** | **40 weeks** | **41 weeks (~10 months full-time)** | Similar total, redistributed for realism |

---

## Appendix C: Bug Fixes from Research Doc

### C.1 Recursive Ancestor CTE (Line 57-58)

**Bug:** `JOIN children c ON c.person_id = (SELECT id FROM ancestors)` -- the subquery `SELECT id FROM ancestors` returns all accumulated rows, causing a runtime error or incorrect results.

**Fix:** Replace with `c.person_id = a.id` -- join against the recursive reference alias.

See Section 2.3 for the corrected CTEs.

### C.2 Invalid media_links Schema (Line 48)

**Bug:** `media_links (media_id, person_id | family_id | event_id)` -- union column syntax is not valid SQL.

**Fix:** Replaced with three separate join tables: `media_persons`, `media_events`, `media_sources`.

See Section 2.2 for the corrected schema.

### C.3 Missing Schema Elements

The research doc's schema lacked:
- Constraints (NOT NULL, CHECK, FOREIGN KEY)
- Indexes (none defined)
- FTS5 for full-text search
- Audit trail
- Soft-delete support
- Structured name parts
- Place normalization
- Genealogical date handling

All addressed in Section 2.

---

## 5. FamilySearch API & Sync

### 5.1 Overview

FamilySearch provides the most comprehensive free genealogy API: 66 billion records, OAuth 2.0 authentication, and endpoints for genealogies, pedigree, search, records, memories, sources, and places (6M+ locations). This is the centerpiece external integration.

### 5.2 OAuth 2.0 PKCE Flow

FamilySearch uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for web applications.

```
┌──────────┐                              ┌────────────────┐
│  Browser  │                              │  FamilySearch  │
│           │  1. Click "Connect FS"       │  OAuth Server  │
│           │─────────────────────────────→ │                │
│           │  Authorization URL with       │                │
│           │  code_challenge (S256)        │                │
│           │                              │                │
│           │  2. User logs in & consents  │                │
│           │  ←─────────────────────────── │                │
│           │  Redirect with auth code     │                │
│           │                              │                │
│  Next.js  │  3. Exchange code + verifier │                │
│  Server   │─────────────────────────────→│                │
│           │  ←─────────────────────────── │                │
│           │  access_token + refresh_token │                │
└──────────┘                              └────────────────┘
```

```typescript
// apps/web/lib/familysearch/auth.ts

const FS_AUTH_URL = 'https://ident.familysearch.org/cis-web/oauth2/v3/authorization';
const FS_TOKEN_URL = 'https://ident.familysearch.org/cis-web/oauth2/v3/token';

export function generateAuthUrl(clientId: string, redirectUri: string): {
  url: string;
  codeVerifier: string;
} {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'openid profile email',
  });

  return {
    url: `${FS_AUTH_URL}?${params}`,
    codeVerifier,
  };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(FS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
```

### 5.3 API Client with Rate Limiting

FamilySearch limits usage to ~18 seconds of execution time per minute window per user.

```typescript
// apps/web/lib/familysearch/client.ts

export class FamilySearchClient {
  private accessToken: string;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://api.familysearch.org';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.rateLimiter = new RateLimiter({
      maxRequests: 30,     // Conservative: ~30 requests per minute
      windowMs: 60_000,
    });
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    if (response.status === 429) {
      // Rate limited — wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await sleep(retryAfter * 1000);
      return this.request(path, options);
    }

    if (response.status === 401) {
      // Token expired — attempt refresh
      await this.refreshToken();
      return this.request(path, options);
    }

    if (!response.ok) {
      throw new FamilySearchApiError(response.status, await response.text());
    }

    return response.json();
  }

  // === Person Operations ===

  async getPerson(personId: string): Promise<FSPerson> {
    return this.request(`/platform/tree/persons/${personId}`);
  }

  async getAncestry(personId: string, generations = 8): Promise<FSAncestry> {
    return this.request(
      `/platform/tree/ancestry?person=${personId}&generations=${generations}`
    );
  }

  async getDescendancy(personId: string, generations = 4): Promise<FSDescendancy> {
    return this.request(
      `/platform/tree/descendancy?person=${personId}&generations=${generations}`
    );
  }

  // === Search Operations ===

  async searchPersons(query: FSSearchQuery): Promise<FSSearchResult> {
    const params = buildSearchParams(query);
    return this.request(`/platform/tree/search?${params}`);
  }

  async searchRecords(query: FSSearchQuery): Promise<FSRecordSearchResult> {
    const params = buildSearchParams(query);
    return this.request(`/platform/search/records?${params}`);
  }

  // === Place Authority ===

  async searchPlaces(name: string): Promise<FSPlace[]> {
    return this.request(`/platform/places/search?name=${encodeURIComponent(name)}`);
  }

  async getPlace(placeId: string): Promise<FSPlace> {
    return this.request(`/platform/places/${placeId}`);
  }
}

// Rate limiter using token bucket algorithm
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.refillRate = maxRequests / windowMs;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = (1 - this.tokens) / this.refillRate;
      await sleep(waitMs);
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

### 5.4 Hints Engine

The "hints" system automatically finds potential record matches for each person in the tree — the feature that makes Ancestry worth $319/year.

```typescript
// apps/web/lib/familysearch/hints.ts

export interface Hint {
  personId: string;         // Local person ID
  externalId: string;       // FamilySearch record/person ID
  source: 'familysearch' | 'nara' | 'chronicling_america';
  matchScore: number;       // 0-1 probability
  recordType: string;       // 'census', 'vital', 'military', etc.
  summary: string;          // Human-readable summary
  externalData: object;     // Raw external record
}

export async function generateHintsForPerson(
  personId: string,
  db: DrizzleDatabase,
  fsClient: FamilySearchClient
): Promise<Hint[]> {
  // 1. Get person data from local database
  const person = await getPersonWithDetails(db, personId);
  if (!person || isPresumablyLiving(person)) return [];

  // 2. Build search queries from person data
  const queries = buildSearchQueries(person);

  // 3. Search FamilySearch records
  const results: Hint[] = [];
  for (const query of queries) {
    try {
      const searchResults = await fsClient.searchRecords(query);
      for (const entry of searchResults.entries.slice(0, 10)) {
        const score = calculateMatchScore(person, entry);
        if (score >= 0.5) {
          results.push({
            personId,
            externalId: entry.id,
            source: 'familysearch',
            matchScore: score,
            recordType: entry.content.gedcomx.recordType || 'unknown',
            summary: summarizeRecord(entry),
            externalData: entry,
          });
        }
      }
    } catch (e) {
      // Log and continue — one failed search shouldn't stop all hints
      console.warn(`Hint search failed for ${personId}:`, e);
    }
  }

  // 4. Deduplicate and sort by score
  return deduplicateHints(results).sort((a, b) => b.matchScore - a.matchScore);
}

function buildSearchQueries(person: PersonWithDetails): FSSearchQuery[] {
  const queries: FSSearchQuery[] = [];
  const primaryName = person.names.find(n => n.is_primary) || person.names[0];
  if (!primaryName) return queries;

  // Query 1: Name + birth date/place
  const birthEvent = person.events.find(e => e.event_type === 'birth');
  queries.push({
    givenName: primaryName.given_name,
    surname: primaryName.surname,
    birthDate: birthEvent?.date_original,
    birthPlace: birthEvent?.place?.name,
  });

  // Query 2: Name + death date/place (broader)
  const deathEvent = person.events.find(e => e.event_type === 'death');
  if (deathEvent) {
    queries.push({
      givenName: primaryName.given_name,
      surname: primaryName.surname,
      deathDate: deathEvent.date_original,
      deathPlace: deathEvent.place?.name,
    });
  }

  // Query 3: Surname + spouse surname (for marriage records)
  // ... additional query strategies

  return queries;
}
```

### 5.5 Sync Strategy

The biggest gap in the research doc. Here's the design:

#### Phase 2: Pull-Only Sync

```
FamilySearch (upstream) ──pull──→ Local SQLite (downstream)
                                 ↑ User edits locally
```

- **Direction:** One-way pull from FamilySearch into local database
- **Conflict model:** FamilySearch data creates `match_candidates` entries. User explicitly accepts or rejects each match. Accepted matches update local records.
- **No automatic overwrites:** FamilySearch data never automatically modifies local records
- **Sync metadata:** `fs_person_id` and `fs_last_sync` on the `persons` table track linkage

#### Phase 5: Bidirectional Sync (Future)

```
FamilySearch ←──push/pull──→ Local SQLite
              three-way merge with manual conflict resolution
```

- **Conflict resolution:** Three-way merge using last-sync snapshot as common ancestor
  - If only local changed: push to FamilySearch
  - If only remote changed: pull to local
  - If both changed same field: surface conflict for manual resolution
- **Sync log:** Every sync operation is logged in `change_log` for auditing

#### Offline Queue

When the app is used offline (PWA mode), mutations are queued:

```typescript
// apps/web/lib/sync/offline-queue.ts

interface QueuedMutation {
  id: string;
  timestamp: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  entityId: string;
  data: object;
  synced: boolean;
}

// Stored in IndexedDB when offline
// Replayed in order when connectivity returns
// Conflicts detected by comparing timestamps with server state
```

### 5.6 Caching Strategy

| Data Type | Cache Location | TTL | Invalidation |
|-----------|---------------|-----|--------------|
| Person details | React Query | 5 min | On edit |
| Search results | React Query | 1 min | On new search |
| Place authority | SQLite (places table) | 30 days | Manual refresh |
| FamilySearch records | `match_candidates` table | Permanent | Manual re-search |
| API tokens | Secure cookie / localStorage | Until expiry | On 401 response |

---

## 6. AI Research Assistant

### 6.1 Architecture

The AI research assistant uses the Vercel AI SDK with Claude's tool-calling capability to create an intelligent genealogy co-pilot that knows the user's tree and can query external sources.

```
┌─────────────────────────────────────────────┐
│              AI Chat Interface               │
│  ┌────────────────────────────────────────┐  │
│  │  User: "Find records for my           │  │
│  │         great-grandmother Maria"       │  │
│  └──────────────────┬─────────────────────┘  │
│                     │                        │
│  ┌──────────────────┴─────────────────────┐  │
│  │         Vercel AI SDK (streaming)      │  │
│  │                                        │  │
│  │  System prompt:                        │  │
│  │  - Tree context (summarized pedigree)  │  │
│  │  - Research methodology                │  │
│  │  - Available tools                     │  │
│  │                                        │  │
│  │  Tools:                                │  │
│  │  ├── searchLocalTree                   │  │
│  │  ├── searchFamilySearch                │  │
│  │  ├── searchNARA                        │  │
│  │  ├── searchNewspapers                  │  │
│  │  ├── computeRelationship              │  │
│  │  ├── analyzeTreeGaps                   │  │
│  │  ├── explainRecord                     │  │
│  │  ├── proposeRelationship               │  │
│  │  └── suggestNextSteps                  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 6.2 System Prompt

```typescript
// packages/ai/prompts/research-assistant.ts

export function buildSystemPrompt(treeContext: TreeContext): string {
  return `You are a genealogy research assistant with deep knowledge of historical records, research methodology, and the user's family tree.

## Your Family Tree Context
${treeContext.summary}

## Key People
${treeContext.keyPersons.map(p =>
  `- ${p.name} (${p.birthYear || '?'}–${p.deathYear || '?'}), ${p.birthPlace || 'unknown birthplace'}`
).join('\n')}

## Research Gaps
${treeContext.gaps.map(g => `- ${g}`).join('\n')}

## Guidelines
1. **Documents are the source of truth.** Always cite specific records. Never fabricate genealogical data.
2. **Be specific about uncertainty.** Say "this census record suggests..." not "your ancestor was..."
3. **Explain your reasoning.** When making connections, show the evidence chain.
4. **Suggest next steps.** After answering, recommend what records to search next.
5. **Consider historical context.** Name spelling variations, border changes, calendar differences.
6. **Privacy-aware.** Never share details about living persons.

## Available Tools
You have access to tools for searching the local tree database, FamilySearch records, NARA catalog, and Chronicling America newspapers. Use them proactively to answer questions with real data.

## Record Types You Can Search
- Census records (US: 1790-1950, UK: 1841-1921)
- Vital records (birth, marriage, death certificates)
- Immigration records (ship manifests, naturalization papers)
- Military records (draft cards, service records, pension files)
- Church records (baptism, marriage, burial)
- Newspaper articles (obituaries, announcements)
- Land and property records
- Probate records (wills, estate inventories)`;
}
```

### 6.3 Tool Definitions

```typescript
// packages/ai/tools/genealogy-tools.ts

import { tool } from 'ai';
import { z } from 'zod';

export const searchLocalTree = tool({
  description: 'Search the local family tree database for persons matching a query',
  parameters: z.object({
    givenName: z.string().optional().describe('Given/first name to search'),
    surname: z.string().optional().describe('Family/last name to search'),
    birthYear: z.number().optional().describe('Approximate birth year'),
    birthPlace: z.string().optional().describe('Birth place to search'),
    query: z.string().optional().describe('Free-text search across all fields'),
  }),
  execute: async ({ givenName, surname, birthYear, birthPlace, query }) => {
    // Search FTS index and exact matches
    // Return matching persons with their events and relationships
  },
});

export const searchFamilySearch = tool({
  description: 'Search FamilySearch.org records for historical records matching a person',
  parameters: z.object({
    givenName: z.string().describe('Given name'),
    surname: z.string().describe('Surname'),
    birthDate: z.string().optional().describe('Birth date (year or full date)'),
    birthPlace: z.string().optional().describe('Birth place'),
    deathDate: z.string().optional().describe('Death date'),
    deathPlace: z.string().optional().describe('Death place'),
    recordType: z.enum(['census', 'vital', 'military', 'immigration', 'church', 'any'])
      .default('any').describe('Type of record to search for'),
  }),
  execute: async (params) => {
    // Call FamilySearch API via our client
    // Return top 5 results with summaries
  },
});

export const searchNARA = tool({
  description: 'Search the US National Archives catalog for government records',
  parameters: z.object({
    query: z.string().describe('Search query'),
    resultType: z.enum(['all', 'item', 'fileUnit', 'series']).default('all'),
  }),
  execute: async ({ query, resultType }) => {
    // Call NARA Catalog API
  },
});

export const searchNewspapers = tool({
  description: 'Search Chronicling America for historical newspaper articles (1756-1963)',
  parameters: z.object({
    query: z.string().describe('Search terms (names, places, events)'),
    dateRange: z.object({
      start: z.string().optional().describe('Start date YYYY'),
      end: z.string().optional().describe('End date YYYY'),
    }).optional(),
    state: z.string().optional().describe('US state to filter by'),
  }),
  execute: async ({ query, dateRange, state }) => {
    // Call Chronicling America API (no key required)
    const params = new URLSearchParams({ terms: query, format: 'json' });
    if (dateRange?.start) params.set('dateFilterType', 'range');
    // ...
  },
});

export const computeRelationship = tool({
  description: 'Compute and explain the relationship between two people in the tree',
  parameters: z.object({
    person1Id: z.string().describe('First person ID'),
    person2Id: z.string().describe('Second person ID'),
  }),
  execute: async ({ person1Id, person2Id }) => {
    // Use the path-finding CTE from Section 2.3
    // Compute relationship label (e.g., "2nd cousin once removed")
  },
});

export const analyzeTreeGaps = tool({
  description: 'Analyze the family tree for research gaps and suggest priorities',
  parameters: z.object({
    personId: z.string().optional().describe('Focus on a specific person\'s line'),
    maxGenerations: z.number().default(5).describe('How many generations to analyze'),
  }),
  execute: async ({ personId, maxGenerations }) => {
    // Query ancestor tree to specified depth
    // Identify: missing birth/death dates, missing parents,
    // missing sources, dead ends with no further ancestors
    // Return prioritized list of gaps
  },
});

export const explainRecord = tool({
  description: 'Explain a historical record in context — what it means, what to look for',
  parameters: z.object({
    recordType: z.string().describe('Type of record (census, will, ship manifest, etc.)'),
    recordContent: z.string().describe('Text or summary of the record'),
    year: z.number().optional().describe('Year of the record'),
    location: z.string().optional().describe('Location of the record'),
  }),
  execute: async ({ recordType, recordContent, year, location }) => {
    // Return structured explanation with historical context
    return {
      explanation: '', // Claude will generate this based on the record
      historicalContext: '', // What was happening in that time/place
      relatedRecords: [], // What other records to look for
    };
  },
});

export const proposeRelationship = tool({
  description: 'Propose a relationship between two people based on discovered evidence. Creates a pending proposal for editor validation — does NOT directly modify the family tree.',
  parameters: z.object({
    person1Id: z.string().describe('First person ID (parent for parent-child)'),
    person2Id: z.string().describe('Second person ID (child for parent-child)'),
    relationshipType: z.enum(['parent_child', 'partner', 'sibling'])
      .describe('Type of relationship discovered'),
    evidence: z.string().describe('Summary of evidence supporting this relationship'),
    confidence: z.number().min(0).max(1).describe('Confidence level 0-1'),
    sourceRecordId: z.string().optional().describe('ID of the source record that supports this'),
  }),
  execute: async ({ person1Id, person2Id, relationshipType, evidence, confidence, sourceRecordId }) => {
    // Insert into proposed_relationships table
    // source_type = 'ai_suggestion'
    // source_detail = evidence summary + sourceRecordId
    // Notify editors via activity feed
    // Return the proposal ID and status
  },
});
```

### 6.4 Context Injection Strategy

Claude's context window has limits. For a large tree (1000+ persons), we can't send the entire database. Strategy:

```typescript
// packages/ai/context/tree-context.ts

export interface TreeContext {
  summary: string;           // 1-2 paragraph overview
  keyPersons: PersonSummary[];  // Max 50 persons (direct line + close relatives)
  gaps: string[];             // Top 10 research gaps
  recentActivity: string[];   // Last 5 research actions
  tokenBudget: number;        // Target ~2000 tokens for context
}

export async function buildTreeContext(
  db: DrizzleDatabase,
  focusPersonId?: string,
  tokenBudget = 2000
): Promise<TreeContext> {
  // 1. Get tree statistics
  const stats = await getTreeStats(db);

  // 2. Get direct line from focus person (or tree root)
  const rootId = focusPersonId || await findRootPerson(db);
  const directLine = await getAncestors(db, rootId, 5); // 5 generations

  // 3. Summarize
  const summary = `Family tree with ${stats.personCount} persons spanning ` +
    `${stats.generationCount} generations. Earliest ancestor: ` +
    `${stats.earliestAncestor?.name} (${stats.earliestAncestor?.birthYear}). ` +
    `${stats.sourcedPercentage}% of facts are sourced.`;

  // 4. Key persons (prioritize direct line, then close relatives)
  const keyPersons = directLine.slice(0, 50).map(p => ({
    id: p.id,
    name: `${p.given_name} ${p.surname}`,
    birthYear: p.birthYear,
    deathYear: p.deathYear,
    birthPlace: p.birthPlace,
    generation: p.generation,
  }));

  // 5. Identify gaps
  const gaps = await identifyResearchGaps(db, directLine);

  return { summary, keyPersons, gaps: gaps.slice(0, 10), recentActivity: [], tokenBudget };
}
```

### 6.5 Model Selection per Task

| Task | Model | Rationale |
|------|-------|-----------|
| Quick lookups ("when was X born?") | Claude Haiku | Fast, cheap, sufficient |
| Record explanation | Claude Sonnet | Good balance of quality/cost |
| Research planning | Claude Sonnet | Needs reasoning |
| Document analysis (OCR output) | Claude Sonnet | Needs entity extraction |
| Complex relationship analysis | Claude Opus | Highest quality reasoning |
| Biography generation | Claude Sonnet | Creative + factual |

### 6.6 Cost Tracking

```typescript
// packages/ai/context/cost-tracker.ts

export interface UsageRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  taskType: string;
}

const PRICING = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },     // per million tokens
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Budget alert: warn when monthly spend exceeds threshold
export async function checkBudget(db: DrizzleDatabase, monthlyLimitUsd = 10): Promise<{
  spent: number;
  remaining: number;
  overBudget: boolean;
}> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const records = await db.select()
    .from(usageTable)
    .where(gte(usageTable.timestamp, monthStart.toISOString()));

  const spent = records.reduce((sum, r) => sum + r.costUsd, 0);
  return { spent, remaining: monthlyLimitUsd - spent, overBudget: spent >= monthlyLimitUsd };
}
