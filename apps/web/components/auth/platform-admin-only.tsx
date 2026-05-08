'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useLens } from '@/lib/lens/provider';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client-side affordance gate for platform-admin-only UI. Mirrors RoleGate but
 * for the platform-admin dimension. Defense-in-depth only — server enforces
 * via requirePlatformAdmin + platformAdminProcedure (returns 404, not 403).
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
  const { data: session } = useSession();
  const { lens } = useLens();
  if (!session?.user?.isPlatformAdmin) return <>{fallback}</>;
  if (lens !== null) return <>{fallback}</>;
  return <>{children}</>;
}
