# ContentViewer Full UX Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ContentViewer into a composable, dark-mode-aware component with drag-bar resize, default toolbar, and always-visible iframe fallback.

**Architecture:** ContentViewer becomes a slot-based component. New files: `bookmarklet-tip.tsx` (extracted bookmarklet UI), `use-resize-handle.ts` (reusable drag-resize hook). Consumers (`item-content.tsx`, `item-preview-shell.tsx`) pass context-specific empty states and actions via props.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, Tailwind CSS v4, next-themes, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-24-content-viewer-ux-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/components/research/item-detail/use-resize-handle.ts` | Create | Reusable pointer-drag resize hook |
| `apps/web/components/research/item-detail/bookmarklet-tip.tsx` | Create | Bookmarklet JS generation + drag-to-bookmark UI |
| `apps/web/components/research/item-detail/content-viewer.tsx` | Rewrite | Composable tabbed viewer with slots, dark mode, toolbar, drag bar |
| `apps/web/components/research/item-detail/item-content.tsx` | Modify | Pass new props (emptyState, sourceActions, showBookmarklet, iframeKey) |
| `apps/web/components/research/item-detail/item-preview-shell.tsx` | Modify | Pass new props (emptyState), remove children usage |

All files in `apps/web/components/research/item-detail/`.

---

### Task 1: Create `useResizeHandle` hook

**Files:**
- Create: `apps/web/components/research/item-detail/use-resize-handle.ts`

This hook manages pointer-drag resize for a container. Both the iframe and text content areas will use it.

- [ ] **Step 1: Create the hook file**

```typescript
// apps/web/components/research/item-detail/use-resize-handle.ts
'use client';

import { useCallback, useRef, useState } from 'react';

const MIN_HEIGHT = 128;

interface UseResizeHandleOptions {
  /** Initial height in pixels. Default 320. */
  initialHeight?: number;
  /** Minimum height in pixels. Default 128. */
  minHeight?: number;
}

export function useResizeHandle(options: UseResizeHandleOptions = {}) {
  const { initialHeight = 320, minHeight = MIN_HEIGHT } = options;
  const [height, setHeight] = useState(initialHeight);
  const heightRef = useRef(initialHeight);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startY.current = e.clientY;
      startHeight.current = heightRef.current;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY.current;
        const newH = Math.max(minHeight, startHeight.current + delta);
        heightRef.current = newH;
        setHeight(newH);
      };

      const onPointerUp = () => {
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
      };

      target.addEventListener('pointermove', onPointerMove);
      target.addEventListener('pointerup', onPointerUp);
    },
    [minHeight],
  );

  return { height, onPointerDown };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `use-resize-handle.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/use-resize-handle.ts
git commit -m "feat(research): add useResizeHandle hook for drag-bar resize"
```

---

### Task 2: Extract `BookmarkletTip` component

**Files:**
- Create: `apps/web/components/research/item-detail/bookmarklet-tip.tsx`

Move the bookmarklet JS generation logic out of ContentViewer into its own component. The bookmarklet JS code is untouched — only the container moves.

- [ ] **Step 1: Create BookmarkletTip**

```tsx
// apps/web/components/research/item-detail/bookmarklet-tip.tsx
'use client';

import { useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

export function BookmarkletTip() {
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
      bookmarkletRef.current.setAttribute(
        'href',
        `javascript:void(function(){${code}}())`,
      );
    }
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
      <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        Drag this to your bookmark bar:{' '}
        <a
          ref={bookmarkletRef}
          href="#"
          suppressHydrationWarning
          className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 font-medium text-primary ring-1 ring-border hover:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            alert(
              'Drag this link to your bookmark bar. Then click it on any page to send its text to Ancstra.',
            );
          }}
        >
          Send to Ancstra
        </a>{' '}
        — then click it on any page to capture its text.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `bookmarklet-tip.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/bookmarklet-tip.tsx
