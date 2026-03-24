# Research Page UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Research page UX with 7 coordinated changes: universal input, provider-colored cards, AI context bridge, workspace icon tabs, smart sidebar, heritage touches, and breadcrumbs.

**Architecture:** All changes are in `apps/web/components/research/` and `apps/web/app/globals.css`. No backend changes. The improvements share `research-hub.tsx` and `research-layout.tsx` so tasks 1-5 must be sequential. Tasks 6-7 are independent (person workspace page).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-24-research-ux-improvements.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/app/globals.css` | Modify | Add provider color tokens |
| `apps/web/components/research/research-input.tsx` | Create | Universal smart input (replaces search-bar + url-paste-input) |
| `apps/web/components/research/search-bar.tsx` | Delete | Replaced by research-input |
| `apps/web/components/research/url-paste-input.tsx` | Delete | Replaced by research-input |
| `apps/web/components/research/research-hub.tsx` | Modify | Wire new input, sidebar logic, heritage touches, callbacks |
| `apps/web/components/research/research-layout.tsx` | Modify | Lift AI state, heritage tab indicator |
| `apps/web/components/research/provider-badge.tsx` | Modify | Add borderColor, icon, provider color mapping |
| `apps/web/components/research/search-result-card.tsx` | Modify | Left border, better relevance bar, pill tags, Ask AI button |
| `apps/web/components/research/search-results.tsx` | Modify | Group by provider with collapsible headers |
| `apps/web/components/research/chat-panel.tsx` | Modify | Accept initialPrompt, onPromptConsumed, searchContext |
| `apps/web/components/research/research-item-card.tsx` | Modify | Add hover shadow |
| `apps/web/components/research/workspace/workspace-tabs.tsx` | Modify | Add icons, scroll container, fade indicators, a11y |
| `apps/web/components/research/workspace/workspace-shell.tsx` | Modify | Add breadcrumb above header |
| `apps/web/components/research/breadcrumb.tsx` | Create | Breadcrumb nav for person workspace |

---

## Task 1: Design Token Additions + Heritage Tab Indicator

**Files:**
- Modify: `apps/web/app/globals.css:8-43` (light `:root`) and `apps/web/app/globals.css:108-142` (dark `.dark`)
- Modify: `apps/web/components/research/research-layout.tsx:29-34`
- Modify: `apps/web/components/research/workspace/workspace-tabs.tsx:52-57`

- [ ] **Step 1: Add provider color tokens to globals.css**

In the `:root` block (after line 42), add:

```css
  --provider-findagrave: oklch(0.60 0.12 180);
  --provider-wikitree: oklch(0.55 0.12 300);
```

In the `.dark` block (after line 141), add:

```css
  --provider-findagrave: oklch(0.50 0.12 180);
  --provider-wikitree: oklch(0.45 0.12 300);
```

In the `@theme inline` block, add the color mappings:

```css
  --color-provider-findagrave: var(--provider-findagrave);
  --color-provider-wikitree: var(--provider-wikitree);
```

- [ ] **Step 2: Update tab indicator in research-layout.tsx**

In `research-layout.tsx`, change the active tab class (line 33) from:

```
'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
```

to:

```
'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
```

- [ ] **Step 3: Update tab indicator in workspace-tabs.tsx**

In `workspace-tabs.tsx`, change the active tab class (line 55) from:

```
'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
```

to:

```
'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
```

- [ ] **Step 4: Verify dev server renders correctly**

Run: `pnpm --filter web dev`
Navigate to `/research` — confirm the Search/AI Chat tab underline is thicker and rounded.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/research/research-layout.tsx apps/web/components/research/workspace/workspace-tabs.tsx
git commit -m "style(research): add provider tokens and heritage tab indicators"
```

---

## Task 2: Heritage Modern Visual Touches

**Files:**
- Modify: `apps/web/components/research/research-hub.tsx:62-188`
- Modify: `apps/web/components/research/research-item-card.tsx:80-131`

- [ ] **Step 1: Update page title weight in research-hub.tsx**

Change line 65 from:
```tsx
<h1 className="text-xl font-semibold">Research</h1>
```
to:
```tsx
<h1 className="text-xl font-bold">Research</h1>
```

- [ ] **Step 2: Make empty-state example buttons use accent hover**

