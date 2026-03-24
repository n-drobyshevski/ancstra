'use client';

import { useState, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Bookmark, FileText, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ContentViewerProps {
  url: string | null;
  fullText: string | null;
  /** Extra content to render below the extracted text (e.g. scrape buttons, paste area) */
  children?: React.ReactNode;
}

export function ContentViewer({ url, fullText, children }: ContentViewerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const isHtml = fullText ? /<[a-z][\s\S]*>/i.test(fullText) : false;

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (bookmarkletRef.current) {
      const origin = window.location.origin;
      const code = [
        'var s="main,article,[role=main],#content,.content,#main-content,.main-content,[itemprop=mainEntity],[itemtype*=Person],[itemtype*=Article],.profile,.memorial,.biography,.record-detail"',
        'var e=document.querySelector(s)||document.body',
        'var c=e.cloneNode(true)',
        'var r="script,style,link,nav,footer,header,aside,iframe,noscript,form,button,input,select,textarea,label,svg,[role=navigation],[role=banner],[role=dialog],[role=alertdialog],[role=search],.nav,.footer,.header,.sidebar,.modal,.dialog,.login,.signup,.cookie,.banner,.toolbar,.menu,.dropdown,.ad,.advertisement,.social-share,.share,.popup,.overlay,.toast,#cookie-banner,.gdpr,.consent"',
        'r.split(",").forEach(function(s){c.querySelectorAll(s).forEach(function(n){n.remove()})})',
        'c.querySelectorAll("[style*=\\"display:none\\"],.hidden,.d-none,[aria-hidden=true]").forEach(function(n){n.remove()})',
        `var w=window.open("${origin}/research/bookmarklet-receiver","_blank")`,
        'var d={type:"ancstra-bookmarklet",html:c.innerHTML,url:location.href,title:document.title}',
        'setTimeout(function(){w.postMessage(d,"*")},2000)',
      ].join(';');
      bookmarkletRef.current.setAttribute('href', `javascript:void(function(){${code}}())`);
    }
  }, []);

  return (
    <div className="rounded-lg border border-border/80 p-4">
      <Tabs defaultValue={url ? 'preview' : 'content'} onValueChange={(v) => { if (v === 'preview' && !showPreview) setShowPreview(true); }}>
        <div className="mb-3 flex items-center justify-between">
          <TabsList>
            {url && (
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

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open in new tab
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Extracted Text tab */}
        <TabsContent value="content">
          {fullText ? (
            isHtml ? (
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0;padding:16px;max-width:100%}img{max-width:100%;height:auto;border-radius:4px}a{color:#4f46e5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}h1,h2,h3,h4{margin:0.8em 0 0.4em}p{margin:0.4em 0}ul,ol{padding-left:1.5em}.hidden,[style*="display:none"],[style*="display: none"]{display:none!important}</style></head><body>${fullText}</body></html>`}
                title="Extracted content"
                className="h-80 min-h-32 w-full resize-y overflow-auto rounded-md border border-border"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="h-48 min-h-20 resize-y overflow-auto rounded-md border border-border p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {fullText}
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No content extracted yet.</p>
            </div>
          )}
          {children}
        </TabsContent>

        {/* Source Page tab */}
        {url && (
          <TabsContent value="preview">
            <div className="space-y-3">
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

              {showPreview && (
                <>
                  {iframeBlocked ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30">
                      <p className="text-sm text-muted-foreground">
                        This site cannot be previewed inline.{' '}
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Open in new tab
                        </a>
                        {' '}and use the bookmarklet or Paste Text.
                      </p>
                      <Button size="sm" variant="ghost" onClick={() => { setIframeBlocked(false); setIframeKey((k) => k + 1); }}>
                        <RefreshCw className="size-3.5" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <iframe
                      key={iframeKey}
                      src={url}
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
  );
}
