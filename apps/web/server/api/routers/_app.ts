import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';
import { familyRouter } from './family';
import { accountRouter } from './account';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
  family: familyRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;
