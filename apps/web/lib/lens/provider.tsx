'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import type { Role } from '@ancstra/auth/types';
import {
  LENS_COOKIE_NAME,
  LENS_COOKIE_MAX_AGE,
  parseLensCookie,
  serializeLensCookie,
  readCookieValue,
} from '@/lib/lens/cookie';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

interface LensContextValue {
  /** The user's real (JWT) role for the current family, or null if unknown. */
  actualRole: Role | null;
  /** The currently active lens role for the current family, or null if no lens is active. */
  lens: Role | null;
  /**
   * Sets or clears the active lens. Pass `null` to reset to actual role.
   * Persists to cookie and invalidates queries so server-side permission
   * decisions reflect the new effective role on the next call.
   */
  setLens: (role: Role | null) => void;
  /** Current familyId; needed because the lens cookie is family-scoped. */
  familyId: string | null;
}

const LensContext = React.createContext<LensContextValue | null>(null);

export function LensProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const isHydrated = useIsHydrated();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Derive actual role + familyId from the JWT memberships. This mirrors the
  // server's family-scope logic; if the user has no memberships, both are null.
  const memberships = session?.user?.memberships ?? [];
  const activeMembership = memberships[0] ?? null;
  const familyId = activeMembership?.familyId ?? null;
  const actualRole = (activeMembership?.role ?? null) as Role | null;

  // Lens is read from cookie ONLY after hydration to avoid SSR/CSR mismatch.
  const [lens, setLensState] = React.useState<Role | null>(null);

  React.useEffect(() => {
    if (!isHydrated) return;
    if (typeof document === 'undefined') return;
    const raw = readCookieValue(document.cookie, LENS_COOKIE_NAME);
    const parsed = parseLensCookie(raw);
    if (parsed && parsed.familyId === familyId) {
      setLensState(parsed.role);
    } else {
      setLensState(null);
    }
  }, [isHydrated, familyId]);

  const setLens = React.useCallback(
    (role: Role | null) => {
      if (typeof document === 'undefined') return;
      if (!familyId) return;
      if (role === null) {
        document.cookie = `${LENS_COOKIE_NAME}=; path=/; max-age=0; sameSite=Lax`;
        setLensState(null);
      } else {
        const value = serializeLensCookie(familyId, role);
        document.cookie = `${LENS_COOKIE_NAME}=${value}; path=/; max-age=${LENS_COOKIE_MAX_AGE}; sameSite=Lax`;
        setLensState(role);
      }
      // Server permission decisions key off the cookie; refetch everything
      // and refresh server components so the UI reflects the new effective role.
      void queryClient.invalidateQueries();
      router.refresh();
    },
    [familyId, queryClient, router],
  );

  const value = React.useMemo<LensContextValue>(
    () => ({ actualRole, lens, setLens, familyId }),
    [actualRole, lens, setLens, familyId],
  );

  return <LensContext.Provider value={value}>{children}</LensContext.Provider>;
}

export function useLens(): LensContextValue {
  const ctx = React.useContext(LensContext);
  if (!ctx) {
    throw new Error('useLens must be used within a LensProvider');
  }
  return ctx;
}
