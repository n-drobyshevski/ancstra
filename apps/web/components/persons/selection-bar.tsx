'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SelectionState } from './use-selection';

interface SelectionBarProps {
  selection: SelectionState;
  pageIds: readonly string[];
  total: number;
  onClear: () => void;
}

export function SelectionBar({ selection, total, onClear }: SelectionBarProps) {
  if (selection.kind === 'none') return null;

  const count =
    selection.kind === 'ids'
      ? selection.rowIds.size
      : total - selection.exclude.size;

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
      role="region"
      aria-label="Bulk selection actions"
    >
      <span className="font-medium">
        {count.toLocaleString()} selected
      </span>
      <div className="flex items-center gap-2">
        {/* Action slots filled by Task PR3-11 (delete) and Task PR3-15 (export) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear selection"
          className="h-7 text-xs"
        >
          <X className="mr-1 h-3 w-3" aria-hidden /> Clear
        </Button>
      </div>
    </div>
  );
}
