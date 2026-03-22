# Research Workspace Design: OSINT-Powered Evidence Analysis

> Date: 2026-03-22 | Status: Approved
> Phase: 2 (extends existing Phase 2 plan)
> Architecture: Approach C — Research + Source Hybrid with staging/promotion workflow

## Problem Statement

Phase 2 originally focused narrowly on FamilySearch API, record matching, and a basic AI chat. Genealogy research requires a broader toolkit:

- Searching across many free/open sources (not just FamilySearch)
- Full-power web scraping for sites without APIs
- A staging area for discoveries before they become official sources
- Structured evidence analysis with conflict detection
- Multiple workspace views for different thinking modes (structured, spatial, dense)

This design extends Phase 2 with a comprehensive research subsystem.

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Research + Source Hybrid** (Approach C) | Research items stage in a lightweight table. Promotion to `sources` is one-click. Keeps the tree clean while allowing rapid capture. |
| 2 | **Free/open APIs first + full web scraping** | Maximize data access. Playwright on Hono worker for JS-rendered pages. |
| 3 | **Hybrid clipping** | In-app search is primary. External URLs/text can be pasted and Ancstra extracts + archives. |
| 4 | **Evidence analysis workspace** | Per-person view with multiple tabbed modes (Board, Canvas, Matrix, Timeline, Conflicts, Proof Summary). |
| 5 | **Tabbed view modes (Hybrid 3)** | Board is default. Canvas and Matrix are added later. All share the same data layer. Ship incrementally. |
| 6 | **AI chat is parallel, not the hub** | Research workspace is a standalone direct-manipulation UI. AI chat shares data but is a separate interface. |
| 7 | **Minimal audit trail** | Sources attached to persons are the record. No research journal bloat. |

## Architecture Overview

```
Client (Browser)
    |
    | Search request
    |
Next.js API ─── /api/research/search
    |                    |
    | Fast providers     | Heavy providers
    | (API-based)        | (scraping, web search)
    |                    |
    v                    v
FamilySearch         Hono Worker
NARA                   Playwright scraper
Chronicling America    Web search (SearXNG/Brave)
FindAGrave             Batch URL archiving
WikiTree               AI entity extraction
Geneanet
OpenArchives
    |                    |
    +--------+-----------+
             |
     Normalize to SearchResult
             |
     User: "Save" → research_item (draft)
     User: "Promote" → source + source_citation
```

### Split Principle

| Path | Where | What |
|------|-------|------|
| Fast (API-based search) | Next.js API routes | FamilySearch, NARA, Chronicling America, FindAGrave, WikiTree, Geneanet, OpenArchives |
| Heavy (scraping, web search) | Hono Worker (Railway) | Playwright page scraping, SearXNG/Brave web search, batch URL archiving, AI entity extraction |

## Data Model

### New Tables

