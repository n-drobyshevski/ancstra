'use client';

import type { ReactNode } from 'react';
import { useHasPermission } from '@/lib/auth/use-has-permission';
import type { Permission } from '@ancstra/auth';

interface RoleGateProps {
  permission: Permission;
  familyIdHint?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * UX-only client-side affordance hiding. Server still enforces; bypassing
 * RoleGate (e.g. via React DevTools) is harmless because the API returns 403/409.
 */
export function RoleGate({ permission, familyIdHint, fallback = null, children }: RoleGateProps) {
  const allowed = useHasPermission(permission, familyIdHint);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
