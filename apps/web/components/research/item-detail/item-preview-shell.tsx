'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, Plus, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProviderBadge, getProviderConfig } from '../provider-badge';
import { ContentViewer } from './content-viewer';
import { useHeaderContent } from '@/lib/header-context';
import { toast } from 'sonner';

interface PreviewResult {
  title: string;
  url: string | null;
  snippet: string | null;
  providerId: string | null;
  externalId: string | null;
  relevanceScore: number | null;
  extractedName: string | null;
  extractedBirthDate: string | null;
  extractedDeathDate: string | null;
  extractedLocation: string | null;
}

interface ItemPreviewShellProps {
  result: PreviewResult;
}

export function ItemPreviewShell({ result }: ItemPreviewShellProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { setHeaderContent } = useHeaderContent();

  // Push breadcrumb into the app header bar
  useEffect(() => {
    setHeaderContent(
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm">
          <li>
            <Link href="/research" className="text-muted-foreground transition-colors hover:text-primary">
              Research
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3 text-muted-foreground" />
          </li>
          <li aria-current="page">
            <span className="truncate font-medium text-foreground">{result.title}</span>
          </li>
        </ol>
      </nav>
    );
    return () => setHeaderContent(null);
  }, [result.title, setHeaderContent]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/research/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          providerId: result.providerId,
          providerRecordId: result.externalId,
          discoveryMethod: 'search',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }

      const data = await res.json();
      toast.success('Saved to research items');
      router.push(`/research/item/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  const askAiPrompt = `Tell me more about this record: "${result.title}"${
    result.providerId ? ` from ${getProviderConfig(result.providerId).label}` : ''
  }${result.url ? `. URL: ${result.url}` : ''}`;

  const hasExtractedData = result.extractedName || result.extractedBirthDate || result.extractedDeathDate || result.extractedLocation;

  return (
    <div className="space-y-6">
      {/* Title + Badges */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold">{result.title}</h1>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {result.providerId && <ProviderBadge providerId={result.providerId} />}
            <Badge variant="outline" className="text-xs">Preview</Badge>
            {result.relevanceScore != null && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${result.relevanceScore * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(result.relevanceScore * 100)}% match
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-3.5" />
            Back to Research
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Save to Research
              </>
            )}
          </Button>
          {result.url && (
            <Button size="sm" variant="outline" asChild>
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                Open URL
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/research?askAi=${encodeURIComponent(askAiPrompt)}`}>
              <Sparkles className="size-3.5" />
              Ask AI
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border border-border/80 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
            {result.snippet ? (
              <p className="text-sm leading-relaxed text-foreground">{result.snippet}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No summary available.</p>
            )}
          </div>

          {/* Source Page & Extracted Text — reusable tabbed viewer */}
          <ContentViewer url={result.url} fullText={null}>
            {/* Save prompt */}
            <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
              <p className="text-sm font-medium text-foreground">Save this item to unlock more features</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Extract facts, add notes, link to people in your tree, and archive the full text.
              </p>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    Save to Research
                  </>
                )}
              </Button>
            </div>
          </ContentViewer>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Extracted data */}
          {hasExtractedData && (
            <div className="rounded-lg border border-border/80 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extracted Data
              </h3>
              <dl className="space-y-2 text-sm">
                {result.extractedName && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{result.extractedName}</dd>
                  </div>
                )}
                {result.extractedBirthDate && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Born</dt>
                    <dd className="font-medium">{result.extractedBirthDate}</dd>
                  </div>
                )}
                {result.extractedDeathDate && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Died</dt>
                    <dd className="font-medium">{result.extractedDeathDate}</dd>
                  </div>
                )}
                {result.extractedLocation && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">{result.extractedLocation}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Details */}
          <div className="rounded-lg border border-border/80 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>
            <dl className="space-y-2 text-sm">
              {result.providerId && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd><ProviderBadge providerId={result.providerId} /></dd>
                </div>
              )}
              {result.url && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">URL</dt>
                  <dd>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline max-w-[160px] truncate"
                    >
                      {(() => { try { return new URL(result.url).hostname; } catch { return result.url; } })()}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
