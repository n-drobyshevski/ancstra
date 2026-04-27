'use client';

import { Button } from '@/components/ui/button';
import type { SelectionState } from './use-selection';

interface SelectAllBannerProps {
  selection: SelectionState;
  pageIds: readonly string[];
  total: number;
  onSelectAllMatching: () => void;
  onClear: () => void;
}

export function SelectAllBanner({
  selection,
  pageIds,
  total,
  onSelectAllMatching,
  onClear,
}: SelectAllBannerProps) {
  if (selection.kind === 'matching') {
    const excludedCount = selection.exclude.size;
    const effectiveCount = total - excludedCount;
    return (
      <div
        className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
        role="status"
        aria-live="polite"
      >
        <span>
          All {effectiveCount.toLocaleString()} matching persons selected
          {excludedCount > 0 && <span className="text-muted-foreground"> ({excludedCount} excluded)</span>}.
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
          Clear selection
        </Button>
      </div>
    );
  }

  if (selection.kind !== 'ids') return null;

  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selection.rowIds.has(id));
  if (!allOnPageSelected) return null;
  if (total <= pageIds.length) return null;

  return (
    <div
      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="text-muted-foreground">
        All {pageIds.length} on this page selected.
      </span>
      <Button variant="link" size="sm" className="h-7 text-xs" onClick={onSelectAllMatching}>
        Select all {total.toLocaleString()} matching
      </Button>
    </div>
  );
}
