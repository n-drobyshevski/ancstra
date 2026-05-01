import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { t } from '../init';

/**
 * Gate for cross-family super-admin procedures. Skips familyScopeMiddleware
 * entirely — platform-admin is an axis orthogonal to family role.
 *
 * Throws NOT_FOUND (not FORBIDDEN) on miss to match the page-level guard's
 * 404-instead-of-403 policy.
 */
export const platformAdminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id || !ctx.userId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }

  const claimed = ctx.session.user.isPlatformAdmin === true;
  let isAdmin = claimed;

  if (!claimed) {
    // Stale-JWT fallback — same pattern as lib/auth/platform-admin.ts.
    const row = await ctx.centralDb
      .select({ isPlatformAdmin: centralSchema.users.isPlatformAdmin })
      .from(centralSchema.users)
      .where(eq(centralSchema.users.id, ctx.userId))
      .get();
    isAdmin = row?.isPlatformAdmin === 1;
  }

  if (!isAdmin) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }

  return next({
    ctx: {
      ...ctx,
      platformAdmin: {
        userId: ctx.userId,
        email: ctx.session.user.email ?? '',
      },
    },
  });
});
