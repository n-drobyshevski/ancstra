# Architecture Overview

## System Architecture Diagram

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
│              Next.js 16 App Router (Server)              │
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

## Deployment Modes

| Mode | Database | Hosting | Use Case |
|------|----------|---------|----------|
| **Local Development** | SQLite via better-sqlite3 | `next dev` on localhost | Primary development environment |
| **Local Production** | SQLite via better-sqlite3 | `next start` on localhost | Personal daily use, full offline support |
| **Web (Family Sharing)** | Turso (edge SQLite) | Vercel free tier | Share tree with family members, 0-cost hosting |

**Key insight:** Transition from local to web requires only changing the database driver (better-sqlite3 → @libsql/client). Drizzle ORM abstracts this difference.

## Monorepo Structure

```
ancstra/
├── apps/
│   └── web/                    # Next.js 16 application
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

**Build tooling:** pnpm (workspaces) + Turborepo (task orchestration). Turbopack is the default bundler in Next.js 16 (no longer experimental).

## Frontend Architecture

### Server/Client Component Boundaries

```
Server Components (default):
  - Page layouts, data fetching, person lists
  - Static tree statistics, source lists
  - GEDCOM import/export triggers

Client Components ('use client'):
  - Tree visualization (React Flow interactive canvas — see ADR-005)
  - AI chat interface (streaming responses)
  - Document viewer (zoom, pan, annotate)
  - DNA chromosome browser (D3 interactions)
  - Form inputs with validation
  - Search with live filtering
```

### State Management

| State Type | Tool | Scope |
|-----------|------|-------|
| **Server data** (persons, events, sources) | React Query (TanStack Query) | Cached, auto-refetched on mutations |
| **UI state** (selected person, sidebar open) | Zustand | Client-side, ephemeral |
| **Form state** | React Hook Form | Per-form with validation |
| **URL state** (filters, current view) | Next.js searchParams | URL-synced for bookmarking/sharing |

### Data Fetching with React Query

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
```

### Progressive Web App (PWA)

Next.js 16 has improved built-in service worker support (no `next-pwa` required).

Service Worker caching strategy:
- **Static assets** (JS, CSS, images): Cache-first, update in background
- **API data**: Network-first, fall back to cache
- **Tree data**: Cache with revalidation on focus

Offline capabilities:
- View cached tree data while offline
- Queue edits in IndexedDB
- Sync queued edits when connectivity returns

### Internationalization (i18n)

Genealogy is inherently international. Supported languages: en, de, fr, es, pt, pl, it, sv, no, da

Considerations:
- Locale-aware date formatting (DD/MM/YYYY vs MM/DD/YYYY)
- GEDCOM dates ("15 MAR 1872", "ABT 1880") displayed with context, not localized
- Historical place names in original languages preserved
- Name diacritics (umlauts, accents, cedillas) fully supported

## Architecture Decision Records

### ADR-001: SQLite over Neo4j

**Context:** Family trees are natural graphs. Neo4j is a graph database.

**Decision:** Use SQLite with recursive CTEs + closure table.

**Rationale:** SQLite handles 10K+ person trees without issue. The `ancestor_paths` closure table (see [ADR-006](decisions/006-closure-table.md)) pre-computes ancestor/descendant pairs, eliminating recursive CTEs for common queries (5-50x improvement). Zero operational overhead — no Java, no server process. The entire database is one portable file. If graph queries are ever needed, Neo4j can be added as a graph query layer alongside SQLite.

**Consequence:** Complex graph analytics ("all paths between two people", graph centrality) still require custom code. Neo4j remains an upgrade path for 50K+ person trees.

### ADR-002: JS/TS over Python Sidecar

**Context:** The research doc proposed FastAPI for OCR, NLP, DNA analysis.

**Decision:** Use JS/TS for everything possible. Python only via cloud APIs or subprocess for truly unavoidable tools.

**Rationale:** Single runtime reduces deployment complexity, debugging surface, and operational overhead. tesseract.js (same engine as Python Tesseract), face-api.js (TensorFlow.js), and Replicate cloud APIs cover all Python-dependent features.

**Consequence:** Record matching quality may be lower initially than Splink. Upgrade path exists — see [AI Strategy](ai-strategy.md).

### ADR-003: Local-First Architecture

**Context:** User wants local-first with web deployment as a later option.

**Decision:** SQLite via better-sqlite3 for local, Turso (libsql) for web. Drizzle ORM abstracts the driver difference.

**Rationale:** Zero hosting cost for personal use. Data sovereignty. Web deployment is a driver swap, not an architecture change.

**Consequence:** Must design for offline-capable PWA from the start. Sync strategy needed when web-deployed.

## Testing Strategy

| Type | Tool | Coverage Target | What |
|------|------|----------------|------|
| **Unit** | Vitest | 80%+ | Business logic, date parsing, name comparison, matching scorer |
| **Integration** | Vitest + test DB | 70%+ | API routes, database queries, GEDCOM import/export |
| **E2E** | Playwright | Critical paths | Import GEDCOM, view tree, search, AI chat, export |
| **Round-trip** | Vitest | 100% of test files | GEDCOM import → export → reimport → compare |
| **Performance** | Vitest bench | Regression | Tree queries at 1K, 10K, 100K persons |

## CI/CD Pipeline

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
      - run: pnpm lint          # ESLint CLI directly (not next lint)
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

## Error Tracking and Monitoring

- **Error tracking:** Sentry free tier (5K events/month)
- **Logging:** Structured JSON logs via `pino`
- **Performance:** Web Vitals tracking (built into Next.js 16)
- **Database:** Query timing via Drizzle logger

---

## Planned Evolution: Hono Worker Backend

Starting in Phase 2, a Hono-based TypeScript worker (`apps/worker`) will be deployed to Railway alongside this Next.js app on Vercel. The worker handles long-running jobs (GEDCOM import, batch matching, OCR), WebSocket connections (job progress, real-time collaboration), and scheduled tasks. Both services share the same Turso database and monorepo packages. See:

- [Backend Architecture Spec](../superpowers/specs/2026-03-21-backend-architecture-design.md) — Full design
- [ADR-007: Hono Worker Sidecar](decisions/007-hono-worker-sidecar.md) — Decision record (written when worker is implemented)

The architecture diagram above reflects Phase 1 (single-service). When the worker is introduced, external API orchestration and background processing move to the worker.

## Related Documentation

- [Product Vision](../vision.md) — Feature scope, non-goals, success criteria
- [Data Model](data-model.md) — Complete SQLite schema, the source of truth for database design
- [AI Strategy](ai-strategy.md) — Claude integration patterns, tool definitions, context injection
- [ADR-005: React Flow Visualization](decisions/005-react-flow-viz.md) — Interactive tree canvas decision
- [ADR-006: Closure Table](decisions/006-closure-table.md) — Pre-computed ancestor/descendant queries
