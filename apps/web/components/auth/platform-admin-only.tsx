'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client-side affordance gate. Mirrors RoleGate but for the platform-admin
 * dimension. Defense-in-depth only — server enforces via requirePlatformAdmin
 * + platformAdminProcedure (returns 404, not 403).
 */
export function PlatformAdminOnly({ fallback = null, children }: Props) {
  const { data: session } = useSession();
  if (!session?.user?.isPlatformAdmin) return <>{fallback}</>;
  return <>{children}</>;
}
