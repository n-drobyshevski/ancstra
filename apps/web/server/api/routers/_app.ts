import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
});

export type AppRouter = typeof appRouter;
