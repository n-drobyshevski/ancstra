'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { FactsheetFactRow } from './factsheet-fact-row';
import { resolveFactsheetConflict } from '@/lib/research/factsheet-client';
import type { FactsheetFact, FactsheetConflict } from '@/lib/research/factsheet-client';
import { AssignFactsPopover } from './assign-facts-popover';

interface FactsheetFactsSectionProps {
  factsheetId: string;
  personId?: string;
  facts: FactsheetFact[];
  conflicts: FactsheetConflict[];
  researchItemTitles: Map<string, string>;
  onDataChanged: () => void;
}

export function FactsheetFactsSection({
  factsheetId, personId, facts, conflicts, researchItemTitles, onDataChanged,
}: FactsheetFactsSectionProps) {
  const conflictFactIds = new Set(
    conflicts.flatMap((c) => c.facts.map((f) => f.id)),
  );

  const handleAccept = useCallback(
    async (acceptedId: string, factType: string) => {
      const conflict = conflicts.find((c) => c.factType === factType);
      if (!conflict) return;
      const rejectedIds = conflict.facts.filter((f) => f.id !== acceptedId).map((f) => f.id);
      try {
        await resolveFactsheetConflict(factsheetId, acceptedId, rejectedIds);
        toast.success('Conflict resolved');
        onDataChanged();
      } catch {
        toast.error('Failed to resolve conflict');
      }
    },
    [factsheetId, conflicts, onDataChanged],
  );

  const handleReject = useCallback(
    async (rejectedId: string, factType: string) => {
      const conflict = conflicts.find((c) => c.factType === factType);
      if (!conflict) return;
      const others = conflict.facts.filter((f) => f.id !== rejectedId);
      if (others.length === 1) {
        await handleAccept(others[0].id, factType);
      }
    },
    [conflicts, handleAccept],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Facts ({facts.length})
        </h4>
        {personId ? (
          <AssignFactsPopover
            factsheetId={factsheetId}
            personId={personId}
            existingFactIds={new Set(facts.map((f) => f.id))}
            onAssigned={onDataChanged}
          >
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              + Assign facts
            </button>
          </AssignFactsPopover>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 cursor-not-allowed" title="Link to a person to assign facts">
            + Assign facts
          </span>
        )}
      </div>

      {facts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No facts assigned yet. Assign facts from research items.
        </p>
      ) : (
        <div className="space-y-1">
          {facts.map((fact) => (
            <FactsheetFactRow
              key={fact.id}
              fact={fact}
              isConflict={conflictFactIds.has(fact.id)}
              sourceTitle={fact.researchItemId ? researchItemTitles.get(fact.researchItemId) : undefined}
              onAccept={() => handleAccept(fact.id, fact.factType)}
              onReject={() => handleReject(fact.id, fact.factType)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
