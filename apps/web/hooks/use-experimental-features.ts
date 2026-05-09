'use client';

import { useMemo } from 'react';
import {
  EXPERIMENTAL_FEATURE_KEYS,
  type ExperimentalFeatureKey,
  type ResolvedExperimentalState,
} from '@ancstra/auth/experimental';
import { trpc } from '@/lib/trpc/client';

const ALL_OFF: Record<ExperimentalFeatureKey, boolean> = {
  biography: false,
  researchChat: false,
  historicalContext: false,
};

export interface UseExperimentalFeaturesResult {
  /** True before the first successful fetch resolves. */
  isLoading: boolean;
  /** Full resolved state once available; null while loading. */
  state: ResolvedExperimentalState | null;
  /** Stable check that defaults to false while loading or on error. */
  isEnabled: (key: ExperimentalFeatureKey) => boolean;
  policyAllowsUsers: boolean;
  masterEnabled: boolean;
  perFeature: Record<ExperimentalFeatureKey, boolean>;
}

/**
 * Shared client hook for experimental-feature gating. Reads the resolved
 * state from the same `experimental.getMyState` cache, so every gate share
 * a single network round-trip.
 *
 * Defaults all features to false while loading — matches the server-side
 * 403 default and prevents flashing AI affordances before we know whether
 * they're actually allowed.
 */
export function useExperimentalFeatures(): UseExperimentalFeaturesResult {
  const query = trpc.experimental.getMyState.useQuery(undefined, {
    staleTime: 30_000,
  });

  return useMemo(() => {
    const state = query.data ?? null;
    const perFeature = state?.perFeature ?? ALL_OFF;
    const isEnabled = (key: ExperimentalFeatureKey) => {
      // Defensive: validate key against the known set so a typo can't pass.
      if (!EXPERIMENTAL_FEATURE_KEYS.includes(key)) return false;
      return perFeature[key] ?? false;
    };
    return {
      isLoading: query.isLoading,
      state,
      isEnabled,
      policyAllowsUsers: state?.policyAllowsUsers ?? false,
      masterEnabled: state?.masterEnabled ?? false,
      perFeature,
    };
  }, [query.data, query.isLoading]);
}
