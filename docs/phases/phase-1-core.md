# Phase 1: Core Manual Tree Builder

> Weeks 1-8 | Started: TBD | Target: TBD

## Approach Change (2026-03-21)

Manual form-based data entry is now the **primary data source**, not GEDCOM import. Person CRUD forms are the highest priority feature (Week 2). GEDCOM import is kept but deprioritized to Week 7. Auth (NextAuth.js v5) moves to Week 1 alongside scaffolding. See the implementation plan for the full restructured week-by-week breakdown.

## Goals

- Deliver a working personal genealogy app with **manual data entry as the primary workflow**
- Establish the monorepo structure, database schema, authentication, and core data operations layer
- Build person CRUD forms with context-aware relationship creation ("Add Father/Spouse/Child")
- Build the foundational tree visualization and person detail UI components
- Include basic GEDCOM import as a secondary data path (deprioritized)
- Set up testing infrastructure and local development workflow
- Create a PWA-ready application for offline access to local tree data

## Systems in Scope

- [Architecture Overview](../architecture/overview.md)
- [Data Model](../architecture/data-model.md)
- [GEDCOM Import/Export](../specs/gedcom-import.md)
- [Tree Visualization](../specs/tree-visualization.md)

## Task Breakdown

### Week 1-2: Monorepo Scaffolding & Database Setup

**Goal:** Establish the foundational project structure and get the database layer working. Scaffold shared packages that will be used by both Next.js and the Hono worker (introduced in Phase 2 — see [Backend Architecture Spec](../superpowers/specs/2026-03-21-backend-architecture-design.md)).

- [ ] Initialize Turborepo with pnpm workspaces (`pnpm create turbo@latest`)
- [ ] Set up Next.js 16 app in `apps/web` with TypeScript, App Router, and `next.config.ts`
- [ ] Configure Tailwind CSS v4 and shadcn/ui (v3.5+) (install base components: Button, Card, Dialog, Dropdown, Tabs, Input)
  - [ ] Use CSS-first configuration (`@import "tailwindcss"` in CSS, no `tailwind.config.js`)
  - [ ] Use OKLCH color space (not HSL)
  - [ ] Zero-config content detection (no `content: [...]` array needed)
  - [ ] CLI: `npx shadcn@latest` (not `npx shadcn-ui@latest`)
- [ ] Set up ESLint, Prettier, and pre-commit hooks (husky) for code consistency
- [ ] Initialize `packages/db` for Drizzle ORM schema and migrations
  - [ ] Configure Drizzle with `better-sqlite3` for local dev and `@libsql/client` for web deployment
  - [ ] Set up `drizzle.config.ts` with both database drivers
  - [ ] Add database migration scripts to `package.json`
- [ ] Design and implement the core SQLite schema:
  - [ ] `persons` table: id, given_name, surname, sex, birth_date, birth_place, birth_place_raw, death_date, death_place, death_place_raw, is_living, privacy_level, notes, created_at, updated_at, soft_delete_at
  - [ ] `families` table: id, spouse1_id, spouse2_id, marriage_date, marriage_place, marriage_place_raw, divorce_date, created_at, updated_at
  - [ ] `children` table: id, family_id, person_id, child_order, created_at (links person to their biological family)
  - [ ] `events` table: id, person_id, event_type, date, place, place_raw, description, confidence, created_at, updated_at
  - [ ] `sources` table: id, title, author, repository, repository_url, citation_text, url, source_id (for FamilySearch linking), created_at, updated_at
  - [ ] `event_sources` junction: event_id, source_id
  - [ ] `media` table: id, file_path, mime_type, title, description, upload_date, created_at, updated_at
  - [ ] `media_persons`, `media_events`, `media_sources` junctions for polymorphic media linking
  - [ ] Add constraints: NOT NULL, FOREIGN KEY, CHECK (sex IN ('M', 'F', 'U')), CHECK (privacy_level IN ('public', 'private', 'living'))
  - [ ] Add indexes on: persons(surname, given_name), persons(birth_date), families(spouse1_id, spouse2_id), children(family_id, person_id)
  - [ ] Add compound indexes for performance: `events(person_id, date_sort)`, `children(person_id, family_id)`
  - [ ] Set up FTS5 virtual table on persons for full-text search: `persons_fts(given_name, surname, notes)`
