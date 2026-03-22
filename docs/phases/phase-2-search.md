# Phase 2: AI Search & Matching

> Weeks 9-18 | Started: TBD | Target: TBD

## Goals

- Connect the app to FamilySearch's 66 billion records via OAuth authentication
- Build an intelligent record matching engine with probabilistic scoring (Jaro-Winkler, blocking, confidence thresholds)
- Deliver an AI-powered research assistant that intelligently queries multiple free data sources
- Implement one-click record attachment and source linking workflow

## Systems in Scope

- [FamilySearch API](../specs/familysearch-api.md)
- [Record Matching](../specs/record-matching.md)
- [AI Research Assistant](../specs/ai-research-assistant.md)
- [Relationship Validation](../specs/relationship-validation.md)

## Task Breakdown

### Week 9-10: FamilySearch OAuth & API Client Setup

**Goal:** Authenticate with FamilySearch and establish API client infrastructure.

- [ ] Register for FamilySearch developer account and obtain client credentials
  - [ ] Get `client_id` and `client_secret` for both sandbox and production
  - [ ] Add to `.env.local`
- [ ] Implement OAuth 2.0 PKCE flow:
  - [ ] Create `apps/web/lib/familysearch/auth.ts` with:
    - [ ] `generateAuthUrl()` — generates authorization URL with code_challenge (S256)
    - [ ] `exchangeCodeForTokens()` — exchanges auth code + verifier for access/refresh tokens
    - [ ] `refreshAccessToken()` — refreshes expired tokens
  - [ ] Create callback route `apps/web/app/api/auth/familysearch/callback` to handle redirect
  - [ ] Store access/refresh tokens in NextAuth.js session
  - [ ] Add logout endpoint to revoke tokens
- [ ] Build FamilySearch API client `apps/web/lib/familysearch/client.ts`:
  - [ ] Rate limiter: respect FamilySearch's ~18 seconds execution time per minute
  - [ ] Implement exponential backoff for 429 (rate limit) responses
  - [ ] Auto-refresh tokens on 401 responses
  - [ ] Add request logging for debugging
  - [ ] Error handling class: `FamilySearchApiError` with status codes
- [ ] Add FamilySearch TypeScript types `packages/lib/types/familysearch.ts`:
  - [ ] `FSPerson`, `FSAncestry`, `FSDescendancy`, `FSRecord`, `FSSearchResult`, etc.
  - [ ] Map FamilySearch schema to internal types
- [ ] Create API route to check FamilySearch connection status: `GET /api/familysearch/status`
- [ ] Build UI for FamilySearch authentication:
  - [ ] "Connect to FamilySearch" button on dashboard
  - [ ] OAuth redirect and callback handling
  - [ ] Display connected status in settings

### Week 10-11: FamilySearch Search Endpoints

**Goal:** Query FamilySearch for persons and records.

- [ ] Implement FamilySearch search methods in client:
  - [ ] `searchPersons(name, birthDate?, birthPlace?)` — find matching persons in FamilySearch tree
  - [ ] `searchRecords(name, birthDate?, birthPlace?, recordType?)` — search indexed records (census, vital, military, etc.)
  - [ ] `getPersonDetails(personId)` — retrieve full person record from FamilySearch
  - [ ] `getAncestry(personId, generations?)` — retrieve ancestor pedigree
  - [ ] `getDescendancy(personId, generations?)` — retrieve descendant pedigree
  - [ ] `getPlaceAuthority(placeName)` — search place hierarchy (for standardizing places)
  - [ ] `getSourceInfo(sourceId)` — retrieve source metadata
- [ ] Create search API routes:
  - [ ] `GET /api/familysearch/search?name={name}&birthDate={date}&birthPlace={place}&type={record|person}`
  - [ ] `GET /api/familysearch/persons/{personId}` — retrieve specific person
  - [ ] `GET /api/familysearch/records/{recordId}` — retrieve specific record details
- [ ] Add input validation for search parameters (Zod schemas)
- [ ] Implement search result caching with React Query to avoid redundant API calls

### Week 11-12: Record Matching Engine (TypeScript)

**Goal:** Build probabilistic matching without Splink (using pure TypeScript).

