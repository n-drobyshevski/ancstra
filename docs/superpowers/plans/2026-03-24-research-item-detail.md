# Research Item Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-page detail view at `/research/item/[id]` that shows all data for a saved research item in a two-column document layout.

**Architecture:** Server component page fetches item via `getResearchItem()`, passes to a client shell that renders header (breadcrumb + actions), main column (summary, full text, notes), and sidebar (facts, linked people, metadata). All mutations use existing API endpoints.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-24-research-item-detail.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/lib/research/constants.ts` | Create | Shared `STATUS_CONFIG` + `DISCOVERY_METHOD_LABELS` |
| `apps/web/components/research/research-item-card.tsx` | Modify | Wrap in `<Link>`, stopPropagation on buttons, import from constants |
| `apps/web/lib/research/evidence-client.ts` | Modify | Add `useResearchItemFacts(itemId)` hook |
| `apps/web/app/(auth)/research/item/[id]/page.tsx` | Create | Server component, data fetch |
| `apps/web/app/(auth)/research/item/[id]/loading.tsx` | Create | Skeleton loading state |
| `apps/web/app/(auth)/research/item/[id]/error.tsx` | Create | Error boundary |
| `apps/web/components/research/item-detail/item-detail-shell.tsx` | Create | Client shell, two-column grid |
| `apps/web/components/research/item-detail/item-header.tsx` | Create | Breadcrumb + title + badges + actions |
| `apps/web/components/research/item-detail/item-content.tsx` | Create | Summary, full text, notes |
| `apps/web/components/research/item-detail/item-sidebar.tsx` | Create | Facts, linked people, details metadata |
| `apps/web/components/research/item-detail/item-notes-editor.tsx` | Create | Inline-editable notes with auto-save |
| `apps/web/components/research/research-layout.tsx` | Modify | Read `?askAi` query param on mount |

---

## Task 1: Extract STATUS_CONFIG to Shared Constants

**Files:**
- Create: `apps/web/lib/research/constants.ts`
- Modify: `apps/web/components/research/research-item-card.tsx`

- [ ] **Step 1: Create constants.ts**

```tsx
export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  promoted: {
    label: 'Promoted',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
  },
};

export const DISCOVERY_METHOD_LABELS: Record<string, string> = {
  search: 'Search',
  scrape: 'Scrape',
  paste_url: 'Pasted URL',
  paste_text: 'Pasted Text',
  ai_suggestion: 'AI Suggestion',
};

export const CONFIDENCE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
  disputed: 'destructive',
};
```

- [ ] **Step 2: Update research-item-card.tsx to import from constants**

Remove the local `STATUS_CONFIG` constant (lines 22-35) and replace with:

```tsx
import { STATUS_CONFIG } from '@/lib/research/constants';
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/research/constants.ts apps/web/components/research/research-item-card.tsx
git commit -m "refactor(research): extract STATUS_CONFIG to shared constants module"
```

---

## Task 2: Make Research Item Card Navigable

**Files:**
- Modify: `apps/web/components/research/research-item-card.tsx`

- [ ] **Step 1: Add Link import**

```tsx
import Link from 'next/link';
```

- [ ] **Step 2: Wrap Card in Link**

Replace the outer `<Card>` wrapper:

From:
```tsx
<Card size="sm" className="transition-shadow hover:shadow-sm">
```

To:
```tsx
<Link href={`/research/item/${item.id}`} className="block">
<Card size="sm" className="transition-shadow hover:shadow-sm">
```

Add the closing `</Link>` after the `</Card>` closing tag.

- [ ] **Step 3: Add stopPropagation + preventDefault to ALL button onClick handlers**

Wrap each `updateStatus` call in the buttons. For example, the Promote button:

From:
```tsx
onClick={() => updateStatus('promoted')}
```

To:
```tsx
onClick={(e) => { e.stopPropagation(); e.preventDefault(); updateStatus('promoted'); }}
```

Apply this same pattern to all three buttons: Promote, Dismiss, and Restore.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/research-item-card.tsx
git commit -m "feat(research): make research item cards link to detail page"
```

---

## Task 3: Add useResearchItemFacts Hook

**Files:**
- Modify: `apps/web/lib/research/evidence-client.ts`

