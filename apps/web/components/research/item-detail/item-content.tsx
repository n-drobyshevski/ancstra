'use client';

import { useState, useCallback, useRef } from 'react';
import { Loader2, ClipboardPaste, X, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemNotesEditor } from './item-notes-editor';
import { ContentViewer } from './content-viewer';
import { useScrapeUrl } from '@/lib/research/scrape-client';
import { toast } from 'sonner';
import { useFactExtraction } from '../extraction/use-fact-extraction';
import { useTextHighlighter } from '../extraction/use-text-highlighter';
import { FactContextMenu } from '../extraction/fact-context-menu';
import { FactPanel, FactPanelBadge } from '../extraction/fact-panel';

interface ItemContentProps {
  item: {
    id: string;
    title: string;
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
  onRefresh: () => Promise<{ fullText: string | null } | null>;
  onScrapeJobStarted: (jobId: string) => void;
  scrapeJobStatus: string | null;
  hideNotes?: boolean;
}

export function ItemContent({ item, onNotesChange, onRefresh, onScrapeJobStarted, scrapeJobStatus, hideNotes }: ItemContentProps) {
  const { scrape, isLoading: scraping, error } = useScrapeUrl();
  const [scrapeAttempted, setScrapeAttempted] = useState(false);
  const [scrapeFailed, setScrapeFailed] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // --- Fact extraction ---
  const extraction = useFactExtraction({
    researchItemId: item.id,
    researchItemTitle: item.title,
  });

  // Wire ref callbacks to the extraction hook's refs
  const handleSrcDocIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    (extraction.iframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el;
    if (el) extraction.attachIframeListeners();
  }, [extraction]);

  const handlePlainTextRef = useCallback((el: HTMLDivElement | null) => {
    (extraction.plainTextRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [extraction]);

  // Text highlighting for extracted facts
  useTextHighlighter(extraction.session.facts, extraction.iframeRef, extraction.plainTextRef);

  // Save handler: create factsheet + batch insert facts
  const handleSaveToFactsheet = useCallback(async () => {
    const { session } = extraction;
    if (session.facts.length === 0) return;

    try {
      // Create or reuse factsheet
      let factsheetId = session.factsheetId;
      if (!factsheetId) {
        const res = await fetch('/api/research/factsheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: session.factsheetTitle }),
        });
        if (!res.ok) throw new Error('Failed to create factsheet');
        const data = await res.json();
        factsheetId = data.id;
        extraction.setFactsheetId(factsheetId!);
      }

      // Batch create facts
      const factsPayload = session.facts.map((f) => ({
        factType: f.factType,
        factValue: f.factValue,
        confidence: f.confidence,
        factsheetId,
        researchItemId: session.researchItemId,
        extractionMethod: 'manual' as const,
      }));

      const res = await fetch('/api/research/facts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts: factsPayload }),
      });

      if (!res.ok) throw new Error('Failed to save facts');

      toast.success(`${session.facts.length} facts saved to factsheet`);
      extraction.clearAllFacts();
    } catch (err) {
      toast.error(String(err));
    }
  }, [extraction]);

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

  return (
    <div className="space-y-4">
      {/* Summary */}
      <details className="group rounded-lg border border-border/80" open>
        <summary className="flex cursor-pointer items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          {item.snippet ? (
            <p className="text-sm leading-relaxed text-foreground">{item.snippet}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No summary available.</p>
          )}
        </div>
      </details>

      {/* Content & Preview — reusable tabbed viewer + extraction panel */}
      <div className="flex gap-0 overflow-hidden rounded-lg border border-border/80">
      <div className="min-w-0 flex-1">
      <ContentViewer
        url={item.url}
        fullText={item.fullText}
        showBookmarklet={!!item.url}
        iframeKey={iframeKey}
        onSrcDocIframeRef={handleSrcDocIframeRef}
        onPlainTextRef={handlePlainTextRef}
        className=""
        sourceActions={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setIframeKey((k) => k + 1)}
          >
            <RefreshCw className="size-3" />
            Reload
          </Button>
        }
        emptyState={
          item.url ? (
            <div className="space-y-3 text-center">
              {scrapeFailed && (
                <p className="text-xs text-muted-foreground">
                  {error?.message ?? 'Could not extract text automatically. Try pasting text from the page instead.'}
                  {' '}
                  <a href="/settings" className="text-primary hover:underline">Configure scrape worker</a>
                </p>
              )}
              <div className="flex items-center justify-center gap-2">
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
            </div>
          ) : undefined
        }
      >
        {/* Paste text area — rendered as children (below content) */}
        {showPasteArea && (
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
      </ContentViewer>
      </div>

      {/* Fact extraction panel */}
      {extraction.panelVisible && (
        <FactPanel
          session={extraction.session}
          onRemoveFact={extraction.removeFact}
          onUpdateFact={extraction.updateDraftFact}
          onClearAll={extraction.clearAllFacts}
          onSave={handleSaveToFactsheet}
          onCollapse={() => extraction.setPanelVisible(false)}
          onTitleChange={extraction.updateFactsheetTitle}
          researchItemTitle={item.title}
        />
      )}
      </div>

      {/* Collapsed panel badge */}
      {!extraction.panelVisible && (
        <FactPanelBadge
          count={extraction.session.facts.length}
          onClick={() => extraction.setPanelVisible(true)}
        />
      )}

      {/* Context menu (portal to body) */}
      <FactContextMenu
        state={extraction.contextMenu}
        onSelect={extraction.addFact}
        onDismiss={extraction.dismissMenu}
      />

      {/* Notes */}
      {!hideNotes && (
        <div className="rounded-lg border border-border/80 p-4">
          <ItemNotesEditor
            itemId={item.id}
            initialNotes={item.notes}
            onNotesChange={onNotesChange}
          />
        </div>
      )}
    </div>
  );
}
