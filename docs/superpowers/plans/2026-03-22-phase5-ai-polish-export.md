# Phase 5: AI Polish & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI biography generation, data quality dashboard, historical context timeline, GEDCOM 7.0 export, narrative PDF export via Gotenberg, lightweight performance optimization, and AI budget hard limit.

**Architecture:** Feature-first vertical slices: (1) data quality dashboard with recharts, (2) biography + historical context AI features, (3) GEDCOM 7.0 + PDF export via Gotenberg, (4) performance pass. New `packages/export/` package for PDF. AI features extend existing `packages/ai/`. Budget enforcement uses central DB limit + family DB usage sum.

**Tech Stack:** Vercel AI SDK, Claude API, recharts, Gotenberg (Docker), Drizzle ORM, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-phase5-ai-polish-export-design.md`

**Important:** Next.js 16 — read `node_modules/next/dist/docs/` before writing Next.js code. Never use `.js` extensions in TS imports. Existing AI chat route is at `apps/web/app/api/ai/chat/route.ts`. Existing GEDCOM serializer is at `apps/web/lib/gedcom/serialize.ts`. Cost tracker is at `packages/ai/src/context/cost-tracker.ts`.

---

## File Map

### New files

```
packages/export/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   └── pdf/
│       ├── gotenberg-client.ts
│       ├── templates/
│       │   ├── family-history.ts
│       │   └── person-biography.ts
│       └── index.ts
├── __tests__/
│   ├── gotenberg-client.test.ts
│   └── templates.test.ts

packages/ai/src/
├── prompts/biography-prompt.ts
├── prompts/historical-context-prompt.ts

packages/db/src/
├── quality-queries.ts                  (data quality metrics queries)

apps/web/
├── app/(auth)/analytics/quality/page.tsx
├── app/(auth)/settings/ai/page.tsx
├── app/api/quality/summary/route.ts
├── app/api/quality/by-generation/route.ts
├── app/api/quality/priorities/route.ts
├── app/api/ai/biography/route.ts
├── app/api/ai/historical-context/route.ts
├── app/api/export/pdf/route.ts
├── app/api/export/gedcom/route.ts      (new API route, replaces server action)
├── app/api/settings/ai-budget/route.ts
├── components/quality/metric-cards.tsx
├── components/quality/completeness-chart.tsx
├── components/quality/missing-data-chart.tsx
├── components/quality/priority-table.tsx
├── components/biography/biography-tab.tsx
├── components/biography/biography-options.tsx
├── components/biography/biography-viewer.tsx
├── components/timeline/historical-event.tsx
├── components/export/export-options.tsx
├── lib/gedcom/serialize-70.ts
├── lib/gedcom/index.ts
├── docker-compose.yml                  (Gotenberg for local dev)
```

### Modified files

```
packages/db/src/family-schema.ts        — add biographies + historical_context tables
packages/db/src/central-schema.ts       — add monthly_ai_budget_usd to family_registry
packages/db/src/ai-schema.ts            — extend ai_usage.taskType enum
packages/ai/src/context/cost-tracker.ts — accept budget limit param
apps/web/app/(auth)/export/page.tsx     — format selector + include/exclude options
apps/web/app/(auth)/person/[id]/page.tsx — biography tab + historical timeline
apps/web/components/app-sidebar.tsx     — add Analytics link
apps/web/lib/auth/api-guard.ts          — add query timing wrapper
apps/web/app/api/sources/route.ts       — add pagination
apps/web/app/api/events/route.ts        — add pagination
apps/web/package.json                   — add recharts
```

---

## Task 1: Schema additions (biographies, historical_context, budget)

**Files:**
- Modify: `packages/db/src/family-schema.ts`
- Modify: `packages/db/src/central-schema.ts`
- Modify: `packages/db/src/ai-schema.ts`

- [ ] **Step 1: Add biographies table to family-schema.ts**

```typescript
export const biographies = sqliteTable('biographies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  tone: text('tone', { enum: ['formal', 'conversational', 'storytelling'] }).notNull(),
  length: text('length', { enum: ['brief', 'standard', 'detailed'] }).notNull(),
  focus: text('focus', { enum: ['life_overview', 'immigration', 'military', 'family_life', 'career'] }).notNull(),
  content: text('content').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique('uq_bio_person_opts').on(table.personId, table.tone, table.length, table.focus),
  index('idx_biographies_person').on(table.personId),
]);
```

- [ ] **Step 2: Add historical_context table to family-schema.ts**

```typescript
export const historicalContext = sqliteTable('historical_context', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  events: text('events').notNull(), // JSON array of { year, title, description, relevance }
  model: text('model').notNull(),
  costUsd: real('cost_usd'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique('uq_hist_ctx_person').on(table.personId),
]);
```

- [ ] **Step 3: Add monthly_ai_budget_usd to central-schema.ts**

Add to `familyRegistry` table:
```typescript
monthlyAiBudgetUsd: real('monthly_ai_budget_usd').notNull().default(10.0),
```

- [ ] **Step 4: Extend ai_usage taskType enum in ai-schema.ts**

Change the enum from:
```typescript
enum: ['chat', 'extraction', 'analysis', 'citation']
```
To:
```typescript
enum: ['chat', 'extraction', 'analysis', 'citation', 'biography', 'historical_context']
```

- [ ] **Step 5: Verify typecheck**

Run: `cd packages/db && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/
git commit -m "feat(db): add biographies, historical_context tables and budget column"
```

---

## Task 2: Update cost tracker for configurable budget

**Files:**
- Modify: `packages/ai/src/context/cost-tracker.ts`

- [ ] **Step 1: Read current cost-tracker.ts**

The current `checkBudget()` accepts `(db, monthlyLimitUsd = 10)`. Update it to be clearer that the limit comes from the caller (who reads it from central DB).

- [ ] **Step 2: Extend UsageRecord taskType**

Update the `taskType` type in the `UsageRecord` interface to include `'biography'` and `'historical_context'`.

- [ ] **Step 3: Add cost estimation helper**

```typescript
export function estimateCost(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): number {
  return calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
}

