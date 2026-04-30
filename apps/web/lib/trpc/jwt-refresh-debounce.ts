'use client';

import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

let inFlight: Promise<void> | null = null;

/**
 * Coalesces concurrent JWT-refresh calls into a single in-flight operation.
 * Both <JwtRefreshObserver> (cookie-driven) and jwtStaleLink (tRPC 409) call this.
 * Without coalescing, both could fire useSession().update() simultaneously and
 * produce duplicate toasts.
 *
 * On resolve, invalidates ALL React-Query caches because the role may have
 * changed and previously-fetched role-gated data is now stale.
 */
export async function runRefresh(
  updateFn: () => Promise<unknown>,
  queryClient: QueryClient,
  toastMessage: string,
): Promise<void> {
  if (inFlight) {
    await inFlight;
    return;
  }
  inFlight = (async () => {
    try {
      await updateFn();
      await queryClient.invalidateQueries();
      toast.info(toastMessage);
    } catch (err) {
      toast.error('Session refresh failed — please reload');
      throw err;
    } finally {
      inFlight = null;
    }
  })();
  await inFlight;
}
