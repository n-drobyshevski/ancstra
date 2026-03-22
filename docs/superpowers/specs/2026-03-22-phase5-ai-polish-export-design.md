# Phase 5: AI Polish & Export — Design Spec

> Status: Approved | Date: 2026-03-22
> Phase: 5 | Duration: 3 weeks | Dependencies: Phase 1-4 complete

## Overview

Add AI-powered biography generation, data quality dashboard, historical context timeline, GEDCOM 7.0 export, narrative PDF export via Gotenberg, and lightweight performance optimizations. Hard AI budget limit with override.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Full Phase 5 as written |
| 2 | Biography generation | Guided with options (tone, length, focus) |
| 3 | Data quality dashboard | Metrics cards + simple bar/donut charts |
| 4 | Performance optimization | Lightweight — pagination, image resize, query timing |
| 5 | GEDCOM 7.0 | Structural compliance only (7.0 wrapper, 5.5.1 field mapping) |
| 6 | PDF generation | Gotenberg (self-hosted Docker, Chromium-based) |
| 7 | Historical context | Timeline overlay (interleaved with person events) |
| 8 | Photo book export | Cut — defer post-launch |
| 9 | PDF service host | Gotenberg on Railway alongside Hono worker |
| 10 | AI cost controls | Hard limit with cutoff, overridable per-action in settings |
| 11 | Chart library | recharts |

## Architecture: Feature-First

Build features as vertical slices in this order:
1. Data quality dashboard (establishes metrics, recharts setup)
2. Biography generation + historical context (AI features, uses quality metrics)
3. Export features (GEDCOM 7.0 + narrative PDF via Gotenberg)
4. Performance optimization pass (pagination, image resize, query timing)

## Data Quality Dashboard

### Metrics

| Metric | Calculation |
|---|---|
| Total persons | COUNT from `persons` |
| % with full names | Persons with `person_names` row having given_name + surname |
| % with birth date | Persons with a `birth` event |
| % with death date | Non-living persons with a `death` event |
| % with birth place | Birth events with `place_id` set |
| % sourced | Persons with at least one `source_citations` row |
| % with media | Persons with at least one `media_persons` link |
| Avg sources per person | Total source_citations / total persons |
| Completeness score | 0-100 per person: name (20), birth date (20), birth place (15), death date (15), source (20), media (10) |

### API

```
GET /api/quality/summary        → { totalPersons, metrics: MetricCard[], overallScore }
GET /api/quality/by-generation   → { generations: [{ depth, personCount, avgScore, breakdown }] }
GET /api/quality/priorities      → { persons: [{ id, name, score, missingFields[] }], total, page, pageSize }
```

### UI

- **Top row:** 4-6 summary metric cards
- **Middle row:** Two recharts — (1) bar chart: completeness by generation, (2) donut chart: missing data breakdown by type
- **Bottom:** Sortable table of research priorities (lowest completeness scores), paginated 20/page
- **Location:** `apps/web/app/(auth)/analytics/quality/page.tsx`, linked from sidebar under "Analytics"

## AI Biography Generation

### Generation options dialog

| Option | Values | Default |
|---|---|---|
| Tone | Formal, Conversational, Storytelling | Conversational |
| Length | Brief (100-200 words), Standard (300-500), Detailed (600-1000) | Standard |
| Focus | Life overview, Immigration story, Military service, Family life, Career/occupation | Life overview |

### Prompt strategy

Input to Claude Sonnet:
- Person's full record (names, dates, places, all events chronologically)
- Parents, spouse(s), children names/dates
- Source citations (so Claude references documented facts)
- Selected tone/length/focus options
- Instruction to distinguish sourced facts from inferences ("Records show..." vs "It is likely that...")

### Caching

New `biographies` table in family DB:

```sql
CREATE TABLE biographies (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  tone TEXT NOT NULL,
  length TEXT NOT NULL,
  focus TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  UNIQUE(person_id, tone, length, focus)
);
```

Re-generating with same options replaces cached version. Different option combinations cached independently.

### API

```
POST /api/ai/biography
Body: { personId, tone, length, focus }
Response: Streaming text (Vercel AI SDK streamText)

GET /api/ai/biography?personId=xxx&tone=conversational&length=standard&focus=life_overview
Response: { cached: true, content: "..." } or { cached: false }
```

