import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { eq } from 'drizzle-orm';
import { searchAttempts } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  PatchSearchAttemptSchema,
  assertNotesRule,
  NotesRequiredError,
} from '@/lib/validators/search-attempts';

/**
 * Bundle E 2026-05-26 — PATCH a search attempt (in-place edit).
 *
 * Auth: editor+ ('ai:research') on the family that owns the attempt's person.
 * Body: PatchSearchAttemptSchema (every field optional).
 *
 * Server merges patch with existing row, then calls assertNotesRule on the
 * merged outcome+notes (Zod can't see existing-row state, so this is the
 * canonical pattern for partial-update validation that depends on the row).
 *
 * Merge semantics:
 *   `undefined` (field omitted) → preserve existing value
 *   `null`      (explicit clear) → set to null
 *
 * Side effects: UPDATE row + bump updatedAt + revalidateTag.
 * No audit event (E-Q9).
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §3.3.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await params;
  try {
    const { familyDb } = await withAuth('ai:research', request);

    const existing = await familyDb
      .select()
      .from(searchAttempts)
      .where(eq(searchAttempts.id, attemptId))
      .all();
    if (existing.length === 0) {
      return NextResponse.json({
        error: { code: 'NOT_FOUND', message: 'Search attempt not found.' },
      }, { status: 404 });
    }
    const existingRow = existing[0];

    const json = await request.json().catch(() => null);
    const parsed = PatchSearchAttemptSchema.safeParse(json);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? '_');
        fields[k] = issue.message;
      }
      return NextResponse.json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Request body failed validation.',
          fields,
        },
      }, { status: 400 });
    }
    const patch = parsed.data;

    // Merge patch with existing row to compute the post-update outcome+notes.
    // `null` in the patch explicitly clears the field; `undefined` (omitted)
    // preserves the existing value.
    const mergedOutcome = patch.outcome ?? existingRow.outcome;
    const mergedNotes = patch.notes !== undefined ? patch.notes : existingRow.notes;

    try {
      assertNotesRule({
        outcome: mergedOutcome as Parameters<typeof assertNotesRule>[0]['outcome'],
        notes: mergedNotes,
      });
    } catch (err) {
      if (err instanceof NotesRequiredError) {
        return NextResponse.json({
          error: {
            code: 'NOTES_REQUIRED',
            message: err.message,
            fields: { notes: err.message },
          },
        }, { status: 400 });
      }
      throw err;
    }

    const now = new Date();
    // Construct the UPDATE set explicitly — only patch the fields the client sent.
    const updates: Partial<typeof existingRow> = {};
    if (patch.threadId !== undefined) updates.threadId = patch.threadId;
    if (patch.researchItemId !== undefined) updates.researchItemId = patch.researchItemId;
    if (patch.providerKind !== undefined) updates.providerKind = patch.providerKind;
    if (patch.providerLabel !== undefined) updates.providerLabel = patch.providerLabel;
    if (patch.query !== undefined) updates.query = patch.query;
    if (patch.searchedAt !== undefined) updates.searchedAt = patch.searchedAt;
    if (patch.outcome !== undefined) updates.outcome = patch.outcome;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    updates.updatedAt = now;

    await familyDb.update(searchAttempts).set(updates)
      .where(eq(searchAttempts.id, attemptId))
      .run();

    const merged = { ...existingRow, ...updates };
    // Tag uses existing.personId — the URL param is attempt id, not person id.
    revalidateTag(`search-attempts:person:${merged.personId}`, 'max');

    return NextResponse.json({
      id: merged.id,
      personId: merged.personId,
      threadId: merged.threadId,
      researchItemId: merged.researchItemId,
      providerKind: merged.providerKind,
      providerLabel: merged.providerLabel,
      query: merged.query,
      searchedAt: merged.searchedAt.getTime(),
      outcome: merged.outcome,
      notes: merged.notes,
      createdBy: merged.createdBy,
      createdAt: merged.createdAt.getTime(),
      updatedAt: merged.updatedAt.getTime(),
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[search-attempts/[id] PATCH]', err);
    return NextResponse.json({
      error: { code: 'INTERNAL', message: String(err) },
    }, { status: 500 });
  }
}

// DELETE is wired in Task 7.
