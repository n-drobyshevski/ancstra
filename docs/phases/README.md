# Ancstra Project Phases

Complete implementation roadmap for the AI-powered genealogy app (~44.5 weeks total).

## Overview

| Phase | Duration | Focus | Deliverable |
|-------|----------|-------|-------------|
| [Phase 0: UX/UI Design](phase-0-design.md) | ~3 weeks | Design system, Figma mockups, personas, user flows | All Phase 1 screens have approved hi-fi mockups |
| [Phase 0.5: Technical Spikes](phase-0.5-spikes.md) | 1 week | Validate high-risk technical assumptions | Spike results documented, blockers resolved |
| *Buffer* | 0.5 weeks | Retrospective, rest | |
| [Phase 1: Core Tree Builder](phase-1-core.md) | 8 weeks | Data model, tree visualization, GEDCOM, PWA, backup, baselines | Working personal genealogy app |
| *Buffer* | 1 week | Retrospective, tech debt, rest | |
| [Phase 2: AI Search & Matching](phase-2-search.md) | 10 weeks | FamilySearch API, matching, AI research assistant | Auto-discovery of records across free databases |
| *Buffer* | 1 week | Retrospective, tech debt, rest | |
| [Phase 3: Document Processing & OCR](phase-3-documents.md) | 7 weeks | Document upload, OCR, AI entity extraction | Upload -> OCR -> extraction -> auto-linking pipeline |
| *Buffer* | 1 week | Retrospective, tech debt, rest | |
| [Phase 4: Auth & Collaboration](phase-4-auth.md) | 4 weeks | Multi-user RBAC, invitations, contribution workflow | Family collaboration working |
| [Phase 5: AI Polish & Export](phase-5-polish.md) | 3 weeks | Biographies, data quality, GEDCOM 7.0, PDF export | AI features polished, exports working |
| [Phase 6: Deployment & Launch](phase-6-launch.md) | 3 weeks | Vercel + Turso, testing, documentation, polish | Production-ready deployed app |
| [Phase 6.5: Beta Period](phase-6.5-beta.md) | 2 weeks | Structured beta with real genealogists | Critical bugs fixed, UX validated |

**Total: ~44.5 weeks (~11 months full-time)** -- includes buffer weeks for sustainability and a structured beta period.

**Post-launch:** [Photos & DNA](future-enhancements.md) -- 8 independent modules (~16-19 weeks), shipped incrementally based on user demand.

## Phase Descriptions

### Phase 0: UX/UI Design (~3 weeks, pre-Phase 1)

**Location:** `phase-0-design.md`

Design-first phase producing all UX/UI artifacts before coding begins. Includes competitive analysis, proto-personas, user flows, design system, Figma mockups, and UX roadmap for future phases. Also: register for FamilySearch developer access early.

### Phase 0.5: Technical Spikes (1 week)

**Location:** `phase-0.5-spikes.md`

Validate high-risk technical assumptions: family-chart rendering at scale, Topola GEDCOM parser with real vendor files, Drizzle driver swap (better-sqlite3 to Turso), Claude tool calling patterns, SQLite recursive CTE performance.

### Phase 1: Core Tree Builder (8 weeks)

**Location:** `phase-1-core.md`

Establish the foundational app. Manual person entry is the primary workflow. Includes: monorepo setup, SQLite schema, Person CRUD, NextAuth.js v5, GEDCOM import/export, tree visualization, search, testing, PWA, plus cross-cutting concerns: backup/recovery, performance baselines, schema migration strategy, basic analytics, accessibility.

**Deliverable:** A functional personal genealogy app you can use immediately.

### Phase 2: AI Search & Matching (10 weeks)

**Location:** `phase-2-search.md`

Connect to free genealogy records. FamilySearch OAuth + API, probabilistic matching engine, hints system, Claude AI research assistant with tool calling, NARA and Chronicling America integration.

**Deliverable:** AI-powered research assistant that discovers matching records across free databases.

### Phase 3: Document Processing & OCR (7 weeks)

