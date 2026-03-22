# Ancstra — Development Roadmap

> **Living status tracker.** Updated as features complete. For detailed task breakdowns, see individual phase docs.
>
> Last updated: 2026-03-22

---

## Current Focus

> **Phase 1: Core Tree Builder — Named Layouts** — `[█████████░] 95% In Progress`
>
> Done: All CRUD, tree viz (iter 1+2), GEDCOM, sources, FTS5+Cmd+K, CI, PWA, sign-out — 111 tests
>
> Working on: Named layout management (DB persistence replacing localStorage)
>
> Next up: Phase 2 — AI features (FamilySearch integration, Claude-powered matching)
> Next up: CI pipeline, PWA, tree viz iteration 2

---

## Phase 0: UX/UI Design

> ~3 weeks | `[█████░░░░░] 50% In Progress`
> [Detailed plan](docs/phases/phase-0-design.md) | [Figma sprint plan](docs/design/figma-design-sprint.md)

### Design Artifacts (Markdown)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Competitive analysis | ~0.5w | `[██████████] 100% Complete` | — |
| Proto-personas | ~0.5w | `[██████████] 100% Complete` | — |
| User stories (Phase 1) | ~0.5w | `[██████████] 100% Complete` | Personas |
| Information architecture | ~0.5w | `[██████████] 100% Complete` | User stories |
| User flows | ~0.5w | `[██████████] 100% Complete` | IA |
| Design system | ~0.5w | `[██████████] 100% Complete` | IA |
| Component inventory | ~0.5w | `[██████████] 100% Complete` | Design system |
| UX roadmap (Phases 2-5) | ~0.5w | `[██████████] 100% Complete` | All above |

### Figma Deliverables (~10 working days)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| User flow diagrams in Figma (6 flows) | ~1d | `[░░░░░░░░░░] 0% Not Started` | Markdown flows |
| Design system in Figma (colors, type, 36 components) | ~1.5d | `[░░░░░░░░░░] 0% Not Started` | Markdown design system |
| Lo-fi wireframes — desktop (24 frames, 1280px) | ~1.5d | `[░░░░░░░░░░] 0% Not Started` | Flow diagrams, Design system |
| Lo-fi wireframes — mobile (11 frames, 375px) | ~1d | `[░░░░░░░░░░] 0% Not Started` | Desktop wireframes |
| Lo-fi wireframes — tablet (3 frames, 768px) | ~0.5d | `[░░░░░░░░░░] 0% Not Started` | Desktop wireframes |
| Hi-fi mockups — Tree View (hero) + Person Detail | ~1d | `[░░░░░░░░░░] 0% Not Started` | Lo-fi wireframes |
| Hi-fi mockups — Person Forms + GEDCOM Import | ~1d | `[░░░░░░░░░░] 0% Not Started` | Lo-fi wireframes |
| Hi-fi mockups — Dashboard + Search + Settings + Dark mode | ~1d | `[░░░░░░░░░░] 0% Not Started` | Lo-fi wireframes |
| Interactive prototypes (3 core flows) | ~0.5d | `[░░░░░░░░░░] 0% Not Started` | Hi-fi mockups |

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
- [ ] All Phase 1 screens have approved hi-fi mockups (24 desktop + 11 mobile + 3 tablet)
- [ ] Design system tokens in Figma (colors, typography, spacing, 36 component sets)
- [ ] 6 user flow diagrams with happy path + edge cases
- [ ] Dark mode variants for 4 key screens (tree, dashboard, detail, command palette)
- [ ] Empty/loading/error states for all screens
- [ ] 3 interactive prototypes (add person, GEDCOM import, search→detail)

---

## Phase 0.5: Technical Spikes

> ~1 week | `[████░░░░░░] 40% In Progress`
> [Detailed plan](docs/phases/phase-0.5-spikes.md)

### Spikes

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Turso/libsql driver swap validation | ~1d | `[██████████] 100% Complete` | — |
| React Flow rendering at 1K+ nodes | ~1d | `[░░░░░░░░░░] 0% Not Started` | — |
| Topola GEDCOM parser evaluation | ~1d | `[░░░░░░░░░░] 0% Not Started` | — |
| Closure table vs recursive CTE bench | ~1d | `[░░░░░░░░░░] 0% Not Started` | — |
| NextAuth.js v5 + Next.js 16 proxy | ~0.5d | `[██████████] 100% Complete` | — |

