'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { JWT_REFRESH_COOKIE_NAME } from '@ancstra/auth';
import { runRefresh } from './jwt-refresh-debounce';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : null;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; sameSite=Lax`;
}

/**
 * Reads the `force-jwt-refresh` cookie set by sub-spec A's proxy when JWT
 * staleness is detected. On detection: triggers useSession().update() (which
 * re-runs the JWT callback in apps/web/auth.ts) and clears the cookie.
 * Mounts once in TRPCReactProvider; observes pathname changes to re-check
 * after navigation.
 *
 * Cookie is cleared synchronously BEFORE runRefresh so that a fast follow-up
 * navigation cannot re-fire the observer between the async clear and resolve.
 * runRefresh coalesces concurrent calls from this observer and jwtStaleLink.
 */
export function JwtRefreshObserver() {
  const { update } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    const value = readCookie(JWT_REFRESH_COOKIE_NAME);
    if (value === '1') {
      clearCookie(JWT_REFRESH_COOKIE_NAME);
      void runRefresh(update, queryClient, 'Access updated');
    }
  }, [pathname, update, queryClient]);

  return null;
}
