# Plan A: Search Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the search infrastructure foundation — Hono worker scaffold, `packages/research` with SearchProvider interface, schema migration for research tables, FamilySearch + NARA + Chronicling America providers, unified search UI, and research items CRUD.

**Architecture:** Pluggable SearchProvider adapter pattern in a new `packages/research` monorepo package. API-based providers run inline in Next.js. Heavy providers (scraping) dispatch to the Hono worker (scaffolded here, fully implemented in Plan C). Research items are stored in a staging table with draft/promoted/dismissed status workflow.

**Tech Stack:** Hono (worker), Drizzle ORM (schema), Zod (validation), Vitest (tests), React (search UI), shadcn/ui components

**Spec:** [Research Workspace Design](../../superpowers/specs/2026-03-22-research-workspace-design.md)

---

## File Structure

### New Files

```
packages/research/
  package.json
  tsconfig.json
  src/
    index.ts                          # barrel export
    providers/
      types.ts                        # SearchProvider, SearchRequest, SearchResult
      registry.ts                     # ProviderRegistry class
      rate-limiter.ts                 # Token-bucket rate limiter
      familysearch/
        auth.ts                       # OAuth PKCE helpers
        provider.ts                   # FamilySearchProvider
        types.ts                      # FS-specific types
      nara/
        provider.ts                   # NARAProvider
      chronicling-america/
        provider.ts                   # ChroniclingAmericaProvider
      mock/
        provider.ts                   # MockProvider for dev/test
    items/
      queries.ts                      # Research item CRUD queries
    __tests__/
      registry.test.ts
      rate-limiter.test.ts
      familysearch-provider.test.ts
      nara-provider.test.ts
      chronicling-america-provider.test.ts
      items-queries.test.ts

packages/db/src/
  research-schema.ts                  # Drizzle schema for research tables

apps/worker/
  package.json, tsconfig.json, Dockerfile
  src/
    index.ts                          # Hono app entry
    routes/health.ts                  # GET /health
    middleware/auth.ts                # JWT verification
    __tests__/health.test.ts

apps/web/
  app/
    (auth)/research/page.tsx          # Research hub page
    api/research/
      search/route.ts                 # Federated search
      items/route.ts                  # Research items list + create
      items/[id]/route.ts             # Item get/update/delete
      items/[id]/persons/route.ts     # Tag/untag persons
    api/auth/familysearch/
      route.ts                        # OAuth initiate
      callback/route.ts               # OAuth callback
  components/research/
    search-bar.tsx
    search-results.tsx
    search-result-card.tsx
    research-item-card.tsx
    provider-badge.tsx
  lib/research/
    search-client.ts                  # React hooks for search
```

### Modified Files

```
packages/db/src/schema.ts             # Re-export research schema
packages/db/src/index.ts              # Export new tables
turbo.json                            # Add worker to pipeline
.env.example                          # Add WORKER_URL, FAMILYSEARCH_* vars
```

---

## Task 1: Hono Worker Scaffold

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/index.ts`, `apps/worker/src/routes/health.ts`, `apps/worker/src/middleware/auth.ts`, `apps/worker/Dockerfile`
- Modify: `turbo.json`, `.env.example`
- Test: `apps/worker/src/__tests__/health.test.ts`

- [ ] **Step 1:** Create `apps/worker/package.json` with hono, jose, better-sqlite3, drizzle-orm dependencies. Scripts: dev (tsx watch), build (tsup), start, test (vitest).

- [ ] **Step 2:** Create `apps/worker/tsconfig.json` extending root config.

- [ ] **Step 3:** Create `apps/worker/src/routes/health.ts` — Hono route returning `{ status: 'ok', timestamp, uptime }`.

- [ ] **Step 4:** Create `apps/worker/src/middleware/auth.ts` — middleware that verifies JWT Bearer token using `jose.jwtVerify()` with `NEXTAUTH_SECRET`. Skips `/health` endpoint. Sets `c.set('userId', payload.sub)`.

- [ ] **Step 5:** Create `apps/worker/src/index.ts` — Hono app with CORS (localhost:3000 + WEB_URL), logger, auth middleware, health route. Exports `AppType` for type-safe client.

- [ ] **Step 6:** Write `apps/worker/src/__tests__/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { health } from '../routes/health.js';