**Location:** `phase-3-documents.md`

Turn physical archives into searchable records. File upload, Tesseract.js OCR, Transkribus for handwriting, Claude entity extraction, auto-linking to tree, source citation generation.

**Deliverable:** Upload a document -> OCR -> extract names/dates -> link to tree -> create source.

### Phase 4: Auth & Collaboration (4 weeks)

**Location:** `phase-4-auth.md`

Multi-user authentication and family sharing. NextAuth.js RBAC, invitation flow, contribution workflow with moderation, activity feed, Google/Apple OAuth.

### Phase 5: AI Polish & Export (3 weeks)

**Location:** `phase-5-polish.md`

AI biography generation, data quality dashboard, performance optimization, GEDCOM 7.0 export, narrative PDF export.

### Phase 6: Deployment & Launch (3 weeks)

**Location:** `phase-6-launch.md`

Vercel + Turso deployment, comprehensive testing (E2E, performance, security, accessibility), documentation, privacy policy, final polish.

### Phase 6.5: Beta Period (2 weeks)

**Location:** `phase-6.5-beta.md`

Structured beta with 3-5 real genealogists. Structured test tasks, feedback collection, bug fixes, iteration.

**Deliverable:** Production-ready app validated by real users.

### Post-Launch: Photos & DNA (Future Enhancements)

**Location:** `future-enhancements.md`

8 independent modules shipped incrementally after launch:
- **Photo Intelligence:** Face detection, face clustering, photo restoration, colorization
- **DNA Analysis:** File parsing + encrypted storage, shared segment detection, DNA-tree validation, chromosome browser

Each module is 1-3 weeks and adds independent value. Prioritize based on user feedback.

## How to Use These Docs