- [ ] **Step 1: Add the hook**

Add at the bottom of `evidence-client.ts`, after the existing hooks. It follows the same pattern as `usePersonFacts` but filters by `researchItemId`:

```tsx
// ---------------------------------------------------------------------------
// useResearchItemFacts — fetch /api/research/facts?researchItemId=...
// ---------------------------------------------------------------------------
export function useResearchItemFacts(researchItemId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{
    facts: Array<{
      id: string;
      personId: string;
      researchItemId: string | null;
      factType: string;
      factValue: string;
      factDateSort: number | null;
      confidence: string;
      notes: string | null;
      createdAt: string;
    }>;
  }>(`/api/research/facts?researchItemId=${researchItemId}`);

  return {
    facts: data?.facts ?? [],
    isLoading,
    error,
    refetch,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/research/evidence-client.ts
git commit -m "feat(research): add useResearchItemFacts hook"
```

---

## Task 4: Create Route Files (page, loading, error)

**Files:**
- Create: `apps/web/app/(auth)/research/item/[id]/page.tsx`
- Create: `apps/web/app/(auth)/research/item/[id]/loading.tsx`
- Create: `apps/web/app/(auth)/research/item/[id]/error.tsx`

- [ ] **Step 1: Create page.tsx**

Follows the exact same pattern as `apps/web/app/(auth)/research/person/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createFamilyDb } from '@ancstra/db';
import { getResearchItem } from '@ancstra/research';
import { ItemDetailShell } from '@/components/research/item-detail/item-detail-shell';
import { getAuthContext } from '@/lib/auth/context';

export default async function ResearchItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = createFamilyDb(authContext.dbFilename);
  const item = await getResearchItem(db, id);
  if (!item) notFound();

  return <ItemDetailShell item={item} />;
}
```

- [ ] **Step 2: Create loading.tsx**

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function ResearchItemLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-48" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create error.tsx**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ResearchItemError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || 'Failed to load this research item.'}
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/research">Go back to Research</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

Note: Build will fail because `ItemDetailShell` doesn't exist yet. That's expected — we'll create it in Task 5. For now, verify no other errors (route structure, imports). If the build fails only on the missing import, that's acceptable at this stage.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(auth\)/research/item/
git commit -m "feat(research): add item detail route with loading and error boundary"
```

---

## Task 5: Create ItemDetailShell + ItemHeader

**Files:**
- Create: `apps/web/components/research/item-detail/item-detail-shell.tsx`
- Create: `apps/web/components/research/item-detail/item-header.tsx`

- [ ] **Step 1: Create item-header.tsx**

```tsx
'use client';

import { useState } from 'react';
import { ChevronRight, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ProviderBadge } from '../provider-badge';
import { STATUS_CONFIG, DISCOVERY_METHOD_LABELS } from '@/lib/research/constants';
import { toast } from 'sonner';

interface ItemHeaderProps {
  item: {
    id: string;
    title: string;
    url: string | null;
    status: string;
    providerId: string | null;
    discoveryMethod: string;
    createdAt: string;
  };
  onStatusChange: (newStatus: string) => void;
  onDeleted: () => void;
}

