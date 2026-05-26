import { z } from 'zod';
import {
  SEARCH_PROVIDER_KINDS,
  SEARCH_OUTCOMES,
  SEARCH_OUTCOMES_REQUIRING_NOTES,
  type SearchOutcome,
} from '@ancstra/db/vocab';

/**
 * Bundle E 2026-05-26 — research-log search-attempts validators.
 *
 * Schemas:
 *   CreateSearchAttemptSchema  — POST body (full payload + notes-required superRefine)
 *   PatchSearchAttemptSchema   — PATCH body (every field optional; notes rule
 *                                 enforced separately by assertNotesRule on
 *                                 the merged row because Zod can't see
 *                                 existing-row state)
 *   ListSearchAttemptsQuerySchema — GET query string
 *
 * Helper:
 *   assertNotesRule({ outcome, notes }) — throws NotesRequiredError when
 *     outcome ∈ SEARCH_OUTCOMES_REQUIRING_NOTES and notes is empty/whitespace.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §3.
 */

function notesIsEmpty(notes: string | null | undefined): boolean {
  return !notes || notes.trim().length === 0;
}

function outcomeRequiresNotes(outcome: SearchOutcome): boolean {
  return (SEARCH_OUTCOMES_REQUIRING_NOTES as readonly string[]).includes(outcome);
}

// ---------------------------------------------------------------------------
// CreateSearchAttemptSchema (POST body)
// ---------------------------------------------------------------------------
export const CreateSearchAttemptSchema = z
  .object({
    threadId: z.string().uuid().nullable().optional(),
    researchItemId: z.string().uuid().nullable().optional(),
    providerKind: z.enum(SEARCH_PROVIDER_KINDS),
    providerLabel: z.string().min(1).max(200).nullable().optional(),
    query: z.string().max(1000).nullable().optional(),
    searchedAt: z.coerce.date(),
    outcome: z.enum(SEARCH_OUTCOMES),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (outcomeRequiresNotes(data.outcome) && notesIsEmpty(data.notes)) {
      ctx.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'notes required for negative or inconclusive outcomes',
      });
    }
  });

export type CreateSearchAttemptInput = z.infer<typeof CreateSearchAttemptSchema>;

// ---------------------------------------------------------------------------
// PatchSearchAttemptSchema (PATCH body)
//
// Every field optional. The notes-required invariant is checked AFTER the
// route merges the patch with the existing row — see assertNotesRule below.
// Explicit-field shape per feedback_zod4_record_enum.
// ---------------------------------------------------------------------------
export const PatchSearchAttemptSchema = z.object({
  threadId: z.string().uuid().nullable().optional(),
  researchItemId: z.string().uuid().nullable().optional(),
  providerKind: z.enum(SEARCH_PROVIDER_KINDS).optional(),
  providerLabel: z.string().min(1).max(200).nullable().optional(),
  query: z.string().max(1000).nullable().optional(),
  searchedAt: z.coerce.date().optional(),
  outcome: z.enum(SEARCH_OUTCOMES).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type PatchSearchAttemptInput = z.infer<typeof PatchSearchAttemptSchema>;

// ---------------------------------------------------------------------------
// ListSearchAttemptsQuerySchema (GET query string)
// ---------------------------------------------------------------------------
export const ListSearchAttemptsQuerySchema = z.object({
  outcome: z.enum(SEARCH_OUTCOMES).optional(),
  providerKind: z.enum(SEARCH_PROVIDER_KINDS).optional(),
  threadId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type ListSearchAttemptsQuery = z.infer<typeof ListSearchAttemptsQuerySchema>;

// ---------------------------------------------------------------------------
// assertNotesRule + NotesRequiredError
//
// PATCH can't enforce notes-required inside Zod because the schema doesn't see
// the existing row. The route merges patch + existing, then calls this helper.
// CreateSearchAttemptSchema's superRefine covers the POST path (it sees the
// full payload), but we also export the helper for route-level reuse if a
// future endpoint composes its own validation.
// ---------------------------------------------------------------------------
export class NotesRequiredError extends Error {
  readonly kind = 'NOTES_REQUIRED' as const;
  constructor() {
    super('notes required for negative or inconclusive outcomes');
    this.name = 'NotesRequiredError';
  }
}

export function assertNotesRule(args: {
  outcome: SearchOutcome;
  notes: string | null | undefined;
}): void {
  if (outcomeRequiresNotes(args.outcome) && notesIsEmpty(args.notes)) {
    throw new NotesRequiredError();
  }
}
