# Research Item Detail Page — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** New full-page detail view for saved research items

---

## Overview

Clicking a saved research item card on the `/research` hub navigates to a dedicated full-page detail view at `/research/item/[id]`. The page shows all available data for the item in a two-column document layout: main content (summary, full text, notes) on the left, metadata and relationships (extracted facts, linked people, details) on the right.

---

## 1. Routing & Navigation

**Route:** `apps/web/app/(auth)/research/item/[id]/page.tsx`

- Server component fetches research item by ID with auth context
- Returns `notFound()` if item doesn't exist
- Passes full item object to client `ItemDetailShell`

**Breadcrumb:** `Research > [Item Title]`
- "Research" links to `/research`
- Item title is the current page (non-link, `text-foreground`, truncated with `max-w-[200px]` on mobile)
- Uses same breadcrumb pattern as person workspace (`<nav aria-label="Breadcrumb">` with `<ol>`)

**Card navigation:** `ResearchItemCard` wraps card content in `<Link href={/research/item/${item.id}}>`. Action buttons (Promote/Dismiss) use `e.stopPropagation()` and `e.preventDefault()` to prevent navigation when clicking actions.

**Loading state:** `loading.tsx` skeleton with header placeholder + two-column grid of skeleton cards.

---

## 2. Page Layout

**Two-column grid:** `lg:grid-cols-[1fr_320px]`, collapses to `grid-cols-1` on mobile.

### Header (full width, above the grid)

- Breadcrumb component
- Title: `text-xl font-bold`
- Metadata chips row: provider badge, status badge, discovery method badge, created date
- Action buttons row:
  - **Promote** (or **Restore** if dismissed) — accent color, primary CTA
  - **Dismiss** — outline variant
  - **Open URL** — outline, only when `url` is set, opens in new tab
  - **Ask AI** — ghost variant with Sparkles icon. Navigates to `/research` and programmatically triggers the AI Chat tab with a pre-filled prompt: `"Tell me more about this record: [title] from [provider]. URL: [url]"`. Implementation: navigate with query param `?askAi=<encoded prompt>`, `ResearchLayout` reads this on mount and calls `handleAskAi(prompt)`.
  - **Delete** — destructive variant, positioned right with separator gap, requires confirmation dialog

### Main Column (left)

1. **Summary card** — displays `snippet` field. Always visible. If no snippet, shows muted "No summary available."

2. **Full Text card** — displays `fullText` field. Collapsed by default showing first ~200 characters with a "Show more" toggle that expands to full content. If no `fullText`, shows "No full text available" with a "Scrape URL" button (calls existing scrape endpoint, only when `url` is set).

3. **Notes card** — inline-editable textarea (`ItemNotesEditor` component). Shows "Click to add research notes..." placeholder when empty. Auto-saves on blur via PATCH to `/api/research/items/[id]`. Debounced (500ms), with subtle "Saving..." / "Saved" status indicator.

### Sidebar (right)

1. **Extracted Facts card** — list of facts fetched via `/api/research/facts?researchItemId=[id]`. Each row: fact type label (formatted, e.g. "Birth Date") + fact value + confidence badge. Confidence colors: high → `Badge variant="default"` (primary), medium → `Badge variant="secondary"`, low → `Badge variant="outline"`, disputed → `Badge variant="destructive"`. Footer: "+ Extract more facts" button triggers POST to `/api/research/facts/extract` with the item's content. Empty state: "No facts extracted yet" with extract button.

2. **Linked People card** — list of persons from `personIds`. Each shows person name as a link to `/research/person/[id]`. Footer: "+ Link to person" button opens a search/select popover (text input that searches persons in the tree, click to link). Empty state: "No people linked yet" with link button.

3. **Details card** — metadata key-value pairs:
   - Provider (with badge)
   - Discovery method (search / scrape / paste_url / paste_text / ai_suggestion)
   - Search query (if any, shown as muted text)
   - Archived status (Yes/No + date if archived)
   - Original URL (truncated, clickable)
   - Created date
   - Last updated date

**Mobile:** Single column. Sidebar sections stack below main content. Action buttons wrap into a flex-wrap row.

---

## 3. Data Fetching & State

**Server-side (page.tsx):**
- Fetch research item by ID using `createFamilyDb(authContext.dbFilename)` — same pattern as `research/person/[id]/page.tsx`. Tenant isolation is at the database level (per-family DB), not row-level filtering.
- Call `getResearchItem(db, id)` from `@ancstra/research` to get the item + personIds
- If not found → `notFound()`

