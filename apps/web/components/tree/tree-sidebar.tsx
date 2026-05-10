'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TreeFiltersList } from './tree-filters-list';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';
import { ThreadsSidebarPanel } from '@/components/research/threads/threads-sidebar-panel';
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
      <Tabs defaultValue="filters" className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b gap-2">
          <TabsList className="h-7">
            <TabsTrigger value="filters" className="text-xs h-6 px-2">
              {t('filtersLabel')}
              {activeCount > 0 && <span className="ml-1 text-muted-foreground">· {activeCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="threads" className="text-xs h-6 px-2">
              Threads
            </TabsTrigger>
          </TabsList>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs shrink-0">
              <X className="mr-1 h-3 w-3" aria-hidden /> {t('clearAll')}
            </Button>
          )}
        </div>
        <TabsContent value="filters" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <TreeFiltersList yearBounds={yearBounds} />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="threads" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <ThreadsSidebarPanel />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
