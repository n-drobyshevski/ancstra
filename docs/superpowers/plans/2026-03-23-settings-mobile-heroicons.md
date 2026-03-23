# Settings Mobile Adaptation + Heroicons Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the settings page fully mobile-adaptive and migrate the entire app from Lucide React to Heroicons.

**Architecture:** Two workstreams executed sequentially. First, the Heroicons migration (mechanical icon replacement + Spinner component + package swap). Second, the settings mobile adaptation (navigation pattern, responsive layouts, touch polish). Icon migration goes first because settings mobile work introduces new Heroicon imports — doing it in the other order would mean writing Lucide imports then immediately replacing them.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, @heroicons/react, Heroicons 24/outline + 20/solid

**Spec:** `docs/superpowers/specs/2026-03-23-settings-mobile-heroicons-design.md`

---

## Task 1: Install Heroicons + Create Spinner Component

**Files:**
- Create: `apps/web/components/ui/spinner.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install @heroicons/react**

```bash
cd D:/projects/ancstra && pnpm add @heroicons/react --filter web
```

Expected: Package added to `apps/web/package.json` dependencies.

- [ ] **Step 2: Create Spinner component**

Create `apps/web/components/ui/spinner.tsx`:

```tsx
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
```

- [ ] **Step 3: Verify Spinner renders**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No type errors from spinner.tsx.

- [ ] **Step 4: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/package.json apps/web/components/ui/spinner.tsx pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
feat: install @heroicons/react and add Spinner component

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate Settings Component Icons (Lucide → Heroicons)

**Files:**
- Modify: `apps/web/components/settings/settings-nav.tsx`
- Modify: `apps/web/components/settings/theme-selector.tsx`
- Modify: `apps/web/components/settings/storage-usage.tsx`
- Modify: `apps/web/components/settings/provider-card.tsx`
- Modify: `apps/web/components/settings/data-settings.tsx`
- Modify: `apps/web/components/settings/worker-status.tsx`
- Modify: `apps/web/app/(auth)/settings/sources/page.tsx`

For each file, replace the `lucide-react` import with the equivalent `@heroicons/react` import using the mapping table below, and replace `Loader2` with the `Spinner` component.

**Icon mapping for settings files:**

| File | Lucide Icons | Heroicons Replacements |
|------|-------------|----------------------|
| settings-nav.tsx | Search, Palette, Shield, Database, Bot | MagnifyingGlassIcon, SwatchIcon, ShieldCheckIcon, CircleStackIcon, CpuChipIcon |
| theme-selector.tsx | Sun, Moon, Monitor | SunIcon, MoonIcon, ComputerDesktopIcon |
| storage-usage.tsx | Database, Archive, Image | CircleStackIcon, ArchiveBoxIcon, PhotoIcon |
| provider-card.tsx | Loader2, Eye, EyeOff, Zap | Spinner, EyeIcon, EyeSlashIcon, BoltIcon |
| data-settings.tsx | Download, Upload, Trash2, Archive, AlertTriangle | ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon, ArchiveBoxIcon, ExclamationTriangleIcon |
| worker-status.tsx | Loader2, Server, ExternalLink | Spinner, ServerIcon, ArrowTopRightOnSquareIcon |
| sources/page.tsx | Loader2, RefreshCw | Spinner, ArrowPathIcon |

- [ ] **Step 1: Migrate settings-nav.tsx**

Replace:
```tsx
import { Search, Palette, Shield, Database, Bot } from 'lucide-react';
```
With:
```tsx
import { MagnifyingGlassIcon, SwatchIcon, ShieldCheckIcon, CircleStackIcon, CpuChipIcon } from '@heroicons/react/24/outline';
```
Update `navItems` array to use new icon names: `icon: MagnifyingGlassIcon`, etc.

- [ ] **Step 2: Migrate theme-selector.tsx**

Replace:
```tsx
import { Sun, Moon, Monitor } from 'lucide-react';
```
With:
```tsx
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
```
Update `themes` array to use new icon names.

- [ ] **Step 3: Migrate storage-usage.tsx**

Replace:
```tsx
import { Database, Archive, Image } from 'lucide-react';
```
With:
```tsx
import { CircleStackIcon, ArchiveBoxIcon, PhotoIcon } from '@heroicons/react/24/outline';
```
Update `categories` array.

- [ ] **Step 4: Migrate provider-card.tsx**

Replace:
```tsx
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react';
```
With:
```tsx
import { EyeIcon, EyeSlashIcon, BoltIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/spinner';
```
Replace all `<Loader2 className="size-3.5 animate-spin" />` with `<Spinner className="size-3.5" />`.

- [ ] **Step 5: Migrate data-settings.tsx**

Replace:
```tsx
import { Download, Upload, Trash2, Archive, AlertTriangle } from 'lucide-react';
```
With:
```tsx
import { ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon, ArchiveBoxIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
```

- [ ] **Step 6: Migrate worker-status.tsx**

Replace:
```tsx
import { Loader2, Server, ExternalLink } from 'lucide-react';
```
With:
```tsx
import { ServerIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/spinner';
```

- [ ] **Step 7: Migrate sources/page.tsx**

Replace:
```tsx
import { Loader2, RefreshCw } from 'lucide-react';
```
With:
```tsx
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/spinner';
```

- [ ] **Step 8: Type-check settings files**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors in settings files.

- [ ] **Step 9: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/settings/ apps/web/app/\(auth\)/settings/ && git commit -m "$(cat <<'EOF'
refactor: migrate settings components from Lucide to Heroicons

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate App Shell Icons (Sidebar, Header, Mode Toggle)

**Files:**
- Modify: `apps/web/components/app-sidebar.tsx`
- Modify: `apps/web/components/app-header.tsx`
- Modify: `apps/web/components/mode-toggle.tsx`
- Modify: `apps/web/components/auth/family-picker.tsx`

**Icon mapping:**

| File | Lucide Icons | Heroicons Replacements |
|------|-------------|----------------------|
| app-sidebar.tsx | Home, Users, GitBranch, Search, BookOpen, Bookmark, Upload, Activity, BarChart3, Settings, LogOut, ExternalLink | HomeIcon, UserGroupIcon, ShareIcon, MagnifyingGlassIcon, BookOpenIcon, BookmarkIcon, ArrowUpTrayIcon, ChartBarIcon, ChartBarIcon, Cog6ToothIcon, ArrowRightStartOnRectangleIcon, ArrowTopRightOnSquareIcon |
| family-picker.tsx | ChevronDown | ChevronDownIcon |

- [ ] **Step 1: Migrate app-sidebar.tsx**

Replace lucide-react import with heroicons equivalents. Note: `Activity` and `BarChart3` both map to `ChartBarIcon` — if both are used distinctly, use `ChartBarIcon` for both (they serve similar purposes).

- [ ] **Step 2: Migrate app-header.tsx, mode-toggle.tsx, family-picker.tsx**

Replace lucide-react imports with heroicons equivalents in each file.

- [ ] **Step 3: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/app-sidebar.tsx apps/web/components/app-header.tsx apps/web/components/mode-toggle.tsx apps/web/components/auth/ && git commit -m "$(cat <<'EOF'
refactor: migrate app shell icons from Lucide to Heroicons

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate Research Component Icons (Batch 1 — Core)

**Files:**
- Modify: `apps/web/components/research/research-hub.tsx`
- Modify: `apps/web/components/research/research-layout.tsx`
- Modify: `apps/web/components/research/chat-panel.tsx`
- Modify: `apps/web/components/research/chat-message.tsx`
- Modify: `apps/web/components/research/search-bar.tsx`
- Modify: `apps/web/components/research/search-result-card.tsx`
- Modify: `apps/web/components/research/research-item-card.tsx`
- Modify: `apps/web/components/research/source-selector.tsx`
- Modify: `apps/web/components/research/tool-call-indicator.tsx`
- Modify: `apps/web/components/research/workspace/workspace-shell.tsx`

For each file: replace `lucide-react` import with mapped `@heroicons/react/24/outline` icons. Replace `Loader2` with `Spinner` import.

- [ ] **Step 1: Migrate all 10 files**

Use the icon mapping table from the spec. Key replacements in this batch:
- `Search` → `MagnifyingGlassIcon`
- `Globe` → `GlobeAltIcon`
- `Sparkles` → `SparklesIcon`
- `Send` → `PaperAirplaneIcon`
- `User` / `Bot` → `UserIcon` / `CpuChipIcon`
- `Loader2` → `Spinner` (from `@/components/ui/spinner`)
- `Check` / `X` → `CheckIcon` / `XMarkIcon`
- `ChevronDown` / `ChevronRight` → `ChevronDownIcon` / `ChevronRightIcon`
- `AlertTriangle` → `ExclamationTriangleIcon`
- `Settings2` → `AdjustmentsHorizontalIcon`

- [ ] **Step 2: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/research/ && git commit -m "$(cat <<'EOF'
refactor: migrate research core icons from Lucide to Heroicons

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrate Research Component Icons (Batch 2 — Sub-modules)

**Files:**
- Modify: `apps/web/components/research/proof/proof-tab.tsx`
- Modify: `apps/web/components/research/proof/proof-section.tsx`
- Modify: `apps/web/components/research/matrix/matrix-tab.tsx`
- Modify: `apps/web/components/research/matrix/matrix-conclusion-cell.tsx`
- Modify: `apps/web/components/research/canvas/source-palette.tsx`
- Modify: `apps/web/components/research/canvas/canvas-toolbar.tsx`
- Modify: `apps/web/components/research/canvas/note-node.tsx`
- Modify: `apps/web/components/research/canvas/conflict-node.tsx`
- Modify: `apps/web/components/research/hints/hints-panel.tsx`
- Modify: `apps/web/components/research/hints/hint-card.tsx`
- Modify: `apps/web/components/research/timeline/timeline-tab.tsx`
- Modify: `apps/web/components/research/timeline/timeline-event.tsx`
- Modify: `apps/web/components/research/conflicts/conflicts-tab.tsx`
- Modify: `apps/web/components/research/board/source-list-panel.tsx`
- Modify: `apps/web/components/research/board/detail-panel.tsx`
- Modify: `apps/web/components/research/board/fact-matrix-row.tsx`
- Modify: `apps/web/components/research/board/detail-panel-actions.tsx`
- Modify: `apps/web/components/research/board/detail-panel-facts.tsx`
- Modify: `apps/web/components/research/url-paste-input.tsx`
- Modify: `apps/web/components/research/text-paste-modal.tsx`
- Modify: `apps/web/components/research/scrape-status.tsx`

**Special case — proof-section.tsx:**
Replace `LucideIcon` type import:
```tsx
// Before
import { ChevronDown, LucideIcon } from 'lucide-react';
// After
import { ChevronDownIcon } from '@heroicons/react/24/outline';
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
```
Then replace all usage of `LucideIcon` type with `IconComponent`.

- [ ] **Step 1: Migrate all 21 files**

Use the icon mapping table. Key replacements in this batch:
- `HelpCircle` → `QuestionMarkCircleIcon`
- `Library` → `BuildingLibraryIcon`
- `FileText` → `DocumentTextIcon`
- `FileCode` → `CodeBracketIcon`
- `Copy` → `ClipboardDocumentIcon`
- `Printer` → `PrinterIcon`
- `CheckCircle2` → `CheckCircleIcon`
- `AlertCircle` → `ExclamationCircleIcon`
- `Calendar` / `Clock` → `CalendarIcon` / `ClockIcon`
- `LayoutGrid` → `Squares2X2Icon`
- `Maximize2` → `ArrowsPointingOutIcon`
- `StickyNote` → `DocumentIcon`
- `PanelLeft` → `Bars3BottomLeftIcon`
- `Map` → `MapIcon`
- `GripVertical` → `Bars3Icon`
- `Inbox` → `InboxIcon`
- `RotateCcw` → `ArrowUturnLeftIcon`
- `Lightbulb` → `LightBulbIcon`
- `ChevronUp` → `ChevronUpIcon`
- `Link` → `LinkIcon`

- [ ] **Step 2: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/research/ && git commit -m "$(cat <<'EOF'
refactor: migrate research sub-module icons from Lucide to Heroicons

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Migrate Remaining Component Icons

**Files:**
- Modify: `apps/web/components/tree/tree-detail-panel.tsx`
- Modify: `apps/web/components/tree/person-palette.tsx`
- Modify: `apps/web/components/tree/tree-toolbar.tsx`
- Modify: `apps/web/components/tree/tree-export.tsx`
- Modify: `apps/web/components/onboarding/welcome-card.tsx`
- Modify: `apps/web/components/members/pending-invites.tsx`
- Modify: `apps/web/components/members/member-list.tsx`
- Modify: `apps/web/components/members/invite-dialog.tsx`
- Modify: `apps/web/components/timeline/historical-event.tsx`
- Modify: `apps/web/components/export/export-options.tsx`
- Modify: `apps/web/components/biography/biography-tab.tsx`
- Modify: `apps/web/components/biography/biography-viewer.tsx`
- Modify: `apps/web/app/(auth)/sources/page.tsx`

- [ ] **Step 1: Migrate all 13 files**

Use the icon mapping table. All straightforward 1:1 replacements.

- [ ] **Step 2: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/tree/ apps/web/components/onboarding/ apps/web/components/members/ apps/web/components/timeline/ apps/web/components/export/ apps/web/components/biography/ apps/web/app/\(auth\)/sources/ && git commit -m "$(cat <<'EOF'
refactor: migrate tree, members, export, biography icons to Heroicons

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Migrate UI Component Icons + Remove Lucide

**Files:**
- Modify: `apps/web/components/ui/command.tsx`
- Modify: `apps/web/components/ui/dialog.tsx`
- Modify: `apps/web/components/ui/dropdown-menu.tsx`
- Modify: `apps/web/components/ui/sheet.tsx`
- Modify: `apps/web/components/ui/sonner.tsx`
- Modify: `apps/web/components/ui/select.tsx`
- Modify: `apps/web/components/ui/sidebar.tsx`
- Modify: `apps/web/package.json` (remove lucide-react)

- [ ] **Step 1: Migrate all 7 UI component files**

These are shadcn/ui components. They typically use: `X` (close), `ChevronDown`, `ChevronRight`, `Check`. Map to: `XMarkIcon`, `ChevronDownIcon`, `ChevronRightIcon`, `CheckIcon`.

**Important:** These components may import icons indirectly from shadcn primitives. Read each file first and only replace explicit `lucide-react` imports.

- [ ] **Step 2: Remove lucide-react**

```bash
cd D:/projects/ancstra && pnpm remove lucide-react --filter web
```

- [ ] **Step 3: Verify no lucide-react references remain**

```bash
cd D:/projects/ancstra && grep -r "lucide-react" apps/web/ --include="*.tsx" --include="*.ts" -l
```

Expected: No files listed.

- [ ] **Step 4: Type-check entire project**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -50
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/ui/ apps/web/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
refactor: migrate UI components to Heroicons, remove lucide-react

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Settings Mobile Header Component

**Files:**
- Create: `apps/web/components/settings/settings-mobile-header.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/settings/settings-mobile-header.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export function SettingsMobileHeader({ title }: { title: string }) {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-2 md:hidden mb-4"
    >
      <ArrowLeftIcon className="size-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{title}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/settings/settings-mobile-header.tsx && git commit -m "$(cat <<'EOF'
feat: add SettingsMobileHeader component for mobile back navigation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Settings Navigation — Mobile List Page

**Files:**
- Modify: `apps/web/app/(auth)/settings/page.tsx`
- Modify: `apps/web/app/(auth)/settings/layout.tsx`
- Modify: `apps/web/components/settings/settings-nav.tsx`

- [ ] **Step 1: Update settings-nav.tsx — add hidden class and subtitles**

Add `hidden md:block` to the root `<nav>`. Export the `navItems` array (with added `subtitle` field) so the mobile list page can reuse it.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  SwatchIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export const navItems = [
  { title: 'Search Sources', subtitle: 'Genealogy databases & providers', href: '/settings/sources', icon: MagnifyingGlassIcon },
  { title: 'Appearance', subtitle: 'Theme and display', href: '/settings/appearance', icon: SwatchIcon },
  { title: 'Privacy', subtitle: 'Living persons & data handling', href: '/settings/privacy', icon: ShieldCheckIcon },
  { title: 'Data & Storage', subtitle: 'Backups, cache, archives', href: '/settings/data', icon: CircleStackIcon },
  { title: 'AI', subtitle: 'Usage and budget', href: '/settings/ai', icon: CpuChipIcon },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:block w-[200px] shrink-0 border-r border-border pr-4 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Update layout.tsx — responsive flex**

```tsx
import { SettingsNav } from '@/components/settings/settings-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex md:min-h-[calc(100vh-4rem)] md:gap-6">
      <SettingsNav />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Update page.tsx — mobile nav list + desktop redirect**

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { SettingsMobileNav } from './settings-mobile-nav';

export default async function SettingsPage() {
  // On desktop, redirect to first section (same as before)
  // On mobile, render the nav list
  // Since we can't detect viewport on server, render both:
  // - Mobile nav list (hidden on md+)
  // - A client-side redirect for desktop
  return <SettingsMobileNav />;
}
```

Create `apps/web/app/(auth)/settings/settings-mobile-nav.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { navItems } from '@/components/settings/settings-nav';

export function SettingsMobileNav() {
  const router = useRouter();

  // On md+ screens, redirect to sources (preserving desktop behavior)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    if (mq.matches) {
      router.replace('/settings/sources');
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) router.replace('/settings/sources');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [router]);

  return (
    <div className="md:hidden">
      <h1 className="text-lg font-semibold mb-2">Settings</h1>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-muted">
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/app/\(auth\)/settings/ apps/web/components/settings/settings-nav.tsx && git commit -m "$(cat <<'EOF'
feat: settings mobile nav list page with desktop redirect

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add Mobile Header to All Settings Sub-Pages

**Files:**
- Modify: `apps/web/app/(auth)/settings/sources/page.tsx`
- Modify: `apps/web/app/(auth)/settings/appearance/page.tsx`
- Modify: `apps/web/app/(auth)/settings/privacy/page.tsx`
- Modify: `apps/web/app/(auth)/settings/data/page.tsx`
- Modify: `apps/web/app/(auth)/settings/ai/page.tsx`

- [ ] **Step 1: Add SettingsMobileHeader to each page**

For each settings sub-page, add the mobile header import and render it at the top of the page content:

```tsx
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
```

Then add `<SettingsMobileHeader title="Section Name" />` as the first child inside the root `<div>`.

Example for `appearance/page.tsx`:
```tsx
import { ThemeSelector } from '@/components/settings/theme-selector';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title="Appearance" />
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how Ancstra looks on your device.
        </p>
      </div>
      <ThemeSelector />
    </div>
  );
}
```

Repeat for: Sources ("Search Sources"), Privacy ("Privacy"), Data ("Data & Storage"), AI ("AI").

- [ ] **Step 2: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/app/\(auth\)/settings/ && git commit -m "$(cat <<'EOF'
feat: add mobile back header to all settings sub-pages

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Privacy Page — Responsive Layout

**Files:**
- Modify: `apps/web/components/settings/privacy-settings.tsx`

- [ ] **Step 1: Update privacy-settings.tsx layout classes**

Replace the three `flex items-start justify-between gap-8` rows with responsive stacking:

**Living Person Threshold:**
```tsx
<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-8">
  <div className="space-y-1">
    <Label htmlFor="living-threshold">Living Person Threshold</Label>
    <p className="text-sm text-muted-foreground">
      Persons born within this many years (with no recorded death) are
      presumed living and subject to privacy restrictions.
    </p>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    {/* input unchanged */}
  </div>
</div>
```

**Default Privacy Level:**
```tsx
<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-8">
  <div className="space-y-1">
    {/* label + description unchanged */}
  </div>
  <div className="flex gap-1 rounded-lg border border-input p-1 w-full md:w-fit shrink-0">
    {/* buttons unchanged */}
  </div>
</div>
```

**Export Privacy Toggle:**
No change — already works inline. The `flex items-start justify-between gap-8` is fine for toggle+label since the switch is small.

- [ ] **Step 2: Verify on dev server** (manual check)

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/settings/privacy-settings.tsx && git commit -m "$(cat <<'EOF'
feat: make privacy settings responsive — stack on mobile, inline on desktop

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Data & Storage Page — Responsive Layout

**Files:**
- Modify: `apps/web/components/settings/storage-usage.tsx`
- Modify: `apps/web/components/settings/data-settings.tsx`

- [ ] **Step 1: Update storage-usage.tsx grid**

Change the breakdown grid from `grid-cols-3` to responsive:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
```

- [ ] **Step 2: Update data-settings.tsx buttons**

**Backup & Restore** — button pair shares one row:
```tsx
<div className="flex gap-2">
  <Button variant="outline" onClick={handleBackup} disabled={backupLoading} className="flex-1">
    <ArrowDownTrayIcon className="size-4" data-icon="inline-start" />
    {backupLoading ? 'Creating...' : 'Download Backup'}
  </Button>
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="outline" className="flex-1">
        <ArrowUpTrayIcon className="size-4" data-icon="inline-start" />
        Restore Backup
      </Button>
    </AlertDialogTrigger>
    {/* dialog content unchanged */}
  </AlertDialog>
</div>
```

**Clear Search Cache** — full-width on mobile:
```tsx
<Button variant="outline" onClick={handleClearCache} disabled={cacheLoading} className="w-full md:w-auto">
```

**Danger Zone** — destructive button pair shares one row:
```tsx
<div className="flex gap-2">
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" disabled={archiveLoading} className="flex-1">
        {/* ... */}
      </Button>
    </AlertDialogTrigger>
    {/* ... */}
  </AlertDialog>
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="destructive" className="flex-1">
        {/* ... */}
      </Button>
    </AlertDialogTrigger>
    {/* ... */}
  </AlertDialog>
</div>
```

- [ ] **Step 3: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/settings/storage-usage.tsx apps/web/components/settings/data-settings.tsx && git commit -m "$(cat <<'EOF'
feat: make data & storage settings responsive — grid and button pairs

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Appearance + Sources — Touch Polish

**Files:**
- Modify: `apps/web/components/settings/theme-selector.tsx`
- Modify: `apps/web/components/settings/provider-card.tsx`

- [ ] **Step 1: Update theme-selector.tsx**

Make the button group full-width on mobile:
```tsx
<div className="flex gap-1 rounded-lg border border-input p-1 w-full md:w-fit">
```

- [ ] **Step 2: Update provider-card.tsx — flex-wrap on footer**

Add `flex-wrap` to the rate limit + test row so it wraps gracefully on very narrow screens:
```tsx
<CardContent className={cn('flex items-center gap-3 flex-wrap', !hasConfigSection && 'pt-0')}>
```

- [ ] **Step 3: Type-check**

```bash
cd D:/projects/ancstra && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd D:/projects/ancstra && git add apps/web/components/settings/theme-selector.tsx apps/web/components/settings/provider-card.tsx && git commit -m "$(cat <<'EOF'
feat: theme selector full-width on mobile, provider card flex-wrap

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Visual Validation in Chrome

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

```bash
cd D:/projects/ancstra && pnpm --filter web dev
```

- [ ] **Step 2: Open Playwright and validate mobile layout**

Use Playwright MCP to navigate to each settings page at mobile viewport (375px width) and desktop viewport (1280px width). Check:
- `/settings` — mobile shows nav list, desktop redirects to sources
- `/settings/sources` — mobile shows back header, cards stack properly
- `/settings/appearance` — theme selector full-width on mobile
- `/settings/privacy` — controls stack on mobile, inline on desktop
- `/settings/data` — button pairs in rows, storage grid single-column on mobile
- `/settings/ai` — mobile header present

- [ ] **Step 3: Take screenshots at both viewports for each page**

- [ ] **Step 4: Fix any visual issues found**

- [ ] **Step 5: Final commit with any fixes**

```bash
cd D:/projects/ancstra && git add -A && git commit -m "$(cat <<'EOF'
fix: visual polish from Chrome validation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```