- [ ] Add performance optimization tables (see [ADR-006](../architecture/decisions/006-closure-table.md)):
  - [ ] `ancestor_paths` closure table for pre-computed ancestor/descendant queries
  - [ ] `person_summary` denormalized display table for tree node rendering
  - [ ] `tree_layouts` table for React Flow canvas position persistence
  - [ ] Write closure table rebuild + incremental maintenance functions in `packages/db/queries/closure-table.ts`
  - [ ] Write person_summary rebuild function in `packages/db/queries/person-summary.ts`
- [ ] Create Drizzle schema definitions in TypeScript using the schema layer
- [ ] Write the initial database migration and test it locally
- [ ] Set up database initialization script to create tables from scratch
- [ ] Add `.env.example` with database connection strings
- [ ] Scaffold `packages/shared` for cross-app utilities:
  - [ ] `packages/shared/src/types/` — shared TypeScript types
  - [ ] `packages/shared/src/dates/` — genealogical date handling
  - [ ] `packages/shared/src/privacy/` — living-person filter logic
  - [ ] `packages/shared/src/auth/` — JWT verification utilities (used by both Next.js and Hono worker in Phase 2)
  - [ ] Barrel export in `packages/shared/src/index.ts`
- [ ] Scaffold `packages/jobs` stub for Phase 2 worker readiness:
  - [ ] `packages/jobs/src/types.ts` — Job, JobType, JobStatus type definitions
  - [ ] `packages/jobs/src/schema.ts` — Drizzle schema for `jobs` table (include in migration pipeline)
  - [ ] `packages/jobs/src/index.ts` — barrel export
  - [ ] Note: query implementations deferred to Phase 2 worker plan
- [ ] Add `WORKER_URL=http://localhost:3001` to `.env.example` (used by Phase 2 Hono worker)

### Week 2-3: Core CRUD API Routes & Authentication

**Goal:** Establish backend API endpoints and basic authentication.

- [ ] Set up NextAuth.js v5 in `apps/web/auth.ts`
  - [ ] Configure with a simple credentials provider for initial testing (email/password)
  - [ ] Add `NextAuthConfig` for session management
  - [ ] Create `proxy.ts` to protect routes (Next.js 16 uses `proxy()` instead of `middleware()`)
- [ ] Build API routes in `apps/web/app/api/`:
  - [ ] `POST /api/persons` - create a new person
  - [ ] `GET /api/persons` - list persons with pagination and FTS search
  - [ ] `GET /api/persons/[id]` - retrieve a single person with relationships (spouse, parents, children)
  - [ ] `PUT /api/persons/[id]` - update person details
  - [ ] `DELETE /api/persons/[id]` - soft-delete a person
  - [ ] `POST /api/families` - create a new family (marriage) record
  - [ ] `GET /api/families/[id]` - retrieve family with both spouses and all children
  - [ ] `PUT /api/families/[id]` - update family details
  - [ ] `POST /api/events` - add an event (birth, death, residence, etc.) to a person
  - [ ] `GET /api/persons/[id]/events` - list all events for a person
  - [ ] `PUT /api/events/[id]` - update an event
  - [ ] `POST /api/sources` - create a source citation
  - [ ] `POST /api/events/[id]/sources` - link a source to an event
- [ ] Add input validation using Zod schemas in `packages/lib/validation`
- [ ] Add error handling for consistent error responses
- [ ] Write integration tests for API routes using `vitest` and `supertest`
- [ ] Add rate limiting to APIs (basic in-memory or Redis-backed)

### Week 3-4: GEDCOM Parser & Import Pipeline

**Goal:** Implement complete GEDCOM 5.5.1 parsing and import with vendor dialect handling.

