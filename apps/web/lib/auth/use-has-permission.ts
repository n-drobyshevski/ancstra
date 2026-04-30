'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { hasPermission, parseRole, type Permission } from '@ancstra/auth';

export interface ActiveMembership {
  familyId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  dbFilename: string;
}

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

export function useHasPermission(
  permission: Permission,
  familyIdHint?: string,
): boolean {
  const membership = useActiveMembership(familyIdHint);
  if (!membership) return false;
  return hasPermission(membership.role, permission);
}