#### Exit Gate → Phase 1
- [ ] All spikes documented with findings
- [ ] No blocking technical risks identified (or mitigations planned)

---

## Phase 1: Core Tree Builder

> Weeks 1-8 (~8 weeks) | `[██░░░░░░░░] 15% In Progress`
> [Detailed plan](docs/phases/phase-1-core.md)

### Foundation (Week 1 — Complete)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Monorepo + Turborepo + pnpm | ~0.5w | `[██████████] 100% Complete` | — |
| Next.js 16 + Tailwind v4 + shadcn/ui | ~0.5w | `[██████████] 100% Complete` | Monorepo |
| Drizzle ORM + SQLite schema | ~1w | `[██████████] 100% Complete` | Monorepo |
| NextAuth.js v5 + sign-up | ~1w | `[██████████] 100% Complete` | Monorepo |
| App shell (sidebar + header) | — | `[██████████] 100% Complete` | Auth |
| Indigo Heritage dark theme | — | `[██████████] 100% Complete` | Tailwind v4 |
| Person create + detail (vertical slice) | — | `[██████████] 100% Complete` | Auth, Schema |
| Vitest + 13 tests (validation + integration) | — | `[██████████] 100% Complete` | CRUD API |
| Turso libsql driver swap validated | — | `[██████████] 100% Complete` | Schema |
| Closure table + person_summary | ~1w | `[░░░░░░░░░░] 0% Not Started` | Schema |
| FTS5 full-text search | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Schema |
| SQLite WAL + backup | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Schema |

### Person CRUD & Data Entry (Week 2 — Complete)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Person CRUD API routes (full) | ~1w | `[██████████] 100% Complete` | Schema, Auth |
| Person detail panel (with relationships) | ~1w | `[██████████] 100% Complete` | CRUD API |
| Person create form | ~1w | `[██████████] 100% Complete` | CRUD API |
| Person edit/update form + inline edit | ~0.5w | `[██████████] 100% Complete` | CRUD API |
| Person soft-delete | ~0.25w | `[██████████] 100% Complete` | CRUD API |
| Relationship linking UI | ~0.5w | `[██████████] 100% Complete` | Forms, Schema |
| Family CRUD + child link/unlink | ~1w | `[██████████] 100% Complete` | CRUD API |
| Event CRUD (any event type) | ~0.5w | `[██████████] 100% Complete` | CRUD API |
| Context-aware person creation | ~0.5w | `[██████████] 100% Complete` | Family CRUD |
| Person link popover (search+link) | ~0.25w | `[██████████] 100% Complete` | Search, Family |
| Person list page + dashboard | ~0.25w | `[██████████] 100% Complete` | CRUD API |
| Search filter (?q= LIKE) | ~0.25w | `[██████████] 100% Complete` | CRUD API |

### Tree Visualization (Iteration 1+2 Complete)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| React Flow canvas + dagre layout | ~1.5w | `[██████████] 100% Complete` | Schema, CRUD API |
| Custom PersonNode + edges | ~0.5w | `[██████████] 100% Complete` | Canvas |
| Floating toolbar + context menus | ~0.5w | `[██████████] 100% Complete` | Canvas |
| Detail panel (slide-out right) | ~0.5w | `[██████████] 100% Complete` | Canvas |
| Drag-from-palette (DraftPersonNode) | ~0.5w | `[██████████] 100% Complete` | Canvas |
| Edge drawing (relationships on canvas) | ~0.5w | `[██████████] 100% Complete` | Canvas |
| Search-to-focus (/tree?focus=) | ~0.25w | `[██████████] 100% Complete` | Canvas |
| Named layouts (DB persistence) | ~0.5w | `[░░░░░░░░░░] 0% Starting` | Canvas |
| Topola PDF/PNG/SVG export | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Canvas |
| Filter panel (sex, generation, living) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Canvas |