export const BIOGRAPHY_ESTIMATE = {
  brief: { inputTokens: 2000, outputTokens: 300 },
  standard: { inputTokens: 2000, outputTokens: 700 },
  detailed: { inputTokens: 2000, outputTokens: 1500 },
};

export const HISTORICAL_CONTEXT_ESTIMATE = { inputTokens: 1000, outputTokens: 500 };
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/context/cost-tracker.ts
git commit -m "feat(ai): extend cost tracker with biography/context task types and estimates"
```

---

## Task 3: Data quality queries

**Files:**
- Create: `packages/db/src/quality-queries.ts`
- Create: `packages/db/__tests__/quality-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Test with in-memory SQLite DB seeded with sample persons, events, sources. Test:
- `getQualitySummary(db)` returns totalPersons, overall score, per-metric percentages
- `getQualityByGeneration(db)` returns generation breakdown
- `getPriorities(db, page, pageSize)` returns persons sorted by lowest completeness

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement quality-queries.ts**

```typescript
import { sql } from 'drizzle-orm';
import type { Database } from './index';

export interface QualityMetric {
  label: string;
  value: number;  // percentage 0-100
  total: number;
  count: number;
}

export interface QualitySummary {
  totalPersons: number;
  overallScore: number;
  metrics: QualityMetric[];
}

export function getQualitySummary(db: Database): QualitySummary {
  // Count total persons (non-deleted)
  // For each metric: query with appropriate joins
  // % with full names: persons with person_names row having given_name + surname
  // % with birth date: persons with birth event
  // % with death date: non-living persons with death event
  // % with birth place: birth events with non-null placeText
  // % sourced: persons with source_citations
  // Completeness: name(20) + birthDate(25) + birthPlace(20) + deathDate(15) + source(20) = 100
}

export function getQualityByGeneration(db: Database): GenerationQuality[] {
  // Use ancestor_paths or manual depth calculation
  // Group by generation depth, return avg completeness
}

export function getPriorities(db: Database, page = 1, pageSize = 20): {
  persons: PriorityPerson[];
  total: number;
  page: number;
  pageSize: number;
} {
  // Query persons with computed completeness score
  // Sort ascending (lowest first = most incomplete)
  // Offset pagination
}
```

- [ ] **Step 4: Run tests to verify pass**

- [ ] **Step 5: Export from packages/db index.ts**

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): data quality metrics queries with completeness scoring"
```

---

## Task 4: Install recharts + data quality API routes

**Files:**
- Create: `apps/web/app/api/quality/summary/route.ts`
- Create: `apps/web/app/api/quality/by-generation/route.ts`
- Create: `apps/web/app/api/quality/priorities/route.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install recharts**