- [ ] Design matching algorithm in `apps/web/lib/matching/engine.ts`:
  - [ ] **Name comparison:**
    - [ ] Implement Jaro-Winkler distance for fuzzy name matching
    - [ ] Set threshold: >= 0.90 for "likely match", 0.85-0.89 for "possible match", < 0.85 for "skip"
    - [ ] Handle name variations (maiden names, nicknames, abbreviated names)
    - [ ] Normalize names before comparison (lowercase, remove accents, remove punctuation)
  - [ ] **Date comparison:**
    - [ ] Exact match = 1.0
    - [ ] Within ±1 year = 0.8
    - [ ] Within ±2 years = 0.6
    - [ ] Beyond ±2 years but same decade = 0.4
    - [ ] Missing date = 0.5 (neutral)
  - [ ] **Place comparison:**
    - [ ] Exact match = 1.0
    - [ ] Partial match (same county/state) = 0.7
    - [ ] Same country but different region = 0.4
    - [ ] Different country = 0 (likely not the same person)
    - [ ] Missing place = 0.5
  - [ ] **Composite scoring:**
    - [ ] Weight: 50% name, 30% birth date, 20% birth place (configurable)
    - [ ] Final score = (name_score * 0.5) + (date_score * 0.3) + (place_score * 0.2)
  - [ ] **Blocking strategy** to reduce search space:
    - [ ] Filter FamilySearch results by surname match (exact or Jaro-Winkler >= 0.85)
    - [ ] Further filter by birth decade match (if date available)
    - [ ] Only score remaining candidates
- [ ] Implement matching functions:
  - [ ] `jaroDist(s1: string, s2: string): number` — Jaro-Winkler distance (0-1)
  - [ ] `nameDist(name1: StructuredName, name2: StructuredName): number` — compare given + surname
  - [ ] `dateDist(date1: string, date2: string): number` — compare with year tolerance
  - [ ] `placeDist(place1: string, place2: string): number` — hierarchical place comparison
  - [ ] `matchScore(localPerson, fsRecord): number` — composite score
  - [ ] `rankMatches(candidates: FSRecord[]): RankedMatch[]` — sort by score
- [ ] Create matching service `apps/web/lib/matching/service.ts`:
  - [ ] `findMatchesForPerson(personId)` — query FamilySearch for a local person, rank results
  - [ ] Batch operation: `findMatchesForAllPersons()` — process entire tree, generate "hints"
- [ ] Add unit tests for matching functions (test Jaro-Winkler, date comparison, edge cases)

### Week 12-13: Hints Engine & Record Review UI

**Goal:** Automatically discover potential records for each person.

- [ ] Build hints generation pipeline in `apps/web/lib/hints/engine.ts`:
  - [ ] For each person in local tree:
    - [ ] If not already linked to FamilySearch, query for matches
    - [ ] Score matches using matching engine
    - [ ] Store top matches (if score >= threshold 0.75) in database
  - [ ] Store hints in new database tables:
    - [ ] `hints` — id, person_id, record_id, record_type, score, status (new, reviewed, linked, dismissed), created_at
    - [ ] `hint_details` — id, hint_id, fs_person_id, fs_record_id, fs_data (JSON blob with FS record)
- [ ] Create API route for hints:
  - [ ] `GET /api/persons/[id]/hints` — retrieve hints for a person
  - [ ] `PUT /api/hints/[id]/status` — update hint status (reviewed, linked, dismissed)
  - [ ] `POST /api/hints/[id]/accept` — accept a hint and link the FamilySearch record
- [ ] Build hints UI panel `apps/web/components/HintsPanel.tsx`:
  - [ ] Display hints sorted by score (highest first)
  - [ ] For each hint, show:
    - [ ] Record image/thumbnail (if available from FamilySearch)
    - [ ] Record details (name, dates, places, record type)
    - [ ] Confidence score with color indicator (green for >0.9, yellow for 0.75-0.89, gray for < 0.75)
    - [ ] "Preview", "Link This Record", "Not This Person" buttons
  - [ ] Preview modal showing full record details and comparison with local person
  - [ ] Accept/reject buttons to save user decision
- [ ] Integrate hints into person detail view:
  - [ ] Show "X new hints available" badge
  - [ ] Display hints panel in sidebar or expandable section
- [ ] Add settings for hint generation:
  - [ ] Minimum score threshold
  - [ ] Auto-generate for all persons vs. on-demand
  - [ ] Enable/disable specific record types

### Week 13-14: Relationship Validation Queue

**Goal:** Help users verify relationships between matched records.

- [ ] Build relationship validator `apps/web/lib/matching/relationships.ts`:
  - [ ] Compute relationship between two FamilySearch persons:
    - [ ] Direct match (same person ID)
    - [ ] Parent-child relationship
    - [ ] Spouse relationship
    - [ ] Siblings (shared parents)
    - [ ] Grandparent, grandchild, aunt/uncle, cousin (N levels up)
    - [ ] Unrelated or distant
  - [ ] Compare local tree relationships with FamilySearch relationships
  - [ ] Flag conflicts or differences
- [ ] Create validation queue database tables:
  - [ ] `relationship_queue` — id, person_a_id, person_b_id, fs_person_a_id, fs_person_b_id, local_relationship, fs_relationship, conflict_flag, created_at, resolved_at
- [ ] API route for validation:
  - [ ] `GET /api/relationships/queue` — list unresolved relationship conflicts
  - [ ] `PUT /api/relationships/[id]/resolve` — accept or reject proposed relationship merge
