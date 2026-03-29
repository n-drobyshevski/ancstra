'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePersonFacts,
  usePersonResearchItems,
} from '@/lib/research/evidence-client';
import {
  buildMatrix,
  useConclusionsForPerson,
  type MatrixCell,
} from '@/lib/research/matrix-helpers';
import { MatrixCellComponent } from './matrix-cell';
import { MatrixConclusionCell } from './matrix-conclusion-cell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { exportMatrixAsCsv, exportMatrixAsPdf } from './matrix-export';

interface MatrixTabProps {
  personId: string;
  personName?: string;
}

export function MatrixTab({ personId, personName = 'Person' }: MatrixTabProps) {
  const { facts, isLoading: factsLoading } = usePersonFacts(personId);
  const { items, isLoading: itemsLoading } = usePersonResearchItems(personId);
  const { conclusions, updateConclusion, isSaving } =
    useConclusionsForPerson(personId);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const firstConflictRef = useRef<HTMLTableRowElement>(null);

  const isLoading = factsLoading || itemsLoading;

  const matrix = useMemo(() => {
    if (facts.length === 0 || items.length === 0) return null;
    const m = buildMatrix(facts, items);
    m.conclusions = conclusions;
    return m;
  }, [facts, items, conclusions]);

  const conflictCount = matrix
    ? Object.keys(matrix.conflicts).length
    : 0;

  const selectedFact = useMemo(() => {
    if (!selectedFactId) return null;
    return facts.find((f) => f.id === selectedFactId) ?? null;
  }, [selectedFactId, facts]);

  const selectedFactSource = useMemo(() => {
    if (!selectedFact?.researchItemId) return null;
    return items.find((it) => it.id === selectedFact.researchItemId) ?? null;
  }, [selectedFact, items]);

  const handleScrollToConflict = useCallback(() => {
    firstConflictRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!matrix || matrix.factTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center px-8">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <svg
            className="size-5 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125"
            />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          No facts to display in the matrix.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Extract facts from your research items on the Board tab first.
        </p>
      </div>
    );
  }

  let firstConflictAssigned = false;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {conflictCount > 0 && (
            <button
              onClick={handleScrollToConflict}
              className="inline-flex items-center gap-1.5 rounded-md bg-status-warning-bg border border-status-warning-bg px-3 py-1.5 text-xs text-status-warning-text hover:bg-status-warning-bg/80 transition-colors"
            >
              <AlertTriangle className="size-3.5" />
              {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} detected
            </button>
          )}
          {isSaving && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMatrixAsCsv(matrix, personName)}
          >
            <Download className="mr-1.5 size-3.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMatrixAsPdf(matrix, personName)}
          >
            <FileText className="mr-1.5 size-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-20 bg-card border-b border-border">
              <th className="sticky left-0 z-30 bg-card px-3 py-2 text-left font-medium text-muted-foreground min-w-[120px] md:min-w-[160px]">
                Fact Type
              </th>
              {matrix.sources.map((source) => (
                <th
                  key={source.id}
                  className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[140px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="line-clamp-2">{source.title}</span>
                    {source.status && (
                      <Badge
                        variant={
                          source.status === 'promoted'
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-[9px] px-1 h-3.5 shrink-0"
                      >
                        {source.status}
                      </Badge>
                    )}
                  </div>
                </th>
              ))}
              <th className="sticky right-0 z-30 bg-status-info-bg px-3 py-2 text-left font-medium text-status-info-text min-w-[180px] border-l border-border">
                Conclusion
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.factTypes.map((factType) => {
              const isConflictRow = !!matrix.conflicts[factType];
              const conflictValues = isConflictRow
                ? new Set(
                    matrix.conflicts[factType].values.map((v) =>
                      v.value.toLowerCase().trim(),
                    ),
                  )
                : null;

              // Assign ref to first conflict row
              const rowRef =
                isConflictRow && !firstConflictAssigned
                  ? (() => {
                      firstConflictAssigned = true;
                      return firstConflictRef;
                    })()
                  : undefined;

              return (
                <tr
                  key={factType}
                  ref={rowRef}
                  className={cn(
                    'border-b border-border last:border-b-0',
                    isConflictRow &&
                      'bg-status-error-bg/50',
                  )}
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-muted-foreground min-w-[120px] md:min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      {isConflictRow && (
                        <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                      )}
                      <span>{formatFactType(factType)}</span>
                    </div>
                  </td>
                  {matrix.sources.map((source) => {
                    const cell = matrix.cells[factType]?.[source.id];
                    const isCellConflict =
                      isConflictRow &&
                      cell &&
                      conflictValues &&
                      conflictValues.size > 1;

                    return (
                      <MatrixCellComponent
                        key={source.id}
                        cell={cell}
                        isConflict={!!isCellConflict}
                        onCellClick={setSelectedFactId}
                      />
                    );
                  })}
                  <MatrixConclusionCell
                    factType={factType}
                    value={matrix.conclusions[factType] ?? ''}
                    onChange={updateConclusion}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fact Detail Sheet */}
      <Sheet
        open={!!selectedFactId}
        onOpenChange={(open) => {
          if (!open) setSelectedFactId(null);
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Fact Detail</SheetTitle>
            <SheetDescription>
              Details about the selected fact extraction.
            </SheetDescription>
          </SheetHeader>
          {selectedFact && (
            <div className="px-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Fact Type
                </label>
                <p className="text-sm mt-0.5">
                  {formatFactType(selectedFact.factType)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Value
                </label>
                <p className="text-sm mt-0.5 font-medium">
                  {selectedFact.factValue}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Confidence
                </label>
                <div className="mt-0.5">
                  <Badge
                    variant={
                      selectedFact.confidence === 'high'
                        ? 'default'
                        : selectedFact.confidence === 'medium'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {selectedFact.confidence}
                  </Badge>
                </div>
              </div>
              {selectedFactSource && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Source
                  </label>
                  <p className="text-sm mt-0.5">{selectedFactSource.title}</p>
                  <Badge
                    variant={
                      selectedFactSource.status === 'promoted'
                        ? 'default'
                        : 'secondary'
                    }
                    className="mt-1"
                  >
                    {selectedFactSource.status}
                  </Badge>
                </div>
              )}
              {selectedFact.notes && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Notes
                  </label>
                  <p className="text-sm mt-0.5 text-muted-foreground">
                    {selectedFact.notes}
                  </p>
                </div>
              )}
              {selectedFact.createdAt && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </label>
                  <p className="text-sm mt-0.5 text-muted-foreground">
                    {new Date(selectedFact.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFactType(factType: string): string {
  return factType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