```bash
cd apps/web && pnpm add recharts
```

- [ ] **Step 2: Create quality API routes**

Each route:
- Uses `withAuth('tree:view')` from api-guard
- Calls the corresponding quality query from `@ancstra/db`
- Returns JSON

`GET /api/quality/summary` → `getQualitySummary(familyDb)`
`GET /api/quality/by-generation` → `getQualityByGeneration(familyDb)`
`GET /api/quality/priorities?page=1&pageSize=20` → `getPriorities(familyDb, page, pageSize)`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/quality/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): data quality API routes + install recharts"
```

---

## Task 5: Data quality dashboard UI

**Files:**
- Create: `apps/web/components/quality/metric-cards.tsx`
- Create: `apps/web/components/quality/completeness-chart.tsx`
- Create: `apps/web/components/quality/missing-data-chart.tsx`
- Create: `apps/web/components/quality/priority-table.tsx`
- Create: `apps/web/app/(auth)/analytics/quality/page.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`

- [ ] **Step 1: Create MetricCards component**

Client component. Fetches from `/api/quality/summary`. Renders 5 cards in a grid: Total Persons, Overall Score, % with Birth Date, % Sourced, % with Birth Place. Each card shows the metric value prominently with a label.

- [ ] **Step 2: Create CompletenessChart component**

Client component. Fetches from `/api/quality/by-generation`. Renders a recharts `BarChart` with `ResponsiveContainer`. X-axis: generation depth. Y-axis: average completeness score (0-100).

```typescript
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function CompletenessChart({ data }: { data: GenerationData[] }) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="generation" label={{ value: 'Generation', position: 'bottom' }} />
          <YAxis domain={[0, 100]} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create MissingDataChart component**

Client component. Renders a recharts `PieChart` (donut) showing the breakdown of missing data types. Uses data from the summary metrics.

```typescript
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Label } from 'recharts';
// Donut chart with innerRadius=60, outerRadius=100
```

- [ ] **Step 4: Create PriorityTable component**

Client component. Fetches from `/api/quality/priorities`. Sortable table with columns: Name, Score (0-100), Missing Fields (badges). Paginated with "Previous/Next" buttons. Uses shadcn Table.

- [ ] **Step 5: Create quality dashboard page**

Server component at `apps/web/app/(auth)/analytics/quality/page.tsx`. Requires `tree:view` permission. Renders MetricCards, then two charts side by side, then PriorityTable.

- [ ] **Step 6: Add Analytics to sidebar**

Read `apps/web/components/app-sidebar.tsx`. Add "Analytics" section with "Data Quality" link to `/analytics/quality`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/quality/ apps/web/app/(auth)/analytics/ apps/web/components/app-sidebar.tsx
git commit -m "feat(web): data quality dashboard with charts and priority table"
```

---

## Task 6: Biography prompt builder

**Files:**
- Create: `packages/ai/src/prompts/biography-prompt.ts`
- Create: `packages/ai/__tests__/biography-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `buildBiographyPrompt(personData, options)` returns a well-structured prompt string containing: person name, dates, events, family members, source citations, tone/length/focus instructions.

- [ ] **Step 2: Implement biography-prompt.ts**

```typescript
export interface BiographyOptions {
  tone: 'formal' | 'conversational' | 'storytelling';
  length: 'brief' | 'standard' | 'detailed';
  focus: 'life_overview' | 'immigration' | 'military' | 'family_life' | 'career';
}

export interface PersonBioData {
  name: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  sex: string;
  events: { type: string; date?: string; place?: string; description?: string }[];
  parents: { name: string; birthYear?: number }[];
  spouses: { name: string; marriageDate?: string }[];
  children: { name: string; birthYear?: number }[];
  sources: { title: string; citationText?: string }[];
}

const TONE_INSTRUCTIONS = {
  formal: 'Write in a formal, academic style suitable for a published family history.',
  conversational: 'Write in a warm, conversational tone as if telling a family story.',
  storytelling: 'Write in a vivid narrative style that brings the person to life.',
};

const LENGTH_INSTRUCTIONS = {
  brief: 'Keep the biography to 100-200 words.',
  standard: 'Write a 300-500 word biography.',
  detailed: 'Write a comprehensive 600-1000 word biography.',
};

const FOCUS_INSTRUCTIONS = {
  life_overview: 'Cover the full arc of their life.',
  immigration: 'Focus on their immigration journey and adaptation to a new country.',
  military: 'Focus on their military service and its impact on their life.',
  family_life: 'Focus on family relationships, marriages, and children.',
  career: 'Focus on their career, occupations, and professional life.',
};

export function buildBiographyPrompt(person: PersonBioData, options: BiographyOptions): string {
  // Build structured prompt with person data + instructions
  // Include: "Distinguish sourced facts ('Records show...') from inferences ('It is likely...')"
  // Include source citations so Claude can reference them
}
```

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Export from packages/ai**

