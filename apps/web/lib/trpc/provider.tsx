'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink } from '@trpc/client';
import { toast } from 'sonner';
import superjson from 'superjson';
import { trpc } from './client';
import { AppSessionProvider } from '@/lib/auth/session-provider';
import { JwtRefreshObserver } from './jwt-refresh-observer';
import { jwtStaleLink } from './jwt-stale-link';

function TRPCInner({ children }: { children: React.ReactNode }) {
  const { update } = useSession();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        jwtStaleLink({
          onJwtStale: () => {
            void update().then(() => {
              toast.info('Access updated');
            });
          },
        }),
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <JwtRefreshObserver />
        {children}
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <TRPCInner>{children}</TRPCInner>
    </AppSessionProvider>
  );
}
