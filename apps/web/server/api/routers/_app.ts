import { createTRPCRouter } from '../trpc';
import { authRouter } from './auth';
import { familyRouter } from './family';
import { accountRouter } from './account';
import { experimentalRouter } from './experimental';
import { gedcomRouter } from './gedcom';
import { personRouter } from './person';
import { platformAdminRouter } from './platform-admin';
import { userPreferencesRouter } from './user-preferences';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  family: familyRouter,
  account: accountRouter,
  experimental: experimentalRouter,
  gedcom: gedcomRouter,
  person: personRouter,
  platformAdmin: platformAdminRouter,
  userPreferences: userPreferencesRouter,
});

export type AppRouter = typeof appRouter;