Change line 123 example button class from:
```
hover:border-primary/50 hover:bg-accent/50
```
to:
```
hover:border-accent/50 hover:bg-accent/10
```

- [ ] **Step 3: Make provider cards interactive**

Change provider card div (line 140) from:
```tsx
<div
  key={name}
  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center"
>
```
to:
```tsx
<button
  type="button"
  key={name}
  onClick={() => handleSearch(name)}
  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer"
>
```

Change closing `</div>` to `</button>` for each provider card.

- [ ] **Step 4: Add hover shadow to research-item-card.tsx**

In `research-item-card.tsx`, change the `<Card>` element (line 81) from:
```tsx
<Card size="sm">
```
to:
```tsx
<Card size="sm" className="transition-shadow hover:shadow-sm">
```

- [ ] **Step 5: Verify visually**

Run dev server, navigate to `/research`. Confirm:
- Title is bolder
- Example search buttons show gold accent on hover
- Provider source cards have hover shadow and highlight
- Saved item cards (if visible) have hover shadow

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/research/research-hub.tsx apps/web/components/research/research-item-card.tsx
git commit -m "style(research): apply Heritage Modern visual touches"
```

---

## Task 3: Universal Smart Input

**Files:**
- Create: `apps/web/components/research/research-input.tsx`
- Modify: `apps/web/components/research/research-hub.tsx`
- Delete: `apps/web/components/research/search-bar.tsx`
- Delete: `apps/web/components/research/url-paste-input.tsx`

- [ ] **Step 1: Create research-input.tsx**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Link, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScrapeUrl } from '@/lib/research/scrape-client';

const URL_REGEX = /^https?:\/\//;

interface ResearchInputProps {
  onSearch: (query: string) => void;
  onSaved?: () => void;
  onOpenTextModal?: () => void;
  placeholder?: string;
}

export function ResearchInput({
  onSearch,
  onSaved,
  onOpenTextModal,
  placeholder = 'Search records or paste a URL...',
}: ResearchInputProps) {
  const [value, setValue] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const { scrape, status, result, error, isLoading } = useScrapeUrl();

  // Auto-detect URL vs search
  useEffect(() => {
    const trimmed = value.trim();
    setIsUrlMode(URL_REGEX.test(trimmed));
  }, [value]);

  // Debounced search (only when not in URL mode)
  useEffect(() => {
    if (isUrlMode) return;
    const timer = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [value, isUrlMode, onSearch]);

  const handleScrape = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const res = await scrape(trimmed);
    if (res) {
      onSaved?.();
    }
  }, [value, scrape, onSaved]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  const isDone = status === 'done';
  const hasValue = value.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-24"
          disabled={isLoading}
          aria-label="Search records or paste a URL"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {hasValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenTextModal}
              className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Paste text from clipboard"
            >
              <FileText className="mr-1 inline size-3" />
              Paste Text
            </button>
          )}
        </div>
      </div>

      {/* Hint text — only when empty and idle */}
      {!hasValue && status === 'idle' && (
        <p className="text-center text-xs text-muted-foreground/60">
          Tip: paste any URL to auto-scrape it
        </p>
      )}

      {/* URL confirmation card */}
      {isUrlMode && hasValue && !isDone && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Link className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{value.trim()}</p>
          </div>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scraping...
              </>
            ) : (
              'Scrape & Save'
            )}
          </Button>
        </div>
      )}

      {/* Success state */}
      {isDone && result && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <CheckCircle2 className="size-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{result.title}</p>
          </div>
          <Badge variant="secondary">Saved</Badge>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error.message}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update research-hub.tsx to use ResearchInput**

Replace the imports at the top — remove `SearchBar` and `UrlPasteInput`, add `ResearchInput`:

```tsx
import { ResearchInput } from './research-input';
// Remove: import { SearchBar } from './search-bar';
// Remove: import { UrlPasteInput } from './url-paste-input';
```

Replace the search bar + divider + URL input section (lines 88-101) with:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
  <div className="flex-1">
    <ResearchInput
      onSearch={handleSearch}
      onSaved={handleSaved}
      onOpenTextModal={() => setTextModalOpen(true)}
    />
  </div>
  <SourceSelector onSelectionChange={setSelectedProviders} />
</div>
```

Remove the "or paste a URL" divider block (lines 95-99) and the standalone `<UrlPasteInput>` (line 101).

