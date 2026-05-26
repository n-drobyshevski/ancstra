'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { SearchProviderKind } from '@ancstra/db/vocab';

/**
 * Ad-hoc kinds: the chip renders `providerLabel` (if set) or falls back to the
 * generic localized kind label.  Frequent / branded kinds always use the
 * localized kind label and the `providerLabel` column is ignored.
 */
const AD_HOC_KINDS: readonly SearchProviderKind[] = [
  'archive',
  'library',
  'family',
  'other',
];

interface ProviderChipProps {
  providerKind: SearchProviderKind;
  providerLabel: string | null;
}

/**
 * Bundle E 2026-05-26 — provider chip for search-attempts.
 *
 * For ad-hoc kinds (archive/library/family/other), renders the providerLabel
 * if non-empty; falls back to the localized kind label.
 * For frequent kinds (familysearch/ancestry/…), always renders the localized
 * kind label and ignores providerLabel.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §2.2.
 */
export function ProviderChip({ providerKind, providerLabel }: ProviderChipProps) {
  const t = useTranslations('persons.researchLog.providers');
  const isAdHoc = (AD_HOC_KINDS as readonly string[]).includes(providerKind);
  const label =
    isAdHoc && providerLabel && providerLabel.trim().length > 0
      ? providerLabel
      : t(providerKind);
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {label}
    </Badge>
  );
}
