# Merge Person Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `/person/[id]` and `/research/person/[id]` into a single unified person page at `/person/[id]` with 11 tabs (3 new: Record, Biography, Citations; 1 enhanced: Timeline with event CRUD).

**Architecture:** The existing `WorkspaceShell` tab container moves from the research route to `/person/[id]`. Three new tab components absorb functionality from the old `PersonDetail` component. The Timeline tab gains inline event CRUD. The old `/research/person/[id]` route becomes a redirect. The old `PersonDetail` component is deleted.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, Tailwind CSS v4, `@ancstra/shared` types

**Spec:** `docs/superpowers/specs/2026-03-27-merge-person-pages-design.md`

---

## File Map

### Files to create
| File | Responsibility |
|---|---|
| `apps/web/components/research/record/record-tab.tsx` | Vitals view/edit, family links, delete person |
| `apps/web/components/research/biography/biography-tab.tsx` | Wrapper combining BiographySection + HistoricalContext |
| `apps/web/components/research/citations/citations-tab.tsx` | Citation list + form for a person |

### Files to modify
| File | Change |
|---|---|
| `apps/web/components/research/workspace/workspace-tabs.tsx` | Add 3 new tab entries, expand `WorkspaceView` type |
| `apps/web/components/research/workspace/workspace-shell.tsx` | Expand `PersonSummary` → import `PersonDetail`, add 3 tab cases, enhance timeline props, add Edit button, default to `record` |
| `apps/web/components/research/timeline/timeline-tab.tsx` | Accept `events` prop, interleave with facts, add inline event CRUD |
| `apps/web/components/research/timeline/timeline-event.tsx` | Add `source` indicator (event vs fact), optional edit/delete actions |
| `apps/web/components/research/breadcrumb.tsx` | Add `record`, `biography`, `citations`, `factsheets` to `VIEW_LABELS` |
| `apps/web/app/(auth)/person/[id]/page.tsx` | Render `WorkspaceShell` with full `PersonDetail` instead of `PersonDetail` component |
| `apps/web/app/(auth)/research/person/[id]/page.tsx` | Replace with redirect to `/person/{id}` |
| `apps/web/components/tree/tree-context-menu.tsx` | Change `/research/person/` link to `/person/` with `?view=board` |
| `apps/web/components/research/item-detail/item-sidebar.tsx` | Change `/research/person/` link to `/person/` |

### Files to delete
| File | Reason |
|---|---|
| `apps/web/components/person-detail.tsx` | Replaced by Record, Biography, Citations tabs |
| `apps/web/app/(auth)/person/[id]/edit/page.tsx` | Editing moves to Record tab |

---

## Task 1: Expand WorkspaceView type and tabs array

**Files:**
- Modify: `apps/web/components/research/workspace/workspace-tabs.tsx`
- Modify: `apps/web/components/research/breadcrumb.tsx`

- [ ] **Step 1: Update WorkspaceView type**

In `apps/web/components/research/workspace/workspace-tabs.tsx`, change line 19:

```typescript
// Before:
export type WorkspaceView = 'board' | 'matrix' | 'conflicts' | 'timeline' | 'canvas' | 'hints' | 'proof' | 'factsheets';

// After:
export type WorkspaceView = 'record' | 'board' | 'matrix' | 'conflicts' | 'timeline' | 'canvas' | 'hints' | 'proof' | 'factsheets' | 'biography' | 'citations';
```

- [ ] **Step 2: Add new tab entries to tabs array**

Add `UserPen`, `BookMarked`, `Quote` to the lucide-react import (line 8), then update the tabs array (lines 21-30):

```typescript
import {
  LayoutGrid,
  Table2,
  GitCompareArrows,
  Clock,
  PenTool,
  BookOpen,
  FileText,
  Layers,
  UserPen,
  BookMarked,
  Quote,
  type LucideIcon,
} from 'lucide-react';

const tabs: { value: WorkspaceView; label: string; icon: LucideIcon }[] = [
  { value: 'record', label: 'Record', icon: UserPen },
  { value: 'board', label: 'Board', icon: LayoutGrid },
  { value: 'matrix', label: 'Matrix', icon: Table2 },
  { value: 'conflicts', label: 'Conflicts', icon: GitCompareArrows },
  { value: 'timeline', label: 'Timeline', icon: Clock },
  { value: 'canvas', label: 'Canvas', icon: PenTool },
  { value: 'hints', label: 'Hints', icon: BookOpen },
  { value: 'proof', label: 'Proof', icon: FileText },
  { value: 'factsheets', label: 'Factsheets', icon: Layers },
  { value: 'biography', label: 'Biography', icon: BookMarked },
  { value: 'citations', label: 'Citations', icon: Quote },
];
```

