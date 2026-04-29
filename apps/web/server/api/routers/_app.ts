import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';
import { familyRouter } from './family';
import { accountRouter } from './account';
import { gedcomRouter } from './gedcom';
import { personRouter } from './person';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
  family: familyRouter,
  account: accountRouter,
  gedcom: gedcomRouter,
  person: personRouter,
});

export type AppRouter = typeof appRouter;
