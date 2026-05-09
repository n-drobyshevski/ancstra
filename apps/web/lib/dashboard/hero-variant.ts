import type { Role } from '@ancstra/auth/types';

/**
 * Hero variant identifiers. `null` means no role-specific hero card — the
 * hero slot falls back to the generic intro band (Phase 1 behavior).
 *
 * Phase 2 wires `family-health` (owner) and `moderation` (admin). Phases 3
 * and 4 add `research-focus` (editor) and `explore` (viewer).
 */
export type HeroVariant =
  | 'family-health'
  | 'moderation'
  | 'research-focus'
  | 'explore'
  | null;

/**
 * Pure mapping from effective role to hero variant. Extracted so the slot
 * page is trivial and the decision is unit-testable without rendering an
 * async Server Component. Lens-aware behavior is the caller's responsibility:
 * pass the *effective* role, not the actual JWT role.
 */
export function selectHeroVariant(role: Role | null): HeroVariant {
  switch (role) {
    case 'owner':
      return 'family-health';
    case 'admin':
      return 'moderation';
    case 'editor':
      return 'research-focus';
    case 'viewer':
      return 'explore';
    case null:
    default:
      return null;
  }
}