**Client-side hooks:**
- `useResearchItemFacts(itemId)` — new hook in `lib/research/evidence-client.ts`. Calls `GET /api/research/facts?researchItemId=[id]`. Returns `{ facts, isLoading, refetch }`.
- Notes editing: local `useState` + debounced `fetch` PATCH on blur. On save failure, show "Failed to save" indicator with retry. Notes do NOT revert on error (preserve user's typed content).
- Status changes: direct `fetch` PATCH with optimistic UI update, revert + toast on error
- Person linking: use existing `tagPersonToItem`/`untagPersonFromItem` functions via the existing `POST /api/research/items/[id]/persons` endpoint. The person search popover calls `GET /api/persons?q=[search]` (debounced 300ms, max 10 results) to find persons in the tree.
- Fact extraction: POST to `/api/research/facts/extract` with `{ text: item.fullText || item.snippet }`. Note: this endpoint currently returns a 501 stub — the "Extract facts" button should be disabled with tooltip "Coming soon" until the AI extraction is implemented. The UI wiring should be in place for when it's enabled.
- Re-scrape: "Scrape URL" button (shown when `fullText` is null and `url` is set) calls `POST /api/research/scrape` with `{ url: item.url }`, then refetches the item to pick up the new `fullText`/`snippet`.

**After delete:** Navigate to `/research` via `router.push('/research')`.

**Existing endpoints used:**
- `GET /api/research/items/[id]` — fetch item
- `PATCH /api/research/items/[id]` — update status, notes
- `DELETE /api/research/items/[id]` — delete item
- `POST /api/research/items/[id]/persons` — link person (existing)
- `DELETE /api/research/items/[id]/persons` — unlink person (existing, pass personId in body)
- `GET /api/research/facts?researchItemId=[id]` — facts for item
- `POST /api/research/facts/extract` — AI fact extraction (stubbed)
- `POST /api/research/scrape` — re-scrape URL for full text

---

## 4. Component Structure

**New files:**

| File | Responsibility |
|------|---------------|
| `apps/web/app/(auth)/research/item/[id]/page.tsx` | Server component, data fetch, auth |
| `apps/web/app/(auth)/research/item/[id]/loading.tsx` | Skeleton loading state |
| `apps/web/app/(auth)/research/item/[id]/error.tsx` | Error boundary — shows error message with "Go back to Research" link |
| `components/research/item-detail/item-detail-shell.tsx` | Client shell, two-column grid, state coordination |
| `components/research/item-detail/item-header.tsx` | Breadcrumb + title + badges + actions |
| `components/research/item-detail/item-content.tsx` | Main column: summary, full text, notes |
| `components/research/item-detail/item-sidebar.tsx` | Sidebar: facts, linked people, details |
| `components/research/item-detail/item-notes-editor.tsx` | Inline-editable notes with debounced auto-save |

**Modified files:**

| File | Change |
|------|--------|
| `components/research/research-item-card.tsx` | Wrap in `<Link>`, add `e.stopPropagation()` + `e.preventDefault()` to ALL button `onClick` handlers (Promote, Dismiss, Restore) |
| `lib/research/evidence-client.ts` | Add `useResearchItemFacts(itemId)` hook |
| `lib/research/constants.ts` | New: extract `STATUS_CONFIG` from `research-item-card.tsx` into shared module so both the card and detail page can reference it |

---

## 5. Accessibility

- Breadcrumb: `<nav aria-label="Breadcrumb">` with `<ol>` and `aria-current="page"`
- Action buttons: all have visible text labels (not icon-only)
- Delete confirmation: focus trapped in dialog, Escape to dismiss
- Notes editor: `<textarea>` with `aria-label="Research notes"`, save status announced via `aria-live="polite"` region
- Full text toggle: "Show more" / "Show less" button with `aria-expanded`
- Collapsible sections: not collapsed by default on the detail page (everything visible, scrollable)
- Keyboard: all interactive elements reachable via Tab, action buttons have focus-visible rings

---

## 6. Heritage Modern Alignment

- Cards use `border-border/80` with `shadow-sm` on hover (consistent with hub cards)
- Single primary CTA per view: Promote button uses accent color, all others are outline/ghost
- Status badges reuse existing `STATUS_CONFIG` colors from `research-item-card.tsx`
- Provider badges reuse `ProviderBadge` and `getProviderConfig` from `provider-badge.tsx`
- Page title: `text-xl font-bold` (matching hub page)
- Tab indicator style not applicable (no tabs on this page)
- Spacing: `space-y-6` between major sections (consistent with design system)

---

## Out of Scope

- Screenshot preview / archived HTML viewer (future feature)
- Inline fact editing (facts are read-only here; edit in the person workspace matrix)
- Drag-and-drop person linking
- Side-by-side comparison of multiple items
- Print / export view
