# Plan D: Record Matching + AI Research Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build probabilistic record matching engine (Jaro-Winkler + composites), hints generation/review, and Claude-powered AI research assistant with tool-calling capability.

**Architecture:** Matching engine in packages/matching with pure functions. Hints stored in match_candidates table. AI assistant uses Vercel AI SDK with streaming, Claude Sonnet default, tree context injection (~2000 tokens), and 15+ tool definitions. Chat UI at /research page alongside search.

**Tech Stack:** Vercel AI SDK (@ai-sdk/anthropic), Vitest, React, shadcn/ui

**Spec:** [Research Workspace Design](../../superpowers/specs/2026-03-22-research-workspace-design.md), [AI Strategy](../../architecture/ai-strategy.md)
**Depends on:** [Plan A](2026-03-22-plan-a-search-foundation.md) (providers, research items)

---

## File Structure

### New Files

```
packages/matching/
  package.json
  tsconfig.json
  src/
    index.ts                          # barrel export
    algorithms/
      jaro-winkler.ts                 # Jaro-Winkler string distance
      date-compare.ts                 # date proximity comparator
      place-compare.ts                # hierarchical place comparator
    scoring/
      composite-scorer.ts             # weighted composite scoring
      blocking.ts                     # blocking strategy (surname + birth decade)
    pipeline/
      hints-generator.ts             # per-person hints generation pipeline
    __tests__/
      jaro-winkler.test.ts
      date-compare.test.ts
      place-compare.test.ts
      composite-scorer.test.ts
      blocking.test.ts
      hints-generator.test.ts

packages/ai/
  package.json
  tsconfig.json
  src/
    index.ts                          # barrel export
    prompts/
      research-assistant.ts           # system prompt builder
    context/
      tree-context.ts                 # buildTreeContext — pedigree summarizer
      cost-tracker.ts                 # usage tracking + budget enforcement
    tools/
      search-local-tree.ts            # searchLocalTree tool
      search-familysearch.ts          # searchFamilySearch tool
      compute-relationship.ts         # computeRelationship tool
      analyze-tree-gaps.ts            # analyzeTreeGaps tool
      explain-record.ts               # explainRecord tool
      propose-relationship.ts         # proposeRelationship tool
    tools/research/
      search-web.ts                   # searchWeb tool (federated provider search)
      scrape-url.ts                   # scrapeUrl tool (via Hono worker)
      extract-facts.ts                # extractFacts tool
      detect-conflicts.ts             # detectConflicts tool
      suggest-searches.ts             # suggestSearches tool
    __tests__/
      tree-context.test.ts
      cost-tracker.test.ts
      search-local-tree.test.ts
      compute-relationship.test.ts
      analyze-tree-gaps.test.ts
      propose-relationship.test.ts
      extract-facts.test.ts
      detect-conflicts.test.ts

packages/db/src/
  matching-schema.ts                  # Drizzle schema for match_candidates, proposed_relationships, etc.
  ai-schema.ts                        # Drizzle schema for ai_usage table

apps/web/
  app/
    api/ai/chat/route.ts              # POST — streaming chat endpoint
    api/matching/
      hints/route.ts                  # GET — list hints for person, POST — generate hints
      hints/[id]/route.ts             # PATCH — accept/reject hint
  components/research/
    hints-panel.tsx                    # hints review panel
    hint-card.tsx                     # individual hint card with side-by-side
    hint-comparison.tsx               # side-by-side person comparison
    chat-panel.tsx                    # AI chat panel with streaming
    chat-message.tsx                  # single chat message (user/assistant/tool)
    tool-call-indicator.tsx           # inline tool call status indicator
    cost-badge.tsx                    # monthly spend indicator
```

### Modified Files

```
packages/db/src/schema.ts             # Re-export matching + AI schema
packages/db/src/index.ts              # Export new tables
apps/web/app/(auth)/research/page.tsx # Add chat panel + hints panel
apps/web/components/app-sidebar.tsx   # (already has Research link from Plan A)
.env.example                          # Add ANTHROPIC_API_KEY, AI_MONTHLY_BUDGET_USD
turbo.json                            # Add matching + ai packages
```

---

## Task 1: Jaro-Winkler Distance Function + Tests

**Files:**
- Create: `packages/matching/package.json`, `packages/matching/tsconfig.json`, `packages/matching/src/algorithms/jaro-winkler.ts`, `packages/matching/src/index.ts`
- Test: `packages/matching/src/__tests__/jaro-winkler.test.ts`

- [ ] **Step 1:** Create `packages/matching/package.json` with name `@ancstra/matching`, no external deps (pure functions). Scripts: test (vitest), build (tsup).

- [ ] **Step 2:** Create `packages/matching/tsconfig.json` extending root config. Target ESNext, module NodeNext.

- [ ] **Step 3:** Write `packages/matching/src/__tests__/jaro-winkler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { jaroWinkler, jaroDistance } from '../algorithms/jaro-winkler.js';

describe('jaroDistance', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroDistance('MARTHA', 'MARTHA')).toBe(1.0);
  });

  it('returns 0.0 for completely different strings', () => {
    expect(jaroDistance('ABC', 'XYZ')).toBe(0.0);
  });

  it('returns 0.0 for empty strings', () => {
    expect(jaroDistance('', '')).toBe(0.0);
  });

  it('computes classic MARTHA/MARHTA example', () => {
    expect(jaroDistance('MARTHA', 'MARHTA')).toBeCloseTo(0.9444, 3);
  });

  it('is case-insensitive', () => {
    expect(jaroDistance('martha', 'MARHTA')).toBeCloseTo(0.9444, 3);
  });

  it('handles single character strings', () => {
    expect(jaroDistance('A', 'A')).toBe(1.0);
    expect(jaroDistance('A', 'B')).toBe(0.0);
  });
});

describe('jaroWinkler', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinkler('SMITH', 'SMITH')).toBe(1.0);
  });

  it('boosts score for common prefix (MARTHA/MARHTA)', () => {
    const jaro = jaroDistance('MARTHA', 'MARHTA');
    const jw = jaroWinkler('MARTHA', 'MARHTA');
    expect(jw).toBeGreaterThan(jaro);
    expect(jw).toBeCloseTo(0.9611, 3);
  });

  it('handles genealogy name variants', () => {
    expect(jaroWinkler('JOHNSON', 'JOHNSTON')).toBeGreaterThan(0.85);
    expect(jaroWinkler('SMITH', 'SMYTH')).toBeGreaterThan(0.85);
    expect(jaroWinkler('CATHERINE', 'KATHERINE')).toBeGreaterThan(0.7);
    expect(jaroWinkler('SCHMIDT', 'SMITH')).toBeLessThan(0.8);
  });

  it('respects custom winkler prefix weight', () => {
    const defaultWeight = jaroWinkler('MARTHA', 'MARHTA');
    const higherWeight = jaroWinkler('MARTHA', 'MARHTA', 0.15);
    expect(higherWeight).toBeGreaterThan(defaultWeight);
  });

  it('caps prefix length at 4', () => {
    // Long common prefix should not over-boost
    const score = jaroWinkler('ABCDEFGH', 'ABCDEFXY');
    expect(score).toBeLessThanOrEqual(1.0);
  });
});
```