- [ ] Integrate Topola's GEDCOM parser:
  - [ ] Install `topola-viewer` and examine its parser source (`@topola/topola-viewer/lib/parse.ts` or equivalent)
  - [ ] Wrap Topola's parser with encoding detection (use `chardet` for non-UTF-8 files)
  - [ ] Handle vendor dialects:
    - [ ] Gramps vendor extensions (custom tags like `_MDNA`)
    - [ ] FamilySearch dialect variations
    - [ ] Legacy Ancestry.com GEDCOM formats
  - [ ] Build encoding detection pipeline:
    - [ ] Detect file encoding (UTF-8, ISO-8859-1, Windows-1252, etc.)
    - [ ] Re-encode if necessary before parsing
- [ ] Create GEDCOM import pipeline in `apps/web/lib/gedcom/import.ts`:
  - [ ] Parse GEDCOM file into a structured tree object
  - [ ] Map GEDCOM individuals (`INDI` records) to `persons` table
  - [ ] Map GEDCOM families (`FAM` records) to `families` and `children` tables
  - [ ] Extract events (BIRTH, DEATH, MARR, BURI, RESI, OCCU, etc.) into `events` table
  - [ ] Extract sources (SOUR records) and citations into `sources` and `event_sources`
  - [ ] Preserve place hierarchies (parse "City, County, State, Country" into structured place data)
  - [ ] Handle name variations (GIVN, SURN, NAME parsing)
- [ ] Implement living-person filter during import:
  - [ ] Any person with no DEAT record and born within 110 years → mark as `is_living = true`
  - [ ] Strip or obfuscate details for living persons in exports
- [ ] Build import UI in `apps/web/app/(auth)/import/`:
  - [ ] File upload component (drag-and-drop, file input)
  - [ ] Import progress indicator (file parsing, validation, database insert)
  - [ ] Conflict detection: warn if importing over existing tree (duplicate names, conflicting dates)
  - [ ] Summary page showing # of persons, families, events imported
- [ ] Add validation checks during import:
  - [ ] Detect circular parent-child relationships
  - [ ] Warn on impossible dates (death before birth)
  - [ ] Validate place formats
  - [ ] Test with real GEDCOM files from: Gramps, FamilySearch, Ancestry exports, Legacy Family Tree

### Week 4-5: GEDCOM Export & Living-Person Privacy

**Goal:** Enable users to export trees and protect living-person privacy.

- [ ] Build GEDCOM export engine in `apps/web/lib/gedcom/export.ts`:
  - [ ] Serialize persons, families, children, events, sources back to GEDCOM 5.5.1 format
  - [ ] Generate valid GEDCOM with proper HEAD, TRLR records
  - [ ] Assign unique XREF IDs (matching original if imported, or generating new)
  - [ ] Preserve vendor extensions if they came from original import
- [ ] Implement living-person filtering for export:
  - [ ] Option A: "Full tree (private)" — include all records, suitable for backup
  - [ ] Option B: "Shareable tree" — strip living persons and their direct parentage
  - [ ] Option C: "Ancestors only" — export only deceased ancestors (for sharing with genealogists)
  - [ ] Allow toggling which persons are marked as living
- [ ] Build export UI in `apps/web/app/(auth)/export/`:
  - [ ] Export format selector (GEDCOM 5.5.1, future GEDCOM 7.0)
  - [ ] Privacy mode selector with preview of what will be hidden
  - [ ] Download button that triggers file generation
- [ ] Add server action for export: `apps/web/app/actions/export-gedcom.ts`
  - [ ] Stream large files to prevent timeout
  - [ ] Add UTF-8 BOM for Windows compatibility
- [ ] Test export roundtrip: import GEDCOM → modify → export → reimport, verify data integrity

### Week 5-6: Tree Visualization with React Flow

**Goal:** Build an interactive work canvas for family trees using React Flow (@xyflow/react). See [ADR-005](../architecture/decisions/005-react-flow-viz.md).

- [ ] Install `@xyflow/react` and `@dagrejs/dagre`
- [ ] Create TreeCanvas component `apps/web/components/tree/TreeCanvas.tsx`:
  - [ ] React Flow canvas with `onlyRenderVisibleElements={true}`
  - [ ] Built-in `<MiniMap />`, `<Controls />`, `<Background variant="dots" />`
  - [ ] Accept tree data from `person_summary` table (single query, no JOINs)
  - [ ] Transform to React Flow nodes/edges format via `toReactFlowData()` adapter