Also **remove the header-level "Paste Text" button** (lines 71-78 in the `<div className="flex items-center gap-3">` block) — this functionality is now inside `ResearchInput`. Keep only the saved items count badge in the header.

- [ ] **Step 3: Delete old files**

```bash
rm apps/web/components/research/search-bar.tsx
rm apps/web/components/research/url-paste-input.tsx
```

- [ ] **Step 4: Verify no broken imports**

Run: `pnpm --filter web build 2>&1 | head -30`
Expected: No import errors for `search-bar` or `url-paste-input`.

- [ ] **Step 5: Verify visually**

Navigate to `/research`. Confirm:
- Single input with search icon and "Paste Text" pill
- Typing text triggers search after 300ms
- Pasting a URL shows the confirmation card with accent "Scrape & Save" button
- "Paste Text" pill disappears when input has value, clear (X) appears
- Hint text visible when input is empty

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/research/research-input.tsx apps/web/components/research/research-hub.tsx
git rm apps/web/components/research/search-bar.tsx apps/web/components/research/url-paste-input.tsx
git commit -m "feat(research): replace search bar + URL input with universal smart input"
```

---

## Task 4: Provider-Colored Result Cards

**Files:**
- Modify: `apps/web/components/research/provider-badge.tsx`
- Modify: `apps/web/components/research/search-result-card.tsx`
- Modify: `apps/web/components/research/search-results.tsx`

- [ ] **Step 1: Extend provider-badge.tsx with border colors and icons**

Replace the entire `PROVIDER_CONFIG` and add new fields:

```tsx
import { Badge } from '@/components/ui/badge';
import { Globe, Archive, Newspaper, MapPin, Search, TreePine, type LucideIcon } from 'lucide-react';

interface ProviderConfigEntry {
  label: string;
  className: string;
  borderClass: string;
  icon: LucideIcon;
}

const PROVIDER_CONFIG: Record<string, ProviderConfigEntry> = {
  mock: {
    label: 'Mock',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    borderClass: 'border-l-purple-500',
    icon: Globe,
  },
  nara: {
    label: 'NARA',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    borderClass: 'border-l-[oklch(0.60_0.12_240)]',
    icon: Archive,
  },
  // NOTE: key is `chronicling_america` (underscore) — the old provider-badge.tsx
  // incorrectly used `chronicling-america` (hyphen). This matches the actual
  // providerId from packages/research/src/providers.
  chronicling_america: {
    label: 'Chronicling America',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    borderClass: 'border-l-accent',
    icon: Newspaper,
  },
  familysearch: {
    label: 'FamilySearch',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    borderClass: 'border-l-[oklch(0.55_0.15_150)]',
    icon: Globe,
  },
  findagrave: {
    label: 'Find A Grave',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    borderClass: 'border-l-provider-findagrave',
    icon: MapPin,
  },
  web_search: {
    label: 'Web Search',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    borderClass: 'border-l-primary',
    icon: Search,
  },
  wikitree: {
    label: 'WikiTree',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    borderClass: 'border-l-provider-wikitree',
    icon: TreePine,
  },
};

const DEFAULT_CONFIG: ProviderConfigEntry = {
  label: '',
  className: 'bg-secondary text-secondary-foreground',
  borderClass: 'border-l-border',
  icon: Globe,
};

export function getProviderConfig(providerId: string): ProviderConfigEntry {
  const config = PROVIDER_CONFIG[providerId];
  if (config) return config;
  return { ...DEFAULT_CONFIG, label: providerId };
}

interface ProviderBadgeProps {
  providerId: string;
}

