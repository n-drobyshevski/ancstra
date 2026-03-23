# Ancstra — Development Roadmap

> **Living status tracker.** Updated as features complete. For detailed task breakdowns, see individual phase docs.
>
> Last updated: 2026-03-23

---

## Current Focus

> **Phase 1 Complete** | **Phase 5: AI Polish & Export** — `[████████░░] 85% In Progress`
>
> Phase 1 closed: closure table, person_summary, WAL/backup, benchmarks, accessible table view, pino logging all done.
> Phase 5 remaining: GEDCOM 7.0 serializer, pagination, query timing logs.
> Phase 3 (Document/OCR) is the largest untouched block before launch.

---

## Phase 0: UX/UI Design

> ~3 weeks | `[███████░░░] 70% Complete`
> [Detailed plan](docs/phases/phase-0-design.md) | [Figma sprint plan](docs/design/figma-design-sprint.md)

### Design Artifacts (Markdown) — All Complete

| Feature | Status |
|---------|--------|
| Competitive analysis | `[██████████] 100% Complete` |
| Proto-personas | `[██████████] 100% Complete` |
| User stories (Phase 1) | `[██████████] 100% Complete` |
| Information architecture | `[██████████] 100% Complete` |
| User flows | `[██████████] 100% Complete` |
| Design system | `[██████████] 100% Complete` |
| Component inventory | `[██████████] 100% Complete` |
| UX roadmap (Phases 2-5) | `[██████████] 100% Complete` |

### Figma Deliverables — Skipped

> Decision (2026-03-22): Skip hi-fi Figma mockups. 42 lo-fi frames captured in Phase 0. Moving directly to code implementation informed by design system markdown + lo-fi wireframes.

### Design Decisions (Resolved 2026-03-22)

| # | Decision |
|---|----------|
| 1 | Tree view switching: instant re-render + 300ms fitView |
| 2 | Person edit: both inline (panel) + full edit page |
| 3 | Drag-to-create-edge: deferred to Phase 2 |
| 4 | Mobile tree: pan/zoom only, no node reposition |
| 5 | Empty states: icon + text only (no illustrations) |
| 6 | Cmd+K: search + actions (full command palette) |
| 7 | PersonNode: show avatar slot now (initials fallback) |
| 8 | Detail panel: resizable (drag edge, persist width) |
| 9 | Tablet sidebar: always show icon-only (64px) |
| 10 | GEDCOM import: show "no merge" notice when data exists |
| 11 | Settings: Privacy + Data + Theme only (no profile) |
| 12 | Tab order: Top bar → Sidebar → Toolbar → Canvas → Panel |

#### Exit Gate → Phase 0.5
- [x] All 8 design markdown artifacts complete and reviewed
- [x] 12 design decisions resolved
- [x] 42 lo-fi Figma frames captured (hi-fi skipped per decision)

---

## Phase 0.5: Technical Spikes

> ~1 week | `[████░░░░░░] 40% Complete`
> [Detailed plan](docs/phases/phase-0.5-spikes.md)

### Spikes

| Feature | Status |
|---------|--------|
| Turso/libsql driver swap validation | `[██████████] 100% Complete` |
| NextAuth.js v5 + Next.js 16 proxy | `[██████████] 100% Complete` |
| React Flow rendering at 1K+ nodes | `[░░░░░░░░░░] 0% Not Started` |
| Topola GEDCOM parser evaluation | `[░░░░░░░░░░] 0% Skipped` — used parse-gedcom instead |
| Closure table vs recursive CTE bench | `[░░░░░░░░░░] 0% Not Started` |

> Note: Remaining spikes were deprioritized — React Flow and parse-gedcom both proved viable during Phase 1 implementation. Closure table bench deferred to Phase 1 performance baselines.

---

## Phase 1: Core Tree Builder

> Weeks 1-8 (~8 weeks) | `[██████████] 100% Complete`
> [Detailed plan](docs/phases/phase-1-core.md)

### Foundation — Complete