- [ ] **Step 5: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): biography prompt builder with tone, length, focus options"
```

---

## Task 7: Historical context prompt builder

**Files:**
- Create: `packages/ai/src/prompts/historical-context-prompt.ts`
- Create: `packages/ai/__tests__/historical-context-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `buildHistoricalContextPrompt(personData)` returns a prompt containing birth/death years, locations, and instructions to return 5-10 historical events as JSON.

- [ ] **Step 2: Implement historical-context-prompt.ts**

```typescript
export function buildHistoricalContextPrompt(person: {
  name: string;
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  events: { type: string; year?: number; place?: string }[];
}): string {
  return `You are a historical context expert. Given this person's life details, return 5-10 major historical events that would have directly affected their life.

Person: ${person.name}
Born: ${person.birthYear || 'unknown'} in ${person.birthPlace || 'unknown'}
Died: ${person.deathYear || 'unknown'} in ${person.deathPlace || 'unknown'}

Key life events:
${person.events.map(e => `- ${e.year || '?'}: ${e.type} in ${e.place || 'unknown'}`).join('\n')}

Return a JSON array of objects with: { "year": number, "title": "short title", "description": "1-2 sentences", "relevance": "how this affected the person" }

Focus on events relevant to their specific time, location, and demographic. Include wars, economic events, migration waves, local history, and social changes.`;
}
```

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Export from packages/ai**

- [ ] **Step 5: Commit**

```bash
git add packages/ai/
git commit -m "feat(ai): historical context prompt builder"
```

---

## Task 8: Biography API route + caching

**Files:**
- Create: `apps/web/app/api/ai/biography/route.ts`

- [ ] **Step 1: Create biography route**

**GET** — Check cache.
```
GET /api/ai/biography?personId=xxx&tone=conversational&length=standard&focus=life_overview
→ { cached: true, content: "..." } or { cached: false }
```

**POST** — Generate (streaming) with budget check.
```
POST /api/ai/biography
Body: { personId, tone, length, focus }
→ Streaming text response
```

Flow:
1. `withAuth('ai:research')`
2. Read budget from central DB `family_registry.monthly_ai_budget_usd`
3. `checkBudget(familyDb, limit)` — if over, return `{ blocked: true, spent, limit }`
4. Gather person data (person + names + events + family + sources)
5. Build prompt via `buildBiographyPrompt()`
6. Stream via `streamText()` with Claude Sonnet
7. After stream completes, cache in `biographies` table (INSERT OR REPLACE on unique constraint)
8. Record usage in `ai_usage`

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/ai/biography/
git commit -m "feat(web): biography generation API with streaming and caching"
```

---

## Task 9: Historical context API route + caching

**Files:**
- Create: `apps/web/app/api/ai/historical-context/route.ts`

- [ ] **Step 1: Create historical-context route**

**GET** — Check cache.
```
GET /api/ai/historical-context?personId=xxx
→ { cached: true, events: [...] } or { cached: false }
```

**POST** — Generate with budget check.
```
POST /api/ai/historical-context
Body: { personId }
→ { events: [{ year, title, description, relevance }] }
```

Flow:
1. `withAuth('ai:research')`
2. Budget check (same as biography)
3. Gather person birth/death/events data
4. Build prompt via `buildHistoricalContextPrompt()`
5. Call Claude Haiku (non-streaming — structured JSON output)
6. Parse JSON response
7. Cache in `historical_context` table (INSERT OR REPLACE)
8. Record usage in `ai_usage`

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/ai/historical-context/
git commit -m "feat(web): historical context generation API with caching"
```

