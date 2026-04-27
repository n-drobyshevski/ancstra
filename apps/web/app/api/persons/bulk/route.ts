import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';
import { resolveScope, RESOLVE_SCOPE_HARD_CAP } from '@/lib/persons/resolve-scope';
import { bulkDeletePersons } from '@/lib/persons/bulk-delete';

const PersonsFiltersSchema = z.object({
  q: z.string().default(''),
  sex: z.array(z.enum(['M', 'F', 'U'])).default([]),
  living: z.array(z.enum(['alive', 'deceased'])).default([]),
  validation: z.array(z.enum(['confirmed', 'proposed'])).default([]),
  bornFrom: z.number().int().nullable().default(null),
  bornTo: z.number().int().nullable().default(null),
  diedFrom: z.number().int().nullable().default(null),
  diedTo: z.number().int().nullable().default(null),
  place: z.string().default(''),
  placeScope: z.enum(['birth', 'any']).default('birth'),
  citations: z.enum(['any', 'none', 'gte1', 'gte3']).default('any'),
  hasProposals: z.boolean().default(false),
  complGte: z.number().int().nullable().default(null),
  sort: z.enum(['name', 'born', 'died', 'compl', 'edited', 'sources']).default('edited'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().default(1),
  size: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
  hide: z.array(z.enum(['sex', 'birthDate', 'deathDate', 'completeness', 'sourcesCount', 'validation', 'updatedAt'])).default([]),
});

const BulkBodySchema = z.object({
  action: z.literal('delete'),
  scope: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('ids'),
      ids: z.array(z.string()).max(RESOLVE_SCOPE_HARD_CAP),
    }),
    z.object({
      kind: z.literal('matching'),
      filters: PersonsFiltersSchema,
      exclude: z.array(z.string()).default([]),
    }),
  ]),
  confirmCount: z.number().int().optional(),
});

const CONFIRM_THRESHOLD = 1000;

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('person:delete', request);

    const body = await request.json();
    const parsed = BulkBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { scope, confirmCount } = parsed.data;
    const ids = await resolveScope(familyDb, scope);

    if (ids.length > RESOLVE_SCOPE_HARD_CAP) {
      return NextResponse.json(
        { error: `Bulk operation exceeds the ${RESOLVE_SCOPE_HARD_CAP} hard cap. Refine your filters.` },
        { status: 422 },
      );
    }

    if (
      scope.kind === 'matching' &&
      ids.length > CONFIRM_THRESHOLD &&
      confirmCount !== ids.length
    ) {
      return NextResponse.json(
        {
          error: 'Confirmation required',
          requiresConfirmation: ids.length,
        },
        { status: 409 },
      );
    }

    if (ids.length === 0) {
      return NextResponse.json({ affected: 0 });
    }

    const { affected } = await bulkDeletePersons(familyDb, ids);

    // Cache invalidation: broad tags cover all per-person entries
    revalidateTag('persons', 'max');
    revalidateTag('persons-list', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');

    // Single audit log entry per bulk op (Q4)
    await logAndInvalidate(centralDb, ctx, {
      action: 'persons_bulk_deleted',
      summary: `Deleted ${affected} ${affected === 1 ? 'person' : 'persons'}`,
      entityType: 'person',
      metadata: {
        count: affected,
        scopeKind: scope.kind,
        sampleIds: ids.slice(0, 5),
      },
    });

    return NextResponse.json({ affected });
  } catch (error) {
    return handleAuthError(error);
  }
}
