import { TRPCClientError, type TRPCClientRuntime, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from '@/server/api/routers/_app';

interface JwtStaleLinkOptions {
  /**
   * Called when a tRPC operation fails with a 409 + code 'JWT_STALE'.
   * Typically wired to () => useSession().update() + toast.
   */
  onJwtStale: () => void;
}

/**
 * tRPC link that intercepts 409 JWT_STALE errors and calls onJwtStale.
 * The original error is still propagated to the caller (so useMutation
 * onError fires); refreshing happens as a side effect. The caller can
 * decide whether to retry the mutation.
 *
 * Shape: TRPCLink<T> = (runtime: TRPCClientRuntime) => OperationLink<T>.
 * The runtime wrapper layer is required by tRPC v11; the runtime arg is unused.
 */
export function jwtStaleLink(opts: JwtStaleLinkOptions): TRPCLink<AppRouter> {
  return (_runtime: TRPCClientRuntime) => {
    return ({ op, next }) => {
      return observable((observer) => {
        const subscription = next(op).subscribe({
          next(value) {
            observer.next(value);
          },
          error(err) {
            if (err instanceof TRPCClientError) {
              const code = (err.data as { code?: string } | undefined)?.code;
              if (code === 'JWT_STALE') {
                try {
                  opts.onJwtStale();
                } catch {
                  // Don't let the callback's failure swallow the original error
                }
              }
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
        return () => subscription.unsubscribe?.();
      });
    };
  };
}