---

## Task 10: Biography UI components

**Files:**
- Create: `apps/web/components/biography/biography-options.tsx`
- Create: `apps/web/components/biography/biography-viewer.tsx`
- Create: `apps/web/components/biography/biography-tab.tsx`

- [ ] **Step 1: Create BiographyOptions component**

Client component. Dialog with three selects: Tone (Formal/Conversational/Storytelling), Length (Brief/Standard/Detailed), Focus (5 options). Shows estimated cost. "Generate" button. Uses shadcn Dialog, Select, Button.

- [ ] **Step 2: Create BiographyViewer component**

Client component. Displays generated biography text with nice typography. "Edit" toggle switches to a textarea for manual refinement. "Export as PDF" button (calls PDF API later). "Regenerate" button opens options dialog again.

- [ ] **Step 3: Create BiographyTab component**

Client component. Wrapper that:
- Checks for cached biography via GET
- If cached: shows BiographyViewer
- If not: shows "Generate Biography" button → opens BiographyOptions
- On generate: streams from POST, displays text as it arrives, then shows viewer

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/biography/
git commit -m "feat(web): biography UI with options dialog, viewer, and streaming"
```

---

## Task 11: Historical context timeline component

**Files:**
- Create: `apps/web/components/timeline/historical-event.tsx`

- [ ] **Step 1: Create HistoricalEvent component**

Client component. Renders a single historical event in the timeline with distinct styling:
- Dashed left border (vs solid for person events)
- Muted text color
- Globe/clock icon (from lucide-react)
- Year, title (bold), description, relevance (italic)

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/timeline/
git commit -m "feat(web): historical event timeline component"
```

---

## Task 12: Integrate biography + historical context into person detail

**Files:**
- Modify: `apps/web/app/(auth)/person/[id]/page.tsx`

- [ ] **Step 1: Read current person detail page**

Understand the existing tab/section structure.

- [ ] **Step 2: Add Biography tab**

Import `BiographyTab`. Add it as a new tab (or section) on the person detail page. Pass `personId`.

- [ ] **Step 3: Add historical context to timeline**

If the person detail page has an events/timeline section:
- Add a "Show historical context" toggle
- When enabled, fetch from GET `/api/ai/historical-context?personId=xxx`
- If cached, interleave historical events with person events by year
- If not cached, show "Generate Historical Context" button
- Render historical events using `HistoricalEvent` component

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(auth)/person/
git commit -m "feat(web): biography tab and historical context on person detail"
```

---

## Task 13: AI budget settings page

**Files:**
- Create: `apps/web/app/api/settings/ai-budget/route.ts`
- Create: `apps/web/app/(auth)/settings/ai/page.tsx`

- [ ] **Step 1: Create ai-budget API route**

**GET** — Returns current budget + usage.
- Read `monthly_ai_budget_usd` from central DB `family_registry`
- Call `checkBudget(familyDb, limit)` and `getUsageStats(familyDb)`
- Return `{ limit, spent, remaining, overBudget, stats }`

**PATCH** — Update budget. Requires `settings:manage`.
- Body: `{ monthlyBudgetUsd: number }`
- Update `family_registry.monthly_ai_budget_usd`

- [ ] **Step 2: Create AI settings page**

Server component. Requires `settings:manage` permission (redirect others). Contains:
- Monthly budget input (numeric, USD) with save button
- Current month usage bar (spent / limit, colored green/yellow/red)
- Usage history table: fetched from stats endpoint
- Add to settings layout navigation

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/settings/ai-budget/ apps/web/app/(auth)/settings/ai/
git commit -m "feat(web): AI budget settings page with usage tracking"
```

---

## Task 14: GEDCOM 7.0 serializer

**Files:**
- Create: `apps/web/lib/gedcom/serialize-70.ts`
- Create: `apps/web/lib/gedcom/index.ts`

- [ ] **Step 1: Read existing serialize.ts**

Understand the 5.5.1 serializer structure, `GedcomExportData` interface, `ExportMode`.

- [ ] **Step 2: Create serialize-70.ts**

Reuse the same `GedcomExportData` interface. Key structural differences from 5.5.1:
- Header: `0 HEAD\n1 GEDC\n2 VERS 7.0\n1 SOUR Ancstra\n`
- Always UTF-8 (no `1 CHAR UNICODE`)
- Sources as top-level records (`0 @S1@ SOUR ...`) referenced by pointer
- Person/family records use `1 SOUR @S1@` instead of inline
- `0 TRLR` at end

