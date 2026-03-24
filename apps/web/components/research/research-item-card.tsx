'use client';

import { useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { STATUS_CONFIG } from '@/lib/research/constants';

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

interface ResearchItemCardProps {
  item: ResearchItem;
  onUpdated?: () => void;
}

export function ResearchItemCard({ item, onUpdated }: ResearchItemCardProps) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(newStatus: 'promoted' | 'dismissed' | 'draft') {
    setUpdating(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, {
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
          ? 'Item promoted'
          : newStatus === 'dismissed'
            ? 'Item dismissed'
            : 'Item restored'
      );
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }

  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const snippet =
    item.snippet && item.snippet.length > 150
      ? item.snippet.slice(0, 150) + '...'
      : item.snippet;

  return (
    <Card size="sm" className="transition-shadow hover:shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-snug">{item.title}</h4>
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      {snippet && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{snippet}</p>
        </CardContent>
      )}
      <CardFooter className="flex gap-1">
        {item.status === 'draft' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus('promoted')}
              disabled={updating}
            >
              <Check className="size-3.5" />
              Promote
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateStatus('dismissed')}
              disabled={updating}
            >
              <X className="size-3.5" />
              Dismiss
            </Button>
          </>
        )}
        {item.status === 'dismissed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus('draft')}
            disabled={updating}
          >
            <RotateCcw className="size-3.5" />
            Restore
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