### GEDCOM (Complete)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| GEDCOM 5.5.1 parser (parse-gedcom) | ~0.5w | `[██████████] 100% Complete` | Schema |
| Import pipeline + wizard UI | ~1w | `[██████████] 100% Complete` | Parser |
| Living-person filter (import) | — | `[██████████] 100% Complete` | Parser |
| GEDCOM export engine | ~0.5w | `[██████████] 100% Complete` | Schema |
| Export UI + privacy modes (full/shareable) | ~0.25w | `[██████████] 100% Complete` | Export engine |
| GEDCOM source import (SOUR records) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Sources |

### Source/Citation Management (Complete)

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Sources + citations schema + migration | ~0.25w | `[██████████] 100% Complete` | — |
| Source CRUD API | ~0.5w | `[██████████] 100% Complete` | Schema |
| Citation CRUD API (polymorphic) | ~0.5w | `[██████████] 100% Complete` | Schema |
| Sources page (/sources) | ~0.25w | `[██████████] 100% Complete` | Source API |
| Citation form + list + detail integration | ~0.5w | `[██████████] 100% Complete` | Citation API |

### Search & Navigation

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| FTS5 search + Cmd+K command palette | ~1w | `[██████████] 100% Complete` | Schema |
| Filter UI (sex, generation, living) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | CRUD API |
| Breadcrumb + recent history | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Canvas |

### Quality & Infrastructure

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Vitest + Testing Library setup | ~0.5w | `[██████████] 100% Complete` | Monorepo |
| Unit + integration tests (111 tests) | ~1w | `[█████████░] 90% In Progress` | CRUD API, Parser |
| Performance baselines (bench suite) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Schema, Canvas |
| PWA setup (manifest, SW, offline) | ~0.5w | `[██████████] 100% Complete` | Monorepo |
| CI pipeline (GitHub Actions) | ~0.5w | `[██████████] 100% Complete` | Tests |
| Accessible tree list view | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Canvas |
| pino structured logging | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Monorepo |

#### Risks
- **GEDCOM dialect complexity** — Gramps, FamilySearch, Ancestry each have subtle vendor extensions
- **Living-person filter edge cases** — incorrect "living" status has privacy implications
- **Encoding issues** — non-UTF-8 GEDCOM files may corrupt data silently

#### Exit Gate → Phase 2
- [ ] Person CRUD integration tests pass
- [ ] GEDCOM import/export roundtrip with 3+ real vendor files
- [ ] React Flow renders 500+ person tree without visible lag
- [ ] Closure table queries < 5ms for 1K+ persons
- [ ] PWA installs and loads cached tree offline
- [ ] CI passes: lint, typecheck, test, build
- [ ] SQLite backup + restore tested
- [ ] Performance baselines documented
- [ ] Accessible list view works with keyboard

---

## Phase 2: AI Search & Matching

> Weeks 9-18 (~10 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-2-search.md)

### FamilySearch Integration

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| OAuth 2.0 PKCE flow | ~1w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 Auth |
| FamilySearch API client (rate limiter, retry) | ~1w | `[░░░░░░░░░░] 0% Not Started` | OAuth |
| Person & record search endpoints | ~1w | `[░░░░░░░░░░] 0% Not Started` | API client |
| Record linking + source creation | ~1w | `[░░░░░░░░░░] 0% Not Started` | Search, Schema |

### Record Matching Engine

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Jaro-Winkler name comparison | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | — |
| Date + place comparators | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | — |
| Composite scoring + blocking | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Comparators |
| Matching service (per-person + batch) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Scoring |

### Hints & Review

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Hints generation pipeline | ~1w | `[░░░░░░░░░░] 0% Not Started` | Matching, FS search |
| Hints review UI (cards, preview, accept/reject) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Hints pipeline |
| Relationship validation queue | ~1w | `[░░░░░░░░░░] 0% Not Started` | Hints |
| Editor decision flow + analytics | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Validation queue |

### AI Research Assistant

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Vercel AI SDK + Claude integration | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 complete |
| System prompt + tree context injection | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | AI SDK |
| Tool definitions (search, explain, propose) | ~1w | `[░░░░░░░░░░] 0% Not Started` | AI SDK, FS client |
| Chat UI with streaming + tool results | ~1w | `[░░░░░░░░░░] 0% Not Started` | Tools |