| Feature | Status |
|---------|--------|
| Monorepo + Turborepo + pnpm | `[██████████] 100% Complete` |
| Next.js 16 + Tailwind v4 + shadcn/ui | `[██████████] 100% Complete` |
| Drizzle ORM + SQLite schema (family-schema, central-schema) | `[██████████] 100% Complete` |
| NextAuth.js v5 + sign-up | `[██████████] 100% Complete` |
| App shell (sidebar + header) | `[██████████] 100% Complete` |
| Indigo Heritage dark theme | `[██████████] 100% Complete` |
| Person create + detail (vertical slice) | `[██████████] 100% Complete` |
| Turso libsql driver swap validated | `[██████████] 100% Complete` |

### Person CRUD & Data Entry — Complete

| Feature | Status |
|---------|--------|
| Person CRUD API routes (full) | `[██████████] 100% Complete` |
| Person detail panel (with relationships) | `[██████████] 100% Complete` |
| Person create form | `[██████████] 100% Complete` |
| Person edit/update form + inline edit | `[██████████] 100% Complete` |
| Person soft-delete | `[██████████] 100% Complete` |
| Relationship linking UI | `[██████████] 100% Complete` |
| Family CRUD + child link/unlink | `[██████████] 100% Complete` |
| Event CRUD (any event type) | `[██████████] 100% Complete` |
| Context-aware person creation | `[██████████] 100% Complete` |
| Person link popover (search+link) | `[██████████] 100% Complete` |
| Person list page + dashboard | `[██████████] 100% Complete` |
| Search filter (?q= LIKE) | `[██████████] 100% Complete` |

### Tree Visualization — Complete

| Feature | Status |
|---------|--------|
| React Flow canvas + dagre layout | `[██████████] 100% Complete` |
| Custom PersonNode + edges (partner + parent-child) | `[██████████] 100% Complete` |
| Floating toolbar + context menus | `[██████████] 100% Complete` |
| Detail panel (slide-out right) | `[██████████] 100% Complete` |
| Drag-from-palette (DraftPersonNode) | `[██████████] 100% Complete` |
| Edge drawing (relationships on canvas) | `[██████████] 100% Complete` |
| Search-to-focus (/tree?focus=) | `[██████████] 100% Complete` |
| Named layouts (DB persistence) | `[██████████] 100% Complete` |
| Filter pills + multi-select | `[██████████] 100% Complete` |
| PNG/SVG/PDF export (html-to-image + jsPDF) | `[██████████] 100% Complete` |

### GEDCOM — Complete

| Feature | Status |
|---------|--------|
| GEDCOM 5.5.1 parser (parse-gedcom) | `[██████████] 100% Complete` |
| Import pipeline + wizard UI | `[██████████] 100% Complete` |
| Living-person filter (import) | `[██████████] 100% Complete` |
| GEDCOM export engine | `[██████████] 100% Complete` |
| Export UI + privacy modes (full/shareable) | `[██████████] 100% Complete` |
| GEDCOM source import (SOUR records) | `[░░░░░░░░░░] 0% Not Started` |

### Source/Citation Management — Complete

| Feature | Status |
|---------|--------|
| Sources + citations schema + migration | `[██████████] 100% Complete` |
| Source CRUD API | `[██████████] 100% Complete` |
| Citation CRUD API (polymorphic) | `[██████████] 100% Complete` |
| Sources page (/sources) | `[██████████] 100% Complete` |
| Citation form + list + detail integration | `[██████████] 100% Complete` |

### Search & Navigation

| Feature | Status |
|---------|--------|
| FTS5 search + Cmd+K command palette | `[██████████] 100% Complete` |
| Filter UI (sex, generation, living) | `[░░░░░░░░░░] 0% Not Started` |
| Breadcrumb + recent history | `[░░░░░░░░░░] 0% Not Started` |

### Quality & Infrastructure

