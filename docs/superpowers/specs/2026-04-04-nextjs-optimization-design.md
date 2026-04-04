# Next.js Optimization — Full Caching, Streaming & Bundle Overhaul

**Date:** 2026-04-04
**Status:** Approved
**Target:** Vercel deployment, Next.js 16.2.1-canary.4

## Overview

Comprehensive optimization pass across caching architecture, component streaming, bundle size, and performance monitoring. Targets all major pages with emphasis on dashboard and activity (component-level Suspense + `use cache`) and persons page (hybrid server/client conversion).

## Goals

- Faster perceived page loads via granular Suspense streaming
- Smarter caching with per-widget cache lifetimes and surgical revalidation
- Eliminate the full-client persons page bottleneck
- Reduce client bundle size via dynamic imports
- Establish performance baselines with Web Vitals monitoring

## Non-Goals

- Image optimization (no heavy image usage)
- Service worker caching changes
- CSS optimization (Tailwind v4 already tree-shakes)
- Font subsetting beyond `next/font`

---

## Section 1: Cache Architecture Redesign

### 1a. Split `cached-queries.ts` into per-domain cached functions

Current `getCachedDashboardData` is one monolithic function returning 5 fields with a single `cacheLife('dashboard')`. Everything invalidates together.

New structure:

```
lib/cached-queries.ts → split into:

  lib/cache/dashboard.ts
    getCachedStatCards(dbFilename)        → use cache, cacheLife('dashboard'), cacheTag('dashboard-stats', 'persons')
    getCachedRecentPersons(dbFilename)    → use cache, cacheLife('dashboard'), cacheTag('dashboard-recent', 'persons')
    getCachedQualityScore(dbFilename)     → use cache: remote, cacheLife('genealogy'), cacheTag('quality')

  lib/cache/activity.ts
    getCachedActivityFeed(familyId)       → use cache: private, cacheLife('activity'), cacheTag('activity')

  lib/cache/tree.ts
    getCachedTreeData(dbFilename)         → use cache: remote, cacheLife('tree'), cacheTag('tree-data')

  lib/cache/person.ts
    getCachedPersonDetail(dbFilename, id) → use cache, cacheLife('genealogy'), cacheTag('person-{id}', 'persons')
    getCachedPersonsList(dbFilename, page, pageSize, query?)
                                          → use cache, cacheLife('dashboard'), cacheTag('persons-list')
```

### 1b. Cache directive strategy

| Data type | Directive | Reason |
|-----------|-----------|--------|
| Tree structure | `use cache: remote` | Shared across all family members, large payload, rarely changes |
| Quality scores | `use cache: remote` | Shared, expensive to compute, changes only on data edits |
| Person detail | `use cache` | Shared within family, keyed by personId |
| Dashboard stats | `use cache` | Shared within family |
| Activity feed | `use cache: private` | Per-user (different users see different activity based on role) |
| Persons list (initial) | `use cache` | Shared default view (page 1, no query) |

### 1c. Fix revalidation calls

Remove dead `'max'` second arg from all `revalidateTag` calls across 17 files. Update tags to match new granular structure:

- `revalidateTag('persons')` — busts person detail, persons list, dashboard stats, recent persons
- `revalidateTag('tree-data')` — busts tree cache
- `revalidateTag('dashboard-stats')` — busts stat cards only
- `revalidateTag('quality')` — busts quality widget only
- `revalidateTag('activity')` — busts activity feed

---

## Section 2: Component-Level Suspense & Streaming

### 2a. Dashboard page — async widget components

Convert each dashboard widget from a prop-receiving component to an async server component that fetches its own cached data.

```
Before (sequential):
  DashboardPage
    └─ await getCachedDashboardData()     ← blocks everything
    └─ render StatCards, RecentPersons, QualityWidget, RecentActivity

After (parallel streaming):
  DashboardPage
    ├─ <Suspense fallback={<StatCardsSkeleton />}>
    │    └─ <StatCards dbFilename={...} />          ← async, own use cache
    ├─ <Suspense fallback={<RecentPersonsSkeleton />}>
    │    └─ <RecentPersons dbFilename={...} />      ← async, own use cache
    ├─ <Suspense fallback={<QualityWidgetSkeleton />}>
    │    └─ <QualityWidget dbFilename={...} />      ← async, own use cache
    └─ <Suspense fallback={<RecentActivitySkeleton />}>
         └─ <RecentActivity familyId={...} />       ← async, use cache: private
```

Each widget streams in independently. The page shell (header, grid layout, quick actions) renders instantly.

### 2b. Activity page — same pattern

```
ActivityPage (instant render — title + shell)
  └─ <Suspense fallback={<ActivityFeedSkeleton />}>
       └─ <ActivityFeedServer familyId={...} />    ← async, use cache: private
```

### 2c. Skeleton components

Each Suspense boundary needs a matching skeleton (simple server components, no `'use client'`):

- `StatCardsSkeleton` — 4 cards with pulsing placeholders
- `RecentPersonsSkeleton` — table with 5 shimmer rows
- `QualityWidgetSkeleton` — card with circular progress placeholder
- `RecentActivitySkeleton` — list with 5 shimmer items
- `ActivityFeedSkeleton` — full-page feed shimmer

Place in `components/skeletons/` or co-locate next to each widget.

### 2d. What stays page-level

All other pages keep their existing `loading.tsx` approach — settings, research, import, export, etc.

---

## Section 3: Persons Page Hybrid Conversion

### 3a. Architecture

```
Before:
  persons/page.tsx ('use client')
    └─ useEffect → fetch('/api/persons') → setState → render

After:
  persons/page.tsx (server component)
    ├─ reads searchParams (?q=, &page=)
    ├─ await getCachedPersonsList(dbFilename, page, pageSize, query)
    ├─ renders initial table server-side
    └─ <PersonsClient initialPersons={...} initialTotal={...} initialQuery={...} initialPage={...}>
         └─ hydrates, takes over search/pagination with client fetch
```

