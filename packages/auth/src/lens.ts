import type { Role } from './types';

/**
 * Numeric rank for role comparison. Higher rank = more permissions.
 * Used by the lens system to enforce downgrade-only semantics.
 */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** True iff `candidate` has strictly fewer permissions than `actual`. */
export function isStrictlyBelow(candidate: Role, actual: Role): boolean {
  return ROLE_RANK[candidate] < ROLE_RANK[actual];
}

/**
 * Roles a user with `actual` may activate as a lens — i.e. roles strictly
 * below their own. Returned in descending order (closest to actual first).
 */
export function availableLenses(actual: Role): Role[] {
  const all: Role[] = ['admin', 'editor', 'viewer'];
  return all.filter((r) => isStrictlyBelow(r, actual));
}

/**
 * Effective role to use for permission decisions.
 *
 * The lens cookie is treated as an UNTRUSTED request for less permission.
 * Only legitimate downgrades are honored; escalation attempts and same-role
 * requests fall back to the actual role.
 */
export function effectiveRole(actual: Role, requested: Role | null): Role {
  if (requested && isStrictlyBelow(requested, actual)) return requested;
  return actual;
}
