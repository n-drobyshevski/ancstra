'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useLens } from '@/lib/lens/provider';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client-side affordance gate for platform-admin-only UI. Mirrors RoleGate but
 * for the platform-admin dimension. Defense-in-depth only — server enforces
 * via requirePlatformAdmin + platformAdminProcedure (returns 404, not 403).
 *
 * Hydration-safe via `useIsHydrated`: SSR + first client render both produce
 * the fallback (typically null), then the real condition is evaluated post-
 * hydration. Without this, SSR — which has the full session via `auth()` —
 * would render the children, while the client first pass (before
 * `<SessionProvider>` async-fetches `/api/auth/session`) would render the
 * fallback. The mismatched tree shape produces hydration warnings and
 * shifts adjacent siblings (e.g. `<LensSelector>`) into the wrong DOM slot.
 *
 * Pre-fetching `auth()` at the layout level to seed `<SessionProvider>` was
 * tried as an alternative — it triggers Next.js 16's blocking-route warning
 * under `cacheComponents` because the root layout would await uncached
 * dynamic data. Same pattern as `useVisibleNavItems` in `app-sidebar.tsx`.
 *
 * Lens-aware: when ANY family-scoped lens is active, this also hides the
 * children. Rationale — the lens promise is "show me what a lower-role user
 * would see", and lower-role users never see platform admin features.
 * Without this, a platform admin lensed-down to viewer would still see the
 * sidebar "Platform" link and be able to navigate into /admin, breaking the
 * fidelity of the test view. The matching server-side check lives in
 * `getPlatformAdmin` (`lib/auth/platform-admin.ts`) so direct URL navigation
 * to /admin/* also returns 404 while a lens is active.
 */
export function PlatformAdminOnly({ fallback = null, children }: Props) {
  const isHydrated = useIsHydrated();
  const { data: session } = useSession();
  const { lens } = useLens();
  if (!isHydrated) return <>{fallback}</>;
  if (!session?.user?.isPlatformAdmin) return <>{fallback}</>;
  if (lens !== null) return <>{fallback}</>;
  return <>{children}</>;
}
