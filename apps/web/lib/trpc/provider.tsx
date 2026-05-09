'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { JWT_REFRESH_COOKIE_NAME } from '@ancstra/auth/constants';
import { trpc } from './client';
import { AppSessionProvider } from '@/lib/auth/session-provider';
import { JwtRefreshObserver } from './jwt-refresh-observer';
import { jwtStaleLink } from './jwt-stale-link';
import { runRefresh } from './jwt-refresh-debounce';

function TRPCInner({ children }: { children: React.ReactNode }) {
  const { update } = useSession();
  const updateRef = useRef(update);
  useEffect(() => { updateRef.current = update; }, [update]);

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
            // Clear cookie BEFORE runRefresh so the cookie observer doesn't double-fire
            if (typeof document !== 'undefined') {
              document.cookie = `${JWT_REFRESH_COOKIE_NAME}=; path=/; max-age=0; sameSite=Lax`;
            }
            void runRefresh(updateRef.current, queryClient, 'Session refreshed — please retry');
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
        <Suspense fallback={null}>
          <JwtRefreshObserver />
        </Suspense>
        {children}
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  // No `session` prop: pre-fetching `auth()` in the root layout to seed
  // <SessionProvider> triggers Next.js 16's blocking-route warning under
  // `cacheComponents`. Components that branch on `useSession()` content
  // (LensSelector, PlatformAdminOnly) gate with `useIsHydrated` instead so
  // SSR + first client render produce the same tree shape.
  return (
    <AppSessionProvider>
      <TRPCInner>{children}</TRPCInner>
    </AppSessionProvider>
  );
}
