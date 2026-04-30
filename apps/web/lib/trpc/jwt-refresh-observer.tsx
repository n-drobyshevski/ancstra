'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

const COOKIE_NAME = 'force-jwt-refresh';

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
 */
export function JwtRefreshObserver() {
  const { update } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    const value = readCookie(COOKIE_NAME);
    if (value === '1') {
      void update().then(() => {
        clearCookie(COOKIE_NAME);
        toast.info('Access updated');
      });
    }
  }, [pathname, update]);

  return null;
}
