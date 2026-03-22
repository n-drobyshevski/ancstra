'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type WorkspaceView = 'board' | 'conflicts' | 'timeline';

const tabs: { value: WorkspaceView; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'conflicts', label: 'Conflicts' },
  { value: 'timeline', label: 'Timeline' },
];

interface WorkspaceTabsProps {
  conflictCount?: number;
}

export function WorkspaceTabs({ conflictCount = 0 }: WorkspaceTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setView(tab.value)}
          className={cn(
            'relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            activeView === tab.value
              ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
              : 'text-muted-foreground',
          )}
        >
          {tab.label}
          {tab.value === 'conflicts' && conflictCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
              {conflictCount}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