### UI

- New "Biography" tab on person detail page
- Shows cached biography if available, or "Generate Biography" button
- Button opens options dialog → submits → streams response
- After generation: "Regenerate", "Edit" toggle (textarea), "Export as PDF" button
- Estimated cost shown in dialog before confirming

## Historical Context Timeline

### Generation

```
POST /api/ai/historical-context
Body: { personId }
Response: { events: [{ year, title, description, relevance }] }
```

Prompt to Claude Haiku:
- Person's birth/death years and locations
- Key life events with dates/places
- Instruction: "Return 5-10 major historical events that directly affected this person's life based on their time period and location."

### Caching

```sql
CREATE TABLE historical_context (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  events TEXT NOT NULL,           -- JSON array of { year, title, description, relevance }
  model TEXT NOT NULL,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  UNIQUE(person_id)
);
```

Cached indefinitely. Regenerate only if person's dates/places change.

### UI integration

On person detail timeline:
- Person events: solid left border (existing)
- Historical events: dashed left border, muted text, globe/clock icon
- Interleaved by year
- Toggle: "Show/hide historical context" checkbox
- "Generate context" button if not cached
- Cost: ~$0.002 per person (Haiku)

## GEDCOM 7.0 Export

### Structural compliance approach

Same data as 5.5.1 export, wrapped in 7.0-compliant structure:
- Header: `0 HEAD` → `1 GEDC` → `2 VERS 7.0`
- Always UTF-8 (no `1 CHAR` tag)
- Sources promoted to top-level records with `@S1@` pointers
- Persons/families reference sources by pointer instead of inline

### Implementation

```
packages/gedcom/exporter/
├── index.ts              (existing — routes to right version)
├── gedcom551.ts          (existing)
└── gedcom70.ts           (new — 7.0 structural wrapper)
```

### Export options UI

Update `apps/web/app/(auth)/export/page.tsx`:
- Format selector: radio — GEDCOM 5.5.1 (default), GEDCOM 7.0
- Include/exclude checkboxes: living persons, sources & citations, media references
- Download button

### API

```
GET /api/export/gedcom?version=5.5.1|7.0&includeLiving=true&includeSources=true&includeMedia=true
Response: GEDCOM file download
```

Permission: `gedcom:export` (Editor+).

## Narrative PDF Export

### Architecture

```
User clicks "Export PDF"
  → API builds HTML from person/family data + biographies
  → Sends HTML to Gotenberg (Chromium-based)
  → Gotenberg returns PDF
  → API streams PDF to user as download
```

### Gotenberg setup

Docker container on Railway (production) or local Docker (development):

```yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    ports:
      - "3000:3000"
```

Connection: `GOTENBERG_URL` env var (default `http://localhost:3000`).

### PDF templates

```
packages/export/src/pdf/
├── gotenberg-client.ts          # HTTP client for Gotenberg
├── templates/
│   ├── family-history.ts        # Full family narrative
│   └── person-biography.ts      # Single person bio
└── index.ts
```

**Family history template:**
- Cover page (family name, date range, compiler)
- Table of contents
- Pedigree chart (HTML/CSS, 4-5 generations)
- Person sections: photo, biography, events, sources
- Timeline appendix

**Person biography template:**
- Person name, dates, photo
- Biography text
- Event timeline
- Source citations

### API

```
POST /api/export/pdf
Body: {
  template: 'family-history' | 'person-biography',
  personId?: string,
  options: { includeLiving, includePhotos, maxGenerations }
}
Response: PDF download
```

Permission: `gedcom:export`. Returns 503 if Gotenberg unavailable. In local dev without Docker, returns rendered HTML instead.

## Performance Optimization

### Pagination

Add offset pagination to endpoints currently returning all results:

| Route | After |
|---|---|
| `GET /api/persons` | `?page=1&limit=50`, default 50 |
| `GET /api/sources` | `?page=1&limit=50` |
| `GET /api/events` | `?page=1&limit=50` |

Return `{ items, total, page, pageSize }`.

### Image optimization

On media upload:
- Store original as-is
- Generate thumbnail: max 400px wide, JPEG 80% quality via `sharp`
- New column `media.thumbnail_path`
- List views and tree nodes use thumbnails; detail view uses original

### Query timing

