import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';
import { familyRouter } from './family';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
  family: familyRouter,
});

export type AppRouter = typeof appRouter;