### External Data Sources

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| NARA Catalog API client | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | — |
| Chronicling America API client | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | — |
| Search UI widgets for NARA + newspapers | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | API clients |
| AI tool integration for external sources | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Tools, API clients |

#### Risks
- **FamilySearch rate limiting** — batch hint generation could trigger limits
- **Matching false positives** — Jaro-Winkler alone may miss edge cases (hyphenated names, nicknames)
- **AI tool calling failures** — malformed arguments or API errors break assistant
- **Scope creep with sources** — full citation management adds complexity

#### Exit Gate → Phase 3
- [ ] FamilySearch OAuth works end-to-end
- [ ] Matching engine >80% precision on test dataset
- [ ] AI assistant answers 5 predefined queries with correct tool calls
- [ ] Hints generated and displayed for 10+ persons
- [ ] Phase 1 performance baselines still pass

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

> Weeks 27-30 (~4 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-4-auth.md)

### Multi-User Auth

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Users/families/members DB tables | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 Schema |
| RBAC roles (owner, contributor, viewer) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Users table |
| Permission checking utilities | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | RBAC |
| Permission guards on all API routes | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Permissions |
| User management UI (list, edit roles, remove) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | RBAC |

### Collaboration

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Token-based invitation system | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Users table |
| Join page + onboarding flow | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Invitations |
| Contribution workflow (add/edit with attribution) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | RBAC |
| Contribution moderation queue (optional) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Contributions |
| Activity feed (who changed what, when) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Change log |

### OAuth Providers

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Google OAuth | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Auth system |
| Apple OAuth | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Auth system |
| Auth + collaboration E2E tests | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | All above |

#### Risks
- **Authentication complexity** — RBAC increases security surface
- **Living person exposure** — shared trees risk leaking living person data

#### Exit Gate → Phase 5
- [ ] Multi-user tested with 3+ concurrent users
- [ ] RBAC verified for all 3 core roles
- [ ] Invitation flow works end-to-end
- [ ] No privilege escalation possible
- [ ] Activity feed shows accurate history

---

## Phase 5: AI Polish & Export

> Weeks 31-33 (~3 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-5-polish.md)

### AI Features

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Biography generation prompts | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | AI SDK (Phase 2) |
| Biography API (streaming, caching) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Prompts |
| Biography UI (generate, edit, export) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Biography API |
| Historical context sidebar | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Biography API |

### Data Quality

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Quality metrics engine (completeness, sourcing) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 Schema |
| Data quality dashboard UI | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Metrics engine |
| Research gap recommendations | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Metrics |

### Export Enhancements

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| GEDCOM 7.0 export | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | GEDCOM 5.5.1 (Phase 1) |
| Narrative PDF export (pedigree + bios + photos) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Biography, Media |
| Photo book export | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Media (Phase 3) |

### Performance

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Query profiling + optimization pass | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | All phases |
| Image optimization (resize, thumbnails) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Media (Phase 3) |
| Web Vitals monitoring | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | — |

#### Risks
- **Biography quality** — Claude may produce bland or inaccurate narratives
- **Scope creep** — many "nice to have" features; follow MoSCoW strictly

#### Exit Gate → Phase 6
- [ ] Biography generation produces coherent narratives
- [ ] Data quality dashboard shows accurate metrics
- [ ] API < 500ms, page load < 3s
- [ ] At least one export format works correctly

---

## Phase 6: Deployment & Launch

> Weeks 34-36 (~3 weeks) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/phase-6-launch.md)

### Infrastructure

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Vercel deployment + custom domain | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | All phases |
| Turso production database + migrations | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Schema |
| Automated backup strategy (Turso snapshots) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Turso |
| Sentry error tracking | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Deployment |
| CI/CD pipeline (lint, typecheck, test, build, deploy) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Tests |

### Testing

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Playwright E2E tests (critical paths) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Deployment |
| Performance / load testing (10+ users, 1K+ persons) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Deployment |
| Security testing (auth boundaries, XSS, SQLi) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Auth (Phase 4) |
| Accessibility testing (NVDA/VO, keyboard, contrast) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | UI complete |