- [ ] **Step 3: Create index.ts router**

```typescript
import { serializeGedcom as serialize551 } from './serialize';
import { serializeGedcom70 } from './serialize-70';

export function serializeGedcom(
  data: GedcomExportData,
  options: { version: '5.5.1' | '7.0'; mode: ExportMode }
): string {
  if (options.version === '7.0') return serializeGedcom70(data, options.mode);
  return serialize551(data, options.mode);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/gedcom/
git commit -m "feat(gedcom): GEDCOM 7.0 serializer with structural compliance"
```

---

## Task 15: GEDCOM export API route + updated UI

**Files:**
- Create: `apps/web/app/api/export/gedcom/route.ts`
- Create: `apps/web/components/export/export-options.tsx`
- Modify: `apps/web/app/(auth)/export/page.tsx`

- [ ] **Step 1: Create GEDCOM export API route**

```
GET /api/export/gedcom?version=5.5.1&includeLiving=true&includeSources=true
```

Permission: `gedcom:export`. Gathers data from family DB, applies living person filter if `includeLiving=false`, serializes using the version-appropriate serializer, returns file download.

- [ ] **Step 2: Create ExportOptions component**

Client component with:
- Format radio: GEDCOM 5.5.1 (default), GEDCOM 7.0
- Checkboxes: Include living persons, Include sources & citations
- Download button

- [ ] **Step 3: Update export page**

