'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SearchOutcome } from '@ancstra/db/vocab';

interface OutcomeChipProps {
  outcome: SearchOutcome;
  className?: string;
}

/**
 * Color class lookup table — one entry per SearchOutcome value.
 *
 * Heritage Modern palette tokens used where available (globals.css):
 *   status-success-bg / status-success-text  → found (green)
 *   status-error-bg   / status-error-text    → negative (red)
 *   muted / muted-foreground                 → inconclusive (neutral)
 *
 * NOTE: `status-success-border` and `status-error-border` tokens are NOT
 * defined in globals.css (verified 2026-05-26). Badge variant="outline"
 * already supplies `border-border`; we override to `border-transparent`
 * for found/negative so the bg color isn't washed out by a gray border.
 * Task 13 or a design-pass can add the missing tokens and update these entries.
 */
const OUTCOME_CLASSES: Record<SearchOutcome, string> = {
  found: 'bg-status-success-bg text-status-success-text border-transparent',
  negative: 'bg-status-error-bg text-status-error-text border-transparent',
  inconclusive: 'bg-muted text-muted-foreground border-border',
};

/**
 * Bundle E 2026-05-26 — outcome chip for search-attempts.
 *
 * Color-coded per spec §4.5 mockup:
 *   found        → green (Heritage status-success tokens)
 *   negative     → red   (Heritage status-error tokens)
 *   inconclusive → neutral gray (muted tokens)
 *
 * `data-outcome` attribute drives both visual debug and test element selection.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.5.
 */
export function OutcomeChip({ outcome, className }: OutcomeChipProps) {
  const t = useTranslations('persons.researchLog.outcomes');
  return (
    <Badge
      variant="outline"
      data-outcome={outcome}
      className={cn('text-xs font-normal', OUTCOME_CLASSES[outcome], className)}
    >
      {t(outcome)}
    </Badge>
  );
}
