import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  createFamily,
  updateFamilySettings,
  deleteFamily,
  logActivity,
} from '@ancstra/auth';
import { centralSchema } from '@ancstra/db';
import {
  createTRPCRouter,
  authenticatedProcedure,
  protectedProcedure,
} from '../trpc';
import { invalidateTags } from '../cache';

const settingsPatchSchema = z.object({
  name: z.string().trim().min(1, 'Family name is required').optional(),
  maxMembers: z.number().int().min(1).max(10000).optional(),
  monthlyAiBudgetUsd: z.number().min(0).max(100000).optional(),
  moderationEnabled: z.boolean().optional(),
});

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  name: 'name',
  maxMembers: 'member limit',
  monthlyAiBudgetUsd: 'AI budget',
  moderationEnabled: 'moderation',
};

export const familyRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(z.object({ name: z.string().trim().min(1, 'Family name is required') }))
    .mutation(async ({ ctx, input }) => {
      const { familyId } = await createFamily(ctx.centralDb, {
        name: input.name,
        ownerId: ctx.userId,
      });
      // Admin surfaces (users list, families list, dashboard counts) all
      // derive aggregates from family_registry / family_members. Without
      // these, a fresh family doesn't show up until cacheLife('minutes')
      // expires — which is why /admin/users showed 0 owned for everyone.
      invalidateTags([
        'platform-users',
        'platform-families',
        'platform-counts',
        `platform-user:${ctx.userId}`,
      ]);
      return { familyId };
    }),

  listMine: authenticatedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.centralDb
        .select({
          id: centralSchema.familyRegistry.id,
          name: centralSchema.familyRegistry.name,
          role: centralSchema.familyMembers.role,
        })
        .from(centralSchema.familyRegistry)
        .innerJoin(
          centralSchema.familyMembers,
          eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
        )
        .where(and(
          eq(centralSchema.familyMembers.userId, ctx.userId),
          eq(centralSchema.familyMembers.isActive, 1),
        ))
        .orderBy(
          sql`${centralSchema.familyMembers.lastSeenAt} DESC NULLS LAST`,
          desc(centralSchema.familyMembers.joinedAt),
        )
        .all();
      return rows;
    }),

  // Read current family settings. Visible to anyone with members:manage so
  // admins can review without being gated behind the owner-only edit form.
  getSettings: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(async ({ ctx }) => {
      const row = await ctx.centralDb
        .select()
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }
      return {
        id: row.id,
        name: row.name,
        ownerId: row.ownerId,
        dbFilename: row.dbFilename,
        moderationEnabled: row.moderationEnabled === 1,
        maxMembers: row.maxMembers,
        monthlyAiBudgetUsd: row.monthlyAiBudgetUsd,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),

  updateSettings: protectedProcedure
    .meta({ permission: 'settings:manage' })
    .input(settingsPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const { row, changed } = await updateFamilySettings(
        ctx.centralDb,
        ctx.familyId,
        input,
      );

      if (changed.length > 0) {
        const labels = changed.map((k) => SETTINGS_FIELD_LABELS[k] ?? k);
        const summary =
          labels.length === 1
            ? `Updated family ${labels[0]}`
            : `Updated family ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

        await logActivity(ctx.centralDb, {
          familyId: ctx.familyId,
          userId: ctx.userId!,
          action: 'family_settings_updated',
          summary,
          metadata: { changed, after: row },
        });

        invalidateTags([
          `family:${ctx.familyId}`,
          'platform-families',
          `platform-family:${ctx.familyId}`,
        ]);
      }

      return { row, changed };
    }),

  delete: protectedProcedure
    .meta({ permission: 'settings:manage' })
    .input(z.object({ confirmName: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Helper re-checks the name; we additionally verify ownerId matches the
      // caller — the partial UQ on owner means there's exactly one owner per
      // family, so this is a tighter guard against an admin somehow reaching
      // this code path.
      const f = await ctx.centralDb
        .select({ ownerId: centralSchema.familyRegistry.ownerId })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();
      if (!f) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }
      if (f.ownerId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the family owner can delete the family',
        });
      }

      try {
        const result = await deleteFamily(ctx.centralDb, ctx.familyId, input.confirmName);
        // family_members FKs cascade-delete, so every member's active-
        // membership count drops by one. platform-users covers the list
        // page; the owner's user-detail also needs invalidation since
        // they're guaranteed to have lost a membership.
        invalidateTags([
          'platform-users',
          'platform-families',
          `platform-family:${ctx.familyId}`,
          'platform-counts',
          `platform-user:${ctx.userId}`,
        ]);
        return result;
      } catch (err) {
        if (err instanceof Error && /confirmation/i.test(err.message)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
        }
        throw err;
      }
    }),
});
