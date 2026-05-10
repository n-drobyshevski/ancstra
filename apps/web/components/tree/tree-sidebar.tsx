'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeFiltersList } from './tree-filters-list';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface TreeSidebarProps {
  yearBounds: TreeYearBounds;
}

export function TreeSidebar({ yearBounds }: TreeSidebarProps) {
  const t = useTranslations('tree.sidebar');
  const { filters, setFilters } = useTreeTableFilters();
  const activeCount = countActiveTreeFilters(filters);

  // Resets every server-driven filter to its default plus page=1. Topology is
  // included because the sidebar is the canonical "all filters" surface for
  // table view; other UI (right-click context menu) still drives topology.
  const clearAll = () => {
    void setFilters({
      q: '',
      sex: [],
      living: [],
      validation: [],
      bornFrom: null,
      bornTo: null,
      diedFrom: null,
      diedTo: null,
      place: '',
      placeScope: 'birth',
      citations: 'any',
      hasProposals: false,
      complGte: null,
      topologyMode: 'all',
      topologyAnchor: '',
      page: 1,
    });
  };

  return (
    <aside aria-label={t('ariaLabel')} className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">
          {t('filtersLabel')} {activeCount > 0 && <span className="text-muted-foreground">· {activeCount}</span>}
        </span>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
            <X className="mr-1 h-3 w-3" aria-hidden /> {t('clearAll')}
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <TreeFiltersList yearBounds={yearBounds} />
      </ScrollArea>
    </aside>
  );
}