### Launch Prep

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| User documentation (getting started, walkthroughs, FAQ) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | All features |
| Privacy policy + terms of service | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | — |
| Welcome flow for new users | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Auth |
| Final bug fixes + polish (loading states, error messages, mobile) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | All |

#### Risks
- **Turso migration edge cases** — Drizzle driver swap may surface issues at scale
- **Performance at scale** — 1K+ persons + concurrent users may need optimization

#### Exit Gate → Phase 6.5
- [ ] App deployed and accessible at production URL
- [ ] All critical-path E2E tests pass
- [ ] API < 500ms, page load < 3s
- [ ] Security checklist completed
- [ ] Privacy policy published
- [ ] Error tracking active
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

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| face-api.js integration (@vladmandic fork) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Phase 3 Media |
| Face detection API + storage (bounding boxes, embeddings) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | face-api |
| Face tagging UI (click face -> assign person) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Detection API |
| Living-person face privacy filter | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Tagging |

### Module 2: Face Clustering & Auto-Matching

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Cosine similarity clustering algorithm | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Module 1 |
| Cluster management API (merge, split, label) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Clustering |
| Cluster gallery UI | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Cluster API |
| Auto-match suggestions (age estimation + tree) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Clusters |

### Module 3: Photo Restoration & Enhancement

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| GFPGAN face restoration + Real-ESRGAN upscaling | ~1w | `[░░░░░░░░░░] 0% Not Started` | Phase 3 Media |
| Enhancement API (restore, upscale, status) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Enhancement pipeline |
| Version tracking (original + enhanced) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Enhancement API |
| Before/after slider UI | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Version tracking |

### Module 4: Photo Colorization

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| DDColor integration | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Module 3 |
| Colorize API + version storage | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | DDColor |
| Colorization UI + disclaimer | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Colorize API |

---

## Post-Launch: DNA Analysis

> ~7-10 weeks total (4 independent modules) | `[░░░░░░░░░░] 0% Not Started`
> [Detailed plan](docs/phases/future-enhancements.md)

### Module 5: DNA File Parsing & Secure Storage

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| Provider parsers (23andMe, Ancestry, MyHeritage, FTDNA, VCF) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Phase 1 Schema |
| Encrypted SNP storage (dna_kits, dna_snps) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Parsers |
| Consent tracking + deletion audit trail | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Storage |
| Upload UI (drag-drop, format detection, consent) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Parsers |
| DNA CRUD API routes | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Storage |

### Module 6: Shared Segment Detection & Relationship Estimation

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| IBD detection algorithm (min 500K bp) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Module 5 |
| centiMorgan estimation + relationship lookup | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | IBD detection |
| Match storage (dna_matches, dna_segments) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | IBD detection |
| Matching API (compare kits, list matches) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Storage |

### Module 7: DNA-Tree Integration & Validation

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| DNA match-to-person linking + suggestions | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Module 6 |
| Relationship validation (DNA vs tree comparison) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Linking |
| DNA-tree dashboard (matches, conflicts) | ~0.5w | `[░░░░░░░░░░] 0% Not Started` | Validation |
| Conflict resolution workflow | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Dashboard |
| DNA validation report (PDF) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Validation |

### Module 8: Chromosome Browser

| Feature | ~Duration | Status | Depends On |
|---------|-----------|--------|------------|
| D3 chromosome visualization (23 bars + segments) | ~1w | `[░░░░░░░░░░] 0% Not Started` | Module 6 |
| Segment export (CSV, DNA Painter compatible) | ~0.25w | `[░░░░░░░░░░] 0% Not Started` | Visualization |

---

## Feature Dependency Chain

Key cross-phase dependencies (feature -> unlocks):

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
| 2026-03-22 | Roadmap created. Phase 0 design artifacts complete. All other phases Not Started. |
| 2026-03-22 | Phase 0 deep breakdown: added Figma deliverables table (10 working days), resolved 12 design decisions, expanded exit gate criteria. Figma sprint plan at docs/design/figma-design-sprint.md. |
