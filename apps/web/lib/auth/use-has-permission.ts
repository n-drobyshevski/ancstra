'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { hasPermission } from '@ancstra/auth/permissions';
import { effectiveRole } from '@ancstra/auth/lens';
import { parseRole, type Permission, type Role } from '@ancstra/auth/types';
import { useLens } from '@/lib/lens/provider';

export interface ActiveMembership {
  familyId: string;
  role: Role;
  dbFilename: string;
}

export interface EffectiveMembership extends ActiveMembership {
  /** The user's real (JWT) role, untouched by any lens. */
  actualRole: Role;
}

/**
 * Resolves the JWT-derived membership for the active (or hinted) family.
 * Returns the user's REAL role — does not apply the lens. Use this when you
 * need to know the user's true role (e.g. inside the lens selector itself).
 *
 * For permission decisions in the UI, prefer `useEffectiveMembership` /
 * `useHasPermission`, which honor the lens.
 */
export function useActiveMembership(familyIdHint?: string): ActiveMembership | null {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const memberships = session?.user?.memberships;
  if (!memberships || memberships.length === 0) return null;

  const urlFamilyId = searchParams?.get('family') ?? null;
  const targetFamilyId = familyIdHint ?? urlFamilyId;

  const raw = targetFamilyId
    ? memberships.find((m) => m.familyId === targetFamilyId)
    : memberships[0];

  if (!raw) return null;

  const role = parseRole(raw.role);
  if (!role) return null;

  return { familyId: raw.familyId, role, dbFilename: raw.dbFilename };
}

/**
 * Like `useActiveMembership`, but returns the EFFECTIVE role for permission
 * decisions — the JWT role downgraded by an active lens, when the lens
 * targets the same family. The original JWT role is exposed as `actualRole`.
 *
 * Single source of truth for client-side permission UI: every `<RoleGate>` and
 * `useHasPermission` call site flows through this hook so toggling the lens
 * automatically hides admin/editor affordances.
 */
export function useEffectiveMembership(
  familyIdHint?: string,
): EffectiveMembership | null {
  const membership = useActiveMembership(familyIdHint);
  const lens = useLens();
  if (!membership) return null;
  // Lens cookie is family-scoped; only honor it when the lens targets the same
  // family as the membership we're resolving. Cross-family checks fall through
  // to the actual JWT role.
  const lensRequest =
    lens.lens && lens.familyId === membership.familyId ? lens.lens : null;
  const role = effectiveRole(membership.role, lensRequest);
  return {
    familyId: membership.familyId,
    role,
    actualRole: membership.role,
    dbFilename: membership.dbFilename,
  };
}

/**
 * Convenience: returns just the effective role for the active (or hinted)
 * family, or `null` if there is no membership.
 */
export function useEffectiveRole(familyIdHint?: string): Role | null {
  return useEffectiveMembership(familyIdHint)?.role ?? null;
}

/**
 * Lens-aware permission check. Server still enforces; this is for UX only.
 */
export function useHasPermission(
  permission: Permission,
  familyIdHint?: string,
): boolean {
  const membership = useEffectiveMembership(familyIdHint);
  if (!membership) return false;
  return hasPermission(membership.role, permission);
}

/**
 * Returns `true` iff the user holds AT LEAST ONE of the given permissions.
 * Useful for nav items / pages that show different surfaces depending on
 * which of several capabilities the user has (e.g. import OR export).
 */
export function useHasAnyPermission(
  permissions: readonly Permission[],
  familyIdHint?: string,
): boolean {
  const membership = useEffectiveMembership(familyIdHint);
  if (!membership) return false;
  return permissions.some((p) => hasPermission(membership.role, p));
}
