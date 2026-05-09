import { eq } from 'drizzle-orm';
import { userPreferences, platformSettings } from '@ancstra/db/central-schema';
import type { CentralDatabase } from '@ancstra/db';
import { ForbiddenError } from './types';

export type ExperimentalFeatureKey =
  | 'biography'
  | 'researchChat'
  | 'historicalContext';

export const EXPERIMENTAL_FEATURE_KEYS = [
  'biography',
  'researchChat',
  'historicalContext',
] as const satisfies readonly ExperimentalFeatureKey[];

export interface ResolvedExperimentalState {
  policyAllowsUsers: boolean;
  masterEnabled: boolean;
  perFeature: Record<ExperimentalFeatureKey, boolean>;
  isEnabled: (key: ExperimentalFeatureKey) => boolean;
}

export class ExperimentalFeatureDisabledError extends ForbiddenError {
  public readonly featureKey: ExperimentalFeatureKey;
  constructor(featureKey: ExperimentalFeatureKey) {
    super('ai:research');
    this.name = 'ExperimentalFeatureDisabledError';
    this.featureKey = featureKey;
    this.message = `Experimental feature '${featureKey}' is not enabled for this user`;
  }
}

function parseOverrides(raw: string | null | undefined): Partial<Record<ExperimentalFeatureKey, boolean>> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: Partial<Record<ExperimentalFeatureKey, boolean>> = {};
  for (const key of EXPERIMENTAL_FEATURE_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

/**
 * Resolve the full experimental-features state for a user.
 *
 * Composition rule (logical AND):
 *   policyAllowsUsers && masterEnabled && perFeatureOverride !== false
 *
 * - Per-feature default is `true` when master is on (only an explicit `false`
 *   in the JSON disables a single feature).
 * - When either gate is off, all features resolve to `false` regardless of
 *   per-feature overrides. Overrides cannot bypass the upstream gates.
 *
 * Two indexed PK lookups, no caching. Cheap to call per request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any Drizzle DB instance (better-sqlite3 or libsql)
export async function resolveExperimentalState(
  centralDb: CentralDatabase | any,
  userId: string,
): Promise<ResolvedExperimentalState> {
  const [policyRow, prefsRow] = await Promise.all([
    centralDb.select({
      experimentalFeaturesAllowUsers: platformSettings.experimentalFeaturesAllowUsers,
    })
      .from(platformSettings)
      .where(eq(platformSettings.id, 'global'))
      .get(),
    centralDb.select({
      experimentalEnabled: userPreferences.experimentalEnabled,
      experimentalFeatures: userPreferences.experimentalFeatures,
    })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .get(),
  ]);

  const policyAllowsUsers = policyRow?.experimentalFeaturesAllowUsers === 1;
  const masterEnabled = prefsRow?.experimentalEnabled === 1;
  const overrides = parseOverrides(prefsRow?.experimentalFeatures);

  const gateOpen = policyAllowsUsers && masterEnabled;
  const perFeature = EXPERIMENTAL_FEATURE_KEYS.reduce(
    (acc, key) => {
      acc[key] = gateOpen && overrides[key] !== false;
      return acc;
    },
    {} as Record<ExperimentalFeatureKey, boolean>,
  );

  return {
    policyAllowsUsers,
    masterEnabled,
    perFeature,
    isEnabled: (key) => perFeature[key],
  };
}

/**
 * Convenience: resolves state and returns whether a single feature is enabled.
 * Equivalent to `(await resolveExperimentalState(...)).isEnabled(key)`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isExperimentalFeatureEnabled(
  centralDb: CentralDatabase | any,
  userId: string,
  key: ExperimentalFeatureKey,
): Promise<boolean> {
  const state = await resolveExperimentalState(centralDb, userId);
  return state.isEnabled(key);
}

/**
 * Throws ExperimentalFeatureDisabledError (extends ForbiddenError) when the
 * feature is not enabled for the user. Compose with `withAuth` in route
 * handlers to get a 403 response automatically via existing handleAuthError.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireExperimentalFeature(
  centralDb: CentralDatabase | any,
  userId: string,
  key: ExperimentalFeatureKey,
): Promise<void> {
  const enabled = await isExperimentalFeatureEnabled(centralDb, userId, key);
  if (!enabled) throw new ExperimentalFeatureDisabledError(key);
}
