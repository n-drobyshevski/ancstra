'use client';

import { Filter } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeSidebar } from './tree-sidebar';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

// Mobile counterpart to the desktop sidebar — same TreeSidebar contents
// rendered inside a Drawer triggered by a Filters button. Used by the
// mobile view bar in table mode.
export function TreeMobileFiltersDrawer({ yearBounds }: { yearBounds: TreeYearBounds }) {
  const { filters } = useTreeTableFilters();
  const activeCount = countActiveTreeFilters(filters);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          aria-label={`Open filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
        >
          <Filter className="mr-1 h-4 w-4" aria-hidden />
          <span className="text-xs">Filters</span>
          {activeCount > 0 && (
            <Badge className="ml-1 h-4 px-1 text-[10px]" aria-hidden>
              {activeCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Filter people</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="max-h-[70vh] pb-8">
          <TreeSidebar yearBounds={yearBounds} />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