```sql
-- Research items: staging area for discoveries
CREATE TABLE research_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  url TEXT,
  snippet TEXT,
  full_text TEXT,
  notes TEXT,

  -- Archive: HTML stored as file on disk (not inline — avoids DB bloat)
  archived_html_path TEXT,           -- path to archived HTML file
  screenshot_path TEXT,              -- path to screenshot image
  archived_at TEXT,

  -- Discovery metadata
  provider_id TEXT,
  provider_record_id TEXT,
  discovery_method TEXT NOT NULL CHECK (discovery_method IN (
    'search', 'scrape', 'paste_url', 'paste_text', 'ai_suggestion'
  )),
  search_query TEXT,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'promoted', 'dismissed'
  )),
  promoted_source_id TEXT REFERENCES sources(id),

  -- Ownership (C3 fix: multi-user scoping)
  created_by TEXT NOT NULL,          -- user_id of researcher

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Link research items to persons (many-to-many)
CREATE TABLE research_item_persons (
  research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  PRIMARY KEY (research_item_id, person_id)
);

-- Structured fact claims from any source
-- Note: both research_item_id and source_citation_id can be set simultaneously.
-- During promotion, the fact retains its research_item_id (origin) and gains
-- a source_citation_id (promoted target). At least one must be set.
CREATE TABLE research_facts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL CHECK (fact_type IN (
    'name', 'birth_date', 'birth_place', 'death_date', 'death_place',
    'marriage_date', 'marriage_place', 'residence', 'occupation',
    'immigration', 'military_service', 'religion', 'ethnicity',
    'parent_name', 'spouse_name', 'child_name', 'other'
  )),
  fact_value TEXT NOT NULL,
  fact_date_sort INTEGER,

  -- Source linkage: at least one must be set. Both set after promotion.
  research_item_id TEXT REFERENCES research_items(id) ON DELETE CASCADE,
  source_citation_id TEXT REFERENCES source_citations(id) ON DELETE CASCADE,

  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low', 'disputed')) DEFAULT 'medium',
  extraction_method TEXT CHECK (extraction_method IN (
    'manual', 'ai_extracted', 'ocr_extracted'
  )) DEFAULT 'manual',

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (research_item_id IS NOT NULL OR source_citation_id IS NOT NULL)
);

-- Canvas positions for the evidence canvas view (like tree_layouts)
CREATE TABLE research_canvas_positions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('research_item', 'source', 'note', 'conflict')),
  node_id TEXT NOT NULL,             -- ID of the research_item, source, or generated note
  x REAL NOT NULL,
  y REAL NOT NULL,
  UNIQUE(person_id, node_type, node_id)
);

-- Search provider registry
CREATE TABLE search_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('api', 'scraper', 'web_search')),
  base_url TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,                       -- JSON: API keys, rate limits, custom settings
  rate_limit_rpm INTEGER DEFAULT 30,
  health_status TEXT CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')) DEFAULT 'unknown',
  last_health_check TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

**FTS5 Sync Contract:** The `fts_research_items` virtual table uses external content mode (`content=''`). Application code must explicitly insert/update/delete FTS entries when research items are created, updated, or deleted. This is handled in `packages/research/facts/fts-sync.ts` — the same pattern used for `fts_persons` in `packages/db`.

### Schema Changes to Existing Tables

None. The `research_items.promoted_source_id` FK provides the link from research to sources. To query "was this source promoted from research?", use `SELECT * FROM research_items WHERE promoted_source_id = :sourceId`. No reverse FK needed on `sources` — avoids bidirectional FK complexity.

### Indexes

```sql
-- Research items
CREATE INDEX idx_research_items_status ON research_items(status);
CREATE INDEX idx_research_items_provider ON research_items(provider_id);
CREATE INDEX idx_research_items_promoted ON research_items(promoted_source_id)
  WHERE promoted_source_id IS NOT NULL;
CREATE INDEX idx_research_items_created_at ON research_items(created_at);
CREATE INDEX idx_research_items_created_by ON research_items(created_by);
CREATE INDEX idx_research_item_persons_person ON research_item_persons(person_id);

-- Research facts
CREATE INDEX idx_research_facts_person ON research_facts(person_id);
CREATE INDEX idx_research_facts_type ON research_facts(person_id, fact_type);
CREATE INDEX idx_research_facts_research_item ON research_facts(research_item_id)
  WHERE research_item_id IS NOT NULL;
CREATE INDEX idx_research_facts_citation ON research_facts(source_citation_id)
  WHERE source_citation_id IS NOT NULL;

-- Canvas positions
CREATE INDEX idx_research_canvas_person ON research_canvas_positions(person_id);

CREATE VIRTUAL TABLE fts_research_items USING fts5(
  research_item_id UNINDEXED,
  title, snippet, full_text, notes,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);
```

### Conflict Detection Query

```sql
-- Exclude multi-valued fact types where multiple distinct values are expected
-- (residence, occupation, child_name can legitimately have many values)
SELECT
  f1.fact_type,
  f1.fact_value AS value_a,
  f2.fact_value AS value_b,
  f1.confidence AS confidence_a,
  f2.confidence AS confidence_b,
  f1.id AS fact_a_id,
  f2.id AS fact_b_id
