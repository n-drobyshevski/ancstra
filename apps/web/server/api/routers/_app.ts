import { createTRPCRouter } from '../trpc';
import { authRouter } from './auth';
import { familyRouter } from './family';
import { accountRouter } from './account';
import { gedcomRouter } from './gedcom';
import { personRouter } from './person';
import { platformAdminRouter } from './platform-admin';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  family: familyRouter,
  account: accountRouter,
  gedcom: gedcomRouter,
  person: personRouter,
  platformAdmin: platformAdminRouter,
});

export type AppRouter = typeof appRouter;
