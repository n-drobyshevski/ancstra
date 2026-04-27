'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import type { SelectionState } from './use-selection';
import type { PersonsFilters } from '@/lib/persons/search-params';

const CONFIRM_THRESHOLD = 1000;

interface SelectionBarProps {
  selection: SelectionState;
  pageIds: readonly string[];
  total: number;
  filters: PersonsFilters;
  onClear: () => void;
}

interface BulkScopePayload {
  kind: 'ids' | 'matching';
  ids?: string[];
  filters?: PersonsFilters;
  exclude?: string[];
}

function buildScope(selection: SelectionState, filters: PersonsFilters): BulkScopePayload | null {
  if (selection.kind === 'ids') {
    return { kind: 'ids', ids: Array.from(selection.rowIds) };
  }
  if (selection.kind === 'matching') {
    return { kind: 'matching', filters, exclude: Array.from(selection.exclude) };
  }
  return null;
}

export function SelectionBar({ selection, total, filters, onClear }: SelectionBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverConfirmedCount, setServerConfirmedCount] = useState<number | null>(null);

  if (selection.kind === 'none') return null;

  const estimatedCount =
    selection.kind === 'ids'
      ? selection.rowIds.size
      : total - selection.exclude.size;
  const displayCount = serverConfirmedCount ?? estimatedCount;
  const requireCountEcho = displayCount > CONFIRM_THRESHOLD && selection.kind === 'matching';

  const performDelete = async (confirmCount?: number) => {
    const scope = buildScope(selection, filters);
    if (!scope) return;
    const body: { action: 'delete'; scope: BulkScopePayload; confirmCount?: number } = {
      action: 'delete',
      scope,
    };
    if (confirmCount !== undefined) body.confirmCount = confirmCount;

    const res = await fetch('/api/persons/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      const data = await res.json();
      if (data.requiresConfirmation) {
        setServerConfirmedCount(data.requiresConfirmation);
        return;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      toast.error(`Delete failed: ${text || res.statusText}`);
      return;
    }

    const data = await res.json();
    toast.success(`Deleted ${data.affected} ${data.affected === 1 ? 'person' : 'persons'}`);
    setDialogOpen(false);
    setServerConfirmedCount(null);
    onClear();
    router.refresh();
  };

  return (
    <>
      <div
        className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        role="region"
        aria-label="Bulk selection actions"
      >
        <span className="font-medium">
          {displayCount.toLocaleString()} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={isPending}
            className="h-7"
          >
            <Trash2 className="mr-1 h-3 w-3" aria-hidden /> Delete
          </Button>
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

      <DeleteConfirmationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setServerConfirmedCount(null);
        }}
        count={displayCount}
        requireCountEcho={requireCountEcho}
        isPending={isPending}
        onConfirm={() => {
          startTransition(() => {
            void performDelete(requireCountEcho ? displayCount : undefined);
          });
        }}
      />
    </>
  );
}
