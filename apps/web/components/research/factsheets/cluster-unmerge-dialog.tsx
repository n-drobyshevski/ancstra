'use client';

/**
 * Bundle D 2026-05-25 — Cluster unmerge confirmation dialog.
 *
 * Wraps Bundle B's `ReverseActionDialog` shell with a cluster member list
 * rendered in its `diff` slot.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §6.1
 */

import { useTranslations } from 'next-intl';
import { ReverseActionDialog } from '@/components/inbox/reverse-action-dialog';
import type { ClusterMember } from '@ancstra/research';

// ---------------------------------------------------------------------------
// ClusterMemberList — colocated helper (~30 LOC)
// Renders bullet list of factsheetTitle → person name plus summary line.
// ---------------------------------------------------------------------------

interface ClusterMemberListProps {
  members: ClusterMember[];
  edgeCount: { families: number; children: number };
}

function ClusterMemberList({ members, edgeCount }: ClusterMemberListProps) {
  const t = useTranslations('factsheet.unmergeCluster');

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {members.map((m) => {
          const personName =
            [m.personGivenName, m.personSurname].filter(Boolean).join(' ') ||
            m.personId;
          return (
            <li key={m.factsheetId} className="flex items-baseline gap-1.5 text-xs">
              <span className="font-medium text-foreground">{m.factsheetTitle}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-muted-foreground">{personName}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground border-t pt-2">
        {t('summary', { families: edgeCount.families, children: edgeCount.children })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClusterUnmergeDialog — public API
// ---------------------------------------------------------------------------

export interface ClusterUnmergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factsheetId: string;
  members: ClusterMember[];
  edgeCount: { families: number; children: number };
  onConfirm: (reason: string) => Promise<void>;
}

export function ClusterUnmergeDialog({
  open,
  onOpenChange,
  factsheetId: _factsheetId,
  members,
  edgeCount,
  onConfirm,
}: ClusterUnmergeDialogProps) {
  const t = useTranslations('factsheet');

  return (
    <ReverseActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('unmergeCluster.title')}
      description={t('unmergeCluster.description', { count: members.length })}
      destructive
      diff={<ClusterMemberList members={members} edgeCount={edgeCount} />}
      actionLabel={t('unmergeCluster.action')}
      onConfirm={onConfirm}
    />
  );
}
