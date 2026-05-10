'use client';

import type { Permission } from '@ancstra/auth/types';
import { hasPermission } from '@ancstra/auth/permissions';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

/**
 * Permission-aware nav-item filter shared between the sidebar and the
 * mobile bottom dock. The hook is generic so callers can attach whatever
 * extra fields they want (icon, label, badge, etc.) without re-typing.
 *
 * Gated by `useIsHydrated` because `useEffectiveMembership` ultimately reads
 * `useSession()`, which returns different data on the SSR pass vs the first
 * client render. Until hydration completes only universally-visible items
 * are returned — server HTML and first client render then match, and
 * permissioned items pop in post-hydration.
 *
 * Server-side enforcement (tRPC `protectedProcedure`, RSC
 * `requirePagePermission`) is the source of truth; this filter is
 * affordance-hiding only.
 */
export interface PermissionGated {
  permission?: Permission | Permission[];
}

export function useVisibleNavItems<T extends PermissionGated>(items: T[]): T[] {
  const isHydrated = useIsHydrated();
  const membership = useEffectiveMembership();
  return items.filter((item) => {
    if (!item.permission) return true;
    if (!isHydrated) return false;
    if (!membership) return false;
    const required = Array.isArray(item.permission)
      ? item.permission
      : [item.permission];
    return required.some((p) => hasPermission(membership.role, p));
  });
}
