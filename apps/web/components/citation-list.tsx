'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CitationForm } from '@/components/citation-form';
import { toast } from 'sonner';
import type { Citation } from '@ancstra/shared';

const confidenceBadge: Record<
  Citation['confidence'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  high: { label: 'High', variant: 'default' },
  medium: { label: 'Medium', variant: 'secondary' },
  low: { label: 'Low', variant: 'outline' },
  disputed: { label: 'Disputed', variant: 'destructive' },
};

interface CitationListProps {
  personId?: string;
  eventId?: string;
  familyId?: string;
  onUpdate?: () => void;
}

export function CitationList({ personId, eventId, familyId, onUpdate }: CitationListProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCitations = useCallback(async () => {
    const params = new URLSearchParams();
    if (personId) params.set('personId', personId);
    if (eventId) params.set('eventId', eventId);
    if (familyId) params.set('familyId', familyId);

    try {
      const res = await fetch(`/api/citations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCitations(Array.isArray(data) ? data : data.citations ?? []);
      }
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [personId, eventId, familyId]);

  useEffect(() => {
    fetchCitations();
  }, [fetchCitations]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this citation?')) return;

    try {
      const res = await fetch(`/api/citations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Citation deleted');
        fetchCitations();
        onUpdate?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to delete citation');
      }
    } catch {
      toast.error('Network error');
    }
  }

  function handleSaved() {
    setShowAdd(false);
    fetchCitations();
    onUpdate?.();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading citations...</p>;
  }

  return (
    <div className="space-y-2">
      {citations.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground">No citations</p>
      )}

      {citations.map((citation) => {
        const badge = confidenceBadge[citation.confidence];
        return (
          <div
            key={citation.id}
            className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {citation.source?.title ?? 'Unknown Source'}
                </span>
                <Badge variant={badge.variant} className="text-xs">
                  {badge.label}
                </Badge>
              </div>
              {citation.citationDetail && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {citation.citationDetail}
                </p>
              )}
              {citation.citationText && (
                <p className="mt-0.5 text-xs text-muted-foreground italic">
                  {citation.citationText}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDelete(citation.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
              title="Delete citation"
            >
              &times;
            </button>
          </div>
        );
      })}

      {showAdd ? (
        <CitationForm
          personId={personId}
          eventId={eventId}
          familyId={familyId}
          onSave={handleSaved}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
        >
          + Add Citation
        </Button>
      )}
    </div>
  );
}
