import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createFamily } from '@ancstra/auth';
import { centralSchema } from '@ancstra/db';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';

export const familyRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(z.object({ name: z.string().trim().min(1, 'Family name is required') }))
    .mutation(async ({ ctx, input }) => {
      const { familyId } = await createFamily(ctx.centralDb, {
        name: input.name,
        ownerId: ctx.userId,
      });
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
});