- [ ] **Step 4:** Run test — Expected: FAIL (module not found)

- [ ] **Step 5:** Implement `packages/matching/src/algorithms/jaro-winkler.ts`:
  - `jaroDistance(s1: string, s2: string): number` — classic Jaro distance: match window = `floor(max(len1, len2) / 2) - 1`, count matches and transpositions, return `(m/len1 + m/len2 + (m-t)/m) / 3`. Normalize both inputs to uppercase.
  - `jaroWinkler(s1: string, s2: string, prefixWeight?: number): number` — applies Winkler boost: `jaro + (commonPrefixLen * prefixWeight * (1 - jaro))`. Default prefixWeight = 0.1. Common prefix capped at 4 characters.

- [ ] **Step 6:** Run test — Expected: PASS

- [ ] **Step 7:** Create barrel `packages/matching/src/index.ts` exporting `jaroWinkler` and `jaroDistance`.

- [ ] **Step 8:** Run: `pnpm install && cd packages/matching && pnpm test` — Expected: PASS

- [ ] **Step 9:** Commit: `feat(matching): Jaro-Winkler string distance algorithm with tests`

---

## Task 2: Date + Place Comparators + Tests

**Files:**
- Create: `packages/matching/src/algorithms/date-compare.ts`, `packages/matching/src/algorithms/place-compare.ts`
- Test: `packages/matching/src/__tests__/date-compare.test.ts`, `packages/matching/src/__tests__/place-compare.test.ts`

- [ ] **Step 1:** Write `packages/matching/src/__tests__/date-compare.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { compareDates, DateCompareResult } from '../algorithms/date-compare.js';

describe('compareDates', () => {
  it('returns exact for identical dateSort values', () => {
    const result = compareDates(18501215, 18501215);
    expect(result.level).toBe('exact');
    expect(result.score).toBe(1.0);
  });

  it('returns within_1yr for dates 6 months apart', () => {
    const result = compareDates(18500615, 18501215);
    expect(result.level).toBe('within_1yr');
    expect(result.score).toBeCloseTo(0.9, 1);
  });

  it('returns within_2yr for dates 18 months apart', () => {
    const result = compareDates(18500101, 18510701);
    expect(result.level).toBe('within_2yr');
    expect(result.score).toBeCloseTo(0.75, 1);
  });

  it('returns same_decade for dates 5 years apart', () => {
    const result = compareDates(18500101, 18550101);
    expect(result.level).toBe('same_decade');
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it('returns no_match for dates > 10 years apart', () => {
    const result = compareDates(18500101, 18700101);
    expect(result.level).toBe('no_match');
    expect(result.score).toBe(0.0);
  });

  it('handles null values gracefully', () => {
    const result = compareDates(null, 18500101);
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5); // neutral — don't penalize missing data
  });

  it('handles both null values', () => {
    const result = compareDates(null, null);
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5);
  });

  it('handles year-only dateSort values (YYYYMMDD with MM=01, DD=01)', () => {
    // Year-only dates: 1850 stored as 18500101
    const result = compareDates(18500101, 18510101);
    expect(result.level).toBe('within_1yr');
  });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/matching/src/algorithms/date-compare.ts`:
  - `DateCompareResult` type: `{ level: 'exact' | 'within_1yr' | 'within_2yr' | 'same_decade' | 'no_match' | 'unknown'; score: number }`
  - `compareDates(dateSort1: number | null, dateSort2: number | null): DateCompareResult`
  - Convert dateSort (YYYYMMDD) to approximate day count for arithmetic. Calculate absolute difference in days. Map to tiers: 0 days = exact (1.0), <= 365 = within_1yr (0.9), <= 730 = within_2yr (0.75), <= 3650 = same_decade (0.5), else no_match (0.0). Null inputs return unknown (0.5).

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/matching/src/__tests__/place-compare.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { comparePlaces, PlaceCompareResult } from '../algorithms/place-compare.js';