FROM research_facts f1
JOIN research_facts f2
  ON f1.person_id = f2.person_id
  AND f1.fact_type = f2.fact_type
  AND f1.id < f2.id
  AND f1.fact_value != f2.fact_value
WHERE f1.person_id = :personId
  AND f1.fact_type NOT IN ('residence', 'occupation', 'child_name', 'other');
```

## Search Provider Architecture

### SearchProvider Interface

```typescript
interface SearchProvider {
  id: string;
  name: string;
  type: 'api' | 'scraper' | 'web_search';
  search(query: SearchRequest): Promise<SearchResult[]>;
  getRecord(recordId: string): Promise<RecordDetail>;
  healthCheck(): Promise<HealthStatus>;
}

interface SearchRequest {
  givenName?: string;
  surname?: string;
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  freeText?: string;
  recordType?: RecordType;
  dateRange?: { start: number; end: number };
  location?: string;
}

interface SearchResult {
  providerId: string;
  externalId: string;
  title: string;
  snippet: string;
  url: string;
  recordType?: RecordType;
  relevanceScore?: number;
  extractedData?: {
    name?: string;
    birthDate?: string;
    deathDate?: string;
    location?: string;
  };
  thumbnailUrl?: string;
}
```

### Provider Implementations

| Provider | Type | Auth | Rate Limit |
|----------|------|------|------------|
| FamilySearch | API | OAuth PKCE | 30 req/min |
| NARA Catalog | API | Free key | 10K/month |
| Chronicling America | API | None | Unlimited |
| FindAGrave | Scraper/API | None (unofficial) | Respectful |
| WikiTree | API | Apps key | Moderate |
| Geneanet | Scraper | None (no public API) | Respectful |
| OpenArchives | API | OAI-PMH | Moderate |
| Web Search | API | SearXNG (self-hosted) or Brave Search API | Configurable |
| URL Scraper | Scraper | None | Rate-limited |

### Monorepo Package

```
packages/research/
  src/
    providers/
      types.ts            # SearchProvider interface
      registry.ts         # provider registration + dispatch
      familysearch.ts     # (moved from existing location)
      nara.ts
      chronicling-america.ts
      findagrave.ts
      wikitree.ts
      geneanet.ts
      openarchives.ts
      web-search.ts       # SearXNG / Brave
    scraper/
      url-scraper.ts      # Playwright page extraction
      archiver.ts         # HTML + screenshot archiving
      extractor.ts        # metadata + text extraction
    facts/
      extract.ts          # AI fact extraction from text
      conflicts.ts        # conflict detection logic
      promote.ts          # research item -> source
    index.ts
```

## Evidence Analysis Workspace

### URL Structure

```
/research/person/[personId]          # Evidence workspace for a person
/research/person/[personId]?view=board    # Board tab (default)
/research/person/[personId]?view=canvas   # Canvas tab
/research/person/[personId]?view=matrix   # Matrix tab
/research/person/[personId]?view=timeline # Timeline tab
/research/person/[personId]?view=conflicts # Conflicts tab
/research/person/[personId]?view=proof    # Proof Summary tab
```

### View Modes (Tabbed)

All tabs share the same underlying data (`research_items`, `research_facts`, `sources`, `source_citations`).

#### Board (Default) — Option A
3-column layout: source list | fact matrix | detail panel.
- Left: scrollable list of sources (promoted, green) and research items (draft, gold). Dismissed items faded.
- Center: fact matrix table — rows are facts, columns are sources. Conflicts highlighted red.
- Right: detail panel for selected source — archived content, extracted facts, notes, actions (Promote, Ask AI, View Archive, Dismiss).

#### Canvas — Option B
React Flow spatial canvas with draggable source cards.
- Left sidebar: source palette (drag to canvas).
- Main: canvas with source cards, note cards, conflict nodes, connection lines.
- Floating toolbar: Connect, Auto-Layout, Zoom Fit.
- Canvas positions stored in `research_canvas_positions` table (like `tree_layouts`).

#### Matrix — Option D
Full-width fact spreadsheet.
- Rows: fact types. Columns: sources. Final column: editable Conclusion.
- Conflict rows highlighted. Click any cell for source detail in slide-out panel.
- Exportable as CSV/PDF.

#### Timeline
Chronological view of all events/facts from all sources for the person. Shows where evidence clusters and where gaps exist. Each event linked to its source.

#### Conflicts
Dedicated view showing all fact disagreements. Each conflict shows competing claims, their sources, and AI-generated analysis. Resolve inline with Accept/Reject/Dispute buttons.

#### Proof Summary
GPS-inspired proof statement builder. Lists: the question being answered, sources consulted, information items extracted, analysis of conflicts, and conclusion. Exportable as document.

### Build Order

1. **Board** — ship first (most structured, most useful day-to-day)
2. **Conflicts** — ship with Board (critical for evidence analysis)
3. **Timeline** — ship next (relatively simple, high value)
4. **Matrix** — ship next (different density, useful for power users)
5. **Canvas** — ship last (most complex, uses React Flow)
6. **Proof Summary** — ship last (least urgent, most specialized)

## Web Scraping

### Playwright on Hono Worker

```typescript
// Hono worker routes
POST /jobs/scrape-url       // Single URL scrape
POST /jobs/scrape-batch     // Queue of URLs
POST /jobs/web-search       // SearXNG/Brave search + optional scrape of results