| Feature | Status |
|---------|--------|
| Vitest + Testing Library setup | `[██████████] 100% Complete` |
| Unit + integration tests (46 test files across packages) | `[██████████] 100% Complete` |
| PWA setup (manifest, SW, offline) | `[██████████] 100% Complete` |
| CI pipeline (GitHub Actions) | `[██████████] 100% Complete` |
| Vercel deployment (live) | `[██████████] 100% Complete` |
| Closure table + person_summary | `[██████████] 100% Complete` |
| FTS5 full-text search engine | `[██████████] 100% Complete` |
| SQLite WAL + backup | `[██████████] 100% Complete` |
| Performance baselines (bench suite) | `[██████████] 100% Complete` |
| Accessible tree table view | `[██████████] 100% Complete` |
| pino structured logging | `[██████████] 100% Complete` |

#### Exit Gate → Phase 2
- [x] Person CRUD integration tests pass
- [ ] GEDCOM import/export roundtrip with 3+ real vendor files
- [x] React Flow renders 500+ person tree without visible lag
- [x] Closure table queries < 5ms for 1K+ persons (benchmarked: 84x faster than recursive CTE)
- [x] PWA installs and loads cached tree offline
- [x] CI passes: lint, typecheck, test, build
- [x] SQLite backup + restore tested
- [x] Performance baselines documented (vitest bench: closure table 84x faster than CTE, person_summary 6x faster)
- [x] Accessible table view works with keyboard

---

## Phase 2: AI Search, Research & Matching

> Weeks 9-20 (~12 weeks) | `[████████░░] 80% Complete`
> [Detailed plan](docs/phases/phase-2-search.md) | [Research workspace spec](docs/superpowers/specs/2026-03-22-research-workspace-design.md) | [Settings spec](docs/superpowers/specs/2026-03-22-settings-page-design.md)

### Multi-Source Search Engine (packages/research) — Complete

| Feature | Status |
|---------|--------|
| SearchProvider interface + registry | `[██████████] 100% Complete` |
| FamilySearch provider (OAuth + API client) | `[██████████] 100% Complete` |
| NARA Catalog provider | `[██████████] 100% Complete` |
| Chronicling America provider | `[██████████] 100% Complete` |
| FindAGrave provider (parser + scraper) | `[██████████] 100% Complete` |
| WikiTree provider | `[██████████] 100% Complete` |
| Web search provider (SearXNG / Brave) | `[██████████] 100% Complete` |
| Rate limiter (per-provider + per-domain) | `[██████████] 100% Complete` |
| Offline mock providers | `[██████████] 100% Complete` |
| Geneanet provider (scraper) | `[░░░░░░░░░░] 0% Not Started` |
| OpenArchives provider (OAI-PMH) | `[░░░░░░░░░░] 0% Not Started` |
| Unified search UI (federated results) | `[██████████] 100% Complete` |

### Web Scraping Engine (Hono Worker) — Complete

| Feature | Status |
|---------|--------|
| Hono worker app (apps/worker) | `[██████████] 100% Complete` |
| Playwright integration | `[██████████] 100% Complete` |
| URL scraper (text, metadata, screenshot) | `[██████████] 100% Complete` |
| Web archive storage (HTML + screenshot) | `[██████████] 100% Complete` |
| Batch scraping (URL queue, background job) | `[██████████] 100% Complete` |
| Rate limiting + robots.txt awareness | `[██████████] 100% Complete` |

### Research Items (Staging Area) — Complete

| Feature | Status |
|---------|--------|
| research_items + research_item_persons schema | `[██████████] 100% Complete` |
| Research item CRUD API routes | `[██████████] 100% Complete` |
| Save search result as research item | `[██████████] 100% Complete` |
| URL paste + extract (Playwright fetch) | `[██████████] 100% Complete` |
| Text paste + AI entity extraction | `[██████████] 100% Complete` |
| Status workflow (draft/promoted/dismissed) | `[██████████] 100% Complete` |
| Person tagging + bulk operations | `[██████████] 100% Complete` |

### Evidence Analysis Workspace — Partially Complete