export function ProviderBadge({ providerId }: ProviderBadgeProps) {
  const config = getProviderConfig(providerId);
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Update search-result-card.tsx with left border, better relevance, pill tags**

Replace the `Card` wrapper to add the left border. Import `getProviderConfig`:

```tsx
import { getProviderConfig } from './provider-badge';
```

Change the outer `<Card>` from:
```tsx
<Card size="sm">
```
to:
```tsx
<Card size="sm" className={`border-l-3 ${getProviderConfig(result.providerId).borderClass} transition-shadow hover:shadow-sm`}>
```

Replace the relevance score section (lines 62-74) with:

```tsx
{result.relevanceScore != null && (
  <div className="shrink-0 flex items-center gap-2">
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${result.relevanceScore * 100}%` }}
      />
    </div>
    <span className="text-xs font-medium text-muted-foreground">
      {Math.round(result.relevanceScore * 100)}%
    </span>
  </div>
)}
```

Replace the extracted data section (lines 79-105) with pill badges:

```tsx
{result.extractedData && (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {result.extractedData.name && (
      <Badge variant="outline" className="text-xs font-normal">
        {result.extractedData.name}
      </Badge>
    )}
    {result.extractedData.birthDate && (
      <Badge variant="outline" className="text-xs font-normal">
        b. {result.extractedData.birthDate}
      </Badge>
    )}
    {result.extractedData.deathDate && (
      <Badge variant="outline" className="text-xs font-normal">
        d. {result.extractedData.deathDate}
      </Badge>
    )}
    {result.extractedData.location && (
      <Badge variant="outline" className="text-xs font-normal">
        {result.extractedData.location}
      </Badge>
    )}
  </div>
)}
```

- [ ] **Step 3: Update search-results.tsx with grouped provider sections**

Replace the component body with grouping logic:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchResultCard } from './search-result-card';
import { getProviderConfig } from './provider-badge';
import type { SearchResult } from '@ancstra/research';

interface SearchResultsProps {
  results: SearchResult[] | undefined;
  isLoading: boolean;
  error: Error | null;
  query: string;
  onSaved?: () => void;
  onAskAi?: (prompt: string) => void;
}

interface ProviderGroup {
  providerId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  results: SearchResult[];
}

export function SearchResults({
  results,
  isLoading,
  error,
  query,
  onSaved,
  onAskAi,
}: SearchResultsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (!results || results.length === 0) return [];

    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.providerId) ?? [];
      list.push(r);
      map.set(r.providerId, list);
    }

    const sorted: ProviderGroup[] = [...map.entries()]
      .sort((a, b) => {
        const countDiff = b[1].length - a[1].length;
        if (countDiff !== 0) return countDiff;
        return a[0].localeCompare(b[0]);
      })
      .map(([providerId, providerResults]) => {
        const config = getProviderConfig(providerId);
        return {
          providerId,
          label: config.label,
          icon: config.icon,
          results: providerResults,
        };
      });

    return sorted;
  }, [results]);

  const toggleGroup = (providerId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Search failed: {error.message}
      </div>
    );
  }

  // NOTE: Previously this showed "Enter a search query..." text. Now returns null
  // because the empty state is handled by ResearchHub's empty-state section.
  if (!query) {
    return null;
  }

  if (results && results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No results found for &ldquo;{query}&rdquo;. Try a different search term.
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? 's' : ''} found
      </p>
      {groups.map((group) => {
        const Icon = group.icon;
        const isCollapsed = collapsed.has(group.providerId);

        return (
          <div key={group.providerId} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.providerId)}
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <Icon className="size-3.5" />
              <span>{group.label}</span>
              <span className="text-xs font-normal">({group.results.length})</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-3">
                {group.results.map((result) => (
                  <SearchResultCard
                    key={`${result.providerId}-${result.externalId}`}
                    result={result}
                    onSaved={onSaved}
                    onAskAi={onAskAi}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify build compiles**

Run: `pnpm --filter web build 2>&1 | head -30`
Expected: No TypeScript errors.

- [ ] **Step 5: Verify visually**

Navigate to `/research`, search for something. Confirm:
- Results grouped by provider with collapsible headers
- Each card has a colored left border
- Relevance bar is wider (w-16) with inline percentage
- Extracted data shows as pill badges

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/research/provider-badge.tsx apps/web/components/research/search-result-card.tsx apps/web/components/research/search-results.tsx
git commit -m "feat(research): provider-colored result cards with grouped sections"
```

---

## Task 5: Smart Saved Items Sidebar

**Files:**
- Modify: `apps/web/components/research/research-hub.tsx`

- [ ] **Step 1: Add collapse state and conditional grid logic**

At the top of `ResearchHub`, add sidebar state:

```tsx
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ancstra:sidebar-collapsed') === 'true';
});

const toggleSidebar = useCallback(() => {
  setSidebarCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem('ancstra:sidebar-collapsed', String(next));
    return next;
  });
}, []);
```

