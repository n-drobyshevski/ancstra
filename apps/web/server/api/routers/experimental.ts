import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import {
  EXPERIMENTAL_FEATURE_KEYS,
  resolveExperimentalState,
  type ExperimentalFeatureKey,
  type ResolvedExperimentalState,
} from '@ancstra/auth';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';

// Per-feature override patch — every key optional, value boolean | null
// (null removes the override and reverts to default). Built explicitly per
// key because Zod 4's z.record(enumSchema, ...) requires every enum value to
// be present, which is the wrong semantics for a partial patch.
const overridesPatchSchema = z.object({
  biography: z.boolean().nullable().optional(),
  researchChat: z.boolean().nullable().optional(),
  historicalContext: z.boolean().nullable().optional(),
});

const setMineInputSchema = z.object({
  master: z.boolean().optional(),
  overrides: overridesPatchSchema.optional(),
}).refine(
  (v) => v.master !== undefined || v.overrides !== undefined,
  { message: 'At least one of `master` or `overrides` is required' },
);

function readOverrides(raw: string | null | undefined): Partial<Record<ExperimentalFeatureKey, boolean>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Partial<Record<ExperimentalFeatureKey, boolean>> = {};
    for (const key of EXPERIMENTAL_FEATURE_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export const experimentalRouter = createTRPCRouter({
  /**
   * Resolved experimental state for the current user. Reflects the platform
   * policy AND the user's master switch AND per-feature overrides composed
   * by `resolveExperimentalState`.
   */
  getMyState: authenticatedProcedure.query(async ({ ctx }): Promise<ResolvedExperimentalState> => {
    return resolveExperimentalState(ctx.centralDb, ctx.userId);
  }),

  /**
   * Update the caller's master switch and/or per-feature overrides. Upserts
   * the user_preferences row. Per-user setting; not audit-logged.
   *
   * `overrides` semantics:
   *   - undefined   → leave existing overrides untouched
   *   - { x: true } → merge into existing overrides
   *   - { x: null } → remove that key from overrides (revert to default)
   *
   * Returns the freshly-resolved state so the form can re-render in one trip.
   */
  setMine: authenticatedProcedure
    .input(setMineInputSchema)
    .mutation(async ({ ctx, input }): Promise<ResolvedExperimentalState> => {
      const now = new Date().toISOString();

      const existing = await ctx.centralDb
        .select({
          experimentalEnabled: centralSchema.userPreferences.experimentalEnabled,
          experimentalFeatures: centralSchema.userPreferences.experimentalFeatures,
        })
        .from(centralSchema.userPreferences)
        .where(eq(centralSchema.userPreferences.userId, ctx.userId))
        .get();

      const currentOverrides = readOverrides(existing?.experimentalFeatures);

      // Apply overrides patch: explicit null removes the key, boolean sets it.
      let nextOverrides = currentOverrides;
      if (input.overrides) {
        nextOverrides = { ...currentOverrides };
        for (const [k, v] of Object.entries(input.overrides) as Array<[ExperimentalFeatureKey, boolean | null]>) {
          if (v === null) {
            delete nextOverrides[k];
          } else {
            nextOverrides[k] = v;
          }
        }
      }

      const nextMaster = input.master !== undefined
        ? (input.master ? 1 : 0)
        : (existing?.experimentalEnabled ?? 0);
      const nextOverridesJson = JSON.stringify(nextOverrides);

      // Upsert: insert with provided values + defaults; on conflict, update
      // the experimental fields only. Mirrors userPreferences.update.
      await ctx.centralDb
        .insert(centralSchema.userPreferences)
        .values({
          userId: ctx.userId,
          experimentalEnabled: nextMaster,
          experimentalFeatures: nextOverridesJson,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: centralSchema.userPreferences.userId,
          set: {
            experimentalEnabled: nextMaster,
            experimentalFeatures: nextOverridesJson,
            updatedAt: now,
          },
        })
        .run();

      return resolveExperimentalState(ctx.centralDb, ctx.userId);
    }),
});
