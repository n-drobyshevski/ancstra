import type { Role, Permission } from '@ancstra/auth/types';

export type QuickActionKey =
  | 'addPerson'
  | 'importData'
  | 'aiResearch'
  | 'viewTree'
  | 'inviteMember';

/**
 * Permission required for each action. Mirrored client-side so the filter
 * runs in the same place as the lens-aware membership lookup. Server still
 * enforces every permission on the linked routes — this is affordance only.
 */
export const QUICK_ACTION_PERMISSIONS: Record<QuickActionKey, Permission> = {
  addPerson: 'person:create',
  importData: 'gedcom:import',
  aiResearch: 'ai:research',
  viewTree: 'tree:view',
  inviteMember: 'members:invite',
};

const MAX_ACTIONS = 4;

const ROLE_ORDER: Record<Role, readonly QuickActionKey[]> = {
  // Owner / admin: lead with creation + import + research, then promote
  // Invite over the redundant `viewTree` (sidebar already exposes the tree).
  owner: ['addPerson', 'importData', 'aiResearch', 'inviteMember'],
  admin: ['addPerson', 'importData', 'aiResearch', 'inviteMember'],
  // Editor: same creation surface; importData self-suppresses because
  // editor lacks `gedcom:import`. ViewTree fills the slot it leaves behind.
  editor: ['addPerson', 'importData', 'aiResearch', 'viewTree'],
  // Viewer: empty. ExploreHero replaces this surface entirely; the only
  // viewer-permitted action (viewTree) is already a hero-tile CTA.
  viewer: [],
};

/**
 * Per-role ordered list of action keys. Filtering by permission still
 * happens at the component layer (lens-aware via `useEffectiveMembership`);
 * this helper just decides *which* actions are eligible to consider. Defensive
 * cap at 4. Pure — unit-testable without rendering anything.
 */
export function selectQuickActionKeys(role: Role | null): QuickActionKey[] {
  if (!role) return [];
  return ROLE_ORDER[role].slice(0, MAX_ACTIONS);
}
