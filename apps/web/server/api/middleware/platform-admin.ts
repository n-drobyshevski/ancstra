import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
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
    // Soft-deleted users are treated as non-admins so a deletion in flight
    // can't keep granting access until the JWT expires.
    const row = await ctx.centralDb
      .select({ isPlatformAdmin: centralSchema.users.isPlatformAdmin })
      .from(centralSchema.users)
      .where(
        and(
          eq(centralSchema.users.id, ctx.userId),
          isNull(centralSchema.users.deletedAt),
        ),
      )
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
