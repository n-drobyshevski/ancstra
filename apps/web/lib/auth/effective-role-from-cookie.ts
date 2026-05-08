import { effectiveRole, type Role } from '@ancstra/auth';
import {
  LENS_COOKIE_NAME,
  parseLensCookie,
  readCookieValue,
} from '@/lib/lens/cookie';

/**
 * Resolves the effective role for permission decisions, honoring the lens
 * cookie iff it requests a strict downgrade for the given family.
 *
 * The lens cookie is UNTRUSTED. Source of truth is `actualRole`, which the
 * caller MUST derive from a signed source (JWT membership or central DB).
 * Cross-family cookies, escalation attempts, and same-role requests all fall
 * back to `actualRole`. See `effectiveRole()` for the downgrade-only semantics.
 *
 * Used by both the tRPC context (`server/api/init.ts`) and the RSC auth
 * context (`lib/auth/context.ts`) so server-rendered pages and tRPC procedures
 * see the same effective role.
 */
export function resolveEffectiveRole(
  actualRole: Role,
  familyId: string,
  cookieHeader: string | null,
): Role {
  if (!cookieHeader) return actualRole;
  const lensRaw = readCookieValue(cookieHeader, LENS_COOKIE_NAME);
  const parsed = parseLensCookie(lensRaw);
  const lensRequest = parsed && parsed.familyId === familyId ? parsed.role : null;
  return effectiveRole(actualRole, lensRequest);
}
