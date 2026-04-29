import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/server/api/routers/_app';

/**
 * Vanilla (non-hook) tRPC client for imperative use in client-side modules
 * that run outside of React components (e.g. in-memory caches, event handlers).
 */
export const vanillaTrpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
    }),
  ],
});