| Feature | Status |
|---------|--------|
| Workspace page /research/person/[id] | `[██████████] 100% Complete` |
| Board tab (3-col: sources / matrix / detail) | `[██████████] 100% Complete` |
| Conflicts tab (dedicated conflict resolution) | `[██████████] 100% Complete` |
| Timeline tab (chronological events) | `[██████████] 100% Complete` |
| Canvas positions API | `[██████████] 100% Complete` |
| Matrix tab (full-width spreadsheet + conclusions) | `[░░░░░░░░░░] 0% Not Started` |
| Canvas tab (React Flow spatial canvas) | `[░░░░░░░░░░] 0% Not Started` |
| Proof Summary tab (GPS-style builder) | `[░░░░░░░░░░] 0% Not Started` |

### Fact Extraction & Conflict Detection — Complete

| Feature | Status |
|---------|--------|
| research_facts schema + migration | `[██████████] 100% Complete` |
| Manual fact entry | `[██████████] 100% Complete` |
| AI-assisted fact extraction | `[██████████] 100% Complete` |
| Conflict detection query + UI | `[██████████] 100% Complete` |
| Conflict resolution API | `[██████████] 100% Complete` |
| Fact confidence ratings | `[██████████] 100% Complete` |

### Source Promotion Workflow — Complete

| Feature | Status |
|---------|--------|
| One-click promote (research item → source) | `[██████████] 100% Complete` |
| AI citation generation | `[██████████] 100% Complete` |
| Fact carry-over to source_citations | `[██████████] 100% Complete` |

### Record Matching Engine (packages/matching) — Complete

| Feature | Status |
|---------|--------|
| Jaro-Winkler name comparison | `[██████████] 100% Complete` |
| Date + place comparators | `[██████████] 100% Complete` |
| Composite scoring + blocking | `[██████████] 100% Complete` |
| Hints generation + review UI | `[██████████] 100% Complete` |
| Matching API routes (/api/matching/hints) | `[██████████] 100% Complete` |

### AI Research Assistant (packages/ai) — Complete

| Feature | Status |
|---------|--------|
| Vercel AI SDK + Claude integration | `[██████████] 100% Complete` |
| System prompt + tree context injection | `[██████████] 100% Complete` |
| Core tools (searchLocalTree, searchFamilySearch, etc.) | `[██████████] 100% Complete` |
| Research tools (searchWeb, scrapeUrl, extractFacts) | `[██████████] 100% Complete` |
| Evidence tools (detectConflicts, analyzeTreeGaps, proposeRelationship) | `[██████████] 100% Complete` |
| Chat UI (/api/ai/chat) | `[██████████] 100% Complete` |
| Cost tracker | `[██████████] 100% Complete` |

### Settings Page — Complete

| Feature | Status |
|---------|--------|
| Settings shell + sidebar nav + mobile nav | `[██████████] 100% Complete` |
| Search Sources page (/settings/sources) | `[██████████] 100% Complete` |
| Provider config API routes + health checks | `[██████████] 100% Complete` |
| Appearance page (theme toggle) | `[██████████] 100% Complete` |
| Privacy page (living threshold, export) | `[██████████] 100% Complete` |
| Data page (backup, storage, cache mgmt) | `[██████████] 100% Complete` |
| AI settings page (/settings/ai) | `[██████████] 100% Complete` |
| Members page (/settings/members) | `[██████████] 100% Complete` |
| Mobile-responsive settings (all sub-pages) | `[██████████] 100% Complete` |

#### Remaining Phase 2 Items (5 items)
1. Geneanet provider (scraper-based)
2. OpenArchives provider (OAI-PMH)
3. Matrix tab (full-width spreadsheet + conclusions)
4. Canvas tab (React Flow spatial canvas for evidence)
5. Proof Summary tab (GPS-style builder)

#### Risks
- **FamilySearch rate limiting** — batch hint generation could trigger limits
- **Matching false positives** — Jaro-Winkler alone may miss edge cases (hyphenated names, nicknames)
- **Playwright on Railway** — headless Chromium uses significant RAM (~200-400MB)
- **Scraping legal/ethical** — respect robots.txt by default; some sites may block