- [ ] Create custom PersonNode component `apps/web/components/tree/PersonNode.tsx`:
  - [ ] Person card with photo, name, dates, sex indicator (blue/pink left border), completion bar
  - [ ] Uses shadcn/ui Avatar, handles living-person privacy ("Living" instead of name)
  - [ ] React Flow Handle components for edge connections (top=target, bottom=source)
- [ ] Create custom edge types:
  - [ ] `ParentChildEdge` — solid/dashed/dotted by validation status (confirmed/proposed/disputed)
  - [ ] `PartnerEdge` — horizontal connection between partners
- [ ] Implement dagre auto-layout:
  - [ ] Compute initial hierarchical positions (rankDir: 'TB', rankSep: 100, nodeSep: 50)
  - [ ] Position partners side-by-side, children below
- [ ] Implement position persistence:
  - [ ] Save node positions to `tree_layouts` table on drag (debounced 500ms)
  - [ ] Load saved positions on page load (manual positions override auto-layout)
  - [ ] Support multiple named layouts per tree
- [ ] Build tree view page `apps/web/app/(auth)/tree/page.tsx`:
  - [ ] Full-screen TreeCanvas with sidebar
  - [ ] Breadcrumb showing currently-focused person
  - [ ] Keyboard shortcuts (arrow keys to navigate, / to search)
- [ ] Implement sidebar:
  - [ ] PersonPalette — drag new persons onto canvas to create entries
  - [ ] SearchPanel — find and focus on specific person
  - [ ] FilterPanel — filter by generation, sex, living status
- [ ] Set up Topola for export only `apps/web/components/tree/TopolaWrapper.tsx`:
  - [ ] Generate PDF/PNG/SVG exports from tree data
  - [ ] Feed React Flow positions into Topola for consistent export
- [ ] Implement click-to-open-detail: clicking a person node opens their detail panel

### Week 5-6: Person Detail Panel & Edit UI

**Goal:** Build the person detail view and edit functionality.

- [ ] Create person detail component `apps/web/components/PersonDetail.tsx`:
  - [ ] Display all person fields: name, sex, birth/death dates and places, notes
  - [ ] Show all events chronologically (births, deaths, occupations, residences)
  - [ ] List attached sources with citations
  - [ ] Show family relationships: spouse(s), parents, children with links
  - [ ] Media gallery if photos/documents are attached
  - [ ] Living-person indicator and privacy notice
  - [ ] Edit button (toggle mode)
- [ ] Build person edit form `apps/web/app/(auth)/person/[id]/edit/page.tsx`:
  - [ ] Text inputs for given_name, surname
  - [ ] Select for sex (M/F/U)
  - [ ] Date pickers for birth_date, death_date
  - [ ] Place autocomplete for birth_place, death_place (autocomplete from existing places, or free-text)
  - [ ] Textarea for notes
  - [ ] Checkbox for is_living override
  - [ ] Add/edit events section (birth, death, occupation, residence, etc.)
    - [ ] Event date picker, place input, type selector, description textarea
    - [ ] Add/remove event buttons
  - [ ] Add/edit sources section
    - [ ] Link to existing source or create new
    - [ ] Citation text field
  - [ ] Save and Cancel buttons
- [ ] Create new person form `apps/web/app/(auth)/person/new/page.tsx`:
  - [ ] Same fields as edit, but empty
  - [ ] Option to create from inline form (minimal) or full form
- [ ] Add person detail modal variant for sidebar/panel display
- [ ] Implement relationship linking UI:
  - [ ] "Add spouse" button → search existing persons, select, create family record
  - [ ] "Add parent" button → search existing persons, select, create children record
  - [ ] "Add child" button → create new person or link existing
- [ ] Server actions for save operations in `apps/web/app/actions/persons.ts`
- [ ] Add optimistic updates using React Query or similar

### Week 6-7: Search, Filtering & Navigation

**Goal:** Make it easy to find and navigate between persons in the tree.

- [ ] Build full-text search with FTS5:
  - [ ] Search API route: `GET /api/search?q={query}` using FTS5 virtual table
  - [ ] Return ranked results (persons with given_name or surname matching)