- [ ] **Step 2: Update the results grid layout**

First, add `ChevronsRight` to the Lucide imports at the top of `research-hub.tsx`:

```tsx
import { Search, Globe, Newspaper, BookOpen, Archive, Bookmark, FileText, ChevronsRight } from 'lucide-react';
```

Also add `cn` if not already imported:
```tsx
import { cn } from '@/lib/utils';
```

Replace the results grid section (lines 191-225, the entire active-state grid inside the ternary) with:

```tsx
<div className={cn(
  'grid gap-6',
  hasItems && !sidebarCollapsed ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'
)}>
  <div className="relative">
    {/* Collapsed sidebar badge */}
    {hasItems && sidebarCollapsed && (
      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -top-1 right-0 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        <Bookmark className="size-3.5" />
        {itemsData?.items.length} saved
      </button>
    )}
    <SearchResults
      results={searchData?.results}
      isLoading={searchLoading}
      error={searchError}
      query={query}
      onSaved={handleSaved}
    />
  </div>

  {hasItems && !sidebarCollapsed && (
    <div className="hidden space-y-3 lg:block">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Saved Items <span className="text-foreground">({itemsData?.items.length})</span>
        </h2>
        <button
          type="button"
          onClick={toggleSidebar}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Collapse sidebar"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
      {itemsLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        itemsData?.items.map((item: any) => (
          <ResearchItemCard
            key={item.id}
            item={item}
            onUpdated={handleSaved}
          />
        ))
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify visually**

Navigate to `/research`, perform a search, save some results. Confirm:
- Sidebar only appears when items exist
- Collapse button hides sidebar, shows floating "[N] saved" badge
- Clicking the badge re-opens the sidebar
- Collapsed state persists after page reload
- On mobile (<lg), sidebar is hidden

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/research-hub.tsx
git commit -m "feat(research): smart collapsible saved items sidebar"
```

---

## Task 6: AI Context Bridge

**Files:**
- Modify: `apps/web/components/research/research-layout.tsx`
- Modify: `apps/web/components/research/search-result-card.tsx`
- Modify: `apps/web/components/research/chat-panel.tsx`
- Modify: `apps/web/components/research/research-hub.tsx`

- [ ] **Step 1: Lift state in research-layout.tsx**

**Note:** This is a full replacement of the component. It incorporates the tab indicator change from Task 1 (`after:h-[2.5px] after:rounded-full`), so the Task 1 edit is preserved.

Update `ResearchLayout` to manage shared state and pass it down:

```tsx
'use client';

import { useState, useCallback, Suspense } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResearchHub } from './research-hub';
import { ChatPanel } from './chat-panel';

type ResearchView = 'search' | 'chat';

interface SearchContext {
  query: string;
  topResults: { title: string; providerId: string }[];
}

const tabs: { value: ResearchView; label: string; icon: typeof Search }[] = [
  { value: 'search', label: 'Search', icon: Search },
  { value: 'chat', label: 'AI Chat', icon: Sparkles },
];

export function ResearchLayout() {
  const [activeView, setActiveView] = useState<ResearchView>('search');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);

  const handleAskAi = useCallback((prompt: string) => {
    setPendingAiPrompt(prompt);
    setActiveView('chat');
  }, []);

  const handlePromptConsumed = useCallback(() => {
    setPendingAiPrompt(null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveView(tab.value)}
              className={cn(
                'relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeView === tab.value
                  ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'search' ? (
          <div className="h-full overflow-y-auto p-6">
            <ResearchHub
              onAskAi={handleAskAi}
              onSearchContextChange={setSearchContext}
            />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading chat...
              </div>
            }
          >
            <ChatPanel
              initialPrompt={pendingAiPrompt}
              onPromptConsumed={handlePromptConsumed}
              searchContext={searchContext}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update research-hub.tsx to accept and call callbacks**

Add props to `ResearchHub`:

```tsx
interface ResearchHubProps {
  onAskAi?: (prompt: string) => void;
  onSearchContextChange?: (ctx: { query: string; topResults: { title: string; providerId: string }[] } | null) => void;
}

