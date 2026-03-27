'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useFactsheetDuplicates,
  promoteFactsheet,
  type FactsheetConflict,
  type DuplicateMatch,
} from '@/lib/research/factsheet-client';

interface FactsheetPromoteProps {
  factsheetId: string;
  factCount: number;
  unresolvedConflicts: FactsheetConflict[];
  hasLinks: boolean;
  onPromoted: () => void;
}

export function FactsheetPromote({
  factsheetId, factCount, unresolvedConflicts, hasLinks, onPromoted,
}: FactsheetPromoteProps) {
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(1);
  const [checkDups, setCheckDups] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<DuplicateMatch | null>(null);
  const [mode, setMode] = useState<'create' | 'merge' | null>(null);
  const [promoting, setPromoting] = useState(false);

  const { matches, isLoading: dupsLoading } = useFactsheetDuplicates(factsheetId, checkDups);

  const step1Pass = factCount > 0 && unresolvedConflicts.length === 0;

  const handleCheckDuplicates = useCallback(() => {
    setCheckDups(true);
    setStep(2);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!mode) return;
    setPromoting(true);
    try {
      await promoteFactsheet(
        factsheetId,
        mode,
        mode === 'merge' ? selectedMatch?.personId : undefined,
        hasLinks,
      );
      toast.success('Promoted to tree');
      onPromoted();
    } catch (err: any) {
      toast.error(err.message ?? 'Promotion failed');
    } finally {
      setPromoting(false);
    }
  }, [factsheetId, mode, selectedMatch, hasLinks, onPromoted]);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={expanded}
      >
        <div>
          <span className="text-sm font-semibold">Promote to Tree</span>
          <span className="ml-2 text-xs text-muted-foreground">Create a person from this hypothesis</span>
        </div>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="divide-y divide-border">
          {/* Step 1: Readiness */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 1 · Readiness
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                {factCount > 0 ? <Check className="size-3 text-green-500" /> : <X className="size-3 text-destructive" />}
                <span>{factCount > 0 ? `${factCount} facts assigned` : 'No facts assigned'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {unresolvedConflicts.length === 0
                  ? <Check className="size-3 text-green-500" />
                  : <X className="size-3 text-destructive" />}
                <span>
                  {unresolvedConflicts.length === 0
                    ? 'No conflicts'
                    : `${unresolvedConflicts.length} unresolved conflict${unresolvedConflicts.length > 1 ? 's' : ''} — resolve above`}
                </span>
              </div>
            </div>
            {step1Pass && step === 1 && (
              <Button size="sm" className="mt-3 h-7 text-xs" onClick={handleCheckDuplicates}>
                Check for Matches
              </Button>
            )}
          </div>

          {/* Step 2: Duplicate Check */}
          <div className={cn('px-4 py-3', !step1Pass && 'opacity-40 pointer-events-none')}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 2 · Duplicate Check
            </p>
            {!checkDups && <p className="text-xs text-muted-foreground">Complete step 1 first...</p>}
            {dupsLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Checking for matches...
              </div>
            )}
            {checkDups && !dupsLoading && matches.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <Check className="size-3" />
                No duplicates found
              </div>
            )}
            {checkDups && !dupsLoading && matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-500">
                  {matches.length} possible match{matches.length > 1 ? 'es' : ''} found
                </p>
                {matches.map((m) => (
                  <div key={m.personId} className="flex items-center justify-between rounded-md border border-border p-2">
                    <div>
                      <span className="text-sm font-medium">{m.givenName} {m.surname}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.matchedFields.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-500">{Math.round(m.score * 100)}%</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => { setSelectedMatch(m); setMode('merge'); setStep(3); }}
                      >
                        Merge into this
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {checkDups && !dupsLoading && step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => { setMode('create'); setStep(3); }}
              >
                Continue as new person
              </Button>
            )}
          </div>

          {/* Step 3: Confirm */}
          <div className={cn('px-4 py-3', step < 3 && 'opacity-40 pointer-events-none')}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Step 3 · Confirm &amp; Create
            </p>
            {step >= 3 && mode && (
              <>
                <p className="text-xs mb-3">
                  {mode === 'create'
                    ? 'Will create a new person from this factsheet.'
                    : `Will merge facts into ${selectedMatch?.givenName} ${selectedMatch?.surname}.`}
                  {hasLinks && ' Connected factsheets will be promoted as a family unit.'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setStep(2); setMode(null); setSelectedMatch(null); }}
                  >
                    Back
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                    disabled={promoting}
                    onClick={handleConfirm}
                  >
                    {promoting ? <><Loader2 className="mr-1 size-3 animate-spin" />Promoting...</> : 'Confirm Promote'}
                  </Button>
                </div>
              </>
            )}
            {step < 3 && <p className="text-xs text-muted-foreground">Complete previous steps...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
