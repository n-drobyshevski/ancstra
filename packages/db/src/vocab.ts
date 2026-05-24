/**
 * Bundle A — Research Flow Unification (2026-05-23).
 * Single source of truth for research-flow enum values. Imports from this file
 * are mandatory; literal vocab strings are forbidden outside migrations and
 * tests (enforced by packages/db/__tests__/vocab-consistency.test.ts).
 *
 * See: docs/superpowers/specs/2026-05-23-research-flow-unification-bundle-a-design.md
 */

// Relationship types — see spec §3.1.
// `spouse` = legally/socially declared marriage
// `partner` = asserted but undocumented union
export const RELATIONSHIP_TYPES = ['parent_child', 'spouse', 'partner', 'sibling'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// Confidence bands — see spec §3.2.
// `high`     — corroborated by ≥2 independent derivative sources, or 1 primary
// `medium`   — 1 derivative source with no contradictions, or AI-extracted w/ source
// `low`      — single source with ambiguous signal, or AI inference no direct source
// `unknown`  — no signal yet (initial state for partial extractions)
// `contested` is orthogonal (boolean), NOT a confidence level.
// NOTE: research_facts.confidence still uses 'disputed' on disk; aligned in
// Bundle A Task 3 (migration + backfill).
export const CONFIDENCE_BANDS = ['high', 'medium', 'low', 'unknown'] as const;
export type Confidence = (typeof CONFIDENCE_BANDS)[number];

// Provenance — see spec §4.
// `cited`          — has sourceCitationId set (formal citation)
// `derived`        — has researchItemId set, no formal citation yet
// `user_inference` — neither set, but user explicitly tagged it as their reasoning
export const PROVENANCE_VALUES = ['cited', 'derived', 'user_inference'] as const;
export type Provenance = (typeof PROVENANCE_VALUES)[number];

// research_items lifecycle — renamed from draft/ready/promoted/merged/dismissed (spec §3.3).
export const RESEARCH_ITEM_STATUSES = ['collected', 'processed', 'extracted', 'discarded'] as const;
export type ResearchItemStatus = (typeof RESEARCH_ITEM_STATUSES)[number];

// factsheet lifecycle — unchanged (spec §3.4).
export const FACTSHEET_STATUSES = ['draft', 'ready', 'promoted', 'merged', 'dismissed'] as const;
export type FactsheetStatus = (typeof FACTSHEET_STATUSES)[number];

// Numeric → categorical banding for AI tool confidence input (spec §3.2).
// Edges: 0.20, 0.55, 0.85. Test cases in propose-relationship-banding.test.ts.
export function bandConfidence(score: number): Confidence {
  if (score >= 0.85) return 'high';
  if (score >= 0.55) return 'medium';
  if (score >= 0.20) return 'low';
  return 'unknown';
}

// Bundle C 2026-05-24: rubric metadata for the inline HoverCard explanation.
// Strings live in apps/web/messages/{en,ru}.json under the `rubric` namespace;
// this constant maps each band to its i18n key and a score-range label.
// AST guard packages/db/__tests__/vocab-consistency.test.ts extends to forbid
// literal rubric copy outside vocab.ts + messages/*.json.
export const CONFIDENCE_BAND_META: Record<Confidence, {
  messageKey: `rubric.${Confidence}`;
  scoreLabel: string;
}> = {
  high:    { messageKey: 'rubric.high',    scoreLabel: 'score ≥ 0.85' },
  medium:  { messageKey: 'rubric.medium',  scoreLabel: '0.55 ≤ score < 0.85' },
  low:     { messageKey: 'rubric.low',     scoreLabel: '0.20 ≤ score < 0.55' },
  unknown: { messageKey: 'rubric.unknown', scoreLabel: 'score < 0.20' },
} as const;

// Map AI tool input enum (3-value) → factType for the new factsheet path. Spec §2.2.
// 'spouse' is intentionally omitted — the AI tool's 3-value input enum has no
// 'spouse' arm; it emits 'partner' and the user can upgrade to 'spouse' during
// factsheet review. See spec §2.2 and §3.1.
export function relationshipToFactType(
  rel: Exclude<RelationshipType, 'spouse'>,
): 'parent_name' | 'spouse_name' | 'sibling_name' {
  if (rel === 'parent_child') return 'parent_name';
  if (rel === 'partner') return 'spouse_name';
  return 'sibling_name';
}
