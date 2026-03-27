# Factsheet Page — Mobile Responsive Design

> **Status:** Design approved
> **Date:** 2026-03-27
> **Scope:** Mobile adaptation of `/research/factsheets` page for screens < 768px
> **Dependencies:** factsheet-page-design (2026-03-27)

## Context

The factsheet page was built with a desktop-first 2-column layout (280px sidebar + 1fr main). On mobile, this doesn't work — the sidebar is too narrow to be useful alongside the main area, and the graph view requires pointer interactions (drag, hover) that don't translate well to touch. This spec adapts the page for mobile screens while preserving full functionality for list browsing, detail viewing, and batch operations.

## Design Decisions

1. **Graph view hidden on mobile** — force-directed canvases need pointer drag/hover. Not worth the complexity for touch.
2. **Navigation push pattern** — list → detail slide transition, matching iOS/Android conventions and the existing per-person tab behavior.
3. **Long-press for batch selection** — native mobile gesture (like photo gallery selection), replaces the desktop batch actions bar.
4. **Collapsible stats bar** — saves vertical space on small screens while keeping pipeline health accessible.

## Breakpoint

All changes apply below `md` (768px). Above `md`, behavior is unchanged.

## Navigation Flow

```
[List View]  ──tap card──>  [Detail View]  ──back button──>  [List View]
```

- The `?fs=<id>` URL param controls which view is shown on mobile:
  - `?fs` absent or empty → show list view (full screen)
  - `?fs=<id>` present → show detail view (full screen)
- Back button clears `?fs` param, returning to list
- The Detail/Graph toggle is **hidden** on mobile (`hidden md:flex` on the toggle container)
- View always defaults to `detail` on mobile regardless of `?view` param

### Slide Transition

- Detail slides in from the right when a factsheet is selected
- Use CSS transition: `transform 200ms ease-out`
- Implementation: conditionally render list or detail based on `selectedId` presence, with `translate-x` animation
- V1 implementation: simple conditional swap (no animation). Slide animation is a polish item for later — the conditional render approach is simpler and avoids mounting both views simultaneously.

## Stats Bar — Condensed Mode

### Desktop (≥ 768px) — unchanged
4-column grid: Total | Draft | Ready | Conflicts

### Mobile (< 768px) — condensed row
Single line showing key numbers inline:

```
12 factsheets · 5 draft · 2 conflicts     [v]
```

- Format: `{total} factsheets · {draft} draft · {conflicts} conflicts`
- Ready count omitted from condensed view (less critical, saves space)
- Chevron icon (`ChevronDown` / `ChevronUp`) at right edge indicates expandability
- **Tap** toggles expansion → shows the full 4-column grid below the condensed row
- Expansion state is component-local (not persisted)

### Component Changes — `factsheet-stats-bar.tsx`

Add an `isExpanded` state and a `useMediaQuery` or Tailwind responsive classes:

```
<div className="border-b border-border px-3 py-2">
  {/* Condensed row — visible only on mobile */}
  <div className="flex md:hidden items-center justify-between cursor-pointer"
       onClick={toggle}>
    <span className="text-xs text-muted-foreground">
      {total} factsheets · {draft} draft · {conflicts} conflicts
    </span>
    <ChevronDown/ChevronUp icon />
  </div>

  {/* Full grid — always visible on desktop, conditionally on mobile */}
  <div className={cn("grid grid-cols-4 gap-2 text-center",
                      "hidden md:grid",           // always on desktop
                      isExpanded && "!grid mt-2"   // show on mobile when expanded
  )}>
    ...existing stats cells...
  </div>
</div>
```

## List View — Mobile Full Screen

On mobile, the sidebar becomes the full-screen list view.

### Layout
- Full viewport width, no `border-right`
- Stats bar (condensed) at top
- Search input + filter pills (same markup, wraps naturally at small widths)
- List header: "Factsheets (N)" + "+ New" button
- Scrollable card list fills remaining height
- No batch actions bar visible by default (appears via long-press)

### Component Changes — `factsheet-sidebar.tsx`

- Remove `border-r` on mobile: `border-r md:border-r border-border` → `md:border-r border-border`
- On mobile, the sidebar IS the page — shown when `selectedId` is null
- Hidden when `selectedId` is present (detail view takes over)

### Component Changes — `factsheets-layout.tsx`

Replace the 2-column grid with responsive logic:

