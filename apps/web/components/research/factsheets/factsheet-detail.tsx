'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Undo2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FACTSHEET_STATUS_CONFIG, FACTSHEET_ENTITY_TYPE_LABELS } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import {
  updateFactsheet,
  useFactsheetConflicts,
  useFactsheetCluster,
  type FactsheetDetail as FactsheetDetailType,
  type Factsheet,
} from '@/lib/research/factsheet-client';
import { ReverseActionDialog } from '@/components/inbox/reverse-action-dialog';
import { ClusterUnmergeDialog } from './cluster-unmerge-dialog';
import { FactsheetFactsSection } from './factsheet-facts-section';
import { FactsheetLinksSection } from './factsheet-links-section';
import { FactsheetLinkDialog } from './factsheet-link-dialog';
import { FactsheetPromote } from './factsheet-promote';

interface FactsheetDetailProps {
  detail: FactsheetDetailType;
  allFactsheets: Factsheet[];
  researchItemTitles: Map<string, string>;
  personId?: string;
  onDataChanged: () => void;
  onSelectFactsheet: (id: string) => void;
}

export function FactsheetDetail({
  detail, allFactsheets, researchItemTitles, personId, onDataChanged, onSelectFactsheet,
}: FactsheetDetailProps) {
  const router = useRouter();
  const t = useTranslations('factsheet');
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unmergeOpen, setUnmergeOpen] = useState(false);
  const [unmergeClusterOpen, setUnmergeClusterOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const { conflicts, refetch: refetchConflicts } = useFactsheetConflicts(detail.id);
  const {
    membership,
    clusterMembers,
    clusterEdgeCount,
    refetch: refetchCluster,
  } = useFactsheetCluster(detail.id, detail.status);

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
    refetchCluster();
  }, [onDataChanged, refetchConflicts, refetchCluster]);

  const handleUnmerge = useCallback(async (reason: string) => {
    const res = await fetch(`/api/research/factsheets/${detail.id}/unmerge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; message?: string }));
      if (body.error === 'dirty' || body.error === 'cluster-promoted') {
        toast.error(`Cannot unmerge: ${body.message ?? body.error}`);
        return;
      }
      throw new Error(body.message || body.error || 'Unmerge failed');
    }
    toast.success('Factsheet unmerged');
    handleDataChanged();
  }, [detail.id, handleDataChanged]);

  const handleRestore = useCallback(async (reason: string) => {
    const res = await fetch(`/api/research/factsheets/${detail.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; message?: string }));
      throw new Error(body.message || body.error || 'Restore failed');
    }
    toast.success('Factsheet restored');
    handleDataChanged();
  }, [detail.id, handleDataChanged]);

  const handleUnmergeCluster = useCallback(async (reason: string) => {
    const res = await fetch(`/api/research/factsheets/${detail.id}/unmerge-cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; message?: string }));
      throw new Error(body.message || body.error || 'Cluster unmerge failed');
    }
    toast.success('Cluster unmerged');
    router.refresh();
    handleDataChanged();
  }, [detail.id, handleDataChanged, router]);

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
          {detail.entityType !== 'person' && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {FACTSHEET_ENTITY_TYPE_LABELS[detail.entityType] ?? detail.entityType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-green-600 border-green-600/30 hover:bg-green-600/10">
              Promote to Tree
            </Button>
          )}
          {detail.status === 'promoted' && membership.kind === 'precise' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setUnmergeClusterOpen(true)}
            >
              <Undo2 className="size-3 mr-1" />
              {t('actions.unmergeCluster')} ({clusterMembers.length})
            </Button>
          )}
          {detail.status === 'promoted' && membership.kind === 'legacy' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled
              title={t('errors.legacyClusterNotSupported')}
            >
              <Undo2 className="size-3 mr-1" />
              {t('actions.unmergeCluster')}
            </Button>
          )}
          {detail.status === 'promoted' && membership.kind === 'no' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setUnmergeOpen(true)}
            >
              <Undo2 className="size-3 mr-1" />
              Unmerge
            </Button>
          )}
          {detail.status === 'dismissed' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRestoreOpen(true)}
            >
              <RotateCcw className="size-3 mr-1" />
              Restore
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
        onCreateLink={() => setLinkDialogOpen(true)}
        onLinkCreated={handleDataChanged}
      />

      {/* Promote */}
      {!isTerminal && (
        <FactsheetPromote
          factsheetId={detail.id}
          factCount={detail.facts.length}
          unresolvedConflicts={unresolvedConflicts}
          hasLinks={detail.links.length > 0}
          onPromoted={onDataChanged}
          onRequestClusterUnmerge={() => setUnmergeClusterOpen(true)}
        />
      )}

      <FactsheetLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        factsheet={detail}
        allFactsheets={allFactsheets}
        existingLinks={detail.links}
        onLinked={handleDataChanged}
      />

      <ReverseActionDialog
        open={unmergeOpen}
        onOpenChange={setUnmergeOpen}
        title="Unmerge factsheet"
        description="This will delete the promoted person, events, and source citations created at promotion time. The factsheet returns to ready status."
        actionLabel="Unmerge"
        destructive
        onConfirm={handleUnmerge}
      />

      <ReverseActionDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore factsheet"
        description="Restore this dismissed factsheet to ready so it can be edited or promoted again."
        actionLabel="Restore"
        onConfirm={handleRestore}
      />

      <ClusterUnmergeDialog
        open={unmergeClusterOpen}
        onOpenChange={setUnmergeClusterOpen}
        factsheetId={detail.id}
        members={clusterMembers}
        edgeCount={clusterEdgeCount}
        onConfirm={handleUnmergeCluster}
      />
    </div>
  );
}