export function ItemHeader({ item, onStatusChange, onDeleted }: ItemHeaderProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      onStatusChange(newStatus);
      toast.success(
        newStatus === 'promoted' ? 'Item promoted' :
        newStatus === 'dismissed' ? 'Item dismissed' : 'Item restored'
      );
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Item deleted');
      onDeleted();
      router.push('/research');
    } catch {
      toast.error('Failed to delete item');
      setDeleting(false);
    }
  }

  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  const askAiPrompt = `Tell me more about this record: "${item.title}"${
    item.providerId ? ` from ${item.providerId}` : ''
  }${item.url ? `. URL: ${item.url}` : ''}`;

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-xs">
          <li>
            <Link href="/research" className="text-muted-foreground transition-colors hover:text-primary">
              Research
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3 text-muted-foreground" />
          </li>
          <li aria-current="page">
            <span className="max-w-[200px] truncate font-medium text-foreground sm:max-w-none">
              {item.title}
            </span>
          </li>
        </ol>
      </nav>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {item.providerId && <ProviderBadge providerId={item.providerId} />}
        <Badge variant="outline" className={statusConfig.className}>
          {statusConfig.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {methodLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold">{item.title}</h1>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {item.status === 'draft' && (
          <>
            <Button
              size="sm"
              onClick={() => updateStatus('promoted')}
              disabled={updating}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Promote
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus('dismissed')} disabled={updating}>
              Dismiss
            </Button>
          </>
        )}
        {item.status === 'dismissed' && (
          <Button size="sm" variant="outline" onClick={() => updateStatus('draft')} disabled={updating}>
            Restore
          </Button>
        )}
        {item.url && (
          <Button size="sm" variant="outline" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open URL
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          asChild
        >
          <Link href={`/research?askAi=${encodeURIComponent(askAiPrompt)}`}>
            <Sparkles className="size-3.5" />
            Ask AI
          </Link>
        </Button>

        <div className="flex-1" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={deleting}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete research item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{item.title}&rdquo; and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create item-detail-shell.tsx**

```tsx
'use client';

import { useState } from 'react';
import { ItemHeader } from './item-header';
import { ItemContent } from './item-content';
import { ItemSidebar } from './item-sidebar';

interface ResearchItemData {
  id: string;
  title: string;
  url: string | null;
  snippet: string | null;
  fullText: string | null;
  notes: string | null;
  status: string;
  providerId: string | null;
  providerRecordId: string | null;
  discoveryMethod: string;
  searchQuery: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  personIds: string[];
}

interface ItemDetailShellProps {
  item: ResearchItemData;
}

export function ItemDetailShell({ item: initialItem }: ItemDetailShellProps) {
  const [item, setItem] = useState(initialItem);

  const handleStatusChange = (newStatus: string) => {
    setItem((prev) => ({ ...prev, status: newStatus }));
  };

  const handleNotesChange = (notes: string) => {
    setItem((prev) => ({ ...prev, notes }));
  };

  const handleDeleted = () => {
    // Navigation happens in ItemHeader
  };

  return (
    <div className="space-y-6">
      <ItemHeader
        item={item}
        onStatusChange={handleStatusChange}
        onDeleted={handleDeleted}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ItemContent
          item={item}
          onNotesChange={handleNotesChange}
        />
        <ItemSidebar item={item} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create stub files for ItemContent and ItemSidebar**

Create `apps/web/components/research/item-detail/item-content.tsx`:

```tsx
'use client';

interface ItemContentProps {
  item: {
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    id: string;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
}

export function ItemContent({ item }: ItemContentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Content placeholder — implemented in Task 6</p>
      </div>
    </div>
  );
}
```

Create `apps/web/components/research/item-detail/item-sidebar.tsx`:

```tsx
'use client';

interface ItemSidebarProps {
  item: {
    id: string;
    providerId: string | null;
    discoveryMethod: string;
    searchQuery: string | null;
    archivedAt: string | null;
    url: string | null;
    createdAt: string;
    updatedAt: string;
    personIds: string[];
  };
}

export function ItemSidebar({ item }: ItemSidebarProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Sidebar placeholder — implemented in Task 7</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`
Expected: Build passes. The page is navigable at `/research/item/[id]`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/item-detail/
git commit -m "feat(research): add item detail shell with header, actions, and delete dialog"
```

---

## Task 6: Implement ItemContent (Summary, Full Text, Notes)

**Files:**
- Create: `apps/web/components/research/item-detail/item-notes-editor.tsx`
- Modify: `apps/web/components/research/item-detail/item-content.tsx`

- [ ] **Step 1: Create item-notes-editor.tsx**

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface ItemNotesEditorProps {
  itemId: string;
  initialNotes: string | null;
  onNotesChange: (notes: string) => void;
}

export function ItemNotesEditor({ itemId, initialNotes, onNotesChange }: ItemNotesEditorProps) {
  const [value, setValue] = useState(initialNotes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? '');

  const save = useCallback(async (notes: string) => {
    if (notes === lastSavedRef.current) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/research/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to save');
      lastSavedRef.current = notes;
      onNotesChange(notes);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [itemId, onNotesChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(newValue), 500);
  }, [save]);

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save(value);
  }, [save, value]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
        <span aria-live="polite" className="text-[11px] text-muted-foreground">
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={() => save(value)}
              className="text-destructive hover:underline"
            >
              Failed to save — retry
            </button>
          )}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Click to add research notes..."
        className="min-h-24 resize-y"
        aria-label="Research notes"
      />
    </div>
  );
}
```

- [ ] **Step 2: Implement item-content.tsx**

Replace the stub with the full implementation:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemNotesEditor } from './item-notes-editor';
import { useScrapeUrl } from '@/lib/research/scrape-client';

interface ItemContentProps {
  item: {
    id: string;
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
}

export function ItemContent({ item, onNotesChange }: ItemContentProps) {
  const [expanded, setExpanded] = useState(false);
  const { scrape, isLoading: scraping } = useScrapeUrl();
  const [scraped, setScraped] = useState(false);

  const handleScrape = useCallback(async () => {
    if (!item.url) return;
    const result = await scrape(item.url);
    if (result) {
      setScraped(true);
      // Page will need a full refresh to pick up new fullText from server
      window.location.reload();
    }
  }, [item.url, scrape]);

  const fullTextPreview = item.fullText
    ? item.fullText.length > 200
      ? item.fullText.slice(0, 200) + '...'
      : item.fullText
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
        {item.snippet ? (
          <p className="text-sm leading-relaxed text-foreground">{item.snippet}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No summary available.</p>
        )}
      </div>

      {/* Full Text */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Text</h3>
        {item.fullText ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {expanded ? item.fullText : fullTextPreview}
            </p>
            {item.fullText.length > 200 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-sm text-primary hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No full text available.</p>
            {item.url && !scraped && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleScrape}
                disabled={scraping}
              >
                {scraping ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  'Scrape URL'
                )}
              </Button>
            )}
          </div>
        )}
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
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/item-detail/item-notes-editor.tsx apps/web/components/research/item-detail/item-content.tsx
git commit -m "feat(research): implement item detail content column with notes editor"
```

