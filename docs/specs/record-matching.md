# Record Matching Engine

> Phase: 2 | Status: Not Started
> Depth: design-level
> Dependencies: [data-model.md](../architecture/data-model.md), [relationship-validation.md](../architecture/relationship-validation.md)
> Data model: match_candidates, proposed_relationships tables

## Overview

Implements probabilistic record linkage (Fellegi-Sunter model) in TypeScript to automatically find potential matches between external records (FamilySearch, census, vital records, etc.) and persons in the local tree. Built-in, no external Python dependencies (Phase 2); upgrade path to Splink available if needed.

## Requirements

- [ ] Blocking strategy to reduce O(n^2) comparisons
- [ ] Name comparison with Jaro-Winkler + nickname awareness + Soundex fallback
- [ ] Date comparison with ±3 year tolerance
- [ ] Place matching (hierarchical, fuzzy)
- [ ] Weighted Fellegi-Sunter scoring across fields
- [ ] Classification thresholds (auto-accept >= 0.95, review 0.70-0.95, reject < 0.70)
- [ ] Integration with relationship validation (propose, not modify)
- [ ] Deduplication of matches
- [ ] Candidate table management

## Design

### Pipeline

```
Input: Local person + external records
  |
  v
1. BLOCKING
   Reduce search space by grouping on surname prefix (first 3 chars)
   O(n^2) → O(k * n) where k = avg block size
  |
  v
2. COMPARISON
   For each pair in same block:
   - Name similarity (Jaro-Winkler + nicknames + Soundex)
   - Date tolerance (birth/death ±3 years)
   - Place matching (hierarchical fuzzy match)
  |
  v
3. SCORING
   Weighted Fellegi-Sunter model:
   score = sum(field_weight * similarity) / sum(weights_present)
  |
  v
4. CLASSIFICATION
   >= 0.95 → auto-accept (match)
   0.70-0.95 → human review
   < 0.70 → reject (non-match)
  |
  v
Output: match_candidates table
```

### Name Comparison with Genealogy Awareness

```typescript
interface NameComparison {
  similarity: number        // 0-1
  method: 'exact' | 'nickname' | 'soundex' | 'jaro-winkler'
}

function compareNames(name1: string, name2: string): NameComparison
```

**Algorithm:**

1. Normalize: lowercase, trim
2. Exact match? Return 1.0
3. Jaro-Winkler distance
4. Check nickname variants (William ↔ Bill, Elizabeth ↔ Betty, etc.)
5. If no strong match, check Soundex (WILLIAM == BILL phonetically?)
6. Combine: max(JW, nickname_boost, soundex_boost)

**Nickname map includes common historical variations:**

```typescript
const NICKNAME_MAP = {
  'william': ['bill', 'billy', 'will', 'willy', 'liam'],
  'elizabeth': ['betty', 'beth', 'liz', 'lizzy', 'eliza', 'bess', 'bessie'],
  'margaret': ['maggie', 'meg', 'peggy', 'marge', 'greta'],
  'james': ['jim', 'jimmy', 'jamie'],
  'robert': ['bob', 'bobby', 'rob', 'robbie', 'bert'],
  'richard': ['dick', 'rick', 'ricky', 'rich'],
  // ... 13 more historical name pairs
}
```

### Scoring (Fellegi-Sunter Model)

```typescript
interface MatchScore {
  overallScore: number
  classification: 'match' | 'review' | 'non-match'
  fieldScores: Record<string, number>
}

const FIELD_WEIGHTS = {
  surname: 0.25,        // Most discriminative
  givenName: 0.20,
  birthDate: 0.20,
  birthPlace: 0.15,
  deathDate: 0.10,
  deathPlace: 0.10,
};

function scoreMatch(
  local: PersonWithDetails,
  external: ExternalRecord
): MatchScore
```

**Calculation:**

```
score = sum(field_weight × similarity) / sum(weights_present)

if score >= 0.95: 'match' (auto-accept)
if 0.70 <= score < 0.95: 'review' (human decision)
if score < 0.70: 'non-match' (reject)
```

**Comparison functions per field:**

- **Surname:** Jaro-Winkler + Soundex
- **Given Name:** Jaro-Winkler + nickname map
- **Birth/Death Dates:** Absolute difference ±3 years = 1.0, linear decay
- **Birth/Death Places:** Hierarchical fuzzy (exact match > county > state > country)

### Integration with Relationship Validation

When a match implies a relationship (e.g., census record showing parent-child or marriage record), do NOT directly modify `families`/`children` tables. Instead, create a `proposed_relationship` entry.

```typescript
async function createProposalFromMatch(
  db: DrizzleDatabase,
  match: MatchScore,
  localPerson: PersonWithDetails,
  externalRecord: ExternalRecord
): Promise<string>  // returns proposal ID
```

**Workflow:**

1. Match engine finds high-confidence match
2. Analyze external record to infer relationship type (parent, spouse, sibling, etc.)
3. Create entry in `proposed_relationships`:
   - `relationship_type`: inferred type
   - `person1_id`, `person2_id`: the two people
   - `source_type`: 'record_match'
   - `source_detail`: JSON with matchScore, externalId, sourceSystem
   - `confidence`: match.overallScore
   - `status`: 'pending'
4. Editors review in validation UI before confirming

**Data model distinction:**

- **match_candidates**: Record-level matches ("this census entry might be about person X")
- **proposed_relationships**: Person-level relationship proposals ("person X appears to be father of person Y")

### Classification Thresholds

| Score Range | Classification | Action | Editorial Review |
|-------------|-----------------|--------|-------------------|
| >= 0.95 | match | Auto-accept | Optional spot-check |
| 0.70-0.95 | review | Pause, notify editor | Required |
| < 0.70 | non-match | Reject silently | None |

## Edge Cases & Error Handling

- **Duplicate external records:** Deduplicate by external ID before scoring
- **Missing fields:** Calculate score using only present fields (weight normalization)
- **Very common names (Smith):** Require stronger secondary matches (birth date + place)
- **Date precision variance:** Year only vs full date (month/day) — normalize to year, apply tolerance
- **Place name evolution:** Lincoln County vs Lincoln Township (hierarchical matching)
- **Multi-word surnames:** McDonald, van der, etc. — preserve in comparison

## Open Questions

- Threshold tuning based on Phase 2 user feedback (current values from literature)?
- Blocking on additional fields (birth year, first initial) for higher precision?
- Machine learning refinement (train on confirmed/rejected matches)?
- Upgrade timing to Splink for handling very large datasets (100K+ records)?
- Privacy: should matches be visible to Viewer role?

## Implementation Notes

Location: `packages/matching/`

Key files:
- `comparators/name-comparator.ts` - Jaro-Winkler, Soundex, nickname matching
- `comparators/date-comparator.ts` - Date tolerance logic
- `comparators/place-comparator.ts` - Hierarchical place matching
- `scorer/fellegi-sunter.ts` - Main scoring algorithm
- `blocker/surname-blocker.ts` - Blocking strategy
- `output/propose-from-match.ts` - Integration with relationship validation

**Upgrade path to Splink:**

If TS matcher quality is insufficient after Phase 2 evaluation:
1. Wrap Splink in Docker container, call via HTTP
2. Package exports `MatchingEngine` interface — both backends implement it
3. No application-level changes required