- [ ] Create search UI component `apps/web/components/PersonSearch.tsx`:
  - [ ] Input field with typeahead
  - [ ] Display search results as dropdown
  - [ ] Click result to open person detail
- [ ] Build filter UI:
  - [ ] Filter by sex (M/F/U/All)
  - [ ] Filter by generation (distance from root person)
  - [ ] Filter by living status (show living, hide living, show all)
  - [ ] Combine filters: e.g., "show all male ancestors"
- [ ] Create breadcrumb navigation in tree view
- [ ] Implement recent persons history (localStorage)
- [ ] Add sidebar with tree outline (collapsible by generation)

### Week 7-8: Testing Infrastructure & PWA Setup

**Goal:** Establish testing patterns and make the app work offline.

- [ ] Set up testing framework:
  - [ ] Configure `vitest` for unit tests
  - [ ] Add `@testing-library/react` for component tests
  - [ ] Add `supertest` for API route testing
  - [ ] Create test directories mirroring source structure
  - [ ] Add GitHub Actions workflow for CI (runs tests on PR)
- [ ] Write unit tests:
  - [ ] GEDCOM parser tests (test with real GEDCOM files, various dialects)
  - [ ] Database schema tests (constraint validation, cascading deletes)
  - [ ] API route tests (CRUD operations, validation, errors)
- [ ] Write component tests:
  - [ ] PersonDetail component (render, edit mode, save)
  - [ ] TreeCanvas component (React Flow rendering, interaction, position persistence)
  - [ ] PersonSearch component (autocomplete, selection)
- [ ] Set up PWA:
  - [ ] Create `public/manifest.json` with app metadata
  - [ ] Configure `next.config.ts` for PWA (Next.js 16 has built-in service worker support)
  - [ ] Generate app icons (192x192, 512x512)
  - [ ] Add service worker to cache core app shell and allow offline tree browsing
  - [ ] Test offline: disable network in DevTools, verify tree loads and person data is accessible
- [ ] Document development workflow:
  - [ ] Local dev: `pnpm install && pnpm db:migrate && pnpm dev`
  - [ ] Testing: `pnpm test`
  - [ ] Building: `pnpm build`
  - [ ] Database operations: `pnpm db:seed`, `pnpm db:reset`
- [ ] Set up environment configuration:
  - [ ] Create `.env.example` with all required variables
  - [ ] Document for local SQLite vs. Turso (web) database
  - [ ] Add comments for each variable
- [ ] Create basic deployment guide:
  - [ ] Local: `next build && next start`
  - [ ] Vercel: push to GitHub, Vercel auto-deploys

### Cross-Cutting: Backup, Baselines, Analytics & Accessibility

**Goal:** Establish foundational cross-cutting concerns that are too important to defer to Phase 5.

**Backup & Recovery (integrate into Week 1-2):**
- [ ] Enable SQLite WAL mode for crash safety
- [ ] Implement automated timestamped backup of SQLite file (copy on app start + daily)
- [ ] Document: "How to back up and restore your Ancstra database"
- [ ] Frame GEDCOM export as a secondary backup mechanism

**Schema Migration Strategy (integrate into Week 1-2):**
- [ ] Document migration approach before writing first migration
- [ ] Use Drizzle Kit's sequential migration files
- [ ] Test: migration from empty database works cleanly
- [ ] Rule: every phase boundary includes "test migration with real data"

**Performance Baselines (integrate into Week 7-8):**
- [ ] Create vitest bench suite for core queries:
  - [ ] Closure table queries at 100, 500, 1K, 5K synthetic persons
  - [ ] Compare: recursive CTE vs closure table SELECT for ancestor/descendant/path queries
  - [ ] FTS5 search performance
  - [ ] GEDCOM import timing with/without pragma tuning and deferred indexes
- [ ] React Flow rendering benchmarks at 500, 1K, 5K nodes
- [ ] Add performance regression tests to CI pipeline
- [ ] Target: all tree queries under 5ms for 5K persons

