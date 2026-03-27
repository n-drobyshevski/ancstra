'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { promoteFactsheet } from '@/lib/research/factsheet-client';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FamilyPromoteModalProps {
  open: boolean;
  onClose: () => void;
  factsheets: FactsheetWithCounts[];
  onPromoted: () => void;
}

export function FamilyPromoteModal({ open, onClose, factsheets, onPromoted }: FamilyPromoteModalProps) {
  const [isPromoting, setIsPromoting] = useState(false);

  const nonDismissed = factsheets.filter(
    (fs) => fs.status !== 'dismissed' && fs.status !== 'promoted' && fs.status !== 'merged'
  );

  const handlePromote = useCallback(async () => {
    setIsPromoting(true);
    try {
      for (const fs of nonDismissed) {
        await promoteFactsheet(fs.id, 'create', undefined, true);
      }
      toast.success(`Promoted ${nonDismissed.length} factsheets as family unit`);
      onPromoted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  }, [nonDismissed, onPromoted, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote Family Unit</DialogTitle>
          <DialogDescription>
            This will create tree entries for {nonDismissed.length} factsheets and their relationships.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Will be promoted ({nonDismissed.length})
          </p>
          {nonDismissed.map((fs) => {
            const cfg = FACTSHEET_STATUS_CONFIG[fs.status] ?? FACTSHEET_STATUS_CONFIG.draft;
            return (
              <div key={fs.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{fs.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{fs.factCount} facts</span>
                </div>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.className)}>
                  {cfg.label}
                </span>
              </div>
            );
          })}

          {nonDismissed.some((fs) => fs.conflictCount > 0) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Some factsheets have unresolved conflicts. Resolve them first for best results.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPromoting}>Cancel</Button>
          <Button onClick={handlePromote} disabled={isPromoting || nonDismissed.length === 0}>
            {isPromoting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Promote {nonDismissed.length} to Tree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
