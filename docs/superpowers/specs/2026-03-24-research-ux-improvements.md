# Research Page UX Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `/research` hub + `/research/person/[id]` workspace

---

## Overview

Seven coordinated improvements to the Research page that address information architecture confusion, visual identity gaps, and navigation deficiencies. All changes align with the Heritage Modern style philosophy and Indigo Heritage palette.

---

## 1. Universal Smart Input

**Problem:** Two separate inputs (search + URL paste) with an awkward "or paste a URL" divider fragment the experience.

**Solution:** Single `ResearchInput` component with auto-detection.

**Behavior:**
- Search icon (left), "Paste Text" pill button (right, inside input)
- "Paste Text" pill is hidden when input has a value — replaced by the existing clear (X) button. No overlap.
- When input is empty: subtle hint below — "Tip: paste any URL to auto-scrape it"
- If input matches `https?://` → URL mode: show a confirmation card **below** the input (same positioning as current `UrlPasteInput`) with "Scrape & Save" button. Reuses existing `useScrapeUrl` hook.
- Otherwise → debounce 300ms → fire search query (same as current `SearchBar`)
- `SourceSelector` button remains to the right of the input (unchanged)
- "Paste Text" pill opens the existing `TextPasteModal`

**Mobile:** Input and SourceSelector stack vertically below `sm` breakpoint. Hint text stays below.

**Accessibility:** Input uses `aria-label="Search records or paste a URL"`. Clear button uses `aria-label="Clear search"`. Paste Text pill uses `aria-label="Paste text from clipboard"`.

**Files:**
- New: `components/research/research-input.tsx`
- Delete: `components/research/search-bar.tsx`, `components/research/url-paste-input.tsx`
- Edit: `components/research/research-hub.tsx` (swap components, remove divider)

---

## 2. Provider-Colored Result Cards

**Problem:** All result cards look identical regardless of source. Relevance visualization is too small.

**Solution:** Color-coded left borders, grouped results, better data presentation.

**Provider color mapping (exact `providerId` strings):**
- `familysearch` → sage green (`--status-confirmed`)
- `nara` → blue (`--sex-male`)
- `chronicling_america` → burnished gold (`--accent`)
- `findagrave` → `oklch(0.60 0.12 180)` — new token `--provider-findagrave` added to design-system.md
- `web_search` → indigo (`--status-proposed`)
- `wikitree` → purple (`oklch(0.55 0.12 300)`) — new token `--provider-wikitree`
- Fallback → neutral (`--border`)

**Left border:** 3px `border-l` using the mapped color on each `SearchResultCard`.

**Grouping:**
- `SearchResults` groups results by `providerId` with collapsible header: provider icon + display name + result count
- All groups expanded by default
- Groups with only 1 result still show the header (for visual consistency)
- Group sort order: by count descending (most results first), then alphabetical
- Collapse/expand uses `aria-expanded` on the header button

**Relevance score:** Replace tiny 48px bar with a slightly larger horizontal bar (w-16 h-1.5) with percentage label already inline. Keep it simple — no circular arc (over-engineered for the data shown).

**Extracted data:** Name, Born, Died, Location rendered as inline `Badge variant="outline"` pills instead of cramped text spans.

**Files:**
- Edit: `components/research/search-result-card.tsx`
- Edit: `components/research/search-results.tsx` (grouping logic)
- Edit: `components/research/provider-badge.tsx` (add borderColor, icon per providerId)

---

## 3. AI Context Bridge

**Problem:** Search and AI Chat are completely isolated tabs with no shared context.

**Solution:** Keep tab structure, add context passing between them.

**Details:**
- Add "Ask AI" button to `SearchResultCard` footer (alongside Save and View), uses `Sparkles` icon
- Clicking it:
  1. Sets `pendingAiPrompt` in `ResearchLayout` state
  2. Switches `activeView` to `'chat'`
- `ResearchLayout` lifts state: `activeView` + `pendingAiPrompt: string | null` + `searchContext: { query: string; topResults: { title: string; providerId: string }[] } | null`
- `ResearchHub` receives `onAskAi(prompt: string)` callback and reports `onSearchContext(ctx)` whenever search results change
- Manual tab switch to AI Chat: `searchContext` is passed via `useChat`'s `body` field so the AI knows what the user was searching