- [ ] Build UI for relationship review:
  - [ ] Queue panel showing conflicts
  - [ ] Side-by-side comparison: local tree vs. FamilySearch
  - [ ] Action buttons: "Merge", "Keep Local", "Update from FamilySearch"
- [ ] Implement relationship conflict resolution:
  - [ ] If FamilySearch shows different parent: offer option to update or keep existing
  - [ ] If spouse linked differently: show both families, let user choose

### Week 14-15: FamilySearch Record Linking

**Goal:** Seamlessly attach FamilySearch records to local persons as sources.

- [ ] Create record linking workflow:
  - [ ] When user accepts a hint, store FamilySearch person/record ID in local person record
  - [ ] Create source entry from FamilySearch record data
  - [ ] Link all events extracted from that record
- [ ] Add source attachment `apps/web/lib/familysearch/source-converter.ts`:
  - [ ] Convert FamilySearch record metadata to source citation (title, author, repository, URL)
  - [ ] Generate citation text in Chicago style
  - [ ] Store FamilySearch IDs for future sync
- [ ] Build source linking UI:
  - [ ] "Add FamilySearch Record" button in person detail
  - [ ] Search/browse dialog for FamilySearch records
  - [ ] Preview record details
  - [ ] Link and create source on confirm
- [ ] Implement source tracking:
  - [ ] Store FamilySearch ID in sources table for future updates
  - [ ] Build sync function to check if FamilySearch records have changed
  - [ ] Display "View on FamilySearch" link in source citation

### Week 15-16: Claude AI Research Assistant

**Goal:** Build an intelligent chat interface for genealogy research.

- [ ] Create Claude API integration `apps/web/lib/ai/client.ts`:
  - [ ] Initialize Vercel AI SDK with Claude (claude-3-5-sonnet or similar)
  - [ ] Implement streaming responses for chat
  - [ ] Add prompt templates for genealogy-specific queries
- [ ] Build AI system prompt `apps/web/lib/ai/prompts.ts` with context:
  - [ ] Provide tree structure (current person, ancestors, descendants, known sources)
  - [ ] Provide research guidelines (primary vs. secondary sources, NARA, Chronicling America, etc.)
  - [ ] Provide research history (already checked these sources, found these records, etc.)
- [ ] Create tool definitions for the AI to call:
  - [ ] `search_familysearch(name, birthDate, birthPlace, recordType)` — search FamilySearch
  - [ ] `search_nara(keywords)` — search NARA Catalog
  - [ ] `search_chronicling_america(keywords, placeName, dateRange)` — search newspapers
  - [ ] `explain_relationship(personA_id, personB_id)` — compute relationship between two people
  - [ ] `suggest_next_research_steps()` — analyze tree, identify gaps
  - [ ] `generate_research_plan(person_id, depth)` — create structured research task list
- [ ] Build chat UI `apps/web/components/ResearchAssistant.tsx`:
  - [ ] Chat interface with message history
  - [ ] User message input
  - [ ] Claude responses with streaming text
  - [ ] Tool call indicators and results
  - [ ] Ability to open/review matched records from search results
  - [ ] Save/export conversation history
- [ ] Create research assistant page `apps/web/app/(auth)/research/page.tsx`
- [ ] Implement example prompts:
  - [ ] "What should I research next?"
  - [ ] "Help me find my great-grandmother born in Poland around 1885"
  - [ ] "Suggest sources for validating this relationship"
  - [ ] "What records exist for this ancestor in NARA?"
- [ ] Add context awareness:
  - [ ] Assistant has access to current person being viewed
  - [ ] Can reference tree structure and existing research
  - [ ] Makes specific suggestions vs. generic advice

### Week 16-17: NARA & Chronicling America Integration

**Goal:** Extend research assistant to query free historical databases.

- [ ] NARA Catalog API client `apps/web/lib/nara/client.ts`:
  - [ ] Get free API key from NARA
  - [ ] Implement search endpoint with keyword, dateRange filters
  - [ ] Parse JSON results
  - [ ] Add rate limiting (10,000 queries/month)
- [ ] Chronicling America API client `apps/web/lib/chronicling-america/client.ts`:
  - [ ] No API key required
  - [ ] Implement keyword search across 21M+ newspaper pages
  - [ ] Support date range filtering (1756-1963)
  - [ ] Parse results with page/edition metadata
- [ ] Create research endpoints:
  - [ ] `GET /api/search/nara?keywords={kw}&dateRange={start}-{end}`
  - [ ] `GET /api/search/chronicling-america?keywords={kw}&place={place}&dateRange={start}-{end}`
- [ ] Build search UI components:
  - [ ] NARA search widget with keyword/date filters
  - [ ] Chronicling America search widget with keyword/place/date filters
  - [ ] Result cards showing preview, link to source
