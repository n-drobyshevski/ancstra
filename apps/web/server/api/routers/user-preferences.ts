import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { centralSchema } from '@ancstra/db';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';

interface Prefs {
  locale: string;
  timezone: string;
  density: 'comfortable' | 'compact';
  notifyEmail: boolean;
  notifyActivity: boolean;
}

const DEFAULTS: Prefs = {
  locale: 'en-US',
  timezone: 'UTC',
  density: 'comfortable',
  notifyEmail: true,
  notifyActivity: true,
};

const preferencesPatchSchema = z.object({
  locale: z.string().min(2).max(35).optional(),
  timezone: z.string().min(1).max(64).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  notifyEmail: z.boolean().optional(),
  notifyActivity: z.boolean().optional(),
});

const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

function rowToPrefs(
  row: typeof centralSchema.userPreferences.$inferSelect | undefined,
): Prefs {
  if (!row) return { ...DEFAULTS };
  return {
    locale: row.locale,
    timezone: row.timezone,
    density: row.density,
    notifyEmail: row.notifyEmail === 1,
    notifyActivity: row.notifyActivity === 1,
  };
}

export const userPreferencesRouter = createTRPCRouter({
  get: authenticatedProcedure.query(async ({ ctx }): Promise<Prefs> => {
    const row = await ctx.centralDb
      .select()
      .from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, ctx.userId))
      .get();
    return rowToPrefs(row);
  }),

  update: authenticatedProcedure
    .input(preferencesPatchSchema)
    .mutation(async ({ ctx, input }): Promise<Prefs> => {
      if (Object.keys(input).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const now = new Date().toISOString();
      const setClause: Record<string, string | number> = { updatedAt: now };
      if (input.locale !== undefined) setClause.locale = input.locale;
      if (input.timezone !== undefined) setClause.timezone = input.timezone;
      if (input.density !== undefined) setClause.density = input.density;
      if (input.notifyEmail !== undefined) setClause.notifyEmail = input.notifyEmail ? 1 : 0;
      if (input.notifyActivity !== undefined) setClause.notifyActivity = input.notifyActivity ? 1 : 0;

      // Upsert: insert with provided values + defaults; on conflict, update only
      // the fields the caller passed.
      await ctx.centralDb
        .insert(centralSchema.userPreferences)
        .values({
          userId: ctx.userId,
          locale: input.locale ?? DEFAULTS.locale,
          timezone: input.timezone ?? DEFAULTS.timezone,
          density: input.density ?? DEFAULTS.density,
          notifyEmail: input.notifyEmail === undefined ? 1 : input.notifyEmail ? 1 : 0,
          notifyActivity: input.notifyActivity === undefined ? 1 : input.notifyActivity ? 1 : 0,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: centralSchema.userPreferences.userId,
          set: setClause,
        })
        .run();

      const row = await ctx.centralDb
        .select()
        .from(centralSchema.userPreferences)
        .where(eq(centralSchema.userPreferences.userId, ctx.userId))
        .get();
      return rowToPrefs(row);
    }),

  updateProfile: authenticatedProcedure
    .input(profilePatchSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.name === undefined && input.avatarUrl === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const set: Record<string, string | null> = {
        updatedAt: new Date().toISOString(),
      };
      if (input.name !== undefined) set.name = input.name;
      if (input.avatarUrl !== undefined) set.avatarUrl = input.avatarUrl;

      await ctx.centralDb
        .update(centralSchema.users)
        .set(set)
        .where(eq(centralSchema.users.id, ctx.userId))
        .run();

      return { success: true as const };
    }),
});
