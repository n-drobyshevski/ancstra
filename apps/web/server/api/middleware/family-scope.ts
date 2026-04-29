import { TRPCError } from '@trpc/server';
import { ensureFamilySchema } from '@ancstra/db';
import { t } from '../init';

export const familyScopeMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.familyId || !ctx.role || !ctx.familyDb || !ctx.dbFilename) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active family membership for this request',
    });
  }
  // Idempotent and process-cached per db key — safe to call on every request.
  try {
    await ensureFamilySchema(ctx.familyDb, ctx.dbFilename);
  } catch (cause) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Family schema init failed for ${ctx.familyId}`,
      cause,
    });
  }
  return next({
    ctx: {
      ...ctx,
      familyId: ctx.familyId,
      role: ctx.role,
      familyDb: ctx.familyDb,
      dbFilename: ctx.dbFilename,
    },
  });
});
