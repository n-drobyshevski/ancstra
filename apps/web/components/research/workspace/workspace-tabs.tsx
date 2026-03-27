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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type WorkspaceView = 'record' | 'board' | 'matrix' | 'conflicts' | 'timeline' | 'canvas' | 'hints' | 'proof' | 'factsheets' | 'biography' | 'citations';

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

interface WorkspaceTabsProps {
  conflictCount?: number;
  hintCount?: number;
  factsheetCount?: number;
}

export function WorkspaceTabs({ conflictCount = 0, hintCount = 0, factsheetCount = 0 }: WorkspaceTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
              {tab.value === 'factsheets' && factsheetCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-muted text-muted-foreground">
                  {factsheetCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