**Basic Analytics Infrastructure (integrate into Week 1-2):**
- [ ] Set up pino for structured JSON logging
- [ ] Log key events: person created, GEDCOM imported, tree viewed, search performed
- [ ] No PII in logs -- use IDs, not names

**Accessibility (integrate into Week 5-6):**
- [ ] Add text-based alternative tree view (outline/list of ancestors/descendants)
- [ ] React Flow canvas is not fully accessible to screen readers -- the list view is the accessible fallback
- [ ] Verify keyboard navigation through person forms and navigation
- [ ] WCAG AA contrast verification on all core screens

---

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | Monorepo scaffolding, Drizzle/SQLite schema (incl. closure table + person_summary), Person CRUD (forms + API), NextAuth.js v5, Tree visualization (React Flow canvas), Person detail panel, Basic search (FTS5), SQLite WAL + backup, Schema migration strategy |
| **Should** | GEDCOM import (parser + UI), GEDCOM export, PWA foundation, CI/CD pipeline (GitHub Actions), Performance baselines, Accessibility (list tree view), Position persistence (tree_layouts) |
| **Could** | Multiple saved layouts, Keyboard shortcuts in tree view, Recent persons history, pino analytics logging |
| **Won't (this phase)** | Multi-user auth, FamilySearch API, AI features, Document upload |

---

## Documentation (write during this phase)

- [ ] README with local dev setup: `pnpm install && pnpm db:migrate && pnpm dev`
- [ ] Database schema documentation (auto-generated from Drizzle if possible)
- [ ] `.env.example` with all variables documented
- [ ] Development workflow guide (test, build, deploy locally)

---

## Exit Gate: Phase 1 to Phase 2

Before starting Phase 2, verify:
- [ ] All Person CRUD integration tests pass
- [ ] GEDCOM import/export roundtrip test passes with 3+ real-world files (different vendors)
- [ ] Tree visualization (React Flow) renders 500+ person tree without visible lag
- [ ] Closure table queries return results in <5ms for 1K+ persons
- [ ] PWA installs and loads cached tree data offline
- [ ] CI pipeline passes: lint, typecheck, test, build
- [ ] Personal tree imported and usable (dogfooding)
- [ ] SQLite backup mechanism works (backup + restore tested)
- [ ] Performance baselines established and documented
- [ ] Accessible tree list view works with keyboard
- [ ] Node drag-to-reposition persists across page reloads (tree_layouts)
- [ ] `packages/shared` exists with auth utilities and shared types
- [ ] `packages/jobs` exists with types and Drizzle schema (queries deferred to Phase 2 worker plan)
- [ ] `jobs` table migration is included in Drizzle migration pipeline

---

## Feedback Loop

After Phase 1 is complete:
- [ ] Share the app with 1-2 genealogy-interested friends or family members
- [ ] Screen-share session: watch them import a GEDCOM and navigate the tree
- [ ] Document: What confused them? Where did they get stuck? What delighted them?
- [ ] Incorporate critical UX findings before starting Phase 2

---

## Key Risks

1. **GEDCOM dialect complexity** — Gramps, FamilySearch, Ancestry, and Legacy each have subtle variations and vendor extensions. Testing against real-world files is critical. Mitigate: create a test suite of GEDCOM files from each source during Week 3-4 parsing phase.

2. **SQLite recursive CTE performance** — Mitigated by the closure table (`ancestor_paths`) which pre-computes ancestor/descendant pairs, eliminating recursive CTEs for common queries. See [ADR-006](../architecture/decisions/006-closure-table.md). Recursive CTEs kept as fallback for ad-hoc queries.

3. **Living-person filter logic** — Incorrect determination of "living" status has privacy implications. Edge cases include very old deaths with no date, adoption relationships, or data from different eras. Mitigate: implement conservative 110-year threshold; document assumptions; add admin override flag; audit periodically.

4. **Encoding issues during GEDCOM import** — Non-UTF-8 files (old Ancestry exports, European records) may fail silently or corrupt data. Mitigate: add robust encoding detection (chardet) and explicit re-encoding; test with non-UTF-8 files in Week 3-4.

## Decisions Made During This Phase

(Empty — filled during implementation)

## Retrospective

(Empty — filled at phase end)
