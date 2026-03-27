'use client';

import { useState, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import {
  updateFactsheet,
  useFactsheetConflicts,
  type FactsheetDetail as FactsheetDetailType,
  type Factsheet,
} from '@/lib/research/factsheet-client';
import { FactsheetFactsSection } from './factsheet-facts-section';
import { FactsheetLinksSection } from './factsheet-links-section';
import { FactsheetPromote } from './factsheet-promote';

interface FactsheetDetailProps {
  detail: FactsheetDetailType;
  allFactsheets: Factsheet[];
  researchItemTitles: Map<string, string>;
  personId: string;
  onDataChanged: () => void;
  onSelectFactsheet: (id: string) => void;
}

export function FactsheetDetail({
  detail, allFactsheets, researchItemTitles, personId, onDataChanged, onSelectFactsheet,
}: FactsheetDetailProps) {
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { conflicts, refetch: refetchConflicts } = useFactsheetConflicts(detail.id);

  const statusCfg = FACTSHEET_STATUS_CONFIG[detail.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const isTerminal = detail.status === 'promoted' || detail.status === 'merged' || detail.status === 'dismissed';

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (notesTimer) clearTimeout(notesTimer);
      const timer = setTimeout(async () => {
        try {
          await updateFactsheet(detail.id, { notes: value });
        } catch {
          toast.error('Failed to save notes');
        }
      }, 500);
      setNotesTimer(timer);
    },
    [detail.id, notesTimer],
  );

  const handleDataChanged = useCallback(() => {
    onDataChanged();
    refetchConflicts();
  }, [onDataChanged, refetchConflicts]);

  const unresolvedConflicts = conflicts.filter((c) =>
    c.facts.some((f) => f.accepted === null),
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', statusCfg.className)}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10">
              Promote to Tree
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this hypothesis..."
          rows={2}
          disabled={isTerminal}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Facts */}
      <FactsheetFactsSection
        factsheetId={detail.id}
        personId={personId}
        facts={detail.facts}
        conflicts={conflicts}
        researchItemTitles={researchItemTitles}
        onDataChanged={handleDataChanged}
      />

      {/* Links */}
      <FactsheetLinksSection
        factsheetId={detail.id}
        links={detail.links}
        allFactsheets={allFactsheets}
        onLinkClick={onSelectFactsheet}
        onCreateLink={() => {}}
      />

      {/* Promote */}
      {!isTerminal && (
        <FactsheetPromote
          factsheetId={detail.id}
          factCount={detail.facts.length}
          unresolvedConflicts={unresolvedConflicts}
          hasLinks={detail.links.length > 0}
          onPromoted={onDataChanged}
        />
      )}
    </div>
  );
}
