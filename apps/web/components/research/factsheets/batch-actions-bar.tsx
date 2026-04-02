'use client';

import { Button } from '@/components/ui/button';

interface BatchActionsBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onBatchDismiss: () => void;
  onBatchLink: () => void;
  isAllSelected: boolean;
  onCancel?: () => void;
}

export function BatchActionsBar({
  selectedCount, onSelectAll, onBatchDismiss, onBatchLink, isAllSelected, onCancel,
}: BatchActionsBarProps) {
  return (
    <>
      {/* Desktop: inline bar */}
      <div className="hidden md:flex gap-2 border-t border-border bg-muted/30 px-3 py-2">
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

      {/* Mobile: floating bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom,0px)] pt-2 shadow-lg md:hidden">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Done
          </Button>
        </div>
        <div className="flex gap-2 pb-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={selectedCount === 0}
            onClick={onBatchDismiss}
          >
            Dismiss
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 text-xs"
            disabled={selectedCount < 2}
            onClick={onBatchLink}
          >
            Link
          </Button>
        </div>
      </div>
    </>
  );
}
