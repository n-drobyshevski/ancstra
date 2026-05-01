import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { centralSchema } from '@ancstra/db';
import { bumpMembershipsVersion } from '@ancstra/auth';
import {
  countOtherPlatformAdmins,
  logPlatformActivity,
} from '@ancstra/auth/admin';
import { createTRPCRouter, platformAdminProcedure } from '../trpc';

export const platformAdminRouter = createTRPCRouter({
  togglePlatformAdmin: platformAdminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        value: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Self-demotion guard: forbid revoking your own admin status if you'd
      // be the last one. Operational safety — keep at least 2 platform admins.
      if (input.userId === ctx.platformAdmin.userId && !input.value) {
        const otherCount = await countOtherPlatformAdmins(
          ctx.centralDb,
          ctx.platformAdmin.userId,
        );
        if (otherCount === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Cannot demote yourself — you are the last platform admin. Promote another user first.',
          });
        }
      }

      const target = await ctx.centralDb
        .select({
          id: centralSchema.users.id,
          name: centralSchema.users.name,
          email: centralSchema.users.email,
          isPlatformAdmin: centralSchema.users.isPlatformAdmin,
        })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, input.userId))
        .get();

      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const desired = input.value ? 1 : 0;
      if (target.isPlatformAdmin === desired) {
        // No-op — claim already in desired state. Don't audit-log no-ops.
        return { ok: true, changed: false } as const;
      }

      await ctx.centralDb
        .update(centralSchema.users)
        .set({ isPlatformAdmin: desired })
        .where(eq(centralSchema.users.id, input.userId))
        .run();

      // Force JWT refresh so the next request picks up the new claim.
      // Same mechanism family-role changes use (sub-spec A).
      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'platform_admin.toggle',
        targetType: 'user',
        targetId: input.userId,
        summary: input.value
          ? `Promoted ${target.name} (${target.email}) to platform admin`
          : `Demoted ${target.name} (${target.email}) from platform admin`,
        metadata: { previous: target.isPlatformAdmin === 1, next: input.value },
      });

      return { ok: true, changed: true } as const;
    }),
});
