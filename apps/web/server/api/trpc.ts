import { experimental_nextAppDirCaller } from '@trpc/server/adapters/next-app-dir';
import { headers } from 'next/headers';
import { t, type Meta, createTRPCContext } from './init';
import { sessionMiddleware } from './middleware/session';
import { familyScopeMiddleware } from './middleware/family-scope';
import { permissionMiddleware } from './middleware/permission';
import { platformAdminMiddleware } from './middleware/platform-admin';

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(sessionMiddleware);

export const protectedProcedure = t.procedure
  .use(sessionMiddleware)
  .use(familyScopeMiddleware)
  .use(permissionMiddleware);

// Cross-family super-admin procedure. No familyScope, no per-family permission
// matrix. Pure read against centralDb + audit-logged mutations.
export const platformAdminProcedure = t.procedure
  .use(sessionMiddleware)
  .use(platformAdminMiddleware);

const formCaller = experimental_nextAppDirCaller({
  pathExtractor: ({ meta }) => (meta as Meta)?.span ?? '',
  createContext: async () => createTRPCContext({ headers: await headers() }),
});

export const protectedFormAction = protectedProcedure.experimental_caller(formCaller);
export const authedFormAction = authenticatedProcedure.experimental_caller(formCaller);
export const publicFormAction = publicProcedure.experimental_caller(formCaller);