---

## Task 7: Implement ItemSidebar (Facts, People, Details)

**Files:**
- Modify: `apps/web/components/research/item-detail/item-sidebar.tsx`

- [ ] **Step 1: Replace the stub with full implementation**

```tsx
'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from '../provider-badge';
import { useResearchItemFacts } from '@/lib/research/evidence-client';
import {
  DISCOVERY_METHOD_LABELS,
  CONFIDENCE_VARIANT,
} from '@/lib/research/constants';

interface ItemSidebarProps {
  item: {
    id: string;
    providerId: string | null;
    discoveryMethod: string;
    searchQuery: string | null;
    archivedAt: string | null;
    url: string | null;
    createdAt: string;
    updatedAt: string;
    personIds: string[];
  };
}

function formatFactType(factType: string): string {
  return factType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ItemSidebar({ item }: ItemSidebarProps) {
  const { facts, isLoading: factsLoading } = useResearchItemFacts(item.id);

  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  return (
    <div className="space-y-4">
      {/* Extracted Facts */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Extracted Facts {facts.length > 0 && `(${facts.length})`}
        </h3>
        {factsLoading ? (
          <p className="text-sm text-muted-foreground">Loading facts...</p>
        ) : facts.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No facts extracted yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled
              title="Coming soon"
            >
              Extract Facts
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {facts.map((fact) => (
              <div key={fact.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{formatFactType(fact.factType)}</span>
                  <p className="font-medium">{fact.factValue}</p>
                </div>
                <Badge variant={CONFIDENCE_VARIANT[fact.confidence] ?? 'outline'} className="shrink-0 text-[10px]">
                  {fact.confidence}
                </Badge>
              </div>
            ))}
            <div className="border-t border-border pt-2 text-center">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled
                title="Coming soon"
              >
                + Extract more facts
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Linked People */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked People {item.personIds.length > 0 && `(${item.personIds.length})`}
        </h3>
        {item.personIds.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No people linked yet.</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-primary">
              + Link to person
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {item.personIds.map((personId) => (
              <Link
                key={personId}
                href={`/research/person/${personId}`}
                className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {personId}
              </Link>
            ))}
            <div className="border-t border-border pt-2 text-center">
              <Button size="sm" variant="ghost" className="text-xs text-primary">
                + Link to person
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h3>
        <dl className="space-y-2 text-sm">
          {item.providerId && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Provider</dt>
              <dd><ProviderBadge providerId={item.providerId} /></dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Found via</dt>
            <dd>{methodLabel}</dd>
          </div>
          {item.searchQuery && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Search query</dt>
              <dd className="max-w-[160px] truncate text-muted-foreground">{item.searchQuery}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{item.archivedAt ? `Yes (${new Date(item.archivedAt).toLocaleDateString()})` : 'No'}</dd>
          </div>
          {item.url && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">URL</dt>
              <dd>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline max-w-[160px] truncate"
                >
                  {(() => { try { return new URL(item.url).hostname; } catch { return item.url; } })()}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(item.updatedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
```