describe('comparePlaces', () => {
  it('returns exact for identical place strings', () => {
    const result = comparePlaces('Springfield, IL', 'Springfield, IL');
    expect(result.level).toBe('exact');
    expect(result.score).toBe(1.0);
  });

  it('returns exact for case-insensitive match', () => {
    const result = comparePlaces('springfield, il', 'Springfield, IL');
    expect(result.level).toBe('exact');
  });

  it('returns county for same county/state but different city', () => {
    const result = comparePlaces('Springfield, Sangamon, IL', 'Chatham, Sangamon, IL');
    expect(result.level).toBe('county');
    expect(result.score).toBeCloseTo(0.8, 1);
  });

  it('returns state for same state but different county', () => {
    const result = comparePlaces('Springfield, IL', 'Chicago, IL');
    expect(result.level).toBe('state');
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it('returns country for same country but different state', () => {
    const result = comparePlaces('Springfield, IL, USA', 'Boston, MA, USA');
    expect(result.level).toBe('country');
    expect(result.score).toBeCloseTo(0.3, 1);
  });

  it('returns no_match for completely different places', () => {
    const result = comparePlaces('Springfield, IL, USA', 'London, England');
    expect(result.level).toBe('no_match');
    expect(result.score).toBe(0.0);
  });

  it('handles null values gracefully', () => {
    const result = comparePlaces(null, 'Springfield, IL');
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5);
  });

  it('normalizes common abbreviations (IL = Illinois)', () => {
    const result = comparePlaces('Springfield, Illinois', 'Springfield, IL');
    expect(result.level).toBe('exact');
  });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/matching/src/algorithms/place-compare.ts`:
  - `PlaceCompareResult` type: `{ level: 'exact' | 'county' | 'state' | 'country' | 'no_match' | 'unknown'; score: number }`
  - `comparePlaces(place1: string | null, place2: string | null): PlaceCompareResult`
  - Parse place strings into parts by splitting on `, `. Normalize to lowercase. Apply US state abbreviation map (IL -> illinois, etc.). Compare from most specific (full match) to least specific (last part match = country). Null inputs return unknown (0.5).
  - Internal helper: `parsePlaceParts(place: string): { parts: string[] }` — splits, trims, normalizes.
  - Internal helper: `US_STATE_ABBREVS: Record<string, string>` — 50 US state abbreviations.

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Export `compareDates`, `comparePlaces` from `packages/matching/src/index.ts`.

- [ ] **Step 10:** Commit: `feat(matching): date and place comparators with tiered scoring`

---

## Task 3: Composite Scorer + Blocking Strategy

**Files:**
- Create: `packages/matching/src/scoring/composite-scorer.ts`, `packages/matching/src/scoring/blocking.ts`
- Test: `packages/matching/src/__tests__/composite-scorer.test.ts`, `packages/matching/src/__tests__/blocking.test.ts`

- [ ] **Step 1:** Write `packages/matching/src/__tests__/composite-scorer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeMatchScore, defaultWeights, MatchInput, MatchResult } from '../scoring/composite-scorer.js';

describe('computeMatchScore', () => {
  it('returns high score for near-identical persons', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: 18501215,
      externalBirthDate: 18501215,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: 19230101,
      externalDeathDate: 19230101,
    };
    const result = computeMatchScore(input);
    expect(result.score).toBeGreaterThan(0.95);
    expect(result.components.name).toBeGreaterThan(0.95);
  });

  it('returns moderate score for similar names + close dates', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smyth',
      localBirthDate: 18500101,
      externalBirthDate: 18510101,
      localBirthPlace: null,
      externalBirthPlace: null,
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.score).toBeLessThan(0.95);
  });

  it('returns low score for different names', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'Mary Johnson',
      localBirthDate: 18500101,
      externalBirthDate: 18500101,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    expect(result.score).toBeLessThan(0.5);
  });

  it('accepts custom weights', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: null,
      externalBirthDate: null,
      localBirthPlace: null,
      externalBirthPlace: null,
      localDeathDate: null,
      externalDeathDate: null,
    };
    const heavyName = computeMatchScore(input, { name: 0.8, birthDate: 0.05, birthPlace: 0.05, deathDate: 0.05, deathPlace: 0.05 });
    const lightName = computeMatchScore(input, { name: 0.2, birthDate: 0.2, birthPlace: 0.2, deathDate: 0.2, deathPlace: 0.2 });
    expect(heavyName.score).toBeGreaterThan(lightName.score);
  });

  it('decomposes scores into named components', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: 18500101,
      externalBirthDate: 18500101,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    expect(result.components).toHaveProperty('name');
    expect(result.components).toHaveProperty('birthDate');
    expect(result.components).toHaveProperty('birthPlace');
    expect(result.components).toHaveProperty('deathDate');
  });

  it('default weights sum to 1.0', () => {
    const sum = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/matching/src/scoring/composite-scorer.ts`:
  - `MatchInput` type: localName, externalName, localBirthDate (number|null), externalBirthDate, localBirthPlace (string|null), externalBirthPlace, localDeathDate, externalDeathDate, localDeathPlace?, externalDeathPlace?
  - `MatchWeights` type: `{ name: number; birthDate: number; birthPlace: number; deathDate: number; deathPlace: number }`
  - `defaultWeights`: `{ name: 0.35, birthDate: 0.25, birthPlace: 0.20, deathDate: 0.10, deathPlace: 0.10 }`
  - `MatchResult` type: `{ score: number; components: Record<string, number>; weights: MatchWeights }`
  - `computeMatchScore(input: MatchInput, weights?: MatchWeights): MatchResult`
  - For name: split into given + surname, compute Jaro-Winkler on each, average. For dates: use `compareDates`. For places: use `comparePlaces`. Final score = weighted sum.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/matching/src/__tests__/blocking.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateBlockingKey, findCandidateBlocks } from '../scoring/blocking.js';

describe('generateBlockingKey', () => {
  it('generates key from surname + birth decade', () => {
    expect(generateBlockingKey('Smith', 18501215)).toBe('smith_185');
  });

  it('normalizes surname to lowercase', () => {
    expect(generateBlockingKey('SMITH', 18500101)).toBe('smith_185');
  });

  it('handles missing birth date', () => {
    expect(generateBlockingKey('Smith', null)).toBe('smith_???');
  });

  it('handles compound surnames', () => {
    expect(generateBlockingKey('Van Der Berg', 19200101)).toBe('vanderberg_192');
  });

  it('strips diacritics', () => {
    expect(generateBlockingKey('Muller', 18700101)).toBe('muller_187');
    expect(generateBlockingKey('Mueller', 18700101)).toBe('mueller_187');
  });
});

describe('findCandidateBlocks', () => {
  it('returns adjacent decades as candidate blocks', () => {
    const blocks = findCandidateBlocks('Smith', 18501215);
    expect(blocks).toContain('smith_185');
    expect(blocks).toContain('smith_184'); // decade before
    expect(blocks).toContain('smith_186'); // decade after
    expect(blocks).toHaveLength(3);
  });

  it('returns single block when birth date is null', () => {
    const blocks = findCandidateBlocks('Smith', null);
    expect(blocks).toEqual(['smith_???']);
  });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/matching/src/scoring/blocking.ts`:
  - `generateBlockingKey(surname: string, birthDateSort: number | null): string` — lowercase surname (strip spaces, keep alpha only) + `_` + first 3 digits of birth year (decade). Null date uses `???`.
  - `findCandidateBlocks(surname: string, birthDateSort: number | null): string[]` — returns primary key + adjacent decades (decade-1, decade+1). Null date returns single `???` block.

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Export all scoring functions from `packages/matching/src/index.ts`.

- [ ] **Step 10:** Run: `cd packages/matching && pnpm test` — Expected: all pass

- [ ] **Step 11:** Commit: `feat(matching): composite scorer with configurable weights and blocking strategy`

---

## Task 4: Hints Generation Pipeline

**Files:**
- Create: `packages/matching/src/pipeline/hints-generator.ts`, `packages/db/src/matching-schema.ts`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/matching/src/__tests__/hints-generator.test.ts`

The `match_candidates` table schema is already defined in `docs/architecture/data-model.md`. This task implements the Drizzle schema and the pipeline that populates it.

- [ ] **Step 1:** Create `packages/db/src/matching-schema.ts` with Drizzle table definitions for:
  - `matchCandidates` — id (PK), personId (FK persons), sourceSystem (text), externalId (text), externalData (text, JSON), matchScore (real, 0-1), matchStatus (enum: pending/accepted/rejected/maybe, default pending), reviewedAt (text nullable), createdAt (text). Unique on (personId, sourceSystem, externalId). Indexes: idx_match_candidates_person on personId, idx_match_candidates_status on matchStatus (WHERE pending).
  - `proposedRelationships` — id (PK), relationshipType (enum: parent_child/partner/sibling), person1Id (FK), person2Id (FK), sourceType (enum: familysearch/nara/ai_suggestion/record_match/ocr_extraction/user_proposal), sourceDetail (text nullable), confidence (real nullable), status (enum: pending/validated/rejected/needs_info, default pending), validatedBy (text nullable), validatedAt (text nullable), rejectionReason (text nullable), createdAt, updatedAt. Indexes on status, person1Id, person2Id.
  - `relationshipJustifications` — id (PK), familyId (FK nullable), childLinkId (FK nullable), justificationText (text), sourceCitationId (FK nullable), authorId (text), createdAt, updatedAt. CHECK constraint: exactly one of familyId or childLinkId must be set. Indexes on familyId, childLinkId.

- [ ] **Step 2:** Add `export * from './matching-schema.js';` to `packages/db/src/schema.ts`.

- [ ] **Step 3:** Run: `cd packages/db && pnpm drizzle-kit generate` — Expected: migration SQL created.

- [ ] **Step 4:** Run: `cd packages/db && pnpm db:migrate` — Expected: tables created.

- [ ] **Step 5:** Write `packages/matching/src/__tests__/hints-generator.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { generateHintsForPerson, HintGeneratorConfig } from '../pipeline/hints-generator.js';

// Mock external search results
const mockSearchResults = [
  {
    providerId: 'familysearch',
    externalId: 'fs-123',
    title: 'John Smith - 1850 Census',
    snippet: 'John Smith, age 30, Springfield IL',
    url: 'https://familysearch.org/ark:/123',
    extractedData: {
      name: 'John Smith',
      birthDate: '1820',
      location: 'Springfield, IL',
    },
  },
  {
    providerId: 'familysearch',
    externalId: 'fs-456',
    title: 'Johan Schmidt - Ship Manifest',
    snippet: 'Johan Schmidt, age 28',
    url: 'https://familysearch.org/ark:/456',
    extractedData: {
      name: 'Johan Schmidt',
      birthDate: '1822',
      location: 'Hamburg, Germany',
    },
  },
];

describe('generateHintsForPerson', () => {
  it('scores and filters search results against local person', () => {
    const localPerson = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: 'Springfield, IL',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    expect(hints.length).toBeGreaterThan(0);
    // First result should score higher (exact name + place match)
    expect(hints[0].externalId).toBe('fs-123');
    expect(hints[0].matchScore).toBeGreaterThan(0.7);
  });

  it('filters out results below score threshold', () => {
    const localPerson = {
      givenName: 'Mary',
      surname: 'Johnson',
      birthDateSort: 19000101,
      birthPlace: 'Boston, MA',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults, { minScore: 0.5 });
    expect(hints).toHaveLength(0); // None should match
  });

  it('respects maxHints config', () => {
    const localPerson = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: null,
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults, { maxHints: 1 });
    expect(hints.length).toBeLessThanOrEqual(1);
  });

  it('returns sorted by matchScore descending', () => {
    const localPerson = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: null,
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    for (let i = 1; i < hints.length; i++) {
      expect(hints[i - 1].matchScore).toBeGreaterThanOrEqual(hints[i].matchScore);
    }
  });

  it('includes match score components for transparency', () => {
    const localPerson = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: 'Springfield, IL',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    expect(hints[0].components).toHaveProperty('name');
    expect(hints[0].components).toHaveProperty('birthDate');
    expect(hints[0].components).toHaveProperty('birthPlace');
  });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/matching/src/pipeline/hints-generator.ts`:
  - `HintGeneratorConfig` type: `{ minScore?: number; maxHints?: number; weights?: MatchWeights }`
  - `LocalPersonData` type: `{ givenName: string; surname: string; birthDateSort: number | null; birthPlace: string | null; deathDateSort: number | null; deathPlace: string | null }`
  - `HintCandidate` type: `{ providerId: string; externalId: string; externalData: Record<string, any>; matchScore: number; components: Record<string, number>; url: string; title: string }`
  - `generateHintsForPerson(person: LocalPersonData, searchResults: SearchResult[], config?: HintGeneratorConfig): HintCandidate[]`
  - For each search result: extract name/dates/places from `extractedData`, call `computeMatchScore`, filter by minScore (default 0.4), sort descending, limit by maxHints (default 20).

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Create `apps/web/app/api/matching/hints/route.ts`:
  - **GET:** `?personId=xxx&status=pending` — queries `match_candidates` table filtered by personId and status. Returns JSON array.
  - **POST:** `{ personId }` — fetches person data from DB, runs search across enabled providers (from Plan A's `ProviderRegistry`), calls `generateHintsForPerson`, upserts results into `match_candidates` table. Returns count of new hints.

- [ ] **Step 10:** Create `apps/web/app/api/matching/hints/[id]/route.ts`:
  - **PATCH:** `{ matchStatus: 'accepted' | 'rejected' | 'maybe' }` — updates match_candidates row, sets reviewedAt to now. If accepted, optionally creates a `proposed_relationship` entry.

- [ ] **Step 11:** Export pipeline functions from `packages/matching/src/index.ts`.

- [ ] **Step 12:** Commit: `feat(matching): hints generation pipeline with match_candidates schema and API`

---

## Task 5: Hints Review UI

**Files:**
- Create: `apps/web/components/research/hints-panel.tsx`, `apps/web/components/research/hint-card.tsx`, `apps/web/components/research/hint-comparison.tsx`
- Modify: `apps/web/app/(auth)/research/page.tsx`

- [ ] **Step 1:** Create `apps/web/components/research/hint-comparison.tsx`:
  - Side-by-side comparison component. Props: `localPerson: PersonSummary`, `externalRecord: ExternalRecordData`.
  - Two columns: "Your Tree" (left) and "External Record" (right).
  - Each column shows: name, birth date, birth place, death date, death place.
  - Highlight matching fields in green, mismatching in amber, missing in gray.
  - Uses `Card` from shadcn/ui. Responsive — stacks vertically on mobile.

- [ ] **Step 2:** Create `apps/web/components/research/hint-card.tsx`:
  - Individual hint card. Props: `hint: MatchCandidate`, `localPerson: PersonSummary`, `onAccept`, `onReject`, `onMaybe`.
  - Shows: provider badge (from Plan A), match score as percentage with color coding (>80% green, 50-80% amber, <50% red), title, snippet.
  - Expandable: click to reveal `HintComparison` component with full side-by-side.
  - Action buttons: Accept (check icon), Reject (X icon), Maybe (? icon). Uses `Button` from shadcn/ui.
  - Score breakdown tooltip showing component scores (name: 95%, date: 90%, place: 80%).

- [ ] **Step 3:** Create `apps/web/components/research/hints-panel.tsx`:
  - Panel component for the research page. Props: `personId: string`.
  - Fetches hints via `GET /api/matching/hints?personId=xxx&status=pending`.
  - Shows count badge in header: "Hints (3)".
  - "Generate Hints" button — calls `POST /api/matching/hints { personId }`. Shows loading spinner during generation.
  - Renders list of `HintCard` components.
  - Filter tabs: Pending | Accepted | Rejected | All.
  - Empty state: "No hints yet. Click 'Generate Hints' to search for matching records."
  - Optimistic updates on accept/reject — removes card with animation, calls PATCH endpoint.

- [ ] **Step 4:** Add a "Hints" tab or collapsible section to the research page at `apps/web/app/(auth)/research/page.tsx`. When a person is selected (via query param `?personId=xxx`), show the `HintsPanel`. When no person is selected, show prompt to select a person.

- [ ] **Step 5:** Wire up mutations: accept calls `PATCH /api/matching/hints/[id]` with `{ matchStatus: 'accepted' }`, reject with `{ matchStatus: 'rejected' }`, maybe with `{ matchStatus: 'maybe' }`. Use optimistic updates with SWR `mutate` or React state.

- [ ] **Step 6:** Add keyboard shortcuts: `a` = accept, `r` = reject, `m` = maybe (when a hint card is focused). Use `useEffect` with keydown listener scoped to focused card.

- [ ] **Step 7:** Commit: `feat(matching): hints review UI with side-by-side comparison cards`

---

## Task 6: Vercel AI SDK Setup + System Prompt

**Files:**
- Create: `packages/ai/package.json`, `packages/ai/tsconfig.json`, `packages/ai/src/index.ts`, `packages/ai/src/prompts/research-assistant.ts`, `packages/ai/src/context/tree-context.ts`, `packages/db/src/ai-schema.ts`
- Modify: `packages/db/src/schema.ts`
- Test: `packages/ai/src/__tests__/tree-context.test.ts`

- [ ] **Step 1:** Create `packages/ai/package.json` with dependencies: `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `zod`. Peer deps: `@ancstra/db`. Scripts: test (vitest), build (tsup).

- [ ] **Step 2:** Create `packages/ai/tsconfig.json` extending root config.

- [ ] **Step 3:** Create `packages/db/src/ai-schema.ts` with Drizzle table definition:
  - `aiUsage` — id (PK), userId (FK users), model (text), inputTokens (integer), outputTokens (integer), costUsd (real), taskType (text: 'chat' | 'extraction' | 'analysis' | 'citation'), sessionId (text nullable, groups messages in a conversation), createdAt (text). Indexes: idx_ai_usage_user_month on (userId, createdAt) for budget queries.

- [ ] **Step 4:** Add `export * from './ai-schema.js';` to `packages/db/src/schema.ts`. Run migration.

- [ ] **Step 5:** Write `packages/ai/src/__tests__/tree-context.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db';
import { buildTreeContext } from '../context/tree-context.js';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

// Setup in-memory DB with schema + seed data (similar to persons.test.ts pattern)
// ...

describe('buildTreeContext', () => {
  it('returns summary with person count', async () => {
    const ctx = await buildTreeContext(db);
    expect(ctx.summary).toContain('persons');
  });

  it('includes key persons from direct line', async () => {
    const ctx = await buildTreeContext(db, 'focus-person-id');
    expect(ctx.keyPersons.length).toBeGreaterThan(0);
    expect(ctx.keyPersons.length).toBeLessThanOrEqual(50);
  });

  it('identifies research gaps', async () => {
    const ctx = await buildTreeContext(db);
    expect(ctx.gaps).toBeInstanceOf(Array);
  });

  it('respects token budget by limiting key persons', async () => {
    const ctx = await buildTreeContext(db, undefined, 500);
    // With very low budget, fewer persons should be included
    expect(ctx.keyPersons.length).toBeLessThanOrEqual(10);
  });

  it('returns valid TreeContext shape', async () => {
    const ctx = await buildTreeContext(db);
    expect(ctx).toHaveProperty('summary');
    expect(ctx).toHaveProperty('keyPersons');
    expect(ctx).toHaveProperty('gaps');
    expect(ctx).toHaveProperty('recentActivity');
    expect(ctx).toHaveProperty('tokenBudget');
  });
});
```

- [ ] **Step 6:** Run test — Expected: FAIL

- [ ] **Step 7:** Implement `packages/ai/src/context/tree-context.ts`:
  - `TreeContext` interface: summary, keyPersons (PersonSummary[]), gaps (string[]), recentActivity (string[]), tokenBudget.
  - `PersonSummary` type: id, name, birthYear, deathYear, birthPlace, generation.
  - `buildTreeContext(db, focusPersonId?, tokenBudget = 2000)`:
    1. Get tree stats: `SELECT COUNT(*) FROM persons WHERE deleted_at IS NULL`.
    2. Find root or focus person. Get ancestors via recursive CTE (5 generations).
    3. Build summary string with person count, generation span, earliest ancestor.
    4. Map direct line to PersonSummary (cap at 50, or fewer if tokenBudget is low — estimate ~40 tokens per person).
    5. Identify gaps: missing birth dates, missing parents (persons with no family as child), unsourced persons (no source_citations). Return top 10.
    6. Get recent activity: last 5 persons created/updated.

- [ ] **Step 8:** Run test — Expected: PASS

- [ ] **Step 9:** Implement `packages/ai/src/prompts/research-assistant.ts`:
  - `buildSystemPrompt(treeContext: TreeContext): string` — template from ai-strategy.md. Includes tree context summary, key persons list, research gaps, guidelines (7 rules), available tools section, record types section. Total system prompt should be under 3000 tokens with a full tree context.

- [ ] **Step 10:** Create barrel `packages/ai/src/index.ts` exporting `buildTreeContext`, `buildSystemPrompt`, `TreeContext`, `PersonSummary`.

- [ ] **Step 11:** Commit: `feat(ai): Vercel AI SDK setup, tree context builder, and system prompt`

---

## Task 7: Core AI Tools (Tree Search, Relationship, Gaps)

**Files:**
- Create: `packages/ai/src/tools/search-local-tree.ts`, `packages/ai/src/tools/compute-relationship.ts`, `packages/ai/src/tools/analyze-tree-gaps.ts`, `packages/ai/src/tools/explain-record.ts`, `packages/ai/src/tools/propose-relationship.ts`, `packages/ai/src/tools/search-familysearch.ts`
- Test: `packages/ai/src/__tests__/search-local-tree.test.ts`, `packages/ai/src/__tests__/compute-relationship.test.ts`, `packages/ai/src/__tests__/analyze-tree-gaps.test.ts`, `packages/ai/src/__tests__/propose-relationship.test.ts`

- [ ] **Step 1:** Write `packages/ai/src/__tests__/search-local-tree.test.ts` — test the execute function with in-memory DB. Seeds 3 persons, searches by surname, verifies results include name, birth/death, events. Tests: exact match, partial match, no match, free-text query.

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/ai/src/tools/search-local-tree.ts`:
  - Uses Vercel AI SDK `tool()` function with Zod parameters: givenName?, surname?, birthYear?, birthPlace?, query?.
  - `execute` function: builds FTS5 query from params, queries `persons_fts` + joins `persons`, `person_names`, `events`. Filters living persons (returns "Living Person" placeholder). Returns max 10 results with: id, name, sex, birthDate, birthPlace, deathDate, deathPlace.
  - Export as `searchLocalTreeTool` (the tool definition) and `executeSearchLocalTree` (the raw function, for unit testing).

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Write `packages/ai/src/__tests__/compute-relationship.test.ts` — seed parent-child relationships, test: computes "parent", "child", "sibling", "grandparent", returns "no relationship found" for unrelated persons.

- [ ] **Step 6:** Implement `packages/ai/src/tools/compute-relationship.ts`:
  - Zod params: person1Id, person2Id.
  - `execute`: uses recursive CTE to find common ancestor path. Computes relationship label (parent, child, grandparent, sibling, cousin, etc.) using generation counts. Returns: `{ relationship, path, commonAncestor, generationsRemoved }`.

- [ ] **Step 7:** Run test — Expected: PASS

- [ ] **Step 8:** Write `packages/ai/src/__tests__/analyze-tree-gaps.test.ts` — seed tree with gaps (missing parents, missing dates), verify gaps are identified and prioritized.

- [ ] **Step 9:** Implement `packages/ai/src/tools/analyze-tree-gaps.ts`:
  - Zod params: personId? (optional focus), maxGenerations (default 5).
  - `execute`: recursive CTE to walk ancestors. For each person check: has birth date? has death date? has parents? has source citations? Count gaps per category. Return prioritized list: `{ personName, personId, gapType, priority, suggestion }`.

- [ ] **Step 10:** Run test — Expected: PASS

- [ ] **Step 11:** Implement `packages/ai/src/tools/explain-record.ts`:
  - Zod params: recordType, recordContent, year?, location?.
  - `execute`: returns structured data that Claude will use to generate explanation. Returns: `{ recordType, year, location, parsedContent: recordContent }`. This is a pass-through — Claude interprets the content using its knowledge. No DB access needed.

- [ ] **Step 12:** Write `packages/ai/src/__tests__/propose-relationship.test.ts` — test that execute creates entry in `proposed_relationships` with correct data, verifies status is 'pending', verifies confidence is stored.

- [ ] **Step 13:** Implement `packages/ai/src/tools/propose-relationship.ts`:
  - Zod params: person1Id, person2Id, relationshipType (parent_child/partner/sibling), evidence (string), confidence (0-1), sourceRecordId?.
  - `execute`: validates both person IDs exist. Checks for duplicate proposal (same person pair + type). Inserts into `proposed_relationships` with sourceType='ai_suggestion', sourceDetail=evidence+sourceRecordId. Returns: `{ proposalId, status: 'pending', message }`.

- [ ] **Step 14:** Run all tests — Expected: PASS

- [ ] **Step 15:** Implement `packages/ai/src/tools/search-familysearch.ts`:
  - Zod params: givenName, surname, birthDate?, birthPlace?, deathDate?, deathPlace?, recordType?.
  - `execute`: uses `FamilySearchProvider` from `@ancstra/research` (Plan A). Passes through search, returns top 5 results mapped to: title, url, snippet, extractedData. If no FS access token, returns error message suggesting user connect FamilySearch.

- [ ] **Step 16:** Export all tools from `packages/ai/src/index.ts`.

- [ ] **Step 17:** Commit: `feat(ai): core tools — searchLocalTree, computeRelationship, analyzeTreeGaps, explainRecord, proposeRelationship, searchFamilySearch`

---

## Task 8: Research AI Tools (Web Search, Scrape, Facts, Conflicts)

**Files:**
- Create: `packages/ai/src/tools/research/search-web.ts`, `packages/ai/src/tools/research/scrape-url.ts`, `packages/ai/src/tools/research/extract-facts.ts`, `packages/ai/src/tools/research/detect-conflicts.ts`, `packages/ai/src/tools/research/suggest-searches.ts`
- Test: `packages/ai/src/__tests__/extract-facts.test.ts`, `packages/ai/src/__tests__/detect-conflicts.test.ts`

- [ ] **Step 1:** Implement `packages/ai/src/tools/research/search-web.ts`:
  - Zod params: query (string), providers? (string[], subset of enabled providers), maxResults? (number, default 10).
  - `execute`: uses `ProviderRegistry` from `@ancstra/research` (Plan A). Calls `searchAll()` with constructed `SearchRequest`. Returns aggregated results with providerId, title, url, snippet, relevanceScore. If specific providers requested, filters registry.

- [ ] **Step 2:** Implement `packages/ai/src/tools/research/scrape-url.ts`:
  - Zod params: url (string), extractEntities? (boolean, default false).
  - `execute`: dispatches to Hono worker `POST /jobs/scrape-url` with `{ url, extractEntities }`. Returns: `{ title, textContent, metadata, extractedEntities? }`. If worker unavailable, returns error message.

- [ ] **Step 3:** Write `packages/ai/src/__tests__/extract-facts.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseExtractedFacts, validateFactType } from '../tools/research/extract-facts.js';

describe('validateFactType', () => {
  it('accepts valid fact types', () => {
    expect(validateFactType('birth_date')).toBe(true);
    expect(validateFactType('death_place')).toBe(true);
    expect(validateFactType('occupation')).toBe(true);
  });

  it('rejects invalid fact types', () => {
    expect(validateFactType('invalid_type')).toBe(false);
  });
});

describe('parseExtractedFacts', () => {
  it('parses well-formed AI extraction output', () => {
    const aiOutput = [
      { factType: 'birth_date', factValue: '15 Mar 1850', confidence: 'high' },
      { factType: 'birth_place', factValue: 'Springfield, IL', confidence: 'medium' },
    ];
    const facts = parseExtractedFacts(aiOutput, 'person-123', 'ri-456');
    expect(facts).toHaveLength(2);
    expect(facts[0].personId).toBe('person-123');
    expect(facts[0].researchItemId).toBe('ri-456');
    expect(facts[0].extractionMethod).toBe('ai_extracted');
  });

  it('filters out facts with invalid types', () => {
    const aiOutput = [
      { factType: 'birth_date', factValue: '1850', confidence: 'high' },
      { factType: 'favorite_color', factValue: 'blue', confidence: 'low' },
    ];
    const facts = parseExtractedFacts(aiOutput, 'person-123', 'ri-456');
    expect(facts).toHaveLength(1);
  });

  it('handles empty extraction', () => {
    const facts = parseExtractedFacts([], 'person-123', 'ri-456');
    expect(facts).toHaveLength(0);
  });
});
```

- [ ] **Step 4:** Run test — Expected: FAIL

- [ ] **Step 5:** Implement `packages/ai/src/tools/research/extract-facts.ts`:
  - Zod params: text (string), documentType? (string), personContext? (string).
  - `execute`: calls Claude (Haiku for cost efficiency) with extraction prompt. Prompt instructs Claude to return JSON array of `{ factType, factValue, confidence }`. Parses response, validates fact types against the 16 allowed types from research_facts schema, creates `research_facts` entries.
  - Export `parseExtractedFacts` and `validateFactType` as standalone functions for unit testing.
  - Valid fact types: `name`, `birth_date`, `birth_place`, `death_date`, `death_place`, `marriage_date`, `marriage_place`, `residence`, `occupation`, `immigration`, `military_service`, `religion`, `ethnicity`, `parent_name`, `spouse_name`, `child_name`, `other`.

- [ ] **Step 6:** Run test — Expected: PASS

- [ ] **Step 7:** Write `packages/ai/src/__tests__/detect-conflicts.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db';
import { executeDetectConflicts } from '../tools/research/detect-conflicts.js';

// Setup in-memory DB, seed person with conflicting facts
// ...

describe('detectConflicts', () => {
  it('detects conflicting birth dates from different sources', async () => {
    // Seed: person with birth_date "1850" from source A and "1852" from source B
    const conflicts = await executeDetectConflicts(db, 'person-123');
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].factType).toBe('birth_date');
    expect(conflicts[0].values).toHaveLength(2);
  });

  it('ignores multi-valued fact types (residence, occupation)', async () => {
    // Seed: person with two different residences — not a conflict
    const conflicts = await executeDetectConflicts(db, 'person-456');
    const residenceConflicts = conflicts.filter(c => c.factType === 'residence');
    expect(residenceConflicts).toHaveLength(0);
  });

  it('returns empty array for person with no conflicts', async () => {
    const conflicts = await executeDetectConflicts(db, 'person-no-conflicts');
    expect(conflicts).toHaveLength(0);
  });
});
```

- [ ] **Step 8:** Implement `packages/ai/src/tools/research/detect-conflicts.ts`:
  - Zod params: personId (string).
  - `execute`: runs the conflict detection SQL query from the research workspace spec (self-join on research_facts, same person + same fact_type + different values, excluding multi-valued types). Returns: `{ factType, values: [{ value, confidence, sourceId }][], suggestion }`.
  - Export `executeDetectConflicts` for unit testing.

- [ ] **Step 9:** Run test — Expected: PASS

- [ ] **Step 10:** Implement `packages/ai/src/tools/research/suggest-searches.ts`:
  - Zod params: personId (string), maxSuggestions? (number, default 5).
  - `execute`: analyzes person's existing data (events, sources, research items already searched). Identifies what's missing. Generates search suggestions: e.g., "Search NARA for military records — no military service documented for John Smith who lived during Civil War era (born 1840)". Returns: `{ suggestions: [{ query, provider, reasoning, priority }] }`.

- [ ] **Step 11:** Export all research tools from `packages/ai/src/index.ts`.

- [ ] **Step 12:** Commit: `feat(ai): research tools — searchWeb, scrapeUrl, extractFacts, detectConflicts, suggestSearches`

---

## Task 9: Chat UI with Streaming

**Files:**
- Create: `apps/web/app/api/ai/chat/route.ts`, `apps/web/components/research/chat-panel.tsx`, `apps/web/components/research/chat-message.tsx`, `apps/web/components/research/tool-call-indicator.tsx`
- Modify: `apps/web/app/(auth)/research/page.tsx`

- [ ] **Step 1:** Create `apps/web/app/api/ai/chat/route.ts`:
  - POST handler. Reads `{ messages, focusPersonId? }` from request body.
  - Validates session (user must be authenticated).
  - Calls `buildTreeContext(db, focusPersonId)` for context injection.
  - Calls `buildSystemPrompt(treeContext)` for system message.
  - Uses `streamText()` from Vercel AI SDK with:
    - `model: anthropic('claude-sonnet-4-6')` (default, configurable via env)
    - `system: systemPrompt`
    - `messages` from request
    - `tools`: all 11 tools (searchLocalTree, searchFamilySearch, computeRelationship, analyzeTreeGaps, explainRecord, proposeRelationship, searchWeb, scrapeUrl, extractFacts, detectConflicts, suggestSearches)
    - `maxSteps: 5` (allow multi-step tool use)
  - On completion callback: record usage in `ai_usage` table via cost tracker.
  - Returns `result.toDataStreamResponse()`.

- [ ] **Step 2:** Create `apps/web/components/research/tool-call-indicator.tsx`:
  - Shows inline indicator when Claude calls a tool. Props: `toolName: string`, `status: 'calling' | 'complete' | 'error'`, `args?: Record<string, any>`, `result?: any`.
  - Visual: small pill with tool icon + name. Spinner while calling. Check mark when complete. Expandable to show args/result as formatted JSON.
  - Tool name display map: `searchLocalTree` -> "Searching your tree...", `searchFamilySearch` -> "Searching FamilySearch...", `analyzeTreeGaps` -> "Analyzing gaps...", etc.

- [ ] **Step 3:** Create `apps/web/components/research/chat-message.tsx`:
  - Single message component. Props: `message: Message` (from Vercel AI SDK `useChat`).
  - User messages: right-aligned, indigo background, white text.
  - Assistant messages: left-aligned, white/card background, markdown rendered.
  - Tool call messages: rendered as `ToolCallIndicator` components inline.
  - Uses `react-markdown` for assistant message rendering (already a project dep or add it).
  - Timestamps shown on hover.

- [ ] **Step 4:** Create `apps/web/components/research/chat-panel.tsx`:
  - Chat panel component. Props: `focusPersonId?: string`.
  - Uses `useChat()` hook from `ai/react` (Vercel AI SDK) pointing to `/api/ai/chat`.
  - Passes `focusPersonId` in request body.
  - Layout: scrollable message list + fixed input bar at bottom.
  - Input: `Textarea` (auto-resize, shift+enter for newline, enter to send) + send button.
  - Empty state: "Ask me anything about your family tree. I can search records, analyze gaps, and help with research."
  - Shows loading indicator (3 dots animation) while assistant is responding.
  - Auto-scrolls to bottom on new messages.
  - "New Chat" button to clear conversation.
  - Suggested starter prompts as clickable chips: "Find records for...", "What gaps exist in my tree?", "Explain this record..."

- [ ] **Step 5:** Integrate chat panel into research page at `apps/web/app/(auth)/research/page.tsx`:
  - Add a resizable split pane or tab: "Search" (existing) | "AI Chat" | "Hints".
  - Chat panel gets the currently selected person's ID as `focusPersonId`.
  - On mobile: tabs instead of split pane.

- [ ] **Step 6:** Handle error states in chat:
  - Budget exceeded: show alert "Monthly AI budget reached ($X/$Y). Increase limit in settings."
  - API error: show retry button on failed message.
  - Network error: show offline indicator.

- [ ] **Step 7:** Add message persistence (optional, lightweight):
  - Store chat sessions in `localStorage` keyed by `personId` for cross-page-refresh continuity.
  - "Clear History" button in chat header.
  - Limit stored messages to last 50 per session.

- [ ] **Step 8:** Commit: `feat(ai): chat UI with streaming, tool call indicators, and research page integration`

---

## Task 10: Cost Tracking + Budget Enforcement

**Files:**
- Create: `packages/ai/src/context/cost-tracker.ts`, `apps/web/components/research/cost-badge.tsx`
- Test: `packages/ai/src/__tests__/cost-tracker.test.ts`

- [ ] **Step 1:** Write `packages/ai/src/__tests__/cost-tracker.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCost, PRICING } from '../context/cost-tracker.js';

