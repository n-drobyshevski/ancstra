'use client';

import { useState } from 'react';
import { Check, X, RotateCcw, ExternalLink, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DetailPanelActionsProps {
  itemId: string;
  status: string;
  url: string | null;
  onStatusChanged: () => void;
}

export function DetailPanelActions({
  itemId,
  status,
  url,
  onStatusChanged,
}: DetailPanelActionsProps) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(newStatus: 'promoted' | 'dismissed' | 'draft') {
    setUpdating(true);
    try {
      const res = await fetch(`/api/research/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update');
      }

      toast.success(
        newStatus === 'promoted'
          ? 'Promoted to source'
          : newStatus === 'dismissed'
            ? 'Item dismissed'
            : 'Restored to draft',
      );
      onStatusChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Actions
      </h4>

      {status === 'draft' && (
        <div className="flex flex-col gap-1.5">
          <span title="Mark as a verified source for your research">
            <Button
              size="sm"
              onClick={() => updateStatus('promoted')}
              disabled={updating}
            >
              <Check className="size-3.5" />
              Promote to Source
            </Button>
          </span>
          <span title="Hide this item — you can restore it later">
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus('dismissed')}
              disabled={updating}
            >
              <X className="size-3.5" />
              Dismiss
            </Button>
          </span>
          {url && (
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Archive className="size-3.5" />
                View Archive
              </a>
            </Button>
          )}
        </div>
      )}

      {status === 'promoted' && url && (
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            View Source
          </a>
        </Button>
      )}

      {status === 'dismissed' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('draft')}
          disabled={updating}
        >
          <RotateCcw className="size-3.5" />
          Restore to Draft
        </Button>
      )}
    </div>
  );
}