- [ ] **Step 3: Update breadcrumb VIEW_LABELS**

In `apps/web/components/research/breadcrumb.tsx`, update the `VIEW_LABELS` record (lines 9-17) to include all 11 views:

```typescript
const VIEW_LABELS: Record<WorkspaceView, string> = {
  record: 'Record',
  board: 'Board',
  matrix: 'Matrix',
  conflicts: 'Conflicts',
  timeline: 'Timeline',
  canvas: 'Canvas',
  hints: 'Hints',
  proof: 'Proof',
  factsheets: 'Factsheets',
  biography: 'Biography',
  citations: 'Citations',
};
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`

Expected: Type errors in `workspace-shell.tsx` about missing tab components (record, biography, citations) — this is expected since we haven't created them yet. No errors in the files we just modified.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/research/workspace/workspace-tabs.tsx apps/web/components/research/breadcrumb.tsx
git commit -m "feat: expand WorkspaceView to 11 tabs (record, biography, citations)"
```

---

## Task 2: Create Record Tab

**Files:**
- Create: `apps/web/components/research/record/record-tab.tsx`

This is the largest new component. It combines the vitals view/edit card, family card, and delete functionality from the old `PersonDetail` component.

- [ ] **Step 1: Create record-tab.tsx**

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { PersonDetail, PersonListItem } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { PersonLinkPopover } from '@/components/person-link-popover';

interface RecordTabProps {
  person: PersonDetail;
}

export function RecordTab({ person }: RecordTabProps) {
  const router = useRouter();

  // --- Vitals edit state ---
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [givenName, setGivenName] = useState(person.givenName);
  const [surname, setSurname] = useState(person.surname);
  const [birthDate, setBirthDate] = useState(person.birthDate ?? '');
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? '');
  const [deathDate, setDeathDate] = useState(person.deathDate ?? '');
  const [deathPlace, setDeathPlace] = useState(person.deathPlace ?? '');
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [notes, setNotes] = useState(person.notes ?? '');

  // --- Delete state ---
  const [deleting, setDeleting] = useState(false);

  const handleSaveVitals = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          givenName,
          surname,
          birthDate: birthDate || undefined,
          birthPlace: birthPlace || undefined,
          deathDate: deathDate || undefined,
          deathPlace: deathPlace || undefined,
          isLiving,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Person updated');
      setEditing(false);
      router.refresh();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [person.id, givenName, surname, birthDate, birthPlace, deathDate, deathPlace, isLiving, notes, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Person deleted');
      router.push('/persons');
    } catch {
      toast.error('Failed to delete person');
      setDeleting(false);
    }
  }, [person.id, router]);

  const fullName = [person.prefix, person.givenName, person.surname, person.suffix]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Vitals Card ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vital Information</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="givenName">Given Name</Label>
                  <Input id="givenName" value={givenName} onChange={(e) => setGivenName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="surname">Surname</Label>
                  <Input id="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthDate">Birth Date</Label>
                  <Input id="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="15 Mar 1880" />
                </div>
                <div>
                  <Label htmlFor="birthPlace">Birth Place</Label>
                  <Input id="birthPlace" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="London, England" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deathDate">Death Date</Label>
                  <Input id="deathDate" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} placeholder="22 Nov 1945" />
                </div>
                <div>
                  <Label htmlFor="deathPlace">Death Place</Label>
                  <Input id="deathPlace" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} placeholder="Manchester, England" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="isLiving" checked={isLiving} onCheckedChange={setIsLiving} />
                <Label htmlFor="isLiving">Is Living</Label>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveVitals} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{fullName}</span>
                <Badge variant="secondary">{person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : 'Unknown'}</Badge>
                {person.isLiving && <Badge variant="outline">Living</Badge>}
              </div>
              {(person.birthDate || person.birthPlace) && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Born:</span> {[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}
                </p>
              )}
              {(person.deathDate || person.deathPlace) && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Died:</span> {[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}
                </p>
              )}
              {person.notes && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
              )}
              {!person.birthDate && !person.deathDate && !person.notes && (
                <p className="text-sm text-muted-foreground italic">No vital information recorded.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Family Card ── */}
      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spouses */}
          <FamilySection
            label="Spouses"
            people={person.spouses}
            addButton={
              <Link href={`/person/new?relation=spouse&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Spouse</Button>
              </Link>
            }
          />

          {/* Parents */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">Parents</h4>
            {person.parents.length > 0 ? (
              <ul className="space-y-1">
                {person.parents.map((p) => (
                  <PersonRow key={p.id} person={p} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No parents recorded.</p>
            )}
            <div className="mt-2 flex gap-2">
              <Link href={`/person/new?relation=father&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Father</Button>
              </Link>
              <Link href={`/person/new?relation=mother&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Mother</Button>
              </Link>
            </div>
          </div>

          {/* Children */}
          <FamilySection
            label="Children"
            people={person.children}
            addButton={
              <Link href={`/person/new?relation=child&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Child</Button>
              </Link>
            }
          />

          {/* Link existing person */}
          <PersonLinkPopover
            personId={person.id}
            personSex={person.sex}
            onLinked={() => router.refresh()}
          />
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Person'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {fullName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this person and all associated events, citations, and family links.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ──

function FamilySection({
  label,
  people,
  addButton,
}: {
  label: string;
  people: PersonListItem[];
  addButton: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h4>
      {people.length > 0 ? (
        <ul className="space-y-1">
          {people.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">None recorded.</p>
      )}
      <div className="mt-2">{addButton}</div>
    </div>
  );
}

function PersonRow({ person }: { person: PersonListItem }) {
  return (
    <li>
      <Link
        href={`/person/${person.id}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {person.givenName} {person.surname}
      </Link>
      {person.sex !== 'U' && (
        <Badge variant="secondary" className="ml-2 text-[10px]">
          {person.sex === 'M' ? 'Male' : 'Female'}
        </Badge>
      )}
      {person.birthDate && (
        <span className="ml-2 text-xs text-muted-foreground">b. {person.birthDate}</span>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep record-tab || echo "No errors in record-tab"`

Expected: No errors specific to `record-tab.tsx`. There may be errors elsewhere from incomplete wiring.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/record/record-tab.tsx
git commit -m "feat: create RecordTab component (vitals, family, delete)"
```

---

## Task 3: Create Biography Tab

**Files:**
- Create: `apps/web/components/research/biography/biography-tab.tsx`

This wraps the existing `BiographyTab` (from `components/biography/biography-tab.tsx`) and `HistoricalEvent` into a single research workspace tab. The existing biography components stay in place — this is a thin wrapper that composes them.

- [ ] **Step 1: Create biography-tab.tsx**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BiographyOptions, type BiographyOptionsResult } from '@/components/biography/biography-options';
import { BiographyViewer } from '@/components/biography/biography-viewer';
import { HistoricalEvent } from '@/components/timeline/historical-event';

interface ResearchBiographyTabProps {
  personId: string;
  personName: string;
}

interface HistoricalEventData {
  year: number;
  title: string;
  description: string;
  relevance: string;
}

export function ResearchBiographyTab({ personId, personName }: ResearchBiographyTabProps) {
  // --- Biography state ---
  const [biographyText, setBiographyText] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // --- Historical context state ---
  const [showHistorical, setShowHistorical] = useState(false);
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEventData[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);

  // Check for cached biography on mount
  const checkBioCache = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/biography?personId=${personId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.text) setBiographyText(data.text);
      }
    } catch {
      // ignore
    } finally {
      setBioLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    checkBioCache();
  }, [checkBioCache]);

  // Generate biography with streaming
  const handleGenerate = useCallback(
    async (options: BiographyOptionsResult) => {
      setStreaming(true);
      setOptionsOpen(false);
      setBiographyText('');
      try {
        const res = await fetch('/api/ai/biography', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, ...options }),
        });
        if (!res.ok || !res.body) throw new Error('Generation failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setBiographyText(text);
        }
      } catch {
        toast.error('Failed to generate biography');
      } finally {
        setStreaming(false);
      }
    },
    [personId],
  );

  // Fetch historical context on toggle
  const handleHistoricalToggle = useCallback(
    async (checked: boolean) => {
      setShowHistorical(checked);
      if (!checked || historicalLoaded) return;
      setHistoricalLoading(true);
      try {
        // Try cached first
        const cacheRes = await fetch(`/api/ai/historical-context?personId=${personId}`);
        if (cacheRes.ok) {
          const data = await cacheRes.json();
          if (data.events?.length) {
            setHistoricalEvents(data.events);
            setHistoricalLoaded(true);
            return;
          }
        }
      } catch {
        // ignore, will show generate button
      } finally {
        setHistoricalLoading(false);
      }
    },
    [personId, historicalLoaded],
  );

  const handleGenerateHistorical = useCallback(async () => {
    setHistoricalLoading(true);
    try {
      const res = await fetch('/api/ai/historical-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setHistoricalEvents(data.events ?? []);
      setHistoricalLoaded(true);
    } catch {
      toast.error('Failed to generate historical context');
    } finally {
      setHistoricalLoading(false);
    }
  }, [personId]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Biography ── */}
      <Card>
        <CardHeader>
          <CardTitle>Biography</CardTitle>
        </CardHeader>
        <CardContent>
          {bioLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : biographyText ? (
            <BiographyViewer
              text={biographyText}
              onRegenerate={() => setOptionsOpen(true)}
              onTextChange={setBiographyText}
            />
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <p className="mb-3 text-sm">No biography generated yet.</p>
              <Button onClick={() => setOptionsOpen(true)}>Generate Biography</Button>
              <p className="mt-2 text-xs">~$0.02 per generation</p>
            </div>
          )}
          <BiographyOptions
            open={optionsOpen}
            onOpenChange={setOptionsOpen}
            onGenerate={handleGenerate}
            generating={streaming}
          />
        </CardContent>
      </Card>

      {/* ── Historical Context ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historical Context</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="historical-toggle"
              checked={showHistorical}
              onCheckedChange={handleHistoricalToggle}
            />
            <Label htmlFor="historical-toggle" className="text-sm">
              Show
            </Label>
          </div>
        </CardHeader>
        {showHistorical && (
          <CardContent>
            {historicalLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : historicalEvents.length > 0 ? (
              <div className="space-y-4">
                {historicalEvents.map((event, i) => (
                  <HistoricalEvent key={i} {...event} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Globe className="mb-2 size-8" />
                <p className="mb-3 text-sm">
                  See world events during {personName}&apos;s lifetime.
                </p>
                <Button variant="outline" onClick={handleGenerateHistorical}>
                  Generate Historical Context
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep biography-tab || echo "No errors in biography-tab"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/biography/biography-tab.tsx
git commit -m "feat: create ResearchBiographyTab (biography + historical context)"
```

---

## Task 4: Create Citations Tab

**Files:**
- Create: `apps/web/components/research/citations/citations-tab.tsx`

Thin wrapper around existing `CitationList` and `CitationForm` components which stay in their current location.

- [ ] **Step 1: Create citations-tab.tsx**

```typescript
'use client';

import { CitationList } from '@/components/citation-list';

interface CitationsTabProps {
  personId: string;
}

export function CitationsTab({ personId }: CitationsTabProps) {
  return (
    <div className="max-w-2xl">
      <CitationList personId={personId} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep citations-tab || echo "No errors in citations-tab"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/citations/citations-tab.tsx
git commit -m "feat: create CitationsTab wrapper for research workspace"
```

---

## Task 5: Enhance Timeline Tab with event CRUD

**Files:**
- Modify: `apps/web/components/research/timeline/timeline-tab.tsx`
- Modify: `apps/web/components/research/timeline/timeline-event.tsx`

Add an `events` prop to the timeline tab. Interleave events with research facts in a single chronological view. Add inline event CRUD (add/edit/delete) using the existing `EventForm` component.

- [ ] **Step 1: Update TimelineEvent to support event entries and actions**

In `apps/web/components/research/timeline/timeline-event.tsx`, expand the component to distinguish event vs fact sources and optionally show edit/delete buttons:

```typescript
'use client';

import { useState } from 'react';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CONFIDENCE_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  high: { label: 'High', variant: 'default' },
  medium: { label: 'Medium', variant: 'secondary' },
  low: { label: 'Low', variant: 'destructive' },
};

interface TimelineEventProps {
  date: string | null;
  factType: string;
  factValue: string;
  confidence: string;
  sourceName?: string;
  hasConflict?: boolean;
  isLast?: boolean;
  /** 'event' = person event (blue border), 'fact' = research fact (neutral border) */
  entrySource?: 'event' | 'fact';
  /** If true, show edit/delete action buttons */
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TimelineEvent({
  date,
  factType,
  factValue,
  confidence,
  sourceName,
  hasConflict,
  isLast,
  entrySource = 'fact',
  editable,
  onEdit,
  onDelete,
}: TimelineEventProps) {
  const conf = CONFIDENCE_BADGE[confidence] ?? CONFIDENCE_BADGE.medium;
  const isEvent = entrySource === 'event';

  return (
    <div className="group relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 mt-1 size-3 shrink-0 rounded-full border-2',
            hasConflict
              ? 'border-destructive bg-destructive/20'
              : isEvent
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-primary bg-primary/20',
          )}
        >
          {hasConflict && (
            <AlertTriangle className="absolute -right-1.5 -top-1.5 size-3 text-destructive" />
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5 pb-2">
        {date && (
          <p className="text-xs font-medium text-muted-foreground">{date}</p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{factType}</p>
          {editable && (
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="size-6" onClick={onEdit}>
                <Pencil className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={onDelete}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-foreground/80">{factValue}</p>
        <div className="flex items-center gap-2 pt-0.5">
          {sourceName && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {sourceName}
            </span>
          )}
          {isEvent && (
            <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600">
              Event
            </Badge>
          )}
          <Badge variant={conf.variant} className="text-[10px]">
            {conf.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update TimelineTab to accept and interleave events**

Replace the full contents of `apps/web/components/research/timeline/timeline-tab.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Event as PersonEvent } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import {
  usePersonFacts,
  usePersonResearchItems,
  usePersonConflicts,
} from '@/lib/research/evidence-client';
import { TimelineEvent } from './timeline-event';
import { EventForm } from '@/components/event-form';

interface TimelineTabProps {
  personId: string;
  events?: PersonEvent[];
}

/** Unified entry for the combined timeline */
interface TimelineEntry {
  id: string;
  factType: string;
  factValue: string;
  date: string | null;
  dateSort: number;
  confidence: string;
  sourceName?: string;
  hasConflict: boolean;
  entrySource: 'event' | 'fact';
  /** Original event object (only for entrySource=event), used for editing */
  eventData?: PersonEvent;
}

/**
 * Parse a date string to sortable integer (YYYYMMDD).
 * Handles YYYY-MM-DD, YYYY-MM, bare YYYY, and Date.parse fallback.
 */
function parseDateSort(dateStr: string | null): number {
  if (!dateStr) return 0;
  const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return parseInt(isoMatch[1], 10) * 10000 + parseInt(isoMatch[2], 10) * 100 + parseInt(isoMatch[3], 10);
  }
  const ymMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    return parseInt(ymMatch[1], 10) * 10000 + parseInt(ymMatch[2], 10) * 100;
  }
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 10000;
  }
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  return 0;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

const PROTECTED_TYPES = new Set(['birth', 'death']);

export function TimelineTab({ personId, events = [] }: TimelineTabProps) {
  const { facts } = usePersonFacts(personId);
  const { items } = usePersonResearchItems(personId);
  const { conflicts } = usePersonConflicts(personId);

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PersonEvent | null>(null);

  // Source name map for research items
  const sourceMap = new Map(items.map((it) => [it.id, it.title]));

  // Conflict fact IDs
  const conflictFactIds = new Set<string>();
  for (const group of conflicts) {
    for (const f of group.facts) {
      conflictFactIds.add(f.id);
    }
  }

  // Build unified timeline entries from facts
  const factEntries: TimelineEntry[] = facts.map((f) => ({
    id: f.id,
    factType: f.factType,
    factValue: f.factValue,
    date: f.factDate,
    dateSort: parseDateSort(f.factDate),
    confidence: f.confidence,
    sourceName: f.researchItemId ? sourceMap.get(f.researchItemId) : undefined,
    hasConflict: conflictFactIds.has(f.id),
    entrySource: 'fact' as const,
  }));

  // Build unified timeline entries from events
  const eventEntries: TimelineEntry[] = events.map((e) => ({
    id: e.id,
    factType: e.eventType,
    factValue: [e.dateOriginal, e.placeText, e.description].filter(Boolean).join(' — '),
    date: e.dateOriginal,
    dateSort: e.dateSort ?? parseDateSort(e.dateOriginal),
    confidence: 'high',
    hasConflict: false,
    entrySource: 'event' as const,
    eventData: e,
  }));

  // Merge and separate dated vs undated
  const all = [...factEntries, ...eventEntries];
  const dated = all.filter((e) => e.dateSort > 0).sort((a, b) => a.dateSort - b.dateSort);
  const undated = all.filter((e) => e.dateSort === 0);

  // Delete event handler
  const handleDeleteEvent = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Event deleted');
      // Refresh server data to re-render with updated events
      window.location.reload();
    } catch {
      toast.error('Failed to delete event');
    }
  }, []);

  // Empty state
  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calendar className="mb-3 size-10" />
        <p className="text-sm font-medium">No events yet</p>
        <p className="mt-1 text-xs">
          Add facts from the Board tab or add events below.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddEvent(true)}>
          <Plus className="mr-1.5 size-3" /> Add Event
        </Button>
        {showAddEvent && (
          <div className="mt-4 w-full max-w-md">
            <EventForm
              personId={personId}
              onSave={() => { setShowAddEvent(false); window.location.reload(); }}
              onCancel={() => setShowAddEvent(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Gap detection
  const GAP_THRESHOLD = 200000; // 20 years in YYYYMMDD units

  const datedElements: React.ReactNode[] = [];
  for (let i = 0; i < dated.length; i++) {
    const entry = dated[i];
    const isLast = i === dated.length - 1 && undated.length === 0;

    // Gap indicator
    if (i > 0) {
      const gap = entry.dateSort - dated[i - 1].dateSort;
      if (gap >= GAP_THRESHOLD) {
        const gapYears = Math.floor(gap / 10000);
        datedElements.push(
          <div key={`gap-${i}`} className="relative flex gap-4 py-2">
            <div className="flex flex-col items-center">
              <div className="w-px flex-1 border-l border-dashed border-muted-foreground/30" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
              <Clock className="size-3" />
              ~{gapYears} year gap
            </div>
          </div>,
        );
      }
    }

    // Inline edit form
    if (editingEvent && editingEvent.id === entry.id) {
      datedElements.push(
        <div key={`edit-${entry.id}`} className="mb-4 ml-7">
          <EventForm
            personId={personId}
            event={editingEvent}
            onSave={() => { setEditingEvent(null); window.location.reload(); }}
            onCancel={() => setEditingEvent(null)}
          />
        </div>,
      );
      continue;
    }

    const isEditable = entry.entrySource === 'event' && !PROTECTED_TYPES.has(entry.factType);

    datedElements.push(
      <TimelineEvent
        key={entry.id}
        date={formatDate(entry.date)}
        factType={entry.factType}
        factValue={entry.factValue}
        confidence={entry.confidence}
        sourceName={entry.sourceName}
        hasConflict={entry.hasConflict}
        isLast={isLast}
        entrySource={entry.entrySource}
        editable={isEditable}
        onEdit={() => entry.eventData && setEditingEvent(entry.eventData)}
        onDelete={() => entry.eventData && handleDeleteEvent(entry.eventData.id)}
      />,
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Add event button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowAddEvent(true)}>
          <Plus className="mr-1.5 size-3" /> Add Event
        </Button>
      </div>

      {/* Add event form */}
      {showAddEvent && (
        <div className="mb-4">
          <EventForm
            personId={personId}
            onSave={() => { setShowAddEvent(false); window.location.reload(); }}
            onCancel={() => setShowAddEvent(false)}
          />
        </div>
      )}

      {/* Dated events */}
      {datedElements.length > 0 && <div>{datedElements}</div>}

      {/* Undated section */}
      {undated.length > 0 && (
        <div className="space-y-1">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Undated
          </h3>
          <div>
            {undated.map((entry, i) => {
              const isEditable = entry.entrySource === 'event' && !PROTECTED_TYPES.has(entry.factType);

              if (editingEvent && editingEvent.id === entry.id) {
                return (
                  <div key={`edit-${entry.id}`} className="mb-4 ml-7">
                    <EventForm
                      personId={personId}
                      event={editingEvent}
                      onSave={() => { setEditingEvent(null); window.location.reload(); }}
                      onCancel={() => setEditingEvent(null)}
                    />
                  </div>
                );
              }

              return (
                <TimelineEvent
                  key={entry.id}
                  date={null}
                  factType={entry.factType}
                  factValue={entry.factValue}
                  confidence={entry.confidence}
                  sourceName={entry.sourceName}
                  hasConflict={entry.hasConflict}
                  isLast={i === undated.length - 1}
                  entrySource={entry.entrySource}
                  editable={isEditable}
                  onEdit={() => entry.eventData && setEditingEvent(entry.eventData)}
                  onDelete={() => entry.eventData && handleDeleteEvent(entry.eventData.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify both files compile**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -E "timeline-(tab|event)" || echo "No errors"`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/research/timeline/timeline-tab.tsx apps/web/components/research/timeline/timeline-event.tsx
git commit -m "feat: enhance timeline tab with event CRUD and interleaved events"
```

---

## Task 6: Wire WorkspaceShell to new tabs and expanded data

**Files:**
- Modify: `apps/web/components/research/workspace/workspace-shell.tsx`

- [ ] **Step 1: Update WorkspaceShell to accept full PersonDetail and render all 11 tabs**

Replace the full contents of `apps/web/components/research/workspace/workspace-shell.tsx`:

```typescript
'use client';

import { Suspense } from 'react';
import { Pencil, Search, Sparkles } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { PersonDetail } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkspaceTabs, type WorkspaceView } from './workspace-tabs';
import { ResearchBreadcrumb } from '../breadcrumb';
import { usePersonConflicts } from '@/lib/research/evidence-client';
import { usePersonHints } from '@/lib/research/hints-client';
import { useFactsheets } from '@/lib/research/factsheet-client';
import { RecordTab } from '../record/record-tab';
import { BoardTab } from '../board/board-tab';
import { ConflictsTab } from '../conflicts/conflicts-tab';
import { TimelineTab } from '../timeline/timeline-tab';
import { HintsPanel } from '../hints/hints-panel';
import { MatrixTab } from '../matrix/matrix-tab';
import { CanvasTab } from '../canvas/canvas-tab';
import { ProofTab } from '../proof/proof-tab';
import { FactsheetsTab } from '../factsheets/factsheets-tab';
import { ResearchBiographyTab } from '../biography/biography-tab';
import { CitationsTab } from '../citations/citations-tab';

interface WorkspaceShellProps {
  person: PersonDetail;
  children?: React.ReactNode;
}

function getInitials(givenName: string, surname: string): string {
  const first = givenName.charAt(0).toUpperCase();
  const last = surname.charAt(0).toUpperCase();
  return `${first}${last}`.trim() || '?';
}

function formatDates(birthDate: string | null | undefined, deathDate: string | null | undefined): string {
  if (!birthDate && !deathDate) return '';
  const birth = birthDate ?? '?';
  const death = deathDate ?? '';
  return death ? `${birth} - ${death}` : `b. ${birth}`;
}

function ShellInner({ person, children }: WorkspaceShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = (searchParams.get('view') as WorkspaceView) || 'record';
  const { conflicts } = usePersonConflicts(person.id);
  const { hints } = usePersonHints(person.id, 'pending');
  const { factsheets } = useFactsheets(person.id);
  const activeFactsheetCount = factsheets.filter(f => f.status !== 'dismissed').length;
  const dates = formatDates(person.birthDate, person.deathDate);
  const personName = `${person.givenName} ${person.surname}`.trim();

  const goToRecord = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'record');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <ResearchBreadcrumb personName={personName} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(person.givenName, person.surname)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{personName}</h1>
            {dates && (
              <p className="text-sm text-muted-foreground">{dates}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeView !== 'record' && (
            <Button variant="outline" size="sm" onClick={goToRecord}>
              <Pencil className="mr-1.5" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Search className="mr-1.5" />
            Search Sources
          </Button>
          <Button variant="outline" size="sm">
            <Sparkles className="mr-1.5" />
            Ask AI
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <WorkspaceTabs
        conflictCount={conflicts.length}
        hintCount={hints.length}
        factsheetCount={activeFactsheetCount}
      />

      {/* Tab content */}
      <div>
        {children ?? (
          <>
            {activeView === 'record' && <RecordTab person={person} />}
            {activeView === 'board' && <BoardTab personId={person.id} />}
            {activeView === 'matrix' && (
              <MatrixTab personId={person.id} personName={personName} />
            )}
            {activeView === 'conflicts' && <ConflictsTab personId={person.id} />}
            {activeView === 'timeline' && (
              <TimelineTab personId={person.id} events={person.events} />
            )}
            {activeView === 'canvas' && <CanvasTab personId={person.id} />}
            {activeView === 'hints' && (
              <HintsPanel
                personId={person.id}
                localPerson={{
                  givenName: person.givenName,
                  surname: person.surname,
                  birthDate: person.birthDate ?? null,
                  deathDate: person.deathDate ?? null,
                }}
              />
            )}
            {activeView === 'proof' && (
              <ProofTab personId={person.id} personName={personName} />
            )}
            {activeView === 'factsheets' && <FactsheetsTab personId={person.id} />}
            {activeView === 'biography' && (
              <ResearchBiographyTab personId={person.id} personName={personName} />
            )}
            {activeView === 'citations' && <CitationsTab personId={person.id} />}
          </>
        )}
      </div>
    </div>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <Suspense>
      <ShellInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors (all tab components are now created and wired).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/research/workspace/workspace-shell.tsx
git commit -m "feat: wire WorkspaceShell to 11 tabs with full PersonDetail data"
```

---

## Task 7: Update person page route and create research redirect

**Files:**
- Modify: `apps/web/app/(auth)/person/[id]/page.tsx`
- Modify: `apps/web/app/(auth)/research/person/[id]/page.tsx`

- [ ] **Step 1: Update person page to render WorkspaceShell**

Replace the full contents of `apps/web/app/(auth)/person/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { assemblePersonDetail } from '@/lib/queries';
import { WorkspaceShell } from '@/components/research/workspace/workspace-shell';
import { getAuthContext } from '@/lib/auth/context';
import { getFamilyDb } from '@/lib/db';

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = await getFamilyDb(authContext.dbFilename);
  const person = await assemblePersonDetail(db, id);
  if (!person) notFound();
  return <WorkspaceShell person={person} />;
}
```

- [ ] **Step 2: Convert research/person route to redirect**

Replace the full contents of `apps/web/app/(auth)/research/person/[id]/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default async function ResearchPersonRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = typeof sp.view === 'string' ? sp.view : undefined;
  const qs = view ? `?view=${view}` : '';
  redirect(`/person/${id}${qs}`);
}
```

- [ ] **Step 3: Verify both files compile**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -E "person/\[id\]" || echo "No errors"`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(auth)/person/[id]/page.tsx apps/web/app/(auth)/research/person/[id]/page.tsx
git commit -m "feat: person page renders WorkspaceShell, research route redirects"
```

---

## Task 8: Update links and clean up old files

**Files:**
- Modify: `apps/web/components/tree/tree-context-menu.tsx` (line 44)
- Modify: `apps/web/components/research/item-detail/item-sidebar.tsx` (line 106)
- Delete: `apps/web/components/person-detail.tsx`
- Delete: `apps/web/app/(auth)/person/[id]/edit/page.tsx`

- [ ] **Step 1: Update tree context menu**

In `apps/web/components/tree/tree-context-menu.tsx`, change line 44:

```typescript
// Before:
{ label: 'Research this person', onClick: () => { router.push(`/research/person/${nodeId}`); onClose(); } },

// After:
{ label: 'Research this person', onClick: () => { router.push(`/person/${nodeId}?view=board`); onClose(); } },
```

- [ ] **Step 2: Update item sidebar link**

In `apps/web/components/research/item-detail/item-sidebar.tsx`, change line 106:

```typescript
// Before:
href={`/research/person/${personId}`}

// After:
href={`/person/${personId}`}
```

- [ ] **Step 3: Delete old PersonDetail component**

Run: `rm apps/web/components/person-detail.tsx`

- [ ] **Step 4: Delete old edit page**

Run: `rm apps/web/app/\(auth\)/person/\[id\]/edit/page.tsx`

- [ ] **Step 5: Check for any remaining imports of deleted files**

Run: `cd apps/web && grep -r "person-detail" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v .next`

Expected: No results. If any file still imports `person-detail`, update or remove the import.

- [ ] **Step 6: Verify full build compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: update links, delete old PersonDetail and edit page"
```

---

## Task 9: Smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && pnpm dev`

- [ ] **Step 2: Navigate to a person page**

Open `http://localhost:3000/person/{any-person-id}` in the browser.

Expected:
- Page loads with the workspace shell (breadcrumb, avatar header, tabs)
- Default tab is "Record" showing vitals, family, and danger zone cards
- All 11 tabs are visible in the tab bar

- [ ] **Step 3: Test Record tab**

- Click "Edit" on the vitals card → form appears with prefilled values
- Click "Cancel" → reverts to view mode
- Click a family member link → navigates to that person's page

- [ ] **Step 4: Test Timeline tab**

- Click "Timeline" tab
- Events (blue dots) and research facts (primary dots) appear interleaved chronologically
- "Add Event" button opens the event form
- Hover over an event row → edit/delete buttons appear (not on birth/death)

- [ ] **Step 5: Test Biography and Citations tabs**

- Click "Biography" tab → shows generate button or cached biography
- Click "Citations" tab → shows citation list with add form

- [ ] **Step 6: Test research redirect**

Navigate to `http://localhost:3000/research/person/{any-person-id}?view=matrix`

Expected: Redirects to `http://localhost:3000/person/{any-person-id}?view=matrix` with Matrix tab active.

- [ ] **Step 7: Test tree context menu**

Navigate to `/tree`, right-click a person node.

Expected: "Research this person" links to `/person/{id}?view=board`.
