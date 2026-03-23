# Settings Mobile Adaptation + Heroicons Migration

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Settings page mobile responsiveness, touch polish, app-wide icon library migration

## Overview

Make the settings page fully mobile-adaptive using a list-detail navigation pattern, responsive content layouts, and proper touch targets. Simultaneously migrate the entire app from Lucide React to Heroicons.

## Decisions

- **Breakpoint:** `md` (768px) — below this, mobile layout; above, desktop sidebar
- **Navigation pattern:** Stacked list page on mobile, sidebar on desktop
- **Content stacking:** Smart — toggles stay inline, inputs and button groups stack vertically on mobile
- **Back navigation:** `← Section Name` header, `md:hidden`
- **Icon library:** Heroicons (`@heroicons/react`) replacing Lucide React app-wide
- **Button pairs:** Share one row even on mobile (e.g., Download/Restore)

## 1. Navigation Pattern

### Settings index page (`settings/page.tsx`)

Currently redirects to `/settings/sources`. Change to:
- **Mobile (<768px):** Render a full-page nav list with items showing icon, title, subtitle, and chevron. Each item links to its section. Touch targets: full row, min 48px height.
- **Desktop (>=768px):** Redirect to `/settings/sources` (current behavior preserved).

Implementation: use a media query hook or render both with `hidden`/`md:hidden` classes.

### Settings layout (`settings/layout.tsx`)

Current: `flex` with 200px sidebar always visible.

Change to:
```
<div className="md:flex md:min-h-[calc(100vh-4rem)] md:gap-6">
  <SettingsNav />  {/* hidden below md */}
  <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
</div>
```

### Settings nav (`settings-nav.tsx`)

Add `hidden md:block` to the root `<nav>`. Add subtitle descriptions to each nav item for use in the mobile list view.

Nav items with subtitles:
| Item | Subtitle |
|------|----------|
| Search Sources | Genealogy databases & providers |
| Appearance | Theme and display |
| Privacy | Living persons & data handling |
| Data & Storage | Backups, cache, archives |
| AI | Usage and budget |

### New: Settings mobile header (`settings-mobile-header.tsx`)

A client component rendered in each settings sub-page (or in layout):
```tsx
<Link href="/settings" className="flex items-center gap-2 md:hidden mb-4">
  <ArrowLeftIcon className="size-4 text-muted-foreground" />
  <span className="text-sm font-semibold">{title}</span>
</Link>
```

## 2. Privacy Page (`privacy-settings.tsx`)

### Living Person Threshold
- **Mobile:** Stack vertically — label/description above, input below
- **Desktop:** Side-by-side with `justify-between`
- Classes: `flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-8`

### Default Privacy Level
- **Mobile:** Button group goes full-width (`w-full`)
- **Desktop:** `w-fit`, current layout preserved
- Classes on button group wrapper: `w-full md:w-fit`

### Export Privacy Toggle
- Stays inline on both mobile and desktop — switch is compact enough
- No changes needed beyond ensuring adequate touch target on the switch

## 3. Data & Storage Page

### Storage Usage (`storage-usage.tsx`)
- Breakdown grid: `grid-cols-1 md:grid-cols-3`
- Progress bar: no change needed (already full-width)

### Data Settings (`data-settings.tsx`)
- **Button pairs** (Backup/Restore, Clear Archives/Delete All): `flex gap-2` with each button `flex-1` — they share the row on all screen sizes
- **Single buttons** (Clear Search Cache): `w-full md:w-auto`
- All buttons: ensure adequate height for touch on mobile

## 4. Sources Page

### Provider cards (`provider-card.tsx`)
- Already flex-based and responsive
- Enforce min touch targets on toggle switch and test button
- Rate limit + test footer: add `flex-wrap` for very narrow screens

### Worker status (`worker-status.tsx`)
- Stays horizontal — content is compact enough
- No layout changes needed

### Sources page (`sources/page.tsx`)
- No layout changes — cards stack naturally

## 5. AI Page

No mobile layout changes needed — page structure TBD (not yet implemented). When built, follow the same patterns: mobile header, stacked layout, adequate touch targets.

## 5b. Appearance Page

### Theme selector (`theme-selector.tsx`)
- Button group: `w-full md:w-fit`
- Each button gets adequate height on mobile
- Icons stay at current size

## 6. Global Touch Polish

Applied across all settings components:
- Interactive elements: adequate min-height for mobile touch
- Container padding: responsive `px-4 md:px-6` (align with parent layout)
- Consistent `space-y-6` section spacing throughout

## 7. Heroicons Migration

### Install
```bash
pnpm add @heroicons/react --filter web
pnpm remove lucide-react --filter web
```

