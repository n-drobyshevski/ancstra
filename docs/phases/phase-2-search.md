# Phase 2: AI Search, Research & Matching

> Weeks 9-20 | Started: TBD | Target: TBD

## Approach (2026-03-22)

Phase 2 is now significantly expanded beyond the original FamilySearch + matching + AI chat scope. It now includes a full OSINT-powered research workspace with multi-source search, web scraping, evidence analysis, and structured fact management. See the [research workspace design spec](../superpowers/specs/2026-03-22-research-workspace-design.md) for the full architecture.

**Key design decisions:**
- **Research + Source Hybrid** (Approach C): Research items stage in a lightweight table. Promotion to `sources` is one-click. Keeps the tree clean.
- **Free/open APIs first + full web scraping**: Playwright on Hono worker for JS-rendered pages.
- **Evidence workspace with tabbed views** (Hybrid 3): Board (default), Canvas, Matrix, Timeline, Conflicts, Proof Summary. Ship Board first, add others incrementally.
- **AI chat is parallel, not the hub**: Research workspace is standalone. AI chat shares data but is a separate interface.

## Goals

- Build a multi-source search engine with pluggable provider architecture (8+ sources)
- Deliver a full-power web scraping engine (Playwright) for sites without APIs
- Create a research item staging area with draft/promote/dismiss workflow
- Build an evidence analysis workspace with multiple view modes per person
- Implement structured fact extraction with conflict detection
- Connect the app to FamilySearch's 66 billion records via OAuth
- Build an intelligent record matching engine with probabilistic scoring
- Deliver an AI-powered research assistant with tool-calling capability
- Scaffold the Hono worker backend for heavy scraping/matching jobs

## Systems in Scope

- [Research Workspace Design](../superpowers/specs/2026-03-22-research-workspace-design.md) (NEW)
- [FamilySearch API](../specs/familysearch-api.md)
- [Record Matching](../specs/record-matching.md)
- [AI Research Assistant](../specs/ai-research-assistant.md)
- [Relationship Validation](../specs/relationship-validation.md)
- [Backend Architecture](../superpowers/specs/2026-03-21-backend-architecture-design.md)

## Task Breakdown

### Week 9-10: Hono Worker Scaffold + Search Infrastructure

**Goal:** Scaffold the Hono worker, create packages/research, implement SearchProvider interface.

- [ ] Scaffold `apps/worker` with Hono (see backend architecture spec)
  - [ ] Health check, JWT auth middleware, job dispatch routes
  - [ ] Docker setup for Railway deployment
  - [ ] WebSocket for job progress
- [ ] Create `packages/research` monorepo package
  - [ ] `SearchProvider` interface + `SearchRequest` / `SearchResult` types
  - [ ] Provider registry with enable/disable, health tracking
  - [ ] Rate limiter (token bucket, per-provider)
- [ ] Database migration: `research_items`, `research_item_persons`, `research_facts`, `search_providers` tables
- [ ] Add `research_canvas_positions` table for canvas view
- [ ] FTS5 virtual table for research items
- [ ] Research item CRUD API routes (`/api/research/items`)
- [ ] Write ADR-007 (Hono worker sidecar)

### Week 10-12: FamilySearch + Core Providers

**Goal:** Implement FamilySearch OAuth and 3-4 additional search providers.

- [ ] FamilySearch OAuth 2.0 PKCE flow
  - [ ] `generateAuthUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()`
  - [ ] Callback route, token storage in session
  - [ ] "Connect to FamilySearch" UI
- [ ] FamilySearch SearchProvider implementation
  - [ ] Person search, record search, place authority
  - [ ] Rate limiting (30 req/min), auto-refresh on 401
- [ ] NARA Catalog SearchProvider
- [ ] Chronicling America SearchProvider
- [ ] Unified search UI
  - [ ] Single search bar, federated results across enabled providers
  - [ ] Result cards with provider badge, relevance score
  - [ ] "Save" button to create research item
- [ ] Offline mock providers for development

### Week 12-13: Web Scraping + Additional Providers

**Goal:** Playwright scraping engine + FindAGrave, WikiTree, web search.

- [ ] Playwright integration on Hono worker
  - [ ] `POST /jobs/scrape-url` — single URL scrape
  - [ ] `POST /jobs/scrape-batch` — queue of URLs
  - [ ] Extract: title, text content, metadata, screenshot
  - [ ] Rate limiting (1 req/sec/domain), robots.txt awareness
- [ ] Web archive storage (HTML + screenshot to local filesystem)
- [ ] FindAGrave provider (unofficial API / scrape hybrid)
- [ ] WikiTree provider (free API)
- [ ] Web search provider (SearXNG self-hosted or Brave Search API)
- [ ] Geneanet provider (scraper, Hono worker)
- [ ] OpenArchives provider (OAI-PMH)
- [ ] Hybrid clipping system
  - [ ] URL paste + extract (dispatches to Playwright)
  - [ ] Text paste + AI entity extraction
- [ ] Provider configuration UI (`/settings/providers`)

### Week 13-14: Record Matching Engine

