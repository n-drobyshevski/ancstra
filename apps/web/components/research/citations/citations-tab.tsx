'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Trash2,
  FileText,
  Quote,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ShieldX,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Citation } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CitationForm } from '@/components/citation-form';

const CONFIDENCE_CONFIG: Record<
  Citation['confidence'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof ShieldCheck }
> = {
  high: { label: 'High', variant: 'default', icon: ShieldCheck },
  medium: { label: 'Medium', variant: 'secondary', icon: ShieldQuestion },
  low: { label: 'Low', variant: 'outline', icon: ShieldAlert },
  disputed: { label: 'Disputed', variant: 'destructive', icon: ShieldX },
};

interface CitationsTabProps {
  personId: string;
}

export function CitationsTab({ personId }: CitationsTabProps) {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/citations?personId=${encodeURIComponent(personId)}`);
      if (res.ok) {
        const data = await res.json();
        setCitations(Array.isArray(data) ? data : data.citations ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchCitations();
  }, [fetchCitations]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/citations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Citation deleted');
        fetchCitations();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to delete citation');
      }
    } catch {
      toast.error('Network error');
    }
  }

  function handleSaved() {
    fetchCitations();
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Citation list */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {citations.length} citation{citations.length !== 1 ? 's' : ''}
        </h2>

        {citations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            <BookOpen className="mb-3 size-10" />
            <p className="text-sm font-medium">No citations yet</p>
            <p className="mt-1 max-w-xs text-xs">
              Citations link this person to source documents. Use the form to add one.
            </p>
          </div>
        )}

        {citations.length > 0 && (
          <div className="space-y-2">
            {citations.map((citation) => (
              <CitationCard
                key={citation.id}
                citation={citation}
                onDelete={() => handleDelete(citation.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: Add citation form (always visible) */}
      <div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Citation</CardTitle>
          </CardHeader>
          <CardContent>
            <CitationForm
              personId={personId}
              onSave={handleSaved}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Citation Card ── */

function CitationCard({
  citation,
  onDelete,
}: {
  citation: Citation;
  onDelete: () => void;
}) {
  const conf = CONFIDENCE_CONFIG[citation.confidence];
  const ConfIcon = conf.icon;
  const sourceTitle = citation.source?.title ?? 'Unknown Source';
  const sourceType = citation.source?.sourceType;

  return (
    <div className="group relative rounded-lg border bg-card transition-colors hover:bg-muted/30">
      <div className="flex gap-3 px-4 py-3">
        {/* Left icon */}
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileText className="size-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Source title + confidence */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{sourceTitle}</span>
            <Badge variant={conf.variant} className="gap-1 text-[10px]">
              <ConfIcon className="size-2.5" />
              {conf.label}
            </Badge>
            {sourceType && (
              <span className="text-[10px] text-muted-foreground">
                {sourceType.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Citation detail */}
          {citation.citationDetail && (
            <p className="text-xs text-muted-foreground">
              {citation.citationDetail}
            </p>
          )}

          {/* Citation text */}
          {citation.citationText && (
            <div className="flex items-start gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5">
              <Quote className="mt-0.5 size-3 shrink-0 text-muted-foreground/60" />
              <p className="text-xs italic text-muted-foreground">
                {citation.citationText}
              </p>
            </div>
          )}
        </div>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete citation from ${sourceTitle}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete citation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the citation from &ldquo;{sourceTitle}&rdquo;. The source itself will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
