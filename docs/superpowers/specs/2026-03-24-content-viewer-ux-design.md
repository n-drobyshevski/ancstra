# ContentViewer Full UX Pass

**Date:** 2026-03-24
**Component:** `apps/web/components/research/item-detail/content-viewer.tsx`
**Consumers:** `item-content.tsx` (saved items), `item-preview-shell.tsx` (search preview)

## Problem

ContentViewer has several UX issues:

1. **Dark mode broken** — srcDoc iframe hardcodes `color:#333` and white background, creating a blinding white rectangle in dark mode
2. **Iframe block detection broken** — `onError` doesn't fire for X-Frame-Options/CSP blocks, leaving users with a blank iframe and no feedback
3. **No loading indicator** — Source Page iframe shows nothing while loading
4. **Bookmarklet always visible** — Takes vertical space even when irrelevant
5. **Empty state is passive** — "No content extracted yet" violates the Confident Guide style philosophy
6. **Resize not discoverable** — `resize-y` with no visual affordance
7. **No content metadata** — No word count or copy-all for extracted text
8. **Not composable** — Same UI for two different use cases (saved items vs preview)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Component architecture | Composable with slots | Two consumers have different needs; base component provides structure, consumers fill context-specific slots |
| Dark mode iframe | Pass theme from next-themes as prop, inject into srcDoc styles | App theme may differ from OS; srcDoc must always match app |
| Iframe block handling | Always-visible fallback bar (no detection) | Detection is fragile; honest UX shows alternatives proactively |
| Resize affordance | Drag bar with pill handle at bottom edge | Discoverable without being heavy; custom drag logic for smoother UX |
| Default toolbar | Built-in word count + copy-all, overridable via slot | Universally useful in both contexts; opt-out not opt-in |
| Empty state | Slot prop, each consumer provides its own | Saved items show scrape/paste; preview shows "save to unlock" |

## New Props Interface

```typescript
interface ContentViewerProps {
  url: string | null;
  fullText: string | null;

  /** Slot: replaces default empty state when fullText is null */
  emptyState?: React.ReactNode;

  /** Slot: fully replace the default toolbar (word count + copy all).
   *  Pass null to hide toolbar entirely. */
  toolbar?: React.ReactNode | null;

  /** Slot: extra buttons appended after the default toolbar actions.
   *  Ignored when toolbar is provided (full replacement). */
  toolbarExtra?: React.ReactNode;

  /** Slot: actions shown alongside the source iframe (e.g. reload button).
   *  Consumer manages its own state; ContentViewer just renders the node. */
  sourceActions?: React.ReactNode;

  /** Key to force-reload the source iframe. Consumer increments to trigger reload. */
  iframeKey?: number;

  /** Show the bookmarklet drag-to-bookmark-bar tip. Default false. */
  showBookmarklet?: boolean;

  /** Content below extracted text (kept from current API) */
  children?: React.ReactNode;
}
```

## Changes

### 1. Dark Mode srcDoc (CRITICAL)

- Read theme from `next-themes` using `useTheme()` inside ContentViewer
- Build two color sets: light (`color:#1e293b`, `background:#fff`, links `#4f46e5`) and dark (`color:#cbd5e1`, `background:hsl(222 20% 12%)`, links `hsl(265 60% 70%)`)
- Inject the active color set into the srcDoc `<style>` block at render time
- Do NOT key the iframe on theme — this destroys and recreates it, causing a flash. Instead, rebuild only the `srcDoc` string when theme changes. React will diff the attribute and update in place. If the browser still flickers on `srcDoc` change, use `postMessage` to inject a `<style>` override into the existing iframe as a fallback.
- Bump base font-size from 14px to 16px

### 2. Always-Visible Fallback Bar (CRITICAL)

Remove all iframe block detection (`iframeBlocked` state, `onError` handler, retry button, the dashed fallback box).

Replace with a persistent helper bar above the source iframe. Two variants:

When `showBookmarklet` is true:
```
Open in new tab ↗  ·  Use bookmarklet to capture text
```

When `showBookmarklet` is false (default):
```
Open in new tab ↗
```

- Always visible when Source Page tab is active
- "Open in new tab" links to `url`
- Clean single-link variant avoids the awkward "Can't see the page?" phrasing when there's no bookmarklet alternative to offer

### 3. Loading Spinner

- Show a centered spinner overlay on the iframe container
- Hide it on iframe `onLoad` event
- Spinner is purely visual feedback, not tied to error detection

### 4. Default Toolbar

