'use client';

import { Button } from '@/components/ui/button';

interface BatchActionsBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onBatchDismiss: () => void;
  onBatchLink: () => void;
  isAllSelected: boolean;
}

export function BatchActionsBar({
  selectedCount, onSelectAll, onBatchDismiss, onBatchLink, isAllSelected,
}: BatchActionsBarProps) {
  return (
    <div className="flex gap-2 border-t border-border bg-muted/30 px-3 py-2">
      <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onSelectAll}>
        {isAllSelected ? 'Deselect All' : 'Select All'}
      </Button>
      <Button variant="outline" size="sm" className="h-6 text-xs" disabled={selectedCount === 0} onClick={onBatchDismiss}>
        Batch Dismiss
      </Button>
      <Button variant="outline" size="sm" className="h-6 text-xs" disabled={selectedCount < 2} onClick={onBatchLink}>
        Batch Link
      </Button>
    </div>
  );
}