### 3b. Server component (new `persons/page.tsx`)

- Reads `searchParams` for `q` and `page`
- Calls `getCachedPersonsList` — new cached function with `use cache`, `cacheLife('dashboard')`, `cacheTag('persons-list')`
- Default view (page 1, no query) is cached and shared across family members
- Passes data as props to the client component

### 3c. Client component (`persons-client.tsx`)

- Receives `initialPersons`, `initialTotal`, `initialQuery`, `initialPage` as props
- Initializes state from props (no blank-to-loading flash)
- Search typing + pagination still use client-side `fetch('/api/persons')`
- Uses `useRouter().replace()` to update URL params on search/paginate (shallow, no server round-trip)
- 300ms debounce, loading states, and pagination UX remain identical

### 3d. Cache behavior

| Scenario | What happens |
|----------|-------------|
| First visit (no params) | Cache HIT — server-rendered table, instant |
| Deep link `?q=smith&page=2` | Cache MISS on first hit, cached after |
| Client-side search typing | Bypasses cache — direct API fetch |
| New person added | `revalidateTag('persons-list')` busts the cached default view |

### 3e. What we're NOT doing

- Not converting the `/api/persons` GET endpoint — stays as-is
- Not adding infinite scroll or virtual tables
- Not caching every search query server-side — only the initial/default view

---

## Section 4: Remote Caching & Partial Prerendering

### 4a. `use cache: remote` for shared data

| Function | Why remote |
|----------|-----------|
| `getCachedTreeData` | Largest payload, shared across family, changes only on mutations |
| `getCachedQualityScore` | Aggregation query, same for everyone, changes only on data edits |

All other data stays on default `use cache` or `use cache: private`.

### 4b. Partial Prerendering (PPR)

Config change:

```ts
// next.config.ts
experimental: {
  viewTransition: true,
  ppr: true,
}
```

Static shell (prerendered at build):
- AppSidebar (navigation links)
- AppHeader (chrome)
- Page grid/layout skeleton

Dynamic holes (streamed at request time):
- All `<Suspense>` boundaries from Section 2

**Caveat:** The auth layout calls `auth()` which makes the entire layout dynamic today. For PPR to work, the auth check needs to be pushed into individual pages or a nested layout so the outer shell can be static. If this proves too complex during implementation, PPR is dropped. Everything else works without it.

### 4c. Scope boundary

PPR is best-effort. If incompatible with current auth layout, drop entirely. The rest of the design delivers the bulk of the value.

---

## Section 5: Bundle Optimization & Performance Monitoring

### 5a. Dynamic imports for heavy client components

| Component | Action |
|-----------|--------|
| `TreePageClient` (family-chart + Topola) | `next/dynamic` with `{ ssr: false }` + loading skeleton |
| `CommandPalette` (cmdk) | `next/dynamic` with `{ ssr: false }` — JS loads on trigger only |

### 5b. Bundle analysis

- Add `@next/bundle-analyzer` as dev dependency
- Run build with `ANALYZE=true`
- Identify unexpectedly large client chunks
- Document findings, action only what's clearly oversized
- One-time investigative task, not ongoing

### 5c. Web Vitals reporting

Use Sentry performance monitoring (already configured) or Vercel Analytics. Track:

- **LCP** — should improve with streaming + cache
- **FCP** — should improve with PPR + static shells
- **TTFB** — should improve with remote cache hits
- **INP** — baseline, shouldn't regress

### 5d. What we're NOT doing

- No image optimization pass
- No service worker caching changes
- No CSS optimization
- No font subsetting beyond `next/font`

---

## Files Affected

### New files
- `lib/cache/dashboard.ts`
- `lib/cache/activity.ts`
- `lib/cache/tree.ts`
- `lib/cache/person.ts`
- `components/skeletons/stat-cards-skeleton.tsx`
- `components/skeletons/recent-persons-skeleton.tsx`
- `components/skeletons/quality-widget-skeleton.tsx`
- `components/skeletons/recent-activity-skeleton.tsx`
- `components/skeletons/activity-feed-skeleton.tsx`
- `components/persons/persons-client.tsx`

### Modified files
- `next.config.ts` — add `ppr: true`
- `lib/cached-queries.ts` — remove (replaced by `lib/cache/*`)
- `app/(auth)/dashboard/page.tsx` — Suspense boundaries, async widgets
- `app/(auth)/activity/page.tsx` — Suspense boundary
- `app/(auth)/persons/page.tsx` — hybrid server/client conversion
- `components/dashboard/stat-cards.tsx` — async server component
- `components/dashboard/recent-persons.tsx` — async server component
- `components/dashboard/quality-widget.tsx` — async server component
- `components/dashboard/recent-activity.tsx` — async server component
- `app/(auth)/tree/page.tsx` — dynamic import for TreePageClient
- `app/layout.tsx` — dynamic import for CommandPalette, Web Vitals
- 17 API route files — remove `'max'` arg from `revalidateTag`, update tags

### Deleted files
- `lib/cached-queries.ts` (replaced by `lib/cache/*`)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PPR incompatible with auth layout | Medium | Drop PPR, keep everything else |
| `use cache: remote` not stable in canary | Low | Fall back to `use cache` |
| `use cache: private` behavior differs from expected | Low | Fall back to `use cache` with user-scoped cache keys |
| Dashboard widget refactor breaks existing component contracts | Low | Widgets currently receive props — new versions fetch internally, old prop interface removed |
| Persons hybrid introduces hydration mismatch | Low | Server and client render identical initial state |
