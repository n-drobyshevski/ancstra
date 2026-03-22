'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePersonConflicts,
  usePersonResearchItems,
} from '@/lib/research/evidence-client';
import { ConflictCard, type ConflictFact } from './conflict-card';

interface ConflictsTabProps {
  personId: string;
}

export function ConflictsTab({ personId }: ConflictsTabProps) {
  const { conflicts, refetch } = usePersonConflicts(personId);
  const { items } = usePersonResearchItems(personId);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  // Build a map of researchItemId -> title for source labels
  const sourceMap = new Map(items.map((it) => [it.id, it.title]));

  const handleResolve = useCallback(
    async (winnerFactId: string, loserFactId: string) => {
      const key = `${winnerFactId}-${loserFactId}`;
      setResolvingIds((prev) => new Set(prev).add(key));

      try {
        const res = await fetch('/api/research/conflicts/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winnerFactId, loserFactId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Resolution failed' }));
          throw new Error(err.error ?? 'Resolution failed');
        }

        toast.success('Conflict resolved');
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Resolution failed');
      } finally {
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [refetch],
  );

  // Empty state
  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CheckCircle2 className="mb-3 size-10 text-green-500" />
        <p className="text-sm font-medium">No conflicts detected</p>
        <p className="mt-1 text-xs">
          All facts for this person are consistent across sources.
        </p>
      </div>
    );
  }

  // Total conflict count across all groups
  const totalCount = conflicts.reduce(
    (sum, group) => sum + Math.max(0, group.facts.length - 1),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {totalCount} conflict{totalCount !== 1 ? 's' : ''} detected
        </h2>
      </div>

      {conflicts.map((group) => {
        // For each conflict group with N facts, show pairwise comparisons
        // (simplification: compare first fact against each subsequent fact)
        const [first, ...rest] = group.facts;
        if (!first || rest.length === 0) return null;

        return (
          <div key={group.factType} className="space-y-3">
            {rest.map((other) => {
              const factA: ConflictFact = {
                id: first.id,
                factValue: first.factValue,
                confidence: first.confidence,
                sourceTitle: first.researchItemId
                  ? sourceMap.get(first.researchItemId)
                  : undefined,
              };
              const factB: ConflictFact = {
                id: other.id,
                factValue: other.factValue,
                confidence: other.confidence,
                sourceTitle: other.researchItemId
                  ? sourceMap.get(other.researchItemId)
                  : undefined,
              };
              const key = `${first.id}-${other.id}`;
              return (
                <ConflictCard
                  key={key}
                  factType={group.factType}
                  factA={factA}
                  factB={factB}
                  onResolve={handleResolve}
                  isResolving={resolvingIds.has(key)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