git commit -m "refactor(research): extract BookmarkletTip from ContentViewer"
```

---

### Task 3: Rewrite `ContentViewer`

**Files:**
- Rewrite: `apps/web/components/research/item-detail/content-viewer.tsx`

This is the core task. Replace the entire file with the new composable component. Key changes:
- New props interface with slots (`emptyState`, `toolbar`, `toolbarExtra`, `sourceActions`, `iframeKey`, `showBookmarklet`)
- Dark mode srcDoc via `useTheme()` from next-themes
- Default toolbar (word count + copy all)
- Always-visible fallback bar (replaces broken onError detection)
- Loading spinner on source iframe
- Drag bar resize via `useResizeHandle`
- Lazy-mount gate kept for source iframe

**Important codebase notes for the implementer:**
- `next-themes` is already installed and `useTheme()` is used in `apps/web/components/mode-toggle.tsx` — follow that pattern
- Import paths use `@/components/...` alias (see existing imports in the current file)
- The project uses Tailwind CSS v4 — all standard utility classes work
- shadcn Tabs from `@/components/ui/tabs` — uses Radix under the hood, all `TabsContent` mounts into DOM by default

- [ ] **Step 1: Write the new ContentViewer**

Replace the entire contents of `apps/web/components/research/item-detail/content-viewer.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `content-viewer.tsx`. There WILL be errors in `item-content.tsx` and `item-preview-shell.tsx` because they still use the old props — that's expected and fixed in Tasks 4-5.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/content-viewer.tsx
git commit -m "feat(research): rewrite ContentViewer with composable slots, dark mode, toolbar, drag bar"
```

---

### Task 4: Update `item-content.tsx` consumer

**Files:**
- Modify: `apps/web/components/research/item-detail/item-content.tsx`

Move the scrape/paste UI from `children` to `emptyState` prop. Add `showBookmarklet`, `sourceActions`, and `iframeKey` props. The scrape/paste conditional (`!item.fullText && item.url`) is now handled by emptyState only rendering when `fullText` is null — but we still need the `item.url` check for the scrape button.

- [ ] **Step 1: Update the component**

Changes needed in `item-content.tsx`:

1. Add `iframeKey` state at the top of the component:
   ```tsx
   const [iframeKey, setIframeKey] = useState(0);
   ```

2. Replace the entire `<ContentViewer url={item.url} fullText={item.fullText}>...</ContentViewer>` JSX block and all its children with:

   ```tsx
   <ContentViewer
     url={item.url}
     fullText={item.fullText}
     showBookmarklet={!!item.url}
     iframeKey={iframeKey}
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
   ```

3. Add `RefreshCw` to the Lucide imports:
   ```tsx
   import { Loader2, ClipboardPaste, X, ChevronDown, RefreshCw } from 'lucide-react';
   ```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `item-content.tsx`. May still have errors in `item-preview-shell.tsx` — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/item-content.tsx
git commit -m "refactor(research): update ItemContent to use new ContentViewer slots"
```

---

### Task 5: Update `item-preview-shell.tsx` consumer

**Files:**
- Modify: `apps/web/components/research/item-detail/item-preview-shell.tsx`

Move the "Save to unlock" CTA from `children` to `emptyState` prop.

- [ ] **Step 1: Update the ContentViewer usage**

In `item-preview-shell.tsx`, replace the entire `<ContentViewer url={result.url} fullText={null}>...</ContentViewer>` JSX block and all its children with:

```tsx
<ContentViewer
  url={result.url}
  fullText={null}
  emptyState={
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
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
  }
/>
```

- [ ] **Step 2: Verify the full project compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean — zero type errors across all modified files.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/item-preview-shell.tsx
git commit -m "refactor(research): update ItemPreviewShell to use new ContentViewer emptyState"
```

---

### Task 6: Manual smoke test

No automated tests exist for these UI components (existing tests are API-level). Verify visually.

- [ ] **Step 1: Start the dev server**

Run: `cd apps/web && pnpm dev`

- [ ] **Step 2: Test saved item view (item-content)**

Navigate to a research item that has extracted text (e.g., `/research/item/<id>`).

Verify:
- [ ] Extracted Text tab shows toolbar with word count and "Copy all" button
- [ ] "Copy all" copies text to clipboard and shows checkmark
- [ ] Drag bar at bottom of content area is visible (pill handle)
- [ ] Dragging the bar resizes the content area; minimum height is ~128px
- [ ] Toggle dark mode (settings or mode toggle) — extracted HTML content adapts colors without flashing
- [ ] Source Page tab shows fallback bar with "Open in new tab" and bookmarklet reference
- [ ] Source Page iframe shows loading spinner, then content
- [ ] Reload button in source actions row works
- [ ] Bookmarklet tip appears below iframe

- [ ] **Step 3: Test saved item with no text**

Navigate to a research item that has NO extracted text but has a URL.

Verify:
- [ ] Extracted Text tab shows scrape/paste buttons (emptyState)
- [ ] Scrape and paste flows still work
- [ ] No toolbar shown (no content)

- [ ] **Step 4: Test preview shell**

Navigate to research, search for something, click a result to preview.

Verify:
- [ ] Extracted Text tab shows "Save to unlock" CTA (emptyState)
- [ ] Source Page tab works with iframe + fallback bar
- [ ] No bookmarklet tip (showBookmarklet defaults to false)
- [ ] No toolbar (no content)

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add -A && git commit -m "fix(research): smoke test fixes for ContentViewer UX"
```

Only commit if there were actual fixes. Skip if everything worked.