export function ResearchHub({ onAskAi, onSearchContextChange }: ResearchHubProps) {
```

Add a `useEffect` after the search data loads to report context:

```tsx
useEffect(() => {
  if (!query || !searchData?.results) {
    onSearchContextChange?.(null);
    return;
  }
  onSearchContextChange?.({
    query,
    topResults: searchData.results.slice(0, 5).map((r) => ({
      title: r.title,
      providerId: r.providerId,
    })),
  });
}, [query, searchData, onSearchContextChange]);
```

Pass `onAskAi` through to `SearchResults`:

```tsx
<SearchResults
  results={searchData?.results}
  isLoading={searchLoading}
  error={searchError}
  query={query}
  onSaved={handleSaved}
  onAskAi={onAskAi}
/>
```

- [ ] **Step 3: Add "Ask AI" button to search-result-card.tsx**

Add `onAskAi` prop and the button in the footer:

```tsx
interface SearchResultCardProps {
  result: SearchResult;
  onSaved?: () => void;
  onAskAi?: (prompt: string) => void;
}
```

In the `CardFooter`, after the View button, add:

```tsx
{onAskAi && (
  <Button
    size="sm"
    variant="ghost"
    onClick={() =>
      onAskAi(
        `Tell me more about this record: "${result.title}" from ${getProviderConfig(result.providerId).label}. URL: ${result.url}. Snippet: ${result.snippet}`
      )
    }
  >
    <Sparkles className="size-3.5" />
    Ask AI
  </Button>
)}
```

Add `Sparkles` to the Lucide imports.

- [ ] **Step 4: Update chat-panel.tsx to consume initialPrompt and searchContext**

Add new props to the interface:

```tsx
interface ChatPanelProps {
  focusPersonId?: string;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  searchContext?: { query: string; topResults: { title: string; providerId: string }[] } | null;
}
```

Update the `useChat` call to include search context:

```tsx
const {
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  reload,
  setMessages,
  append,
} = useChat({
  api: '/api/ai/chat',
  body: {
    focusPersonId,
    ...(searchContext && {
      searchContext: `User was searching for: "${searchContext.query}". Top results: ${searchContext.topResults.map((r) => `${r.title} (${r.providerId})`).join(', ')}`,
    }),
  },
});
```

Add `useEffect` to consume the initial prompt:

```tsx
// Auto-send initial prompt from "Ask AI" button
useEffect(() => {
  if (initialPrompt) {
    append({ role: 'user', content: initialPrompt });
    onPromptConsumed?.();
  }
}, [initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Verify build and test manually**

Run: `pnpm --filter web build 2>&1 | head -30`

Then test manually:
1. Search for something on `/research`
2. Click "Ask AI" on a result card
3. Confirm tab switches to AI Chat and message auto-sends
4. Switch back to Search, then click AI Chat tab manually
5. Confirm chat has context about the search

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/research/research-layout.tsx apps/web/components/research/research-hub.tsx apps/web/components/research/search-result-card.tsx apps/web/components/research/chat-panel.tsx
git commit -m "feat(research): AI context bridge between search and chat"
```

---

## Task 7: Workspace Icon Tabs with Scroll

**Files:**
- Modify: `apps/web/components/research/workspace/workspace-tabs.tsx`

- [ ] **Step 1: Rewrite workspace-tabs.tsx with icons, scroll, and a11y**

```tsx
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useRef, useState, useEffect } from 'react';
import {
  LayoutGrid,
  Table2,
  GitCompareArrows,
  Clock,
  PenTool,
  BookOpen,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type WorkspaceView = 'board' | 'matrix' | 'conflicts' | 'timeline' | 'canvas' | 'hints' | 'proof';

const tabs: { value: WorkspaceView; label: string; icon: LucideIcon }[] = [
  { value: 'board', label: 'Board', icon: LayoutGrid },
  { value: 'matrix', label: 'Matrix', icon: Table2 },
  { value: 'conflicts', label: 'Conflicts', icon: GitCompareArrows },
  { value: 'timeline', label: 'Timeline', icon: Clock },
  { value: 'canvas', label: 'Canvas', icon: PenTool },
  { value: 'hints', label: 'Hints', icon: BookOpen },
  { value: 'proof', label: 'Proof', icon: FileText },
];

interface WorkspaceTabsProps {
  conflictCount?: number;
  hintCount?: number;
}

export function WorkspaceTabs({ conflictCount = 0, hintCount = 0 }: WorkspaceTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const activeView = (searchParams.get('view') as WorkspaceView) || 'board';

  const setView = useCallback(
    (view: WorkspaceView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === 'board') {
        params.delete('view');
      } else {
        params.set('view', view);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname],
  );

  // Detect overflow for fade indicators
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  // Arrow key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.value === activeView);
      if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        e.preventDefault();
        setView(tabs[currentIndex + 1].value);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setView(tabs[currentIndex - 1].value);
      }
    },
    [activeView, setView],
  );

  return (
    <div className="relative border-b border-border">
      {/* Left fade */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-background to-transparent" />
      )}
      {/* Right fade */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      )}

      <div
        ref={scrollRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.value;

          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setView(tab.value)}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              {tab.value === 'conflicts' && conflictCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {conflictCount}
                </Badge>
              )}
              {tab.value === 'hints' && hintCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                  {hintCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify visually**

Navigate to `/research/person/[id]`. Confirm:
- Each tab has an icon before its label
- "Proof Summary" is now just "Proof"
- Badges still appear on Conflicts and Hints tabs
- On narrow viewport, tabs scroll horizontally
- Fade indicators appear at edges when scrollable
- Arrow keys navigate between tabs

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/workspace/workspace-tabs.tsx
git commit -m "feat(research): workspace icon tabs with horizontal scroll and a11y"
```

---

## Task 8: Breadcrumb Navigation

**Files:**
- Create: `apps/web/components/research/breadcrumb.tsx`
- Modify: `apps/web/components/research/workspace/workspace-shell.tsx`

- [ ] **Step 1: Create breadcrumb.tsx**

```tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { WorkspaceView } from './workspace/workspace-tabs';

const VIEW_LABELS: Record<WorkspaceView, string> = {
  board: 'Board',
  matrix: 'Matrix',
  conflicts: 'Conflicts',
  timeline: 'Timeline',
  canvas: 'Canvas',
  hints: 'Hints',
  proof: 'Proof',
};

interface ResearchBreadcrumbProps {
  personName: string;
}

function BreadcrumbInner({ personName }: ResearchBreadcrumbProps) {
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as WorkspaceView) || 'board';
  const viewLabel = VIEW_LABELS[view] ?? 'Board';

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-xs">
        <li>
          <Link
            href="/research"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Research
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li>
          <span className="max-w-[120px] truncate text-muted-foreground sm:max-w-none">
            {personName}
          </span>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li aria-current="page">
          <span className="font-medium text-foreground">{viewLabel}</span>
        </li>
      </ol>
    </nav>
  );
}