describe('calculateCost', () => {
  it('calculates Sonnet cost correctly', () => {
    // 1000 input tokens + 500 output tokens on Sonnet
    const cost = calculateCost('claude-sonnet-4-6', 1000, 500);
    // (1000 * 3.00 + 500 * 15.00) / 1_000_000 = 0.0105
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  it('calculates Haiku cost correctly', () => {
    const cost = calculateCost('claude-haiku-4-5', 1000, 500);
    // (1000 * 0.80 + 500 * 4.00) / 1_000_000 = 0.0028
    expect(cost).toBeCloseTo(0.0028, 4);
  });

  it('calculates Opus cost correctly', () => {
    const cost = calculateCost('claude-opus-4-6', 1000, 500);
    // (1000 * 15.00 + 500 * 75.00) / 1_000_000 = 0.0525
    expect(cost).toBeCloseTo(0.0525, 4);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCost('unknown-model', 1000, 500)).toBe(0);
  });
});

describe('checkBudget', () => {
  // Uses in-memory DB with seeded ai_usage rows
  it('returns spent amount for current month', async () => {
    // Seed usage records for this month
    const result = await checkBudget(db, 10);
    expect(result.spent).toBeGreaterThan(0);
    expect(result.remaining).toBeLessThan(10);
    expect(result.overBudget).toBe(false);
  });

  it('detects over-budget condition', async () => {
    // Seed usage records totaling > $10
    const result = await checkBudget(db, 10);
    expect(result.overBudget).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('excludes previous month usage', async () => {
    // Seed usage records from last month — should not count
    const result = await checkBudget(db, 10);
    expect(result.spent).toBe(0);
  });
});
```

- [ ] **Step 2:** Run test — Expected: FAIL

- [ ] **Step 3:** Implement `packages/ai/src/context/cost-tracker.ts`:
  - `PRICING` constant: per-million-token rates for claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-6 (from ai-strategy.md).
  - `calculateCost(model: string, inputTokens: number, outputTokens: number): number` — pure function.
  - `recordUsage(db, { userId, model, inputTokens, outputTokens, taskType, sessionId }): Promise<void>` — inserts into `ai_usage` table with calculated cost.
  - `checkBudget(db, monthlyLimitUsd = 10): Promise<{ spent: number; remaining: number; overBudget: boolean }>` — queries `ai_usage` for current month, sums costUsd. Returns budget status.
  - `getUsageStats(db, userId, daysBack = 30): Promise<{ totalCost: number; totalRequests: number; byModel: Record<string, { requests: number; cost: number }> }>` — for settings display.

- [ ] **Step 4:** Run test — Expected: PASS

- [ ] **Step 5:** Add budget enforcement to `apps/web/app/api/ai/chat/route.ts`:
  - Before calling `streamText()`, call `checkBudget(db, monthlyLimit)`. Read `AI_MONTHLY_BUDGET_USD` from env (default $10).
  - If `overBudget`, return 429 with `{ error: 'Monthly AI budget exceeded', spent, limit }`.
  - After stream completes (in `onFinish` callback), call `recordUsage()` with token counts from response.

- [ ] **Step 6:** Create `apps/web/components/research/cost-badge.tsx`:
  - Small badge showing monthly spend. Props: none (fetches from API).
  - Fetches `GET /api/ai/usage` — returns `{ spent, limit, remaining, percentUsed }`.
  - Visual: green for <50%, amber for 50-80%, red for >80%. Shows "$X.XX / $Y.YY".
  - Tooltip: breakdown by model, total requests this month.
  - Placed in chat panel header next to "New Chat" button.

- [ ] **Step 7:** Create `apps/web/app/api/ai/usage/route.ts`:
  - GET handler: calls `checkBudget()` and `getUsageStats()`, returns combined JSON.
  - Only accessible to authenticated users. Returns their own usage only.

- [ ] **Step 8:** Add `ANTHROPIC_API_KEY` and `AI_MONTHLY_BUDGET_USD` to `.env.example`.

- [ ] **Step 9:** Export cost tracker functions from `packages/ai/src/index.ts`.

- [ ] **Step 10:** Commit: `feat(ai): cost tracking with budget enforcement and usage badge`

---

## Summary

| Task | What | Tests | ~Duration |
|------|------|-------|-----------|
| 1 | Jaro-Winkler distance | jaro-winkler.test.ts | 0.5d |
| 2 | Date + place comparators | date-compare.test.ts, place-compare.test.ts | 1d |
| 3 | Composite scorer + blocking | composite-scorer.test.ts, blocking.test.ts | 1d |
| 4 | Hints generation pipeline | hints-generator.test.ts + schema migration | 1.5d |
| 5 | Hints review UI | — (visual) | 1.5d |
| 6 | Vercel AI SDK + system prompt | tree-context.test.ts | 1.5d |
| 7 | Core AI tools (6 tools) | search, relationship, gaps, propose tests | 2d |
| 8 | Research AI tools (5 tools) | extract-facts, detect-conflicts tests | 2d |
| 9 | Chat UI with streaming | — (integration) | 2d |
| 10 | Cost tracking + budget | cost-tracker.test.ts | 1d |

**Total estimated duration:** ~14 days
**Total commits:** ~10
**Total test files:** ~12
**Total new tools:** 11 (6 core + 5 research)
