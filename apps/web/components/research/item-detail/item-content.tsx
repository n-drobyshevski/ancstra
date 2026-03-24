'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, ExternalLink, ClipboardPaste, X, RefreshCw, Bookmark, FileText, Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const { scrape, isLoading: scraping, error } = useScrapeUrl();
  const [scrapeAttempted, setScrapeAttempted] = useState(false);
  const [scrapeFailed, setScrapeFailed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
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

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (bookmarkletRef.current) {
      const origin = window.location.origin;
      const code = [
        // Find best content area — try specific selectors, fall back to body
        'var s="main,article,[role=main],#content,.content,#main-content,.main-content,[itemprop=mainEntity],[itemtype*=Person],[itemtype*=Article],.profile,.memorial,.biography,.record-detail"',
        'var e=document.querySelector(s)||document.body',
        'var c=e.cloneNode(true)',
        // Strip UI chrome aggressively
        'var r="script,style,link,nav,footer,header,aside,iframe,noscript,form,button,input,select,textarea,label,svg,[role=navigation],[role=banner],[role=dialog],[role=alertdialog],[role=search],.nav,.footer,.header,.sidebar,.modal,.dialog,.login,.signup,.cookie,.banner,.toolbar,.menu,.dropdown,.ad,.advertisement,.social-share,.share,.popup,.overlay,.toast,#cookie-banner,.gdpr,.consent"',
        'r.split(",").forEach(function(s){c.querySelectorAll(s).forEach(function(n){n.remove()})})',
        // Also remove hidden elements
        'c.querySelectorAll("[style*=\\"display:none\\"],.hidden,.d-none,[aria-hidden=true]").forEach(function(n){n.remove()})',
        // Open receiver and send
        `var w=window.open("${origin}/research/bookmarklet-receiver","_blank")`,
        'var d={type:"ancstra-bookmarklet",html:c.innerHTML,url:location.href,title:document.title}',
        'setTimeout(function(){w.postMessage(d,"*")},2000)',
      ].join(';');
      bookmarkletRef.current.setAttribute('href', `javascript:void(function(){${code}}())`);
    }
  }, []);

  const isHtml = item.fullText ? /<[a-z][\s\S]*>/i.test(item.fullText) : false;

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

      {/* Content & Preview — tabbed */}
      <div className="rounded-lg border border-border/80 p-4">
        <Tabs defaultValue={item.url ? 'preview' : 'content'} onValueChange={(v) => { if (v === 'preview' && !showPreview) setShowPreview(true); }}>
          <div className="mb-3 flex items-center justify-between">
            <TabsList>
              {item.url && (
                <TabsTrigger value="preview">
                  <Globe className="size-3.5" />
                  Source Page
                </TabsTrigger>
              )}
              <TabsTrigger value="content">
                <FileText className="size-3.5" />
                Extracted Text
              </TabsTrigger>
            </TabsList>

            {/* Actions — always visible */}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open in new tab
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {/* Content tab */}
          <TabsContent value="content">
            {item.fullText ? (
              <>
                {isHtml ? (
                  // Render sanitized HTML in a sandboxed iframe for visual fidelity
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0;padding:16px;max-width:100%}img{max-width:100%;height:auto;border-radius:4px}a{color:#4f46e5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}h1,h2,h3,h4{margin:0.8em 0 0.4em}p{margin:0.4em 0}ul,ol{padding-left:1.5em}.hidden,[style*="display:none"],[style*="display: none"]{display:none!important}</style></head><body>${item.fullText}</body></html>`}
                    title="Extracted content"
                    className="h-80 min-h-32 w-full resize-y overflow-auto rounded-md border border-border"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="h-48 min-h-20 resize-y overflow-auto rounded-md border border-border p-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {item.fullText}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
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
                    <div className="mt-3 flex items-center justify-center gap-2">
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
          </TabsContent>

          {/* Preview tab */}
          {item.url && (
            <TabsContent value="preview">
              <div className="space-y-3">
                {/* Preview controls */}
                <div className="flex items-center gap-2">
                  {!showPreview ? (
                    <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}>
                      <Globe className="size-3.5" />
                      Load Preview
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setIframeBlocked(false); setIframeKey((k) => k + 1); }}
                    >
                      <RefreshCw className="size-3.5" />
                      Reload
                    </Button>
                  )}
                </div>

                {/* Iframe */}
                {showPreview && (
                  <>
                    {iframeBlocked ? (
                      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30">
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
                          {' '}and use Paste Text on the Content tab.
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setIframeBlocked(false); setIframeKey((k) => k + 1); }}
                        >
                          <RefreshCw className="size-3.5" />
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <iframe
                        key={iframeKey}
                        src={item.url}
                        title="Page preview"
                        className="h-[28rem] min-h-32 w-full resize-y overflow-auto rounded-md border border-border"
                        sandbox="allow-scripts allow-same-origin"
                        onError={() => setIframeBlocked(true)}
                      />
                    )}
                  </>
                )}

                {/* Bookmarklet */}
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Drag this to your bookmark bar:{' '}
                    <a
                      ref={bookmarkletRef}
                      href="#"
                      suppressHydrationWarning
                      className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 font-medium text-primary ring-1 ring-border hover:ring-primary"
                      onClick={(e) => { e.preventDefault(); alert('Drag this link to your bookmark bar. Then click it on any page to send its text to Ancstra.'); }}
                    >
                      Send to Ancstra
                    </a>
                    {' '} — then click it on any page to capture its text.
                  </p>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

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
