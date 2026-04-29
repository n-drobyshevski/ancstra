import { TRPCError } from '@trpc/server';
import { hasPermission, type Permission } from '@ancstra/auth';
import { t } from '../init';

export const permissionMiddleware = t.middleware(({ ctx, meta, next }) => {
  const required = meta?.permission as Permission | undefined;
  if (!required) {
    return next();
  }
  if (!ctx.role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No role for permission check' });
  }
  if (!hasPermission(ctx.role, required)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing permission: ${required}`,
    });
  }
  return next();
});