```tsx
// Mobile: show list OR detail (not both)
// Desktop: show both in grid

<div className="h-full overflow-hidden rounded-lg border border-border">
  {/* Desktop: 2-column grid */}
  <div className="hidden md:grid md:grid-cols-[280px_1fr] h-full">
    <FactsheetSidebar ... />
    <MainArea ... />
  </div>

  {/* Mobile: conditional render */}
  <div className="md:hidden h-full">
    {selectedId ? (
      <MobileDetailView ... />
    ) : (
      <FactsheetSidebar ... />
    )}
  </div>
</div>
```

## Detail View — Mobile Full Screen

### Top Bar
- Left: back arrow button (`ArrowLeft` icon) → clears `?fs` param
- Center: factsheet title (truncated with `line-clamp-1`)
- Right: status badge + overflow menu (⋯)

```
[←]  John H. Smith          [Draft] [⋯]
```

- Height: `h-12` (48px, meets touch target minimum)
- Border bottom: `border-b border-border`

### Content
- Full-width scrollable area below the top bar
- Renders `FactsheetDetail` component with no changes (already full-width capable)
- No Detail/Graph toggle visible

### Component — `MobileDetailHeader`

New lightweight component (or inline in layout):

```tsx
<div className="flex items-center gap-2 border-b border-border px-3 h-12">
  <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-md hover:bg-muted">
    <ArrowLeft className="size-4" />
  </button>
  <span className="flex-1 text-sm font-semibold truncate">{title}</span>
  <StatusBadge />
  <OverflowMenu />
</div>
```

## Batch Selection — Long-Press

### Activation
- **Long-press** (500ms hold) on any factsheet card enters selection mode
- The long-pressed card is auto-selected (checked)
- All cards show checkboxes (existing `isSelectable` pattern)

### Selection Mode UI
- Cards show checkboxes, tapping toggles selection (doesn't navigate)
- **Floating action bar** appears at bottom of screen:
  ```
  ┌──────────────────────────────────┐
  │  [Cancel]   3 selected   [Done] │
  │  [Dismiss]              [Link]  │
  └──────────────────────────────────┘
  ```
  - Top row: Cancel (exits mode), count, Done (exits mode)
  - Bottom row: Dismiss (batch dismiss selected), Link (batch link selected)
  - Fixed position: `fixed bottom-0 left-0 right-0` with `pb-safe` for home indicator
  - Background: `bg-background border-t border-border shadow-lg`
  - Slides up from bottom with `translate-y` animation

### Deactivation
- Tap "Cancel" or "Done" → exit selection mode, clear selections
- After batch action completes → auto-exit selection mode

### Component Changes — `factsheet-card.tsx`

Add `onLongPress` prop:

```ts
interface FactsheetCardProps {
  // ...existing props...
  onLongPress?: () => void;
}
```

Implementation: use `onPointerDown` + `setTimeout(500ms)` + `onPointerUp` cancel pattern. Clear timeout on pointer up/leave/cancel. Call `onLongPress` if timer fires.

### Component Changes — `batch-actions-bar.tsx`

Add mobile variant:

- Desktop: inline bar at bottom of sidebar (existing)
- Mobile: floating fixed-position bar with Cancel/Done + action buttons
- Use `md:` responsive classes to switch between variants

## Component Summary

| Component | Mobile Change |
|-----------|--------------|
| `factsheets-layout.tsx` | Show list OR detail (not both). Hide graph toggle. Add mobile detail header with back button. |
| `factsheet-stats-bar.tsx` | Condensed single-line row with tap-to-expand on mobile. |
| `factsheet-sidebar.tsx` | Full-width on mobile. No right border. Hidden when detail is shown. Long-press activates batch mode. |
| `factsheet-card.tsx` | Add `onLongPress` prop with 500ms timer. |
| `batch-actions-bar.tsx` | Mobile: floating bottom bar with Cancel/Done + actions. Desktop: unchanged. |
| `factsheet-graph-view.tsx` | No changes — parent hides it on mobile. |

## Accessibility

- Back button: `aria-label="Back to factsheet list"`
- Long-press: provide alternative — the "Select" text button (already exists in sidebar header) also activates batch mode on mobile
- Floating bar: `role="toolbar"` with `aria-label="Batch actions"`
- Selection count announced via `aria-live="polite"` region

## Out of Scope

- Graph view on mobile (future: read-only or cluster cards)
- Swipe-to-dismiss or swipe-to-select gestures
- Pull-to-refresh
- Offline support
