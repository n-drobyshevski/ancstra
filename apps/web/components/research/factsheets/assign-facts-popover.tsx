'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONFIDENCE_VARIANT } from '@/lib/research/constants';
import {
  assignFactToFactsheet,
  type FactsheetFact,
} from '@/lib/research/factsheet-client';

interface AssignFactsPopoverProps {
  factsheetId: string;
  personId: string;
  existingFactIds: Set<string>;
  onAssigned: () => void;
  children: React.ReactNode;
}

export function AssignFactsPopover({
  factsheetId,
  personId,
  existingFactIds,
  onAssigned,
  children,
}: AssignFactsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<FactsheetFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  // Fetch ungrouped facts when popover opens
  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      return;
    }
    setLoading(true);
    fetch(`/api/research/facts?personId=${personId}`)
      .then((res) => res.json())
      .then((data) => {
        // Filter to only show facts not already in any factsheet
        const ungrouped = (data.facts ?? []).filter(
          (f: FactsheetFact) => !f.factsheetId && !existingFactIds.has(f.id),
        );
        setFacts(ungrouped);
      })
      .catch(() => toast.error('Failed to load facts'))
      .finally(() => setLoading(false));
  }, [open, personId, existingFactIds]);

  const toggleFact = useCallback((factId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(factId)) next.delete(factId);
      else next.add(factId);
      return next;
    });
  }, []);

  const handleAssign = useCallback(async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    try {
      for (const factId of selected) {
        await assignFactToFactsheet(factsheetId, factId);
      }
      toast.success(`${selected.size} fact${selected.size > 1 ? 's' : ''} assigned`);
      setOpen(false);
      onAssigned();
    } catch {
      toast.error('Failed to assign facts');
    } finally {
      setAssigning(false);
    }
  }, [factsheetId, selected, onAssigned]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <h4 className="text-sm font-medium">Assign facts to factsheet</h4>

        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Loading ungrouped facts...
          </div>
        )}

        {!loading && facts.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No ungrouped facts available. Extract facts from research items first.
          </p>
        )}

        {!loading && facts.length > 0 && (
          <>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {facts.map((fact) => {
                const isSelected = selected.has(fact.id);
                const confVariant = CONFIDENCE_VARIANT[fact.confidence] ?? 'secondary';
                return (
                  <label
                    key={fact.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-2 cursor-pointer hover:bg-accent/5 min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFact(fact.id)}
                      className="size-4 shrink-0 rounded border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {fact.factType.replace(/_/g, ' ')}
                      </span>
                      <span className="ml-1.5 text-xs">{fact.factValue}</span>
                    </div>
                    <Badge variant={confVariant} className="text-[9px] h-4 px-1 shrink-0">
                      {fact.confidence}
                    </Badge>
                  </label>
                );
              })}
            </div>
            <Button
              size="sm"
              className="w-full h-9"
              disabled={selected.size === 0 || assigning}
              onClick={handleAssign}
            >
              {assigning ? (
                <><Loader2 className="mr-1.5 size-3 animate-spin" />Assigning...</>
              ) : (
                `Assign ${selected.size} fact${selected.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
