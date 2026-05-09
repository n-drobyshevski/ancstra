import type { Role } from '@ancstra/auth/types';
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityCategoryKey,
} from './activity-config';

/**
 * Per-role config controlling which Activity categories and individual
 * actions are visible. Mirrors the `getDashboardCards(role)` shape used by
 * the /settings landing page (single source of truth, switch-on-role).
 *
 * The server filter is authoritative; the client value is reapplied as
 * defense-in-depth and so flipping the lens cookie can re-derive visibility
 * without a refetch storm.
 *
 * Caller contract: when `redactLivingPersons` is true, run
 * `redactActivityForViewer(items, livingPersonIds)` AFTER
 * `filterEntriesByVisibility` so redaction only applies to entries the role
 * is allowed to see.
 */
export interface ActivityVisibility {
  /** Tabs the role may see, in display order, with `all` first. */
  categories: ActivityCategory[];
  /** Allowlist of action strings the role is permitted to see anywhere. */
  allowedActions: ReadonlySet<string>;
  /** When true, summaries for living-person entries must be redacted. */
  redactLivingPersons: boolean;
}

/**
 * Categories visible per role, in display order. The `all` tab is rebuilt
 * per role so its action list reflects only what that role can see.
 */
const ROLE_CATEGORY_KEYS: Record<Role, readonly ActivityCategoryKey[]> = {
  owner:  ['all', 'people', 'media', 'members', 'settings', 'import', 'contrib'],
  admin:  ['all', 'people', 'media', 'members', 'settings', 'import', 'contrib'],
  editor: ['all', 'people', 'media', 'import', 'contrib'],
  viewer: ['all', 'people', 'media', 'contrib'],
};

/**
 * Per-action exclusions on top of the category visibility above. Used for
 * actions that live inside a visible category but should still be hidden
 * (e.g. owner_transferred is in `members` but admins shouldn't see it).
 */
const ROLE_ACTION_EXCLUSIONS: Record<Role, readonly string[]> = {
  owner: [],
  admin: ['owner_transferred'],
  editor: [],
  viewer: [],
};

export function getActivityVisibility(role: Role): ActivityVisibility {
  const visibleKeys = ROLE_CATEGORY_KEYS[role];
  const exclusions = new Set(ROLE_ACTION_EXCLUSIONS[role]);

  // Allowed-action set = union of visible non-`all` category actions, minus exclusions.
  const allowedActions = new Set<string>();
  for (const cat of ACTIVITY_CATEGORIES) {
    if (cat.key === 'all') continue;
    if (!visibleKeys.includes(cat.key)) continue;
    if (!cat.actions) continue;
    for (const action of cat.actions) {
      if (!exclusions.has(action)) allowedActions.add(action);
    }
  }

  // Rebuild categories so per-tab filters stay coherent with the allow-set.
  const categories: ActivityCategory[] = visibleKeys.map((key) => {
    if (key === 'all') {
      return { key: 'all', actions: null };
    }
    const base = ACTIVITY_CATEGORIES.find((c) => c.key === key);
    if (!base) return { key, actions: [] };
    const filtered = (base.actions ?? []).filter((a) => allowedActions.has(a));
    return { ...base, actions: filtered };
  });

  return {
    categories,
    allowedActions,
    redactLivingPersons: role === 'viewer',
  };
}

/** Filter an arbitrary feed by an ActivityVisibility. */
export function filterEntriesByVisibility<T extends { action: string }>(
  entries: T[],
  visibility: ActivityVisibility,
): T[] {
  return entries.filter((entry) => visibility.allowedActions.has(entry.action));
}