#### Exit Gate → Phase 3
- [x] FamilySearch OAuth works end-to-end
- [x] At least 4 search providers functional (FS, NARA, Chronicling America, web search, FindAGrave, WikiTree)
- [x] Matching engine built with composite scoring
- [x] Research items: save, tag, promote, dismiss workflow works
- [x] Evidence workspace Board tab functional with fact matrix + conflict detection
- [x] AI assistant has tools for search, facts, conflicts
- [x] Playwright scrapes and archives a URL successfully

---

## Phase 3: Document Processing & OCR

> Weeks 19-25 (~7 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-3-documents.md)

### Media Management

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| File upload API (multipart, size limits) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 complete |
| Local file storage (UUID naming, subdirs) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Upload API |
| Media gallery UI (grid, lightbox, metadata) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Storage |
| Media detail page (zoom, rotate, download) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Gallery |
| Media linking to persons/events | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Gallery, CRUD API |
| EXIF/PDF metadata extraction | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Upload API |

### OCR Pipeline

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Image preprocessing (sharp: deskew, denoise, binarize) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Media storage |
| Tesseract.js integration (printed text) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Preprocessing |
| Transkribus API client (handwritten) | ~1w | `[░░░░░░░░░░] 0% Not Started` | — |
| OCR engine selector (printed vs handwritten) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Tesseract, Transkribus |
| OCR results storage + status tracking | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Tesseract |
| Multi-language support (en, de, fr, it, pl) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Tesseract |
| Transkribus credit tracking + warnings | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Transkribus |

### AI Entity Extraction

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Claude extraction prompts (names, dates, places, relationships) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | OCR pipeline |
| Extraction API + results storage | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Prompts |
| Entity review UI (highlight, confirm, edit) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Extraction API |
| Auto-linking extracted persons to tree | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Entity review, Matching engine |
| Auto source citation generation | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Auto-linking |

### Document Review

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Three-column review page (image / OCR / entities) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Entity review |
| Document library (filters, batch OCR, search) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Gallery, OCR |
| Person detail "Documents" tab | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Media linking |
| Document workflow status tracking | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | OCR, Extraction |

#### Risks
- **OCR accuracy on degraded documents** — old, faded, stained docs may produce poor results
- **Transkribus credit exhaustion** — free tier is 50-100 pages/month
- **Entity extraction ambiguity** — Claude may misinterpret relationships in OCR text
- **False auto-linking** — common names could match wrong tree person

#### Exit Gate → Phase 4
- [ ] OCR pipeline processes 10+ real documents with >70% text accuracy
- [ ] Entity extraction identifies names/dates in 80%+ of test documents
- [ ] Auto-linking suggests correct person in 70%+ of cases
- [ ] Source citation auto-generation produces valid citations
- [ ] Phase 1-2 performance baselines still pass

---

## Phase 4: Authentication & Collaboration

> Weeks 27-30 (4 weeks) | `[██████████] 100% Complete` — branch: feature/phase4-auth
> [Detailed plan](docs/phases/phase-4-auth.md) | [Spec](docs/superpowers/specs/2026-03-22-phase4-auth-collaboration-design.md)

### Auth Package (packages/auth/) — Complete

| Feature | Status |
|---------|--------|
| RBAC (Owner/Admin/Editor/Viewer) | `[██████████] 100% Complete` |
| NextAuth v5 custom adapter | `[██████████] 100% Complete` |
| Google + Apple OAuth | `[██████████] 100% Complete` |
| Family invitations (token-based) | `[██████████] 100% Complete` |
| Activity feed (cursor pagination) | `[██████████] 100% Complete` |
| Moderation queue (configurable) | `[██████████] 100% Complete` |
| Living person full redaction | `[██████████] 100% Complete` |
| Optimistic locking | `[██████████] 100% Complete` |
| Owner transfer | `[██████████] 100% Complete` |
| OAuth account linking | `[██████████] 100% Complete` |

### Multi-DB Architecture — Complete