### Import conventions
- **Default:** `@heroicons/react/24/outline` — matches current Lucide outline style
- **Compact/inline:** `@heroicons/react/20/solid` — for small indicators, nav chevrons
- **Sizing:** Use Tailwind `size-4` (16px) for inline, `size-5` (20px) for standalone

### Icon mapping (Lucide → Heroicons)

| Lucide | Heroicons (24/outline) | Notes |
|--------|----------------------|-------|
| Activity | ChartBarIcon | |
| AlertCircle | ExclamationCircleIcon | |
| AlertTriangle | ExclamationTriangleIcon | |
| Archive | ArchiveBoxIcon | |
| BarChart3 | ChartBarIcon | |
| Bookmark | BookmarkIcon | |
| BookOpen | BookOpenIcon | |
| Bot | CpuChipIcon | Closest match |
| Calendar | CalendarIcon | |
| Check | CheckIcon | |
| CheckCircle / CheckCircle2 | CheckCircleIcon | |
| ChevronDown | ChevronDownIcon | |
| ChevronRight | ChevronRightIcon | |
| ChevronUp | ChevronUpIcon | |
| Clock | ClockIcon | |
| Copy | ClipboardDocumentIcon | |
| Database | CircleStackIcon | |
| Download | ArrowDownTrayIcon | |
| Eye | EyeIcon | |
| EyeOff | EyeSlashIcon | |
| ExternalLink | ArrowTopRightOnSquareIcon | |
| FileCode | CodeBracketIcon | |
| FileText | DocumentTextIcon | |
| GitBranch | ShareIcon | Closest match |
| Globe | GlobeAltIcon | |
| GripVertical | Bars3Icon | |
| HelpCircle | QuestionMarkCircleIcon | |
| Home | HomeIcon | |
| Image | PhotoIcon | |
| Inbox | InboxIcon | |
| LayoutGrid | Squares2X2Icon | |
| Library | BuildingLibraryIcon | |
| Lightbulb | LightBulbIcon | |
| Link | LinkIcon | |
| Loader2 | **Spinner component** | See below |
| LogOut | ArrowRightStartOnRectangleIcon | |
| Map | MapIcon | |
| Maximize2 | ArrowsPointingOutIcon | |
| Monitor | ComputerDesktopIcon | |
| Moon | MoonIcon | |
| Newspaper | NewspaperIcon | |
| Palette | SwatchIcon | |
| PanelLeft | Bars3BottomLeftIcon | |
| Pencil | PencilIcon | |
| Plus | PlusIcon | |
| Printer | PrinterIcon | |
| RefreshCw | ArrowPathIcon | |
| RotateCcw | ArrowUturnLeftIcon | |
| Search | MagnifyingGlassIcon | |
| Send | PaperAirplaneIcon | |
| Server | ServerIcon | |
| Settings | Cog6ToothIcon | |
| Settings2 | AdjustmentsHorizontalIcon | |
| Shield | ShieldCheckIcon | |
| Sparkles | SparklesIcon | |
| Star | StarIcon | |
| StickyNote | DocumentIcon | |
| Sun | SunIcon | |
| Trash2 | TrashIcon | |
| Upload | ArrowUpTrayIcon | |
| User | UserIcon | |
| Users | UserGroupIcon | |
| X | XMarkIcon | |
| Zap | BoltIcon | |

New usage (not a Lucide replacement):
| Icon | Heroicons | Import path |
|------|-----------|-------------|
| ArrowLeftIcon | ArrowLeftIcon | `@heroicons/react/24/outline` |

### New: Spinner component (`components/ui/spinner.tsx`)

Heroicons doesn't include an animated spinner. Create a reusable component:
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

### LucideIcon type replacement

In `proof-section.tsx`, replace `LucideIcon` type import with:
```tsx
type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
```

### Migration scope
- 62 files across the app
- All under `apps/web/components/` and `apps/web/app/`
- Mechanical find-and-replace with the mapping table above

## Files Summary

### Modified (settings — 10 files)
- `app/(auth)/settings/layout.tsx`
- `app/(auth)/settings/page.tsx`
- `app/(auth)/settings/sources/page.tsx`
- `components/settings/settings-nav.tsx`
- `components/settings/privacy-settings.tsx`
- `components/settings/data-settings.tsx`
- `components/settings/storage-usage.tsx`
- `components/settings/theme-selector.tsx`
- `components/settings/provider-card.tsx`
- `components/settings/worker-status.tsx`

### New (2 files)
- `components/settings/settings-mobile-header.tsx`
- `components/ui/spinner.tsx`

### Modified (icon migration — ~52 additional files)
- All files importing from `lucide-react` across `components/` and `app/`

### Package changes
- Add: `@heroicons/react`
- Remove: `lucide-react`
