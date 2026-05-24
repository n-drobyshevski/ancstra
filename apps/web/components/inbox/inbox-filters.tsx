'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { InboxItemType, InboxCounts } from '@ancstra/research';

const TYPE_LABELS: Record<InboxItemType, string> = {
  factsheet_draft: 'Drafts',
  ai_proposal: 'AI proposals',
  conflict: 'Conflicts',
  hint: 'Hints',
};

interface InboxFiltersProps {
  counts: InboxCounts;
  activeTypes: InboxItemType[];
  activeThreadId?: string | null;
}

export function InboxFilters({ counts, activeTypes, activeThreadId }: InboxFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleType = useCallback((type: InboxItemType) => {
    const params = new URLSearchParams(searchParams.toString());
    const set = new Set(activeTypes);
    if (set.has(type)) set.delete(type);
    else set.add(type);

    if (set.size === 0 || set.size === 4) params.delete('type');
    else params.set('type', [...set].join(','));

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTypes, pathname, router, searchParams]);

  const clearThread = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('threadId');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const typeChips = (Object.keys(TYPE_LABELS) as InboxItemType[]).map((type) => {
    const active = activeTypes.includes(type);
    const count = counts.byType[type] ?? 0;
    return (
      <Button
        key={type}
        variant={active ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleType(type)}
        className="h-8"
      >
        {TYPE_LABELS[type]}
        <Badge variant={active ? 'secondary' : 'outline'} className="ml-2">{count}</Badge>
      </Button>
    );
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {typeChips}
      {activeThreadId && (
        <Button variant="secondary" size="sm" onClick={clearThread} className="h-8">
          Thread filter
          <X className="size-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