**`ChatPanel` state lifecycle for `initialPrompt`:**
1. `ResearchLayout` passes `initialPrompt={pendingAiPrompt}` to `ChatPanel`
2. `ChatPanel` uses a `useEffect` watching `initialPrompt`: when it transitions from `null` → truthy string, call `append({ role: 'user', content: initialPrompt })`
3. After consuming, `ChatPanel` calls `onPromptConsumed()` callback which sets `pendingAiPrompt` back to `null` in `ResearchLayout`
4. This prevents re-sends on re-render or tab switching

**`ChatPanel` prop changes:** `focusPersonId` remains (used on workspace page). New props: `initialPrompt?: string | null`, `onPromptConsumed?: () => void`, `searchContext?: { query: string; topResults: ... } | null`

**Files:**
- Edit: `components/research/research-layout.tsx` (lift state, pass props)
- Edit: `components/research/search-result-card.tsx` (add Ask AI button, needs `onAskAi` prop)
- Edit: `components/research/chat-panel.tsx` (accept initialPrompt, onPromptConsumed, searchContext)
- Edit: `components/research/research-hub.tsx` (pass onAskAi callback, report searchContext)

---

## 4. Workspace Icon Tabs with Scroll

**Problem:** 7 text-only tabs risk overflow on narrow screens. No visual scannability.

**Solution:** Add Lucide icons, horizontal scroll with fade indicators.

**Icon mapping:**
- Board → `LayoutGrid`
- Matrix → `Table2`
- Conflicts → `GitCompareArrows`
- Timeline → `Clock`
- Canvas → `PenTool`
- Hints → `BookOpen`
- Proof → `FileText` (label shortened from "Proof Summary")

**Existing badges:** Conflict count (`Badge variant="destructive"`) and hint count (`Badge variant="secondary"`) remain, positioned after the label text, same as today. Icons go before the label.

**Scroll behavior:**
- Container: `overflow-x-auto` with hidden scrollbar (`scrollbar-width: none; -webkit-scrollbar: display none`)
- Fade indicators: 24px gradient pseudo-elements on left/right edges, from `bg-background` to transparent
- Only visible when content overflows (detect with `scrollWidth > clientWidth` via a `useRef` + `ResizeObserver`)
- All tabs: `whitespace-nowrap flex-shrink-0`
- Icon size: `size-3.5`

**Accessibility:** Container uses `role="tablist"`. Each tab button uses `role="tab"`, `aria-selected`. Arrow key navigation between tabs (left/right).

**Mobile:** Horizontal scroll is the mobile strategy — no layout change needed.

**Files:**
- Edit: `components/research/workspace/workspace-tabs.tsx`

---

## 5. Smart Saved Items Sidebar

**Problem:** Fixed 320px sidebar always visible during search, even when empty. Wastes horizontal space.

**Solution:** Conditional sidebar with collapse toggle.

**Behavior:**
- No saved items (`itemsData?.items.length === 0`) → full-width results (`grid-cols-1`). The empty-state dashed prompt is removed — discoverability comes from the "Save" button on each result card instead.
- Has saved items (≥1) → show sidebar (`grid-cols-[1fr_320px]`) unless user has collapsed it
- Collapse toggle button (chevron) at top of sidebar hides it
- Collapsed state persisted in `localStorage` (`ancstra:sidebar-collapsed`)
- When collapsed: floating badge in top-right of results area — "[N] saved" with bookmark icon. Clicking re-opens sidebar.

**Mobile:** Sidebar is desktop-only (`lg:` breakpoint). On mobile, saved items count shows in the header badge (already exists). No collapse toggle on mobile.

**Files:**
- Edit: `components/research/research-hub.tsx` (conditional grid, collapse state, localStorage)

---

## 6. Heritage Modern Visual Touches

**Problem:** Current UI is generic shadcn with no Heritage Modern personality.