// Job output
interface ScrapeResult {
  url: string;
  title: string;
  textContent: string;
  html: string;
  screenshotPath: string;
  metadata: {
    author?: string;
    publishedDate?: string;
    siteName?: string;
  };
  extractedEntities?: EntityExtractionOutput;  // if AI extraction requested
}
```

### Scraping Rules

- Respect `robots.txt` by default (configurable override per provider)
- Rate limit: max 1 request/second per domain
- User-Agent identifies Ancstra
- Archive HTML + screenshot to local storage
- Timeout: 30 seconds per page

## AI Integration Extensions

### New Tools for Research Assistant

```typescript
// Search across all enabled providers
tool: searchWeb({
  query: string,
  providers?: string[],      // subset of providers, or all
  maxResults?: number
})

// Scrape and extract from a URL
tool: scrapeUrl({
  url: string,
  extractEntities?: boolean  // run AI entity extraction on content
})

// Get research items for a person
tool: getResearchItems({
  personId: string,
  status?: 'draft' | 'promoted' | 'all'
})

// Extract structured facts from text
tool: extractFacts({
  text: string,
  documentType?: string,
  personContext?: string     // known facts about the person for context
})

// Find fact conflicts across sources
tool: detectConflicts({
  personId: string
})

// Suggest what to search next based on gaps
tool: suggestSearches({
  personId: string,
  maxSuggestions?: number
})
```

### Evidence-Aware Context

The tree context injection (`buildTreeContext`) is extended to include:
- Count of research items per person (draft vs promoted)
- Known conflicts for the focus person
- List of providers already searched for this person

## Source Promotion Workflow

```
research_item (draft)
    |
    | User clicks "Promote to Source"
    |
    v  (entire promotion runs in a single SQLite transaction)
1. Create sources record (title, author, publisher, URL from research_item)
2. AI generates citation text (Chicago / Evidence Explained style)
3. Create source_citations linking to person/event
4. Update research_facts: set source_citation_id on facts from this item
   (research_item_id is retained as origin backlink)