**Deferred features (follow-up tasks, not blockers):**
- **Person search/link popover:** The "+ Link to person" button is a placeholder (no onClick). Implementing the popover with `GET /api/persons?q=` search is a separate task.
- **Person name resolution:** Linked people show as person IDs, not names. Resolving names requires a new API call or server-side join — separate task.
- Both are tracked in the spec as known limitations, not bugs.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/item-detail/item-sidebar.tsx
git commit -m "feat(research): implement item detail sidebar with facts, people, and metadata"
```

---

## Task 8: Wire Ask AI Query Param in ResearchLayout

**Files:**
- Modify: `apps/web/components/research/research-layout.tsx`

- [ ] **Step 1: Add useSearchParams and useEffect to read `askAi` query param**

Add imports:
```tsx
import { useSearchParams } from 'next/navigation';
import { useState, useCallback, Suspense, useEffect } from 'react';
```

Since `useSearchParams` needs a Suspense boundary, we need to extract the component's body into an inner component. Apply these surgical changes rather than replacing the entire file:

1. Add `useEffect` to the React import and add `useSearchParams, useRouter` from `next/navigation`
2. Rename `ResearchLayout` to `ResearchLayoutInner`
3. Add the `useSearchParams`/`useRouter` hooks and the `askAi` param `useEffect` at the top of `ResearchLayoutInner`
4. Create a new `ResearchLayout` export that wraps `ResearchLayoutInner` in `<Suspense>`

The result should look like:

```tsx
'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function ResearchLayoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeView, setActiveView] = useState<ResearchView>('search');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);

  // Read ?askAi= param on mount (from item detail "Ask AI" button)
  useEffect(() => {
    const askAi = searchParams.get('askAi');
    if (askAi) {
      setPendingAiPrompt(askAi);
      setActiveView('chat');
      // Clean the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('askAi');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/research');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only on mount

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

export function ResearchLayout() {
  return (
    <Suspense>
      <ResearchLayoutInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/research-layout.tsx
git commit -m "feat(research): read askAi query param for item detail → chat bridge"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm --filter web build` completes without errors
- [ ] Clicking a saved item card on `/research` navigates to `/research/item/[id]`
- [ ] Promote/Dismiss/Restore buttons on the card do NOT navigate (stopPropagation works)
- [ ] Detail page shows breadcrumb: Research > Item Title
- [ ] Header shows provider badge, status badge, discovery method, date
- [ ] Promote/Dismiss/Restore buttons work on detail page with toast feedback
- [ ] Open URL button opens external link in new tab
- [ ] Delete button shows confirmation dialog, deletes, navigates back to `/research`
- [ ] Summary card shows snippet or "No summary available"
- [ ] Full Text card shows collapsed text with "Show more" toggle
- [ ] Full Text card shows "Scrape URL" button when no fullText + url exists
- [ ] Notes editor auto-saves on blur with "Saving..." / "Saved" indicator
- [ ] Sidebar shows extracted facts with confidence badges
- [ ] Sidebar shows linked people (or empty state)
- [ ] Sidebar shows metadata details
- [ ] Ask AI button navigates to `/research?askAi=...` and opens AI chat
- [ ] Loading skeleton shows during page load
- [ ] Error boundary shows on server errors
- [ ] Mobile: single column layout, action buttons wrap
