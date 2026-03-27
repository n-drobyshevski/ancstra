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
  Layers,
  UserPen,
  BookMarked,
  Quote,
  ChevronsUpDown,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export type WorkspaceView =
  | 'record'
  | 'timeline'
  | 'conflicts'
  | 'board'
  | 'matrix'
  | 'factsheets'
  | 'hints'
  | 'canvas'
  | 'proof'
  | 'biography'
  | 'citations';

interface TabDef {
  value: WorkspaceView;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface TabGroup {
  label: string;
  tabs: TabDef[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Core',
    tabs: [
      { value: 'record',    label: 'Record',    icon: UserPen,         description: 'Vital information & family' },
      { value: 'timeline',  label: 'Timeline',  icon: Clock,           description: 'Chronological events' },
      { value: 'conflicts', label: 'Conflicts', icon: GitCompareArrows, description: 'Contradicting facts' },
    ],
  },
  {
    label: 'Research',
    tabs: [
      { value: 'board',      label: 'Board',      icon: LayoutGrid, description: 'Sources & fact extraction' },
      { value: 'matrix',     label: 'Matrix',     icon: Table2,     description: 'Fact-by-source comparison' },
      { value: 'factsheets', label: 'Factsheets', icon: Layers,     description: 'Organized fact collections' },
      { value: 'hints',      label: 'Hints',      icon: BookOpen,   description: 'AI-matched candidates' },
      { value: 'canvas',     label: 'Canvas',     icon: PenTool,    description: 'Visual evidence map' },
    ],
  },
  {
    label: 'Output',
    tabs: [
      { value: 'proof',      label: 'Proof',      icon: FileText,   description: 'Proof statement builder' },
      { value: 'biography',  label: 'Biography',  icon: BookMarked, description: 'AI-generated narrative' },
      { value: 'citations',  label: 'Citations',  icon: Quote,      description: 'Source citations' },
    ],
  },
];

const ALL_TABS: TabDef[] = TAB_GROUPS.flatMap((g) => g.tabs);

/** The 4 tabs shown inline on mobile */
const PRIMARY_TAB_VALUES: Set<WorkspaceView> = new Set([
  'record', 'timeline', 'board', 'conflicts',
]);

interface WorkspaceTabsProps {
  conflictCount?: number;
  hintCount?: number;
  factsheetCount?: number;
}

interface IndicatorState {
  left: number;
  width: number;
}

function getBadge(
  value: WorkspaceView,
  conflictCount: number,
  hintCount: number,
  factsheetCount: number,
) {
  if (value === 'conflicts' && conflictCount > 0) {
    return (
      <Badge
        variant="destructive"
        className={cn('ml-1 h-4 min-w-4 px-1 text-[10px]', conflictCount > 0 && 'animate-subtle-pulse')}
      >
        {conflictCount}
      </Badge>
    );
  }
  if (value === 'hints' && hintCount > 0) {
    return (
      <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
        {hintCount}
      </Badge>
    );
  }
  if (value === 'factsheets' && factsheetCount > 0) {
    return (
      <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-muted text-muted-foreground">
        {factsheetCount}
      </Badge>
    );
  }
  return null;
}

export function WorkspaceTabs({
  conflictCount = 0,
  hintCount = 0,
  factsheetCount = 0,
}: WorkspaceTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefsMap = useRef<Map<WorkspaceView, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<IndicatorState>({ left: 0, width: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeView = (searchParams.get('view') as WorkspaceView) || 'record';

  const setView = useCallback(
    (view: WorkspaceView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === 'record') {
        params.delete('view');
      } else {
        params.set('view', view);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname],
  );

  // Register a tab button ref in the map
  const setTabRef = useCallback(
    (value: WorkspaceView) => (el: HTMLButtonElement | null) => {
      if (el) {
        tabRefsMap.current.set(value, el);
      } else {
        tabRefsMap.current.delete(value);
      }
    },
    [],
  );

  // Recalculate the sliding indicator position
  const updateIndicator = useCallback(() => {
    const btn = tabRefsMap.current.get(activeView);
    const container = scrollRef.current;
    if (!btn || !container) return;
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, [activeView]);

  // Update indicator whenever activeView changes or container resizes
  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateIndicator]);

  // Arrow key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = ALL_TABS.findIndex((t) => t.value === activeView);
      if (e.key === 'ArrowRight' && currentIndex < ALL_TABS.length - 1) {
        e.preventDefault();
        setView(ALL_TABS[currentIndex + 1].value);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setView(ALL_TABS[currentIndex - 1].value);
      }
    },
    [activeView, setView],
  );

  // Mobile inline tabs: primary 4 + active tab if not in primary set
  const mobileTabs = ALL_TABS.filter(
    (t) => PRIMARY_TAB_VALUES.has(t.value) || t.value === activeView,
  );

  return (
    <>
      {/* ── Desktop: grouped horizontal scroll tabs with sliding indicator ── */}
      <div className="relative border-b border-border hidden md:block">
        <div
          ref={scrollRef}
          role="tablist"
          onKeyDown={handleKeyDown}
          className="relative flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className="contents">
              {/* Divider between groups */}
              {groupIndex > 0 && (
                <div className="flex items-center mx-4" aria-hidden="true">
                  <div className="w-px self-stretch border-r border-border/50 my-1.5" />
                </div>
              )}

              {group.tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.value;

                return (
                  <button
                    key={tab.value}
                    ref={setTabRef(tab.value)}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setView(tab.value)}
                    className={cn(
                      'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2',
                      'text-sm font-medium rounded-md',
                      'transition-all duration-150',
                      'hover:bg-muted/50 active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {tab.label}
                    {getBadge(tab.value, conflictCount, hintCount, factsheetCount)}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Sliding active indicator */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 h-[2.5px] rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>

      {/* ── Mobile: inline primary tabs + More sheet ── */}
      <div className="border-b border-border md:hidden">
        <div
          role="tablist"
          className="relative flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {mobileTabs.map((tab) => {
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
                  'relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2.5',
                  'text-sm font-medium rounded-md',
                  'transition-all duration-150',
                  'hover:bg-muted/50 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
                {getBadge(tab.value, conflictCount, hintCount, factsheetCount)}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2.5',
              'text-sm font-medium rounded-md',
              'transition-all duration-150',
              'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <ChevronsUpDown className="size-3.5" />
            More
          </button>
        </div>
      </div>

      {/* ── Mobile: all-tabs sheet with group headings ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh]">
          <SheetHeader>
            <SheetTitle>All Views</SheetTitle>
            <SheetDescription className="sr-only">
              Select a workspace view
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto pb-4">
            {TAB_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>

                <div className="grid gap-0.5">
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeView === tab.value;

                    return (
                      <button
                        key={tab.value}
                        onClick={() => {
                          setView(tab.value);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 text-left">
                          <span className="block">{tab.label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {tab.description}
                          </span>
                        </span>
                        {getBadge(tab.value, conflictCount, hintCount, factsheetCount)}
                        {isActive && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