5. Set research_item.status = 'promoted'
6. Set research_item.promoted_source_id = new source ID
7. COMMIT transaction
```

## Hybrid Clipping System

### In-App Save
Any search result can be saved as a `research_item` with one click. Metadata (title, URL, snippet, provider) auto-populated from `SearchResult`.

### URL Paste + Extract
1. User pastes a URL into the research workspace
2. Next.js dispatches to Hono worker: `POST /jobs/scrape-url`
3. Worker fetches page via Playwright, extracts text/metadata, takes screenshot
4. Returns `ScrapeResult` → creates `research_item` with archived content
5. Optionally runs AI entity extraction on the text

### Text Paste + Extract
1. User pastes raw text (e.g., from a PDF or email)
2. AI extracts entities (names, dates, places, relationships)
3. Creates `research_item` with `discovery_method = 'paste_text'`
4. Extracted facts stored as `research_facts`

## Provider Registry

### Configuration UI

Settings page at `/settings/providers`:
- List of all providers with enable/disable toggles
- API key input fields where needed
- Rate limit usage indicators
- Health status badges (healthy/degraded/down)
- "Test Connection" button per provider

### Health Monitoring

Background health checks via Hono worker cron:
- `GET /cron/provider-health` — runs daily, pings each provider's API
- Updates `search_providers.health_status` and `last_health_check`
- Auto-disables providers that fail 3 consecutive checks

## Complete Feature List

### Multi-Source Search Engine
- [ ] SearchProvider interface + registry
- [ ] FamilySearch provider (existing, moved to packages/research)
- [ ] NARA Catalog provider (existing, moved)
- [ ] Chronicling America provider (existing, moved)
- [ ] FindAGrave provider
- [ ] WikiTree provider
- [ ] Geneanet provider (scraper)
- [ ] OpenArchives provider (OAI-PMH)
- [ ] Web search provider (SearXNG / Brave)
- [ ] Unified search UI (federated results)
- [ ] Provider-specific search (dedicated search per source)
- [ ] Rate limiting per provider
- [ ] Offline mock providers for development

### Web Scraping Engine
- [ ] Playwright integration on Hono worker
- [ ] URL scraper (text, metadata, screenshot)
- [ ] AI entity extraction from scraped text
- [ ] Web archive storage (HTML + screenshot)
- [ ] Respectful scraping (rate limits, robots.txt)
- [ ] Batch scraping (queue of URLs)

### Research Items
- [ ] research_items table + migration
- [ ] CRUD API routes
- [ ] Save search result as research item
- [ ] URL paste + extract
- [ ] Text paste + extract
- [ ] Status workflow (draft/promoted/dismissed)
- [ ] Person tagging (many-to-many)
- [ ] Bulk operations (tag, dismiss, promote)
- [ ] FTS5 search across research items

### Evidence Analysis Workspace
- [ ] Workspace page at /research/person/[id]
- [ ] Board tab (3-column: sources | matrix | detail)
- [ ] Conflicts tab (dedicated conflict resolution)
- [ ] Timeline tab (chronological events)
- [ ] Matrix tab (full-width spreadsheet with conclusions)
- [ ] Canvas tab (React Flow spatial canvas)
- [ ] Proof Summary tab (GPS-style proof builder)

### Fact Extraction & Conflict Detection
- [ ] research_facts table + migration
- [ ] Manual fact entry
- [ ] AI-assisted fact extraction
- [ ] Conflict detection query
- [ ] Conflict resolution UI (accept/reject/dispute)
- [ ] Fact confidence ratings

### Source Promotion
- [ ] One-click promote workflow
- [ ] AI citation generation
- [ ] Fact carry-over to source_citations
- [ ] Link preservation (research_items.promoted_source_id backlink)

### Hybrid Clipping
- [ ] In-app save from search results
- [ ] URL paste + Playwright extraction
- [ ] Text paste + AI extraction
- [ ] Screenshot archiving

### Provider Registry
- [ ] search_providers table + migration
- [ ] Provider configuration UI (/settings/providers)
- [ ] Health monitoring (cron)
- [ ] API key management

### AI Integration
- [ ] searchWeb tool
- [ ] scrapeUrl tool
- [ ] getResearchItems tool
- [ ] extractFacts tool
- [ ] detectConflicts tool
- [ ] suggestSearches tool
- [ ] Evidence-aware context injection

## Related Documentation

- [Phase 2 Plan](../../phases/phase-2-search.md) — updated with research features
- [AI Strategy](../../architecture/ai-strategy.md) — tool definitions
- [Backend Architecture](2026-03-21-backend-architecture-design.md) — Hono worker for scraping
- [Data Model](../../architecture/data-model.md) — source of truth for schema
- [Style Philosophy](../../design/style-philosophy.md) — Indigo Heritage palette