| Feature | Status |
|---------|--------|
| Central DB (ancstra.sqlite) | `[██████████] 100% Complete` |
| Per-family DB (family-{id}.sqlite) | `[██████████] 100% Complete` |
| Migration script (single → multi-DB) | `[██████████] 100% Complete` |
| proxy.ts (Next.js 16 route auth) | `[██████████] 100% Complete` |

### Web Integration — Complete

| Feature | Status |
|---------|--------|
| All ~58 API routes retrofitted with RBAC | `[██████████] 100% Complete` |
| Members management page | `[██████████] 100% Complete` |
| Join page (invitation acceptance) | `[██████████] 100% Complete` |
| Activity feed page | `[██████████] 100% Complete` |
| OAuth buttons (login/signup) | `[██████████] 100% Complete` |
| Family picker + role badge | `[██████████] 100% Complete` |
| Moderation queue UI | `[██████████] 100% Complete` |
| Family creation flow | `[██████████] 100% Complete` |

---

## Phase 5: AI Polish & Export

> Weeks 31-33 (3 weeks) | `[████████░░] 85% Complete` — branch: feature/phase5-polish
> [Detailed plan](docs/phases/phase-5-polish.md) | [Spec](docs/superpowers/specs/2026-03-22-phase5-ai-polish-export-design.md)

### Data Quality Dashboard — Complete

| Feature | Status |
|---------|--------|
| Quality metrics queries (packages/db) | `[██████████] 100% Complete` |
| Quality API routes (/api/quality/summary, /api/quality/priorities) | `[██████████] 100% Complete` |
| Recharts dashboard UI (/analytics/quality) | `[██████████] 100% Complete` |

### AI Biography Generation — Complete

| Feature | Status |
|---------|--------|
| Biography prompt builder (packages/ai) | `[██████████] 100% Complete` |
| Biography API (/api/ai/biography — streaming + caching) | `[██████████] 100% Complete` |
| Biography tab on person detail | `[██████████] 100% Complete` |

### Historical Context Timeline — Complete

| Feature | Status |
|---------|--------|
| Context prompt builder (packages/ai) | `[██████████] 100% Complete` |
| Context API (/api/ai/historical-context) | `[██████████] 100% Complete` |
| Historical context on person detail | `[██████████] 100% Complete` |

### Export Features — Partially Complete

| Feature | Status |
|---------|--------|
| Gotenberg client (packages/export) | `[██████████] 100% Complete` |
| PDF templates (person + family) | `[██████████] 100% Complete` |
| PDF export API (/api/export/pdf) | `[██████████] 100% Complete` |
| GEDCOM 7.0 serializer | `[░░░░░░░░░░] 0% Not Started` |
| Export options UI (GEDCOM 7.0) | `[░░░░░░░░░░] 0% Not Started` |

### Performance & Infrastructure

| Feature | Status |
|---------|--------|
| AI budget hard limit + settings (/settings/ai, /api/ai/usage) | `[██████████] 100% Complete` |
| Pagination (sources, events) | `[░░░░░░░░░░] 0% Not Started` |
| Query timing logs | `[░░░░░░░░░░] 0% Not Started` |

#### Remaining Phase 5 Items (4 items)
1. GEDCOM 7.0 serializer
2. Export options UI for GEDCOM 7.0
3. Pagination on sources/events lists
4. Query timing logs

#### Exit Gate → Phase 6
- [x] Biography generation produces coherent narratives
- [x] Data quality dashboard shows accurate metrics
- [ ] API < 500ms, page load < 3s
- [x] PDF export works correctly
- [ ] GEDCOM 7.0 export works

---

## Phase 6: Deployment & Launch

> Weeks 34-36 (~3 weeks) | `[███████░░░] 70% Complete` — branch: feature/phase6-launch
> [Detailed plan](docs/phases/phase-6-launch.md)

### Infrastructure

| Feature | Status |
|---------|--------|
| Vercel deployment + custom domain | `[██████████] 100% Complete` |
| Turso production database + provisioning API | `[██████████] 100% Complete` |
| Sentry error + performance monitoring | `[██████████] 100% Complete` |
| CI/CD pipeline (lint, typecheck, test, build, deploy) | `[██████████] 100% Complete` |
| Automated backup strategy (Turso snapshots) | `[░░░░░░░░░░] 0% Not Started` |