Above the extracted text content area, a subtle bar:
- **Left:** word count (e.g., "1,247 words") — computed from `fullText`. When `fullText` contains HTML (detected by the existing `isHtml` regex), strip tags before counting words.
- **Right:** "Copy all" button
- Only shown when `fullText` is non-null
- If `toolbar` prop is provided, it replaces the default. If `toolbar={null}`, no toolbar.
- To extend the default toolbar rather than replace it, consumers can use `toolbarExtra?: React.ReactNode` (rendered after the default buttons). `toolbar` is full replacement; `toolbarExtra` is additive.

### 5. Drag Bar Resize

Replace native `resize-y` on iframe and text containers with a custom drag bar:
- 20px tall bar at the bottom edge with a centered 32px pill handle
- Subtle border-top separator
- `cursor: ns-resize` on the bar
- Custom `onPointerDown` drag logic that adjusts the container's height
- Min height constraint (128px), no max height constraint
- Extract the drag-resize logic into a reusable `useResizeHandle` hook (or a `<ResizablePanel>` wrapper) since both the iframe container and text container need it

### 6. Empty State as Slot

- Remove the hardcoded "No content extracted yet." message
- When `fullText` is null: render `emptyState` prop if provided, otherwise fall back to a minimal default: `"No text extracted yet."` (centered, muted). This prevents a blank void if a consumer forgets the prop.
- Each consumer should provide its own contextual empty state for a better UX

### 7. Bookmarklet Opt-In

- Move bookmarklet from always-on to `showBookmarklet` prop (default `false`)
- When true, show the bookmarklet tip in the fallback bar (Source Page tab) and as a collapsible tip below the content area
- `item-content.tsx` passes `showBookmarklet={true}`
- `item-preview-shell.tsx` passes nothing (defaults to false)

### 8. Cleanup

- Remove `iframeBlocked` state and `iframeKey` state
- **Keep** the `showPreview` lazy-mount gate — Radix TabsContent renders all children into the DOM (toggling `data-state`), so without this gate the external iframe would load immediately on mount even if the user never views the Source Page tab. The gate now triggers on tab switch via `onValueChange` (existing behavior). Alternatively, wrap the iframe in a component that checks the tab's `data-state` and only mounts when active.
- Remove the "Load Preview" / "Reload" button row — replaced by `sourceActions` slot
- `item-content.tsx` passes a reload button via `sourceActions`. The reload button increments an `iframeKey` managed by the consumer (not ContentViewer). ContentViewer accepts an optional `iframeKey?: number` prop to allow consumers to force-reload the iframe.

### 9. Bookmarklet Extraction

- Extract bookmarklet JS generation logic (current lines 23-38 of `content-viewer.tsx`) into a standalone `<BookmarkletTip />` component
- ContentViewer renders `<BookmarkletTip />` only when `showBookmarklet` is true
- This keeps ContentViewer focused on content viewing; the bookmarklet is an independent concern

## Consumer Updates

### item-content.tsx (saved items)

```tsx
<ContentViewer
  url={item.url}
  fullText={item.fullText}
  showBookmarklet={!!item.url}
  emptyState={
    // Note: ScrapeOrPastePrompt must handle the case where item.url is null
    // (no scrape button, only paste). The current conditional (!item.fullText && item.url)
    // moves inside the prompt component.
    <ScrapeOrPastePrompt url={item.url} itemId={item.id} />
  }
  sourceActions={<ReloadButton />}
  iframeKey={iframeKey}
>
  {/* children: additional content below extracted text */}
</ContentViewer>
```

### item-preview-shell.tsx (search preview)

```tsx
<ContentViewer
  url={result.url}
  fullText={null}
  emptyState={<SaveToUnlockCTA />}  // existing "Save to unlock" box
/>
```

## Files Modified

| File | Change |
|------|--------|
| `content-viewer.tsx` | Full rewrite: new props, dark mode, toolbar, drag bar, slots |
| `bookmarklet-tip.tsx` (new) | Extracted bookmarklet JS generation + drag-to-bookmark UI |
| `use-resize-handle.ts` (new) | Reusable hook for drag-bar resize logic |
| `item-content.tsx` | Update ContentViewer usage: pass emptyState, showBookmarklet, sourceActions, iframeKey |
| `item-preview-shell.tsx` | Update ContentViewer usage: pass emptyState |

## Out of Scope

- No changes to `item-notes-editor.tsx` (already has good UX patterns)
- No changes to the bookmarklet JS logic itself
- No changes to the tab structure (Source Page / Extracted Text tabs stay)
- No accessibility overhaul beyond what these changes naturally improve
