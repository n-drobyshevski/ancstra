import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import * as Sentry from '@sentry/nextjs';
import { appRouter } from '@/server/api/routers/_app';
import { createTRPCContext } from '@/server/api/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ path, error }) {
      console.error(`[tRPC] ${path ?? '<no-path>'} failed:`, error);
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        Sentry.captureException(error, { extra: { path } });
      }
    },
  });

export { handler as GET, handler as POST };