1. **Current Phase:** Start with [Phase 0: UX/UI Design](phase-0-design.md), then [Phase 0.5: Technical Spikes](phase-0.5-spikes.md), then [Phase 1](phase-1-core.md).
2. **Planning:** Each phase has:
   - Goals (what "done" looks like)
   - Systems in Scope (links to detailed spec sections)
   - Task Breakdown (week-by-week tasks with checkboxes)
   - MoSCoW Prioritization (Must / Should / Could / Won't)
   - Exit Gate (explicit criteria to move to next phase)
   - Feedback Loop (how to validate with real users)
   - Documentation (what to write during this phase)
   - Key Risks (and mitigations)
   - Decisions Made (filled during execution)
   - Retrospective (filled at phase end)
3. **Tracking:** Check off tasks as you complete them. Use the decision/retrospective sections to capture context for future phases.
4. **Dependencies:** Each phase depends on the previous ones. Don't skip phases or do them out of order.
5. **Buffer weeks:** Use for retrospectives, tech debt cleanup, dependency updates, and rest. If a phase finishes on time, use the buffer for early planning of the next phase.
6. **When behind schedule:** Use MoSCoW to decide what to cut. Cut "Could" items first, then "Should" items. Never cut "Must" items -- if "Must" items can't be completed, extend the phase.

## Key Success Metrics

- **Timeline:** Ship Phase 1 in 8 weeks; full project in ~44.5 weeks (~11 months)
- **Quality:** >90% test coverage on critical paths (GEDCOM, matching, encryption)
- **Performance:** All API endpoints respond in <500ms for typical data
- **Privacy:** Living person filter confirmed, GDPR-compliant
- **Usability:** App is intuitive enough for non-technical family members (validated in beta)
- **Sustainability:** Buffer weeks used, retrospectives completed, no burnout

## Retrospective Template

At the end of each phase (during buffer week), answer these questions:

1. **What went well?** What worked, what should we keep doing?
2. **What took longer than expected?** Why? What can we learn?
3. **What should we do differently next phase?**
4. **What technical debt did we accumulate?** Add to TECH_DEBT.md.
5. **Are the remaining phase estimates still realistic?** Adjust if needed.
6. **What risks materialized? What new risks emerged?**

Schedule: 0.5-1 day at the end of each phase, before starting the next.

## Technical Debt Management

- Maintain a `TECH_DEBT.md` file in the repo root
- At each retrospective, review and prioritize debt items
- Allocate 10-15% of each phase's time to debt reduction
- Use buffer weeks for larger debt items
- Categories: code quality, performance, testing gaps, dependency updates, documentation

## Tech Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 16 (App Router) + React 19 | Server components for full-stack efficiency, Turbopack default |
| **Styling** | Tailwind CSS v4 + shadcn/ui (v3.5+) | CSS-first config, OKLCH colors, no lock-in |
| **Database** | SQLite (better-sqlite3) → Turso (web) | Zero-cost, full data portability |
| **ORM** | Drizzle ORM | Abstracts both database drivers |
| **Tree Visualization** | family-chart + Topola | Interactive + GEDCOM-native |
| **AI** | Claude API + Vercel AI SDK | Streaming, tool calling, document analysis |
| **OCR** | Tesseract.js + Transkribus API | Printed + handwritten support |
| **Face Recognition** | face-api.js / DeepFace | Post-launch: face detection, clustering |
| **Testing** | vitest + @testing-library | Fast unit/component tests |
| **Deployment** | Vercel + Turso | Serverless, edge SQL, $0/month |

## Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│           Browser / PWA                              │
│  Tree | Research | Documents | Collaboration        │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / Server Actions
┌────────────────────┴─────────────────────────────────┐
│         Next.js 16 (App Router)                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  /api/persons  /api/search  /api/media       │   │
│  │  /api/ai  /api/familysearch  /api/users      │   │
│  └──────────┬─────────────────┬──────────────────┘   │
│             │                 │                      │
│  ┌──────────▼──┐    ┌─────────▼──────┐             │
│  │ Drizzle ORM │    │ Vercel AI SDK  │             │
│  │ (SQLite)    │    │ (Claude API)   │             │
│  └──────────┬──┘    └────────────────┘             │
│             │                                      │
│  ┌──────────▼──────────────────────────────────┐  │
│  │  SQLite (local) OR Turso (web)              │  │
│  │  Schema: persons, families, events, sources │  │
│  │  media, hints, matches, users, families      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  External APIs:                                    │
│  ┌─────────────┐ ┌──────┐ ┌────────────────────┐   │
│  │FamilySearch │ │NARA  │ │Chronicling America │   │
│  └─────────────┘ └──────┘ └────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## File Locations

All phase documents are stored in `D:\projects\ancstra\docs\phases\`:

- `phase-0-design.md` -- UX/UI design (~3 weeks)
- `phase-0.5-spikes.md` -- Technical spikes (1 week)
- `phase-1-core.md` -- Core tree builder (8 weeks)
- `phase-2-search.md` -- AI search + matching (10 weeks)
- `phase-3-documents.md` -- Document OCR + extraction (7 weeks)
- `phase-4-auth.md` -- Auth & collaboration (4 weeks)
- `phase-5-polish.md` -- AI polish & export (3 weeks)
- `phase-6-launch.md` -- Deployment & launch (3 weeks)
- `phase-6.5-beta.md` -- Beta period (2 weeks)
- `future-enhancements.md` -- Post-launch: Photos & DNA (8 modules)
- `README.md` -- This file

**Related specs:** See `D:\projects\ancstra\docs\superpowers\specs\2026-03-21-ancstra-full-spec-design.md` for detailed system architecture, data model, and API specifications.

**Research foundation:** See `D:\projects\ancstra\first_research.md` for original market research, tech stack rationale, and competitive analysis.

## Next Steps

1. Complete Phase 0 (UX/UI Design) -- finish Figma mockups
2. Register for FamilySearch developer access (do this NOW, approval takes weeks)
3. Run Phase 0.5 technical spikes to validate assumptions
4. Ensure development environment is set up (Node.js 22+, pnpm, Git)
5. Start Phase 1: monorepo scaffolding and database setup
6. At end of each phase: run retrospective, clean up tech debt, take a break
