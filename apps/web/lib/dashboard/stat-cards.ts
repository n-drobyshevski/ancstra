import type { Role } from '@ancstra/auth/types';

export type StatKey =
  | 'people'
  | 'families'
  | 'dataQuality'
  | 'last30Days'
  | 'pendingContributions';

const DEFAULT_KEYS: readonly StatKey[] = ['people', 'families', 'dataQuality', 'last30Days'];
const MAX_KEYS = 4;

const ROLE_KEYS: Record<Role, readonly StatKey[]> = {
  // Owner gets the canonical four KPIs.
  owner: ['people', 'families', 'dataQuality', 'last30Days'],
  // Admin swaps `families` for `pendingContributions` — moderation backlog
  // is the metric an admin lands on the dashboard to triage.
  admin: ['people', 'pendingContributions', 'dataQuality', 'last30Days'],
  // Editor leads with quality (their primary outcome metric) and drops
  // families to keep the row to 3 — opens visual breathing room.
  editor: ['dataQuality', 'people', 'last30Days'],
  // Viewer keeps to two. Quality is omitted because they can't act on it.
  viewer: ['people', 'last30Days'],
};

/**
 * Returns the per-role stat-card key list (in render order). Defensive
 * `slice(0, 4)` ensures the contract holds even if the table is edited later
 * in a rush. Pure — unit-testable without rendering anything.
 */
export function selectStatKeys(role: Role | null): StatKey[] {
  const keys = role ? ROLE_KEYS[role] : DEFAULT_KEYS;
  return keys.slice(0, MAX_KEYS);
}