### Testing

| Feature | Status |
|---------|--------|
| Playwright E2E tests (critical paths) | `[██████████] 100% Complete` |
| Security testing (auth boundaries, checklist) | `[██████████] 100% Complete` |
| Performance / load testing (10+ users, 1K+ persons) | `[░░░░░░░░░░] 0% Not Started` |
| Accessibility testing (NVDA/VO, keyboard, contrast) | `[░░░░░░░░░░] 0% Not Started` |

### Launch Prep

| Feature | Status |
|---------|--------|
| User documentation (Nextra docs site) | `[██████████] 100% Complete` |
| Welcome flow for new users | `[██████████] 100% Complete` |
| Error messages utility | `[██████████] 100% Complete` |
| Privacy policy + terms of service | `[░░░░░░░░░░] 0% Not Started` |
| Final bug fixes + polish (loading states, error messages, mobile) | `[███░░░░░░░] 30% In Progress` |

#### Remaining Phase 6 Items (4 items)
1. Automated Turso backup strategy
2. Performance / load testing
3. Accessibility testing
4. Privacy policy + terms of service

#### Exit Gate → Phase 6.5
- [x] App deployed and accessible at production URL
- [x] Critical-path E2E tests pass
- [ ] API < 500ms, page load < 3s
- [x] Security checklist completed
- [ ] Privacy policy published
- [x] Error tracking active (Sentry)
- [ ] Backup/restore tested

---

## Phase 6.5: Beta Period

> Weeks 37-38 (~2 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-6.5-beta.md)

### Beta Program

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Recruit 3-5 beta testers | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Deployment |
| Beta onboarding guide + structured test tasks | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Docs |
| Feedback collection setup (issues, forms) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | — |
| Week 1: testing + bug triage | ~1w | `[░░░░░░░░░░] 0% Not Started` | Testers onboarded |
| Week 2: critical/high bug fixes + UX friction fixes | ~1w | `[░░░░░░░░░░] 0% Not Started` | Triage |
| Documentation updates from beta feedback | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Feedback |

#### Exit Gate → Public Launch
- [ ] All critical bugs from beta fixed
- [ ] No blocking UX issues (all testers complete core tasks)
- [ ] Beta tester satisfaction >= 7/10 average
- [ ] Sentry error rate stable
- [ ] Launch decision made: launch / extend beta / pivot

---

## Post-Launch: Photo Intelligence

> ~7-8 weeks total (4 independent modules) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/future-enhancements.md)

### Module 1: Face Detection & Tagging

| Feature | ~Duration | Status |
|---------|-----------|--------|
| face-api.js integration (@vladmandic fork) | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| Face detection API + storage | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Face tagging UI (click face -> assign person) | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| Living-person face privacy filter | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |

### Module 2: Face Clustering & Auto-Matching

| Feature | ~Duration | Status |
|---------|-----------|--------|
| Cosine similarity clustering | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Cluster management API | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Cluster gallery UI | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Auto-match suggestions | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |

### Module 3: Photo Restoration & Enhancement

| Feature | ~Duration | Status |
|---------|-----------|--------|
| GFPGAN + Real-ESRGAN | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| Enhancement API | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Version tracking | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |
| Before/after slider UI | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |

### Module 4: Photo Colorization

| Feature | ~Duration | Status |
|---------|-----------|--------|
| DDColor integration | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Colorize API + version storage | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |
| Colorization UI + disclaimer | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |

---

## Post-Launch: DNA Analysis

> ~7-10 weeks total (4 independent modules) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/future-enhancements.md)

### Module 5: DNA File Parsing & Secure Storage

| Feature | ~Duration | Status |
|---------|-----------|--------|
| Provider parsers (23andMe, Ancestry, MyHeritage, FTDNA, VCF) | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| Encrypted SNP storage | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Consent tracking + deletion audit trail | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Upload UI (drag-drop, format detection, consent) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| DNA CRUD API routes | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |

