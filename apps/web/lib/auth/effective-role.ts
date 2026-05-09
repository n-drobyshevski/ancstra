import type { Role } from '@ancstra/auth/types';
import { getAuthContext } from './context';

/**
 * Returns the effective (lens-aware) role for the current request, or null
 * when the user has no auth context. Thin wrapper around `getAuthContext` —
 * exists so role-conditional layout files don't need to know about
 * dbFilename, familyId, etc.
 *
 * Use for UI composition decisions (which widgets to render). Server still
 * enforces actual permissions via tRPC procedures and `requirePagePermission`.
 */
export async function getEffectiveRole(): Promise<Role | null> {
  const ctx = await getAuthContext();
  return ctx?.role ?? null;
}

/**
 * Returns the user's actual JWT role, untouched by any active lens. Use only
 * for affordances that need the real role (e.g. "you are viewing as X" labels).
 * Never use for permission decisions.
 */
export async function getActualRole(): Promise<Role | null> {
  const ctx = await getAuthContext();
  return ctx?.actualRole ?? null;
}
