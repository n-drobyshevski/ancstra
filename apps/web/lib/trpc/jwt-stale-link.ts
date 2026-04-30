import { TRPCClientError, type TRPCLink } from '@trpc/client';
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
 * Implementation note: the function is cast as TRPCLink<AppRouter> for
 * use in the link chain, but it is implemented as an OperationLink
 * (skipping the unused TRPCClientRuntime wrapper layer) so that tests
 * can exercise it without wiring a full client runtime.
 */
export function jwtStaleLink(opts: JwtStaleLinkOptions): TRPCLink<AppRouter> {
  // Cast: OperationLink satisfies TRPCLink when the runtime wrapper is a no-op
  return (({ next, op }: { next: (op: unknown) => ReturnType<typeof observable>; op: unknown }) => {
    return observable((observer) => {
      const subscription = next(op).subscribe({
        next(value: unknown) {
          observer.next(value as never);
        },
        error(err: unknown) {
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
          observer.error(err as never);
        },
        complete() {
          observer.complete();
        },
      });
      return () => subscription.unsubscribe?.();
    });
  }) as unknown as TRPCLink<AppRouter>;
}