### Module 6: Shared Segment Detection & Relationship Estimation

| Feature | ~Duration | Status |
|---------|-----------|--------|
| IBD detection algorithm (min 500K bp) | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| centiMorgan estimation + relationship lookup | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Match storage | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |
| Matching API | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |

### Module 7: DNA-Tree Integration & Validation

| Feature | ~Duration | Status |
|---------|-----------|--------|
| DNA match-to-person linking + suggestions | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Relationship validation (DNA vs tree) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| DNA-tree dashboard | ~0.5w | `[░░░░░░░░░░] 0% Not Started` |
| Conflict resolution workflow | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |
| DNA validation report (PDF) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |

### Module 8: Chromosome Browser

| Feature | ~Duration | Status |
|---------|-----------|--------|
| D3 chromosome visualization | ~1w | `[░░░░░░░░░░] 0% Not Started` |
| Segment export (CSV, DNA Painter compatible) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` |

---

## Codebase Summary

### Packages (8)

| Package | Purpose | Tests |
|---------|---------|-------|
| `packages/db` | Drizzle ORM schemas, closure table, person_summary, backup | 5 test files |
| `packages/shared` | Shared types, date handling, privacy filters, pino logging | — |
| `packages/auth` | RBAC, NextAuth adapter, invitations, privacy, moderation | 9 test files |
| `packages/research` | Search providers, scraper, rate limiter, archiver, facts, conflicts | 17 test files |
| `packages/matching` | Jaro-Winkler, date/place compare, composite scorer, hints | 6 test files |
| `packages/ai` | Claude tools, prompts (biography, historical context, research) | 10 test files |
| `packages/export` | Gotenberg PDF client, templates | 1 test file |
| `apps/worker` | Hono worker (Playwright scraper, batch jobs) | 3 test files |

### Apps (2)

| App | Description | Route count |
|-----|-------------|-------------|
| `apps/web` | Next.js 16 main app | ~58 API routes, 12 page groups |
| `apps/worker` | Hono background worker | 2 routes (health, scrape) |

### Active Worktrees

None — all worktrees cleaned up (2026-03-23). All branches merged to master.

---

## Feature Dependency Chain

```
Monorepo --> Schema --> CRUD API --> React Flow Canvas
                |                         |
                |-> FTS5 Search           |-> Position Persistence
                |-> GEDCOM Parser         |-> Accessible List View
                |-> Auth (NextAuth)       |
                |                         |
                +-> Closure Table --------+

Phase 1 Complete --> FamilySearch OAuth --> FS Search --> Hints Pipeline
                 |                                            |
                 |-> AI SDK --> Tools --> Chat UI              |
                 |                   |                        |
                 |                   +-> NARA + Chronicling   |
                 |                                            |
                 +-> Matching Engine ---+--------------------+

Phase 3 Media --> OCR Pipeline --> Entity Extraction --> Auto-Linking
            |
            |-> Face Detection (post-launch) --> Face Clustering
            +-> Photo Restoration (post-launch)

Module 5: DNA Parsing --> Module 6: Segments --> Module 7: Tree Integration
                                           +--> Module 8: Chromosome Browser
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-22 | Roadmap created. Phase 0 design artifacts complete. |
| 2026-03-22 | Phase 0 deep breakdown: Figma deliverables, 12 design decisions, exit gates. |
| 2026-03-23 | **Major update**: Roadmap fully reconciled with actual codebase state. Phase 1 updated to 90% (was 15%). Phase 2 items updated from 0% to actual status (~80% complete). Phase 5 updated to 85% (was 10%). Phase 6 updated to 70% (was 0%). Added codebase summary section with package/test breakdown. Added worktree tracking. Corrected test count and API route count. |
| 2026-03-23 | **Phase 1 complete**: All 6 remaining items implemented — closure table (84x faster than CTE), person_summary (6x faster tree loading), WAL/backup, benchmarks, accessible tree table view, pino logging. Stale worktrees cleaned up. |