**Goal:** Build probabilistic matching for FamilySearch records.

- [ ] Jaro-Winkler name comparison (`packages/matching`)
- [ ] Date comparator (exact/±1yr/±2yr/decade/missing)
- [ ] Place comparator (exact/county/state/country/missing)
- [ ] Composite scoring with configurable weights (50% name, 30% date, 20% place)
- [ ] Blocking strategy (surname + birth decade filter before scoring)
- [ ] Hints generation pipeline
  - [ ] For each person: query FamilySearch, score matches, store top hits
  - [ ] Store in `match_candidates` table
- [ ] Hints review UI
  - [ ] Cards with confidence score, record preview
  - [ ] Accept / reject / maybe buttons
  - [ ] Side-by-side comparison (local vs FamilySearch)
- [ ] Relationship validation queue
  - [ ] Pending proposals from AI, matching, imports
  - [ ] Editor review with evidence display

### Week 14-16: Evidence Analysis Workspace

**Goal:** Build the per-person evidence workspace with Board tab as default.

- [ ] Workspace page at `/research/person/[id]`
  - [ ] Person header (name, dates, avatar)
  - [ ] Tab navigation (Board, Conflicts, Timeline — Canvas/Matrix/Proof later)
- [ ] **Board tab** (3-column layout)
  - [ ] Left: source list (promoted sources + draft research items, dismissed faded)
  - [ ] Center: fact matrix (rows = facts, columns = sources, conflicts highlighted)
  - [ ] Right: detail panel (archived content, extracted facts, notes, actions)
- [ ] Research facts CRUD
  - [ ] Manual fact entry per research item or source
  - [ ] AI-assisted fact extraction from research item text
  - [ ] Fact confidence ratings (high/medium/low/disputed)
- [ ] Conflict detection
  - [ ] SQL query: same person + same fact_type + different fact_value
  - [ ] Visual highlighting in fact matrix (red rows)
  - [ ] Conflict resolution: accept one value, mark disputed
- [ ] **Conflicts tab**
  - [ ] Dedicated list of all fact disagreements
  - [ ] Each conflict: competing claims, source links, resolution buttons
- [ ] **Timeline tab**
  - [ ] Chronological events from all sources
  - [ ] Each event linked to its source
  - [ ] Visual gaps where evidence is missing

### Week 16-17: Source Promotion + AI Research Assistant

**Goal:** One-click promotion workflow and Claude-powered chat.

- [ ] Source promotion workflow
  - [ ] Research item → source with auto-generated citation
  - [ ] AI citation generation (Chicago / Evidence Explained style)
  - [ ] Fact carry-over: research_facts → source_citations
  - [ ] Backlink via `research_items.promoted_source_id`
- [ ] Vercel AI SDK + Claude integration
  - [ ] Streaming chat API route (`/api/ai/chat`)
  - [ ] System prompt with tree context injection
  - [ ] Model selection per task (Haiku/Sonnet/Opus)
  - [ ] Cost tracking + monthly budget
- [ ] Core AI tools
  - [ ] `searchLocalTree` — FTS5 search
  - [ ] `searchFamilySearch` — FamilySearch records
  - [ ] `searchNARA` — NARA catalog
  - [ ] `searchNewspapers` — Chronicling America
  - [ ] `computeRelationship` — path-finding between two persons
  - [ ] `analyzeTreeGaps` — identify research gaps
  - [ ] `explainRecord` — historical record context
  - [ ] `proposeRelationship` — create pending proposal
- [ ] Research-specific AI tools
  - [ ] `searchWeb` — federated search across all providers
  - [ ] `scrapeUrl` — fetch + extract a web page
  - [ ] `getResearchItems` — retrieve staged items for a person
  - [ ] `extractFacts` — structured fact extraction from text
  - [ ] `detectConflicts` — find fact disagreements
  - [ ] `suggestSearches` — recommend sources based on gaps
- [ ] Chat UI (`/research` page)
  - [ ] Message history, streaming responses
  - [ ] Tool call indicators and results
  - [ ] "Ask AI" button from evidence workspace

### Week 17-18: Additional Workspace Tabs

**Goal:** Add Matrix and Canvas tabs to the evidence workspace.

- [ ] **Matrix tab** (full-width spreadsheet)
  - [ ] Facts as rows, sources as columns
  - [ ] Editable Conclusion column for user assessments
  - [ ] Conflict rows highlighted
  - [ ] Click cell for source detail slide-out
  - [ ] CSV/PDF export
- [ ] **Canvas tab** (React Flow spatial canvas)
  - [ ] Draggable source cards, note cards, conflict nodes
  - [ ] Connection lines between related sources
  - [ ] Left sidebar: source palette (drag to add)
  - [ ] Floating toolbar: Connect, Auto-Layout, Zoom Fit
  - [ ] Canvas positions stored in `research_canvas_positions` table
- [ ] **Proof Summary tab**
  - [ ] GPS-inspired proof statement builder
  - [ ] Sections: Question, Sources Consulted, Information Items, Analysis, Conclusion
  - [ ] Exportable as document