Replace the current server-action-based export with the new ExportOptions component that calls the API route.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/export/ apps/web/components/export/ apps/web/app/(auth)/export/
git commit -m "feat(web): GEDCOM export API with version selector and options"
```

---

## Task 16: Gotenberg client + packages/export scaffold

**Files:**
- Create: `packages/export/package.json`
- Create: `packages/export/tsconfig.json`
- Create: `packages/export/src/index.ts`
- Create: `packages/export/src/pdf/gotenberg-client.ts`
- Create: `packages/export/__tests__/gotenberg-client.test.ts`
- Create: `docker-compose.yml` (project root, for local dev)

- [ ] **Step 1: Create packages/export scaffold**

package.json with deps on `@ancstra/db`, `@ancstra/shared`. Add vitest for testing.

- [ ] **Step 2: Create gotenberg-client.ts**

```typescript
export class GotenbergClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.GOTENBERG_URL || 'http://localhost:3000';
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const formData = new FormData();
    formData.append('files', new Blob([html], { type: 'text/html' }), 'index.html');

    const response = await fetch(
      `${this.baseUrl}/forms/chromium/convert/html`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      throw new Error(`Gotenberg error: ${response.status} ${await response.text()}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 3: Write test**

Test `isAvailable()` returns false when no server. Test `htmlToPdf()` throws on connection error. (Integration test with real Gotenberg deferred to CI with Docker.)

- [ ] **Step 4: Create docker-compose.yml**

```yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    ports:
      - "3000:3000"
    restart: unless-stopped
```

- [ ] **Step 5: Commit**

```bash
git add packages/export/ docker-compose.yml
git commit -m "feat(export): Gotenberg client and Docker setup for PDF generation"
```

---

## Task 17: PDF templates

**Files:**
- Create: `packages/export/src/pdf/templates/family-history.ts`
- Create: `packages/export/src/pdf/templates/person-biography.ts`
- Create: `packages/export/src/pdf/index.ts`

- [ ] **Step 1: Create person-biography template**

```typescript
export function renderPersonBiographyHtml(data: {
  name: string;
  dates: string;
  biography: string;
  events: { date: string; type: string; place: string }[];
  sources: { title: string; citation: string }[];
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; line-height: 1.6; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
  .dates { color: #666; font-style: italic; }
  .biography { margin: 24px 0; }
  .events { margin-top: 24px; }
  .event { margin: 8px 0; }
  .sources { margin-top: 24px; font-size: 0.9em; }
  .source { margin: 4px 0; }
</style></head><body>
  <h1>${data.name}</h1>
  <p class="dates">${data.dates}</p>
  <div class="biography">${data.biography}</div>
  <!-- events and sources sections -->
</body></html>`;
}
```

- [ ] **Step 2: Create family-history template**

Larger template with cover page, TOC, person sections. Takes an array of persons with their biographies.

- [ ] **Step 3: Create pdf/index.ts**

Exports both templates + the GotenbergClient.

- [ ] **Step 4: Commit**

```bash
git add packages/export/src/pdf/
git commit -m "feat(export): PDF templates for person biography and family history"
```

---

## Task 18: PDF export API route

**Files:**
- Create: `apps/web/app/api/export/pdf/route.ts`

- [ ] **Step 1: Create PDF export route**

```
POST /api/export/pdf
Body: { template: 'family-history' | 'person-biography', personId?, options }
```

Permission: `gedcom:export`. Flow:
1. Auth check
2. Gather data from family DB (person + biography cache + events + sources)
3. Render HTML template
4. Check if Gotenberg is available
5. If available: send to Gotenberg, return PDF
6. If not: return HTML with header `X-PDF-Fallback: true` and note in response

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/export/pdf/
git commit -m "feat(web): PDF export API route via Gotenberg"
```

---

## Task 19: Performance optimization pass

**Files:**
- Modify: `apps/web/app/api/sources/route.ts`
- Modify: `apps/web/app/api/events/route.ts`
- Modify: `apps/web/lib/auth/api-guard.ts`

- [ ] **Step 1: Add pagination to sources route**

Read current `apps/web/app/api/sources/route.ts`. Add `page` and `pageSize` query params (default 50). Return `{ items, total, page, pageSize }`.

- [ ] **Step 2: Add pagination to events route**

Same treatment for `apps/web/app/api/events/route.ts`.

- [ ] **Step 3: Add query timing to api-guard.ts**

Read current `apps/web/lib/auth/api-guard.ts`. Add timing wrapper:

```typescript
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  if (duration > 500) {
    console.warn(`[SLOW] ${label}: ${duration.toFixed(0)}ms`);
  }
  return result;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/sources/ apps/web/app/api/events/ apps/web/lib/auth/api-guard.ts
git commit -m "feat(web): pagination on sources/events routes + query timing"
```

---

## Task 20: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Read current ROADMAP.md fully**

- [ ] **Step 2: Add Phase 4 section**

Add Phase 4: Authentication & Collaboration as completed (or in-progress on feature branch). Include:
- Multi-user RBAC (Owner/Admin/Editor/Viewer)
- Google + Apple OAuth
- Family invitations
- Activity feed
- Moderation queue
- Multi-DB architecture
- 113 tests passing

- [ ] **Step 3: Add Phase 5 section**

Add Phase 5: AI Polish & Export with task breakdown:
- Data quality dashboard (recharts)
- AI biography generation (guided options, streaming, caching)
- Historical context timeline overlay
- GEDCOM 7.0 export (structural compliance)
- Narrative PDF export (Gotenberg)
- AI budget hard limit
- Performance optimization (pagination, query timing)

- [ ] **Step 4: Update "Current Focus" section**

Update to reflect Phase 4 complete, Phase 5 in progress.

- [ ] **Step 5: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update ROADMAP with Phase 4 complete and Phase 5 breakdown"
```

---

## Task Dependency Order

```
Task 1 (schema) → Task 2 (cost tracker)
                → Task 3 (quality queries)

Task 3 → Task 4 (quality API + recharts install) → Task 5 (quality dashboard UI)

Task 1 + 2 → Task 6 (biography prompt)
           → Task 7 (historical context prompt)

Task 6 → Task 8 (biography API)
Task 7 → Task 9 (historical context API)

Task 8 → Task 10 (biography UI)
Task 9 → Task 11 (historical event component)
Task 10 + 11 → Task 12 (integrate into person detail)

Task 1 + 2 → Task 13 (AI budget settings)

Task 14 (GEDCOM 7.0) — independent
Task 14 → Task 15 (GEDCOM export API + UI)

Task 16 (Gotenberg client) → Task 17 (PDF templates) → Task 18 (PDF API)

Task 19 (performance) — independent

Task 20 (ROADMAP) — independent, do anytime
```

**Parallelizable groups:**
- Tasks 2, 3 can run in parallel after Task 1
- Tasks 4, 6, 7, 13, 14, 16, 19, 20 can run in parallel once their deps are met
- Tasks 8, 9, 10, 11, 15, 17 can run in parallel once their deps are met