Lightweight wrapper in `api-guard.ts`:
- Measure handler duration
- Log warning to console if > 500ms
- No monitoring infrastructure — development aid only

### What's NOT included

- No deep query profiling or index analysis
- No tree visualization lazy loading overhaul
- No Web Vitals monitoring (defer to Phase 6)

## AI Cost Controls

### Budget system

- `monthly_ai_budget_usd` column on `family_registry` (default 10.00)
- Owner configurable in Settings > AI
- Per-family budget (shared across all members)

### Enforcement

```
AI action triggered → checkBudget(centralDb, familyId)
  → Under limit: proceed, log usage after
  → Over limit: block with message
    → User options: "Wait" or "Allow this action" (one-time override)
    → Override bypasses for single action, still logged
```

Budget resets monthly (calendar month). `checkBudget()` sums `ai_usage.cost_usd` WHERE `created_at >= first of current month`.

### Pre-action cost estimates

| Action | Model | Estimate |
|---|---|---|
| Biography | Sonnet | ~$0.02 |
| Historical context | Haiku | ~$0.002 |
| AI chat | Sonnet | Variable (no pre-estimate) |

### Settings UI

`apps/web/app/(auth)/settings/ai/page.tsx`:
- Monthly budget input (numeric, USD)
- Current month usage bar (spent / limit)
- Usage history table: date, action type, model, tokens, cost

## Package Structure

### New package: `packages/export/`

```
packages/export/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── pdf/
│   │   ├── gotenberg-client.ts
│   │   ├── templates/
│   │   │   ├── family-history.ts
│   │   │   └── person-biography.ts
│   │   └── index.ts
│   └── gedcom70/
│       ├── serializer.ts
│       └── index.ts
```

### Schema additions (family DB)

- `biographies` table
- `historical_context` table
- `media.thumbnail_path` column

### Schema additions (central DB)

- `family_registry.monthly_ai_budget_usd` column (REAL, default 10.00)

### New dependencies

- `recharts` — chart library (apps/web)
- `sharp` — image resizing (apps/web)
- Gotenberg — Docker service (not npm)

### New API routes

```
apps/web/app/api/
├── quality/
│   ├── summary/route.ts
│   ├── by-generation/route.ts
│   └── priorities/route.ts
├── ai/
│   ├── biography/route.ts
│   └── historical-context/route.ts
├── export/
│   └── pdf/route.ts
└── settings/
    └── ai-budget/route.ts
```

### New pages

```
apps/web/app/(auth)/
├── analytics/quality/page.tsx
├── settings/ai/page.tsx
```

### New components

```
apps/web/components/
├── quality/
│   ├── metric-cards.tsx
│   ├── completeness-chart.tsx
│   ├── missing-data-chart.tsx
│   └── priority-table.tsx
├── biography/
│   ├── biography-tab.tsx
│   ├── biography-options.tsx
│   └── biography-viewer.tsx
├── timeline/
│   └── historical-event.tsx
└── export/
    └── export-options.tsx
```

### Modified files

```
apps/web/app/(auth)/export/page.tsx         — format selector + options
apps/web/app/(auth)/person/[id]/page.tsx    — biography tab, historical timeline
apps/web/components/app-sidebar.tsx         — "Analytics" link
packages/db/src/family-schema.ts            — new tables + columns
packages/db/src/central-schema.ts           — budget column
packages/gedcom/exporter/index.ts           — route to 7.0 serializer
apps/web/lib/auth/api-guard.ts              — query timing wrapper
```

## Exit Criteria

- [ ] Biography generation produces coherent narratives with streaming
- [ ] Biography options (tone/length/focus) affect output quality
- [ ] Historical context events interleave correctly on person timeline
- [ ] Data quality dashboard shows accurate metrics with charts
- [ ] Research priorities table identifies persons with lowest completeness
- [ ] GEDCOM 7.0 export produces structurally valid files
- [ ] Export options UI works for both 5.5.1 and 7.0
- [ ] Narrative PDF generates via Gotenberg with family history template
- [ ] Single person PDF export works from biography tab
- [ ] AI budget hard limit blocks generation when exceeded
- [ ] Budget override allows single-action bypass
- [ ] API routes paginated (persons, sources, events)
- [ ] Image thumbnails generated on upload
- [ ] Slow queries logged (>500ms warning)
