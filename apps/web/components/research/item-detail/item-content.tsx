'use client';

import { useState, useCallback, useRef } from 'react';
import { Loader2, ExternalLink, ClipboardPaste, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemNotesEditor } from './item-notes-editor';
import { useScrapeUrl } from '@/lib/research/scrape-client';
import { toast } from 'sonner';

interface ItemContentProps {
  item: {
    id: string;
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
  onRefresh: () => Promise<{ fullText: string | null } | null>;
  onScrapeJobStarted: (jobId: string) => void;
  scrapeJobStatus: string | null;
}

export function ItemContent({ item, onNotesChange, onRefresh, onScrapeJobStarted, scrapeJobStatus }: ItemContentProps) {
  const [expanded, setExpanded] = useState(false);
  const { scrape, isLoading: scraping, error } = useScrapeUrl();
  const [scrapeAttempted, setScrapeAttempted] = useState(false);
  const [scrapeFailed, setScrapeFailed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScrape = useCallback(async () => {
    if (!item.url) return;
    setScrapeFailed(false);
    const result = await scrape(item.url, { itemId: item.id });
    if (!result) {
      setScrapeAttempted(true);
      setScrapeFailed(true);
      return;
    }

    if (result.jobId) {
      onScrapeJobStarted(result.jobId);
      return;
    }

    setScrapeAttempted(true);
    if (result.status === 'completed') {
      const updated = await onRefresh();
      if (!updated?.fullText) {
        setScrapeFailed(true);
      }
    } else {
      setScrapeFailed(true);
    }
  }, [item.url, item.id, scrape, onRefresh, onScrapeJobStarted]);

  const handleSavePastedText = useCallback(async () => {
    if (!pasteText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullText: pasteText.trim() }),
      });
      if (res.ok) {
        await onRefresh();
        setShowPasteArea(false);
        setPasteText('');
        toast.success('Full text saved');
      }
    } catch {
      toast.error('Failed to save text');
    } finally {
      setSaving(false);
    }
  }, [pasteText, item.id, onRefresh]);

  const isActivelyScraping = scraping || scrapeJobStatus === 'pending' || scrapeJobStatus === 'processing';

  const fullTextPreview = item.fullText
    ? item.fullText.length > 200
      ? item.fullText.slice(0, 200) + '...'
      : item.fullText
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
        {item.snippet ? (
          <p className="text-sm leading-relaxed text-foreground">{item.snippet}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No summary available.</p>
        )}
      </div>

      {/* Full Text */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Text</h3>
        {item.fullText ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {expanded ? item.fullText : fullTextPreview}
            </p>
            {item.fullText.length > 200 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-sm text-primary hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No full text available.</p>
            {item.url && (
              <>
                {scrapeFailed && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error?.message ?? 'Could not extract text automatically. Try pasting text from the page instead.'}
                    {' '}
                    <a href="/settings" className="text-primary hover:underline">Configure scrape worker</a>
                  </p>
                )}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleScrape}
                    disabled={isActivelyScraping}
                  >
                    {isActivelyScraping ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Scraping...
                      </>
                    ) : scrapeAttempted ? (
                      'Retry Scrape'
                    ) : (
                      'Scrape URL'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowPasteArea(true);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                  >
                    <ClipboardPaste className="size-3.5" />
                    Paste Text
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Paste text area */}
        {showPasteArea && !item.fullText && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Open the URL, copy the page text, and paste it here.
              </p>
              <button
                type="button"
                onClick={() => { setShowPasteArea(false); setPasteText(''); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste page text here..."
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={6}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {pasteText.length > 0 ? `${pasteText.length.toLocaleString()} characters` : ''}
              </span>
              <Button
                size="sm"
                onClick={handleSavePastedText}
                disabled={!pasteText.trim() || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Text'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Page Preview */}
      {item.url && !item.fullText && (
        <div className="rounded-lg border border-border/80 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Preview</h3>
            <div className="flex items-center gap-2">
              {!showPreview && (
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(true)}>
                  Load Preview
                </Button>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open in new tab
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
          {showPreview && (
            <div className="mt-3">
              {iframeBlocked ? (
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    This site cannot be previewed inline.{' '}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Open in new tab
                    </a>
                    {' '}and use Paste Text above.
                  </p>
                </div>
              ) : (
                <iframe
                  src={item.url}
                  title="Page preview"
                  className="h-96 w-full rounded-md border border-border"
                  sandbox="allow-scripts allow-same-origin"
                  onError={() => setIframeBlocked(true)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="rounded-lg border border-border/80 p-4">
        <ItemNotesEditor
          itemId={item.id}
          initialNotes={item.notes}
          onNotesChange={onNotesChange}
        />
      </div>
    </div>
  );
}