**Solution:** CSS/class-level changes only — no structural modifications. These are **research-page-specific** refinements, not design system changes.

**Changes:**
- **Page title:** Stays `text-xl` (consistent with other pages) but gets `font-bold` (up from `font-semibold`) for stronger anchoring
- **Card warmth:** `border-border/80` with `shadow-sm` on hover (warm shadow per style-philosophy)
- **Active tab indicator:** `after:h-[2.5px] after:rounded-full` (thicker, rounded ends). Applied to both `ResearchLayout` and `WorkspaceTabs`
- **Accent gold CTA:** Empty state example buttons get `hover:border-accent/50`. "Scrape & Save" button uses accent color as primary — this is the single most important CTA per the style philosophy.
- **Interactive provider cards:** `hover:shadow-sm hover:border-primary/20` transition, cursor-pointer. Clicking pre-filters search to that provider.
- **Saved item cards:** `hover:shadow-sm` transition matching search result cards
- **Spacing:** Stays `space-y-6` (consistent with design system). No change.

**Files:**
- Edit: `components/research/research-hub.tsx`
- Edit: `components/research/search-result-card.tsx`
- Edit: `components/research/research-item-card.tsx` (add hover shadow)
- Edit: `components/research/research-layout.tsx`
- Edit: `components/research/workspace/workspace-tabs.tsx`

---

## 7. Breadcrumb Navigation

**Problem:** Navigating from `/research` to `/research/person/[id]` loses context. No way back except browser back button.

**Solution:** Breadcrumb component on the person workspace page.

**Structure:** `Research > [Person Name] > [Active Tab]`
- "Research" → links to `/research`
- Person name → static (current page)
- Active tab → non-link, current segment. Derived from `useSearchParams().get('view')` mapped through the `tabs` array in `workspace-tabs.tsx`. Default (no param) = "Board".
- Separator: `ChevronRight` (Lucide, size-3, muted-foreground)
- Positioned above the person header in `WorkspaceShell`
- Styling: `text-xs text-muted-foreground` for links, `text-foreground` for current. Links: `hover:text-primary`
- No breadcrumb on `/research` itself (top level)

**Accessibility:** Uses `<nav aria-label="Breadcrumb">` wrapping an `<ol>` with `<li>` per segment. Current page segment uses `aria-current="page"`.

**Mobile:** On narrow screens (<640px), breadcrumb truncates person name with ellipsis at `max-w-[120px]`.

**Files:**
- New: `components/research/breadcrumb.tsx`
- Edit: `components/research/workspace/workspace-shell.tsx` (add breadcrumb above header)

---

## Dependencies & Order

Changes are largely independent but share some files. Recommended implementation order:

1. **Heritage Modern touches** (#6) — foundation CSS that other changes build on
2. **Universal Smart Input** (#1) — biggest structural change to the hub
3. **Provider-Colored Cards** (#2) — builds on the new hub layout
4. **Smart Sidebar** (#5) — modifies the results grid in hub
5. **AI Context Bridge** (#3) — wires up cross-tab communication
6. **Workspace Icon Tabs** (#4) — independent, person page only
7. **Breadcrumbs** (#7) — independent, person page only

Items 6 and 7 can be parallelized. Items 1-5 share `research-hub.tsx` and benefit from sequential work.

---

## Design Token Additions

Two new provider-specific tokens to add to `design-system.md`:

```css
:root {
  --provider-findagrave: oklch(0.60 0.12 180);
  --provider-wikitree: oklch(0.55 0.12 300);
}
```

These follow the existing OKLCH-only convention. Existing semantic tokens (`--status-confirmed`, `--sex-male`, `--accent`, `--status-proposed`) are reused for the other providers — no new tokens needed for those.

---

## Out of Scope

- Slide-over AI panel (future evolution if context bridge proves limiting)
- Search history / recent searches
- Person-aware example searches (requires tree context in hub)
- Workspace tab reorganization (overflow menu, sidebar nav)
- Keyboard shortcut for forcing URL mode in universal input
- Editable AI prompt before auto-send (may revisit based on user feedback)