export function ResearchBreadcrumb(props: ResearchBreadcrumbProps) {
  return (
    <Suspense>
      <BreadcrumbInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Add breadcrumb to workspace-shell.tsx**

Import the breadcrumb at the top:

```tsx
import { ResearchBreadcrumb } from '../breadcrumb';
```

In the `ShellInner` component, add the breadcrumb above the header `div` (before the flex row with avatar):

```tsx
return (
  <div className="space-y-6">
    {/* Breadcrumb */}
    <ResearchBreadcrumb personName={`${person.givenName} ${person.surname}`.trim()} />

    {/* Header */}
    <div className="flex items-center justify-between">
```

- [ ] **Step 3: Verify visually**

Navigate to `/research/person/[id]`. Confirm:
- Breadcrumb shows: Research > [Name] > Board
- "Research" is a working link back to `/research`
- Switching tabs updates the breadcrumb's last segment
- On mobile, the person name truncates with ellipsis

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/breadcrumb.tsx apps/web/components/research/workspace/workspace-shell.tsx
git commit -m "feat(research): breadcrumb navigation on person workspace"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm --filter web build` completes without errors
- [ ] `/research` — universal input works (search + URL auto-detect + paste text)
- [ ] `/research` — results grouped by provider with colored left borders
- [ ] `/research` — "Ask AI" on a result switches to chat with context
- [ ] `/research` — sidebar only shows when items exist, collapses/expands
- [ ] `/research` — heritage touches: bold title, accent CTAs, interactive providers, warm hover shadows
- [ ] `/research/person/[id]` — all 7 tabs have icons, horizontal scroll works
- [ ] `/research/person/[id]` — breadcrumb shows and updates per tab
- [ ] Both pages look correct in dark mode
- [ ] Tab indicators are thicker and rounded on both pages
