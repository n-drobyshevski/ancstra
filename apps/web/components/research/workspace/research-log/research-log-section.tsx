'use client';

interface ResearchLogSectionProps {
  personId: string;
}

/**
 * Bundle E 2026-05-26 — Research log tab content root.
 *
 * Task 8 ships a minimal placeholder. Task 10 swaps in SearchAttemptList +
 * filters; Tasks 11-12 add the add/edit/delete dialogs and full wiring.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.
 */
export function ResearchLogSection({ personId: _personId }: ResearchLogSectionProps) {
  return (
    <div className="text-sm text-muted-foreground" data-testid="research-log-placeholder">
      Research log placeholder
    </div>
  );
}