### Week 19-20: Integration Testing & Polish

**Goal:** End-to-end testing, performance, documentation.

- [ ] Integration tests
  - [ ] Search provider tests (mock responses)
  - [ ] Research item lifecycle (create → tag → promote → verify source created)
  - [ ] Fact extraction + conflict detection
  - [ ] FamilySearch OAuth flow (sandbox)
  - [ ] Matching engine precision test
  - [ ] AI tool calling (5 predefined queries)
  - [ ] Playwright scraping (live URL test)
- [ ] Performance
  - [ ] Search response time < 2s for federated search
  - [ ] Evidence workspace loads < 1s for person with 10+ sources
  - [ ] Phase 1 baselines still pass
- [ ] Provider health monitoring
  - [ ] Cron job: daily health check on all providers
  - [ ] Auto-disable after 3 consecutive failures
- [ ] Documentation
  - [ ] Research workspace usage guide
  - [ ] Search provider development guide (how to add a new provider)
  - [ ] FamilySearch integration setup (OAuth, rate limits)
  - [ ] Matching algorithm documentation

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | SearchProvider interface + registry, FamilySearch OAuth + provider, Research items CRUD + staging workflow, Evidence workspace Board tab + fact matrix, Conflict detection, Source promotion, AI research assistant (chat + core tools), Hono worker scaffold |
| **Should** | NARA + Chronicling America providers, Playwright scraping, Hints + matching engine, Conflicts tab, Timeline tab, URL/text paste clipping, Research-specific AI tools |
| **Could** | FindAGrave, WikiTree, Geneanet, OpenArchives providers, Matrix tab, Canvas tab, Proof Summary tab, Web search provider, Provider health monitoring, CSV/PDF export |
| **Won't (this phase)** | DNA match correlation, FamilySearch bidirectional sync, Auto-accept hints, ML-based matching improvement, Provider marketplace |

## Build Order (Incremental Delivery)

1. Hono worker scaffold + packages/research + schema migration
2. FamilySearch provider + unified search UI
3. Research items staging + save/tag workflow
4. Evidence workspace Board tab (3-column layout)
5. Fact extraction + conflict detection
6. Record matching + hints
7. Source promotion workflow
8. AI research assistant (chat + tools)
9. Playwright scraping + additional providers
10. Timeline + Conflicts tabs
11. Matrix tab
12. Canvas tab
13. Proof Summary tab

## API Resilience

- [ ] All search providers have mock/fixture implementations
- [ ] Development works without live API access
- [ ] Playwright scraping has timeout + fallback to basic fetch
- [ ] AI tools handle provider failures gracefully (suggest manual search)

## Mid-Phase Checkpoint (Week 14)

At midpoint, assess:
- [ ] SearchProvider interface works with 2+ real providers
- [ ] Research items can be saved and tagged to persons
- [ ] Board tab renders with fact matrix
- [ ] If behind: defer Canvas tab, Matrix tab, Proof Summary to Phase 5 buffer

## Exit Gate: Phase 2 to Phase 3

Before starting Phase 3, verify:
- [ ] FamilySearch OAuth works end-to-end
- [ ] At least 4 search providers functional
- [ ] Research items: save, tag, promote, dismiss workflow works
- [ ] Evidence workspace Board tab functional with fact matrix
- [ ] Conflict detection identifies disagreements correctly
- [ ] Matching engine >80% precision on test dataset
- [ ] AI assistant answers 5 predefined queries with correct tool calls
- [ ] Playwright scrapes and archives a URL successfully
- [ ] Hono worker deploys to Railway with health check
- [ ] Phase 1 performance baselines still pass

## Feedback Loop

After Phase 2 is complete:
- [ ] Post on r/Genealogy for feedback on research workspace concept
- [ ] Screen-share: watch someone research an ancestor using the workspace
- [ ] Ask: "Does the evidence board help? What view mode do you use most?"
- [ ] Document feedback for Phase 3+ prioritization

---

## Key Risks

1. **FamilySearch API rate limiting** — batch operations could trigger limits. Mitigate: conservative rate limiter, background queue, on-demand over batch.

2. **Matching false positives** — Jaro-Winkler alone may miss edge cases. Mitigate: conservative thresholds (0.75 min), collect user feedback, iterate scoring weights.

3. **AI tool calling failures** — malformed arguments or API errors. Mitigate: comprehensive error handling, fallback to manual search suggestions.

4. **Playwright on Railway** — headless Chromium uses ~200-400MB RAM. Mitigate: limit to 1 concurrent scrape job, prefer client-side for single pages, fallback to basic fetch.

5. **Scraping legal/ethical** — some sites may block or have ToS against scraping. Mitigate: respect robots.txt by default, identify as Ancstra, use official APIs where available.

6. **Scope management** — research workspace has 6 tabs. Mitigate: ship Board first, add tabs incrementally per MoSCoW. Canvas and Proof Summary can defer to Phase 5 if needed.

## Decisions Made During This Phase

(Empty — filled during implementation)

## Retrospective

(Empty — filled at phase end)
