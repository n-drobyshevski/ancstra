# Phase 0.5: Technical Spikes

> Duration: 1 week | Started: TBD | Target: TBD
> Prerequisite: Phase 0 gate passed (all Phase 1 screens have approved hi-fi mockups)

## Purpose

Validate high-risk technical assumptions with throwaway experiments before committing to 10+ months of implementation. These are isolated spikes, not prototypes of the app. Each spike proves or disproves a specific technical assumption. If a spike fails, document the finding in an ADR and identify alternatives before Phase 1 begins.

## Spikes

### Spike 1: family-chart Rendering at Scale (0.5 days)

**Question:** Can family-chart render 500+ person trees performantly in React 19?

**Test:**
- [ ] Install family-chart in a throwaway Next.js 16 app
- [ ] Generate synthetic tree data: 100, 500, 1000 persons
- [ ] Measure render time, frame rate during pan/zoom, memory usage
- [ ] Test on both desktop and mobile viewport

**Pass criteria:** 500-person tree renders in <2s, pan/zoom at 30+ FPS on desktop
**Fail action:** Evaluate d3-based alternatives or virtual rendering; document in ADR-005

---

### Spike 2: Topola GEDCOM Parser with Real Vendor Dialects (0.5 days)

**Question:** Does Topola's parser handle real-world GEDCOM files from major vendors without major patching?

**Test:**
- [ ] Collect 4+ real GEDCOM files: Gramps export, FamilySearch export, Ancestry export, Legacy Family Tree export
- [ ] Parse each through Topola's parser
- [ ] Verify: all persons extracted, relationships correct, events parsed, no silent data loss
- [ ] Document any vendor-specific quirks or failures

**Pass criteria:** 90%+ data fidelity across all 4 vendor formats
**Fail action:** Evaluate gedcom.js or custom parser; budget extra time in Phase 1 Week 3-4

---

### Spike 3: Drizzle Driver Swap — better-sqlite3 to Turso (0.5 days)

**Question:** Does Drizzle ORM actually abstract the driver difference between better-sqlite3 (local) and @libsql/client (Turso) without edge cases?

**Test:**
- [ ] Create a skeleton Next.js app with Drizzle + better-sqlite3
- [ ] Define a small schema (persons, families, children)
- [ ] Write 5 queries: basic CRUD, JOIN, recursive CTE, FTS5 search, transaction
- [ ] Swap driver to @libsql/client pointing at a free Turso database
- [ ] Run the same 5 queries against Turso
- [ ] Deploy skeleton to Vercel to validate serverless compatibility

**Pass criteria:** All 5 queries produce identical results on both drivers; Vercel deploy works
**Fail action:** Document incompatibilities; design abstraction layer; evaluate direct libsql if needed

---

### Spike 4: SQLCipher + Drizzle Compatibility (0.5 days)

**Question:** Can SQLCipher (encrypted SQLite) work with Drizzle ORM for DNA data encryption in Phase 4?

**Test:**
- [ ] Install better-sqlite3-sqlcipher or @journeyapps/sqlcipher
- [ ] Attempt to use with Drizzle ORM
- [ ] Test: create encrypted database, write data, read data, verify encryption at rest
- [ ] Test: can a regular better-sqlite3 connection read the encrypted database? (should fail)

**Pass criteria:** Drizzle works with SQLCipher driver; encrypted data unreadable without key
**Fail action:** Plan application-level encryption (encrypt specific columns) as alternative; document in ADR

---

### Spike 5: Claude Tool Calling for Research Assistant (0.5 days)

**Question:** Does Claude's tool calling work reliably for the genealogy research assistant pattern (search FamilySearch, interpret results, suggest next steps)?

**Test:**
- [ ] Create a test script with Vercel AI SDK + Claude
- [ ] Define 3 mock tools: search_records, explain_relationship, suggest_research
- [ ] Send 5 diverse genealogy research prompts
- [ ] Verify: Claude calls correct tools with valid arguments, handles tool results, produces coherent responses

**Pass criteria:** 4/5 prompts result in correct tool calls and useful responses
**Fail action:** Adjust prompt engineering; consider structured output instead of tool calling

---

### Spike 6: SQLite Recursive CTE Performance (0.5 days)

**Question:** Can SQLite recursive CTEs handle ancestor/descendant queries for 1K-10K person trees under 500ms?

**Test:**
- [ ] Create a test SQLite database with synthetic tree data: 1K, 5K, 10K persons
- [ ] Write recursive CTE for: all ancestors (N generations), all descendants, relationship path between two persons
- [ ] Benchmark each query with proper indexes
- [ ] Test with and without indexes to measure index impact

**Pass criteria:** All ancestor/descendant queries complete in <500ms for 10K persons with indexes
**Fail action:** Design denormalization strategy (materialized paths, closure table); budget optimization time

---

## MoSCoW Prioritization

| Priority | Spikes |
|----------|--------|
| **Must** | Spike 3 (Turso driver swap) — blocks entire deployment strategy |
| **Must** | Spike 1 (family-chart scale) — blocks core visualization |
| **Must** | Spike 2 (Topola GEDCOM) — blocks data import |
| **Should** | Spike 6 (recursive CTE perf) — important but can optimize later |
| **Could** | Spike 5 (Claude tool calling) — Phase 2 is months away; API may change |
| **Won't (now)** | Spike 4 (SQLCipher) — Photos & DNA moved to post-launch; run this spike before implementing DNA modules |

## Exit Gate: Phase 0.5 to Phase 1

Before starting Phase 1, verify:
- [ ] All Must spikes pass or have documented alternatives (ADRs)
- [ ] Should spikes completed or risk acknowledged with mitigation plan
- [ ] Spike results documented in `docs/architecture/decisions/` as needed
- [ ] No blocking technical risks remain for Phase 1

## Feedback Loop

- Share spike results with any technical advisors or genealogy community contacts
- If any spike fails, reassess timeline impact before starting Phase 1

## Retrospective

(Empty -- filled at phase end)
