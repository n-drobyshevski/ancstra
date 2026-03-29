'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProviderBadge } from '../provider-badge';
import { DetailPanelFacts } from './detail-panel-facts';
import { DetailPanelActions } from './detail-panel-actions';

interface Fact {
  id: string;
  factType: string;
  factValue: string;
  confidence: string;
  researchItemId: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  status: string;
  providerId: string | null;
  notes: string | null;
  createdAt: string;
  personIds: string[];
}

interface DetailPanelProps {
  item: ResearchItem | null;
  facts: Fact[];
  personId: string;
  onDataChanged: () => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  promoted: {
    label: 'Source',
    className: 'bg-status-success-bg text-status-success-text',
  },
  draft: {
    label: 'Draft',
    className: 'bg-status-warning-bg text-status-warning-text',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-status-neutral-bg text-status-neutral-text',
  },
};

export function DetailPanel({ item, facts, personId, onDataChanged }: DetailPanelProps) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <FileText className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Select an item to view details.
        </p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[item.status] ?? STATUS_BADGE.draft;
  const itemFacts = facts.filter((f) => f.researchItemId === item.id);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Badge variant="outline" className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
          {item.providerId && <ProviderBadge providerId={item.providerId} />}
        </div>

        <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            {new URL(item.url).hostname}
          </a>
        )}
      </div>

      {/* Content preview */}
      {item.snippet && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Preview
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {item.snippet}
            </p>
          </div>
        </>
      )}

      <Separator />

      {/* Facts */}
      <DetailPanelFacts
        facts={itemFacts}
        itemId={item.id}
        personId={personId}
        snippetText={item.snippet}
        onFactsChanged={onDataChanged}
      />

      <Separator />

      {/* Actions */}
      <DetailPanelActions
        itemId={item.id}
        status={item.status}
        url={item.url}
        onStatusChanged={onDataChanged}
      />
    </div>
  );
}