describe('Health route', () => {
  const app = new Hono();
  app.route('/', health);

  it('returns ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 7:** Run: `cd apps/worker && pnpm test` — Expected: PASS

- [ ] **Step 8:** Create `apps/worker/Dockerfile` — multi-stage (node:20-slim, pnpm, build, run).

- [ ] **Step 9:** Update `turbo.json` — add worker dev/build/test tasks. Add `WORKER_URL`, `FAMILYSEARCH_CLIENT_ID`, `FAMILYSEARCH_CLIENT_SECRET`, `FAMILYSEARCH_REDIRECT_URI`, `NARA_API_KEY` to `.env.example`.

- [ ] **Step 10:** Run: `pnpm install && cd apps/worker && pnpm test` — Expected: PASS

- [ ] **Step 11:** Commit: `feat(worker): scaffold Hono worker with health route and auth middleware`

---

## Task 2: Research Schema Migration

**Files:**
- Create: `packages/db/src/research-schema.ts`
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`

- [ ] **Step 1:** Create `packages/db/src/research-schema.ts` with Drizzle table definitions for:
  - `researchItems` — id, title, url, snippet, fullText, notes, archivedHtmlPath, screenshotPath, archivedAt, providerId, providerRecordId, discoveryMethod (enum), searchQuery, status (enum: draft/promoted/dismissed), promotedSourceId (FK sources), createdBy (FK users), createdAt, updatedAt. Indexes: status, providerId, createdBy, createdAt.
  - `researchItemPersons` — researchItemId (FK), personId (FK), composite PK. Index on personId.
  - `researchFacts` — id, personId (FK), factType (enum: 16 types), factValue, factDateSort, researchItemId (FK nullable), sourceCitationId (FK nullable), confidence (enum), extractionMethod (enum), createdAt, updatedAt. Indexes: personId, (personId+factType).
  - `searchProviders` — id (PK string), name, providerType (enum), baseUrl, isEnabled, config (JSON text), rateLimitRpm, healthStatus (enum), lastHealthCheck, createdAt.
  - `researchCanvasPositions` — id, personId (FK), nodeType (enum), nodeId, x, y. Unique on (personId, nodeType, nodeId).

- [ ] **Step 2:** Add `export * from './research-schema.js';` to `packages/db/src/schema.ts`.

- [ ] **Step 3:** Run: `cd packages/db && pnpm drizzle-kit generate` — Expected: migration SQL created.

- [ ] **Step 4:** Run: `cd packages/db && pnpm db:migrate` — Expected: tables created.

- [ ] **Step 5:** Commit: `feat(db): add research schema — items, facts, providers, canvas positions`

---

## Task 3: packages/research — Types, Registry, Rate Limiter

**Files:**
- Create: `packages/research/package.json`, `packages/research/tsconfig.json`, `packages/research/src/index.ts`, `packages/research/src/providers/types.ts`, `packages/research/src/providers/registry.ts`, `packages/research/src/providers/rate-limiter.ts`
- Test: `packages/research/src/__tests__/registry.test.ts`, `packages/research/src/__tests__/rate-limiter.test.ts`

- [ ] **Step 1:** Create `packages/research/package.json` — depends on `@ancstra/db`, `@ancstra/shared`, zod. Scripts: test (vitest), build (tsup).

- [ ] **Step 2:** Create `packages/research/src/providers/types.ts`:
  - `RecordType` — union of 15 record type strings (matching source_type enum)
  - `SearchRequest` — givenName?, surname?, birthYear?, birthPlace?, deathYear?, deathPlace?, freeText?, recordType?, dateRange?, location?, limit?, offset?
  - `SearchResult` — providerId, externalId, title, snippet, url, recordType?, relevanceScore?, extractedData? { name?, birthDate?, deathDate?, location? }, thumbnailUrl?
  - `RecordDetail` — providerId, externalId, title, fullText, url, recordType?, metadata (Record<string,string>)
  - `HealthStatus` — 'healthy' | 'degraded' | 'down' | 'unknown'
  - `SearchProvider` — interface: readonly id, name, type; search(), getRecord?(), healthCheck()

- [ ] **Step 3:** Write `packages/research/src/__tests__/rate-limiter.test.ts` — tests: allows within limit, blocks when exceeded, refills over time (fake timers).

- [ ] **Step 4:** Run test — Expected: FAIL (module not found)

- [ ] **Step 5:** Implement `packages/research/src/providers/rate-limiter.ts` — token-bucket: constructor(requestsPerMinute), acquire() (async, waits if needed), private refill().

- [ ] **Step 6:** Run test — Expected: PASS

- [ ] **Step 7:** Write `packages/research/src/__tests__/registry.test.ts` — tests: register + get, listEnabled, disable provider, searchAll across providers, graceful failure on provider error.

- [ ] **Step 8:** Run test — Expected: FAIL

- [ ] **Step 9:** Implement `packages/research/src/providers/registry.ts` — ProviderRegistry class: register(), get(), setEnabled(), listEnabled(), listAll(), isEnabled(), searchAll() with Promise.allSettled.

- [ ] **Step 10:** Run test — Expected: PASS

- [ ] **Step 11:** Create barrel `packages/research/src/index.ts` exporting types + ProviderRegistry + RateLimiter.

- [ ] **Step 12:** Run: `pnpm install && cd packages/research && pnpm test` — Expected: all pass

- [ ] **Step 13:** Commit: `feat(research): SearchProvider interface, ProviderRegistry, and RateLimiter`

---

## Task 4: Mock + NARA + Chronicling America Providers

**Files:**
- Create: `packages/research/src/providers/mock/provider.ts`, `packages/research/src/providers/nara/provider.ts`, `packages/research/src/providers/chronicling-america/provider.ts`
- Test: `packages/research/src/__tests__/nara-provider.test.ts`, `packages/research/src/__tests__/chronicling-america-provider.test.ts`

- [ ] **Step 1:** Create `MockProvider` — returns 3 hardcoded results (census, immigration, newspaper) filtered by surname/freeText match.

- [ ] **Step 2:** Write `nara-provider.test.ts` — mock `fetch`, test: returns mapped results, handles API error gracefully, health check.

- [ ] **Step 3:** Run test — Expected: FAIL

- [ ] **Step 4:** Implement `NARAProvider` — searches `https://catalog.archives.gov/api/v1` with q param. Uses RateLimiter(30). Maps response to SearchResult[]. Returns empty array on error.

- [ ] **Step 5:** Run test — Expected: PASS

- [ ] **Step 6:** Write `chronicling-america-provider.test.ts` — mock fetch, test: returns newspaper results, supports date range params.

- [ ] **Step 7:** Run test — Expected: FAIL

- [ ] **Step 8:** Implement `ChroniclingAmericaProvider` — searches `https://chroniclingamerica.loc.gov/search/pages/results/` with andtext, date1, date2, state, format=json params. Maps items to SearchResult[].

- [ ] **Step 9:** Run test — Expected: PASS

- [ ] **Step 10:** Export all providers from index.ts.

- [ ] **Step 11:** Commit: `feat(research): Mock, NARA, and Chronicling America search providers`

---

## Task 5: FamilySearch OAuth + Provider

**Files:**
- Create: `packages/research/src/providers/familysearch/auth.ts`, `packages/research/src/providers/familysearch/types.ts`, `packages/research/src/providers/familysearch/provider.ts`
- Create: `apps/web/app/api/auth/familysearch/route.ts`, `apps/web/app/api/auth/familysearch/callback/route.ts`
- Test: `packages/research/src/__tests__/familysearch-provider.test.ts`

- [ ] **Step 1:** Create FS types — FSTokens, FSPerson, FSSearchResponse.

- [ ] **Step 2:** Create OAuth helpers — `generateAuthUrl(clientId, redirectUri)` returns { url, codeVerifier }. `exchangeCodeForTokens(code, verifier, clientId, redirectUri)` POSTs to FS token endpoint.

- [ ] **Step 3:** Write `familysearch-provider.test.ts` — mock fetch, test: searches and maps results, sends auth header, handles empty results.

- [ ] **Step 4:** Run test — Expected: FAIL

- [ ] **Step 5:** Implement `FamilySearchProvider` — constructor(accessToken), search() queries `/platform/tree/search`, maps FSPerson to SearchResult. Uses RateLimiter(30). healthCheck() calls `/platform/tree/current-person`.

- [ ] **Step 6:** Run test — Expected: PASS

- [ ] **Step 7:** Create `apps/web/app/api/auth/familysearch/route.ts` — GET handler: generates auth URL, stores codeVerifier in httpOnly cookie, redirects to FamilySearch.

- [ ] **Step 8:** Create `apps/web/app/api/auth/familysearch/callback/route.ts` — GET handler: reads code + codeVerifier, exchanges for tokens, stores in session, redirects to /settings.

- [ ] **Step 9:** Export from index.ts.

- [ ] **Step 10:** Commit: `feat(research): FamilySearch OAuth PKCE flow and search provider`

---

## Task 6: Research Items CRUD API

**Files:**
- Create: `packages/research/src/items/queries.ts`
- Create: `apps/web/app/api/research/items/route.ts`, `apps/web/app/api/research/items/[id]/route.ts`, `apps/web/app/api/research/items/[id]/persons/route.ts`
- Test: `packages/research/src/__tests__/items-queries.test.ts`

- [ ] **Step 1:** Write `items-queries.test.ts` — in-memory SQLite, tests: create item, get by id, list with status filter, update status, tag/untag persons.

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/research/src/items/queries.ts` — functions: createResearchItem(), getResearchItem() (with joined personIds), listResearchItems() (with status/personId filters), updateResearchItemStatus(), tagPersonToItem(), untagPersonFromItem().

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Create `apps/web/app/api/research/items/route.ts` — GET (list with ?status filter) + POST (create from SearchResult data). Follow existing API patterns from `apps/web/app/api/persons/route.ts`.

- [ ] **Step 6:** Create `apps/web/app/api/research/items/[id]/route.ts` — GET + PATCH (update status, notes) + DELETE.

- [ ] **Step 7:** Create `apps/web/app/api/research/items/[id]/persons/route.ts` — POST (tag person) + DELETE (untag person).

- [ ] **Step 8:** Commit: `feat(research): research items CRUD API with person tagging`

---

## Task 7: Federated Search API + Search UI

**Files:**
- Create: `apps/web/app/api/research/search/route.ts`
- Create: `apps/web/components/research/search-bar.tsx`, `search-results.tsx`, `search-result-card.tsx`, `provider-badge.tsx`, `research-item-card.tsx`
- Create: `apps/web/app/(auth)/research/page.tsx`, `apps/web/lib/research/search-client.ts`

- [ ] **Step 1:** Create `apps/web/app/api/research/search/route.ts` — GET handler: parses query params (q, givenName, surname, birthYear, birthPlace, providers, limit), initializes ProviderRegistry with available providers, calls searchAll(), returns JSON results.

- [ ] **Step 2:** Create `apps/web/lib/research/search-client.ts` — React hooks: `useResearchSearch(query)` using SWR/fetch, `useResearchItems(status?)`.

- [ ] **Step 3:** Create `apps/web/components/research/provider-badge.tsx` — small Badge with provider name + color coding.

- [ ] **Step 4:** Create `apps/web/components/research/search-result-card.tsx` — Card showing: provider badge, title, snippet, extracted data, relevance score, "Save" button.

- [ ] **Step 5:** Create `apps/web/components/research/search-results.tsx` — renders list of SearchResultCard, groups by provider, loading/empty states.

- [ ] **Step 6:** Create `apps/web/components/research/search-bar.tsx` — Input with search icon, debounced 300ms, provider filter chips.

- [ ] **Step 7:** Create `apps/web/components/research/research-item-card.tsx` — Card for saved items: status badge, title, snippet, tagged persons, action buttons.

- [ ] **Step 8:** Create `apps/web/app/(auth)/research/page.tsx` — Research hub: search bar at top, results below, sidebar with saved research items.

- [ ] **Step 9:** Add "Research" link to sidebar navigation in `apps/web/components/app-sidebar.tsx`.

- [ ] **Step 10:** Commit: `feat(research): search UI — federated search, result cards, research page`

---

## Summary

| Task | What | Tests | ~Duration |
|------|------|-------|-----------|
| 1 | Hono worker scaffold | health route | 0.5d |
| 2 | Research schema migration | drizzle generate | 0.5d |
| 3 | Types + registry + rate limiter | registry, rate limiter | 1d |
| 4 | Mock + NARA + CA providers | mock fetch | 1d |
| 5 | FamilySearch OAuth + provider | mock fetch | 1.5d |
| 6 | Research items CRUD | item queries | 1.5d |
| 7 | Federated search API + UI | — | 2d |

**Total commits:** ~7
