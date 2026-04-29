import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
