'use client';

import { useState, useMemo, useEffect } from 'react';
import { ExternalLink, FileText, Globe, Loader2, Copy, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookmarkletTip } from './bookmarklet-tip';
import { useResizeHandle } from './use-resize-handle';

// --- Helpers ---

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text: string, isHtml: boolean): number {
  const plain = isHtml ? stripHtmlTags(text) : text;
  const trimmed = plain.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function buildSrcDocStyles(theme: string | undefined): string {
  const isDark = theme === 'dark';
  return [
    'body{',
    '  font-family:system-ui,-apple-system,sans-serif;',
    '  font-size:16px;line-height:1.6;margin:0;padding:16px;max-width:100%;',
    `  color:${isDark ? '#cbd5e1' : '#1e293b'};`,
    `  background:${isDark ? 'hsl(222,20%,12%)' : '#fff'};`,
    '}',
    `a{color:${isDark ? 'hsl(265,60%,70%)' : '#4f46e5'}}`,
    'img{max-width:100%;height:auto;border-radius:4px}',
    'table{border-collapse:collapse;width:100%}',
    `td,th{border:1px solid ${isDark ? 'hsl(220,10%,25%)' : '#e5e7eb'};padding:6px 10px;text-align:left}`,
    'h1,h2,h3,h4{margin:0.8em 0 0.4em}',
    'p{margin:0.4em 0}',
    'ul,ol{padding-left:1.5em}',
    '.hidden,[style*="display:none"],[style*="display: none"]{display:none!important}',
  ].join('');
}

// --- Drag bar sub-component ---

function DragBar({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="flex h-5 cursor-ns-resize items-center justify-center border-t border-border/50 bg-muted/20"
    >
      <div className="h-[3px] w-8 rounded-full bg-border/60" />
    </div>
  );
}

// --- Default toolbar sub-component ---

function DefaultToolbar({
  wordCount,
  fullText,
  extra,
}: {
  wordCount: number;
  fullText: string;
  extra?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const isHtml = /<[a-z][\s\S]*>/i.test(fullText);

  async function handleCopy() {
    try {
      const text = isHtml ? stripHtmlTags(fullText) : fullText;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore if clipboard API not available
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-3 py-1">
      <span className="text-xs text-muted-foreground">
        {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
      </span>
      <div className="flex items-center gap-2">
        {extra}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="size-3 text-green-600" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
      </div>
    </div>
  );
}

// --- Props ---

interface ContentViewerProps {
  url: string | null;
  fullText: string | null;
  /** Slot: replaces default empty state when fullText is null */
  emptyState?: React.ReactNode;
  /** Slot: fully replace the default toolbar. Pass null to hide. */
  toolbar?: React.ReactNode | null;
  /** Slot: extra buttons appended after default toolbar actions. Ignored when toolbar is provided. */
  toolbarExtra?: React.ReactNode;
  /** Slot: actions shown alongside the source iframe */
  sourceActions?: React.ReactNode;
  /** Key to force-reload the source iframe. Consumer increments to trigger reload. */
  iframeKey?: number;
  /** Show the bookmarklet tip. Default false. */
  showBookmarklet?: boolean;
  /** Content below extracted text */
  children?: React.ReactNode;
}

// --- Main component ---

export function ContentViewer({
  url,
  fullText,
  emptyState,
  toolbar,
  toolbarExtra,
  sourceActions,
  iframeKey,
  showBookmarklet = false,
  children,
}: ContentViewerProps) {
  const { resolvedTheme } = useTheme();
  const [showPreview, setShowPreview] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Reset loading state when consumer triggers iframe reload
  useEffect(() => {
    if (iframeKey !== undefined) setIframeLoading(true);
  }, [iframeKey]);

  const contentResize = useResizeHandle({ initialHeight: 320 });
  const previewResize = useResizeHandle({ initialHeight: 448 });

  const isHtml = fullText ? /<[a-z][\s\S]*>/i.test(fullText) : false;

  const wordCount = useMemo(
    () => (fullText ? countWords(fullText, isHtml) : 0),
    [fullText, isHtml],
  );

  const srcDoc = useMemo(() => {
    if (!fullText || !isHtml) return '';
    const styles = buildSrcDocStyles(resolvedTheme);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body>${fullText}</body></html>`;
  }, [fullText, isHtml, resolvedTheme]);

  // Resolve toolbar: undefined = default, null = hidden, ReactNode = custom
  const showDefaultToolbar = toolbar === undefined && fullText;
  const showCustomToolbar = toolbar !== undefined && toolbar !== null;

  return (
    <div className="rounded-lg border border-border/80">
      <Tabs
        defaultValue={url ? 'preview' : 'content'}
        onValueChange={(v) => {
          if (v === 'preview' && !showPreview) setShowPreview(true);
        }}
      >
        {/* Tab header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
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
        </div>

        {/* ===== Extracted Text tab ===== */}
        <TabsContent value="content" className="mt-0">
          {/* Toolbar */}
          {showDefaultToolbar && (
            <DefaultToolbar
              wordCount={wordCount}
              fullText={fullText!}
              extra={toolbarExtra}
            />
          )}
          {showCustomToolbar && toolbar}

          {/* Content area */}
          {fullText ? (
            <div className="relative">
              {isHtml ? (
                <iframe
                  srcDoc={srcDoc}
                  title="Extracted content"
                  className="w-full overflow-auto border-0"
                  style={{ height: contentResize.height }}
                  sandbox="allow-same-origin"
                />
              ) : (
                <div
                  className="overflow-auto p-3"
                  style={{ height: contentResize.height }}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {fullText}
                  </p>
                </div>
              )}
              <DragBar onPointerDown={contentResize.onPointerDown} />
            </div>
          ) : (
            <div className="px-4 py-6">
              {emptyState ?? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    No text extracted yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Children slot (below content) */}
          {children && <div className="px-4 pb-4">{children}</div>}

          {/* Collapsible bookmarklet tip — visible on Extracted Text tab when opted in */}
          {showBookmarklet && (
            <details className="border-t border-border/50 px-4 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Bookmarklet: capture text from any page
              </summary>
              <div className="pt-2">
                <BookmarkletTip />
              </div>
            </details>
          )}
        </TabsContent>

        {/* ===== Source Page tab ===== */}
        {url && (
          <TabsContent value="preview" className="mt-0">
            {/* Fallback bar — always visible */}
            <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-1.5 text-xs">
              {sourceActions && (
                <div className="flex items-center gap-2">{sourceActions}</div>
              )}
              <div className="ml-auto flex items-center gap-2 text-muted-foreground">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open in new tab
                  <ExternalLink className="size-3" />
                </a>
                {showBookmarklet && (
                  <>
                    <span className="text-border">&middot;</span>
                    <span>Use bookmarklet to capture text</span>
                  </>
                )}
              </div>
            </div>

            {/* Iframe with loading spinner */}
            <div className="relative">
              {showPreview ? (
                <>
                  {iframeLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Loading preview...
                        </span>
                      </div>
                    </div>
                  )}
                  <iframe
                    key={iframeKey}
                    src={url}
                    title="Page preview"
                    className="w-full border-0"
                    style={{ height: previewResize.height }}
                    sandbox="allow-scripts allow-same-origin"
                    onLoad={() => setIframeLoading(false)}
                  />
                </>
              ) : (
                <div
                  className="flex items-center justify-center text-sm text-muted-foreground"
                  style={{ height: previewResize.height }}
                >
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}
              <DragBar onPointerDown={previewResize.onPointerDown} />
            </div>

            {/* Bookmarklet tip */}
            {showBookmarklet && (
              <div className="px-4 pb-4 pt-3">
                <BookmarkletTip />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