- [ ] Integrate into research assistant:
  - [ ] Tool definitions for the AI to call these APIs
  - [ ] Automatic suggestions to search these sources for specific ancestors

### Week 17-18: Editor Decision Flow & Testing

**Goal:** Create workflow for reviewing and deciding on matches.

- [ ] Build decision workflow `apps/web/lib/hints/decision-flow.ts`:
  - [ ] For each hint:
    - [ ] Show side-by-side comparison (local vs. FamilySearch)
    - [ ] Display matching algorithm breakdown (why this score?)
    - [ ] Collect user decision: "Yes, link", "No, different person", "Maybe, mark for review"
  - [ ] Track decision and reasoning for future machine learning
- [ ] Create decision UI:
  - [ ] Dedicated page for hint review `apps/web/app/(auth)/review-hints/page.tsx`
  - [ ] Batch hint review interface (process multiple in sequence)
  - [ ] Show match confidence breakdown
  - [ ] Add notes field for user reasoning
- [ ] Build analytics dashboard to track:
  - [ ] # of hints generated
  - [ ] # of hints reviewed
  - [ ] # of hints accepted vs. rejected
  - [ ] Average match score for accepted vs. rejected
- [ ] Comprehensive testing:
  - [ ] Unit tests for matching algorithm (Jaro-Winkler, date/place comparison)
  - [ ] Integration tests for FamilySearch API calls (mock responses)
  - [ ] End-to-end tests for hint generation and review workflow
  - [ ] Test with real FamilySearch data in sandbox environment

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | FamilySearch OAuth + API client, Record matching engine (Jaro-Winkler), Hints generation + review UI, Claude AI research assistant (basic chat + tool calling) |
| **Should** | Relationship validation queue, FamilySearch record linking + source creation, NARA integration, Batch hint generation |
| **Could** | Chronicling America integration, Decision analytics dashboard, Match score visualization breakdown |
| **Won't (this phase)** | Auto-accept hints, ML-based matching improvement, FamilySearch tree sync |

## Mid-Phase Checkpoint (Week 13)

At the midpoint, assess:
- [ ] FamilySearch OAuth works end-to-end
- [ ] Matching engine has basic scoring (Jaro-Winkler + dates)
- [ ] If behind: defer NARA and Chronicling America to Phase 3 buffer or Phase 5b

## API Resilience

- [ ] Build API clients with abstraction layers that can be mocked for development
- [ ] Create mock/fixture data for FamilySearch, NARA, and Chronicling America
- [ ] Development should work without live API access (offline-capable development)

## Documentation (write during this phase)

- [ ] FamilySearch integration guide (OAuth setup, rate limits, troubleshooting)
- [ ] Matching algorithm documentation (scoring weights, thresholds, tuning)
- [ ] Research assistant usage guide

## Exit Gate: Phase 2 to Phase 3

Before starting Phase 3, verify:
- [ ] FamilySearch OAuth flow works end-to-end (login, search, logout)
- [ ] Matching engine achieves >80% precision on a test dataset of known matches
- [ ] AI research assistant answers 5 predefined genealogy queries with correct tool calls
- [ ] Hints system generates and displays results for 10+ persons
- [ ] All Phase 1 performance baselines still pass (no regression)

## Feedback Loop

After Phase 2 is complete:
- [ ] Post on r/Genealogy or genealogy forums for concept feedback on the AI research assistant
- [ ] Share screenshots or demo video of hints + matching workflow
- [ ] Ask: "Would this be useful in your research? What's missing?"
- [ ] Document feedback for Phase 3+ prioritization

---

## Key Risks

1. **FamilySearch API rate limiting** — With many persons in tree, generating hints for all could trigger rate limits. Mitigate: implement batch processing with rate limiter (Week 9-10), add queue system for background hint generation, start conservative (generate hints only on-demand or nightly).

2. **Matching algorithm false positives** — Low thresholds may link wrong records; high thresholds may miss true matches. Jaro-Winkler alone may not handle all edge cases (hyphenated names, prefixes, nicknames). Mitigate: set conservative thresholds (0.75 minimum for suggestions, 0.90 for auto-accept), collect user feedback on false matches, iterate on scoring weights.

3. **AI tool calling failures** — If Claude cannot call research tools (API errors, malformed arguments), the research assistant breaks. Mitigate: comprehensive error handling, fallback to manual search suggestions, log failures for debugging.

4. **Scope creep with sources** — Full source management (notes, page numbers, access dates) adds complexity. Mitigate: focus on minimum viable source (title, URL, FamilySearch ID); defer detailed citation management to Phase 3+.

## Decisions Made During This Phase

(Empty — filled during implementation)

## Retrospective

(Empty — filled at phase end)
