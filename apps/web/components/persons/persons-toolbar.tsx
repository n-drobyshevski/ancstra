'use client';

import { Filter } from 'lucide-react';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PersonsSidebar } from './persons-sidebar';
import { usePersonsFilters } from './use-persons-filters';
import { countActiveFilters } from '@/lib/persons/active-filter-count';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsToolbarProps {
  yearBounds: TreeYearBounds;
}

export function PersonsToolbar({ yearBounds }: PersonsToolbarProps) {
  const { filters } = usePersonsFilters();
  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Open filters${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
            >
              <Filter className="mr-2 h-4 w-4" aria-hidden />
              Filters
              {activeCount > 0 && (
                <Badge className="ml-2 h-5 px-1.5" aria-hidden>
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
              <PersonsSidebar yearBounds={yearBounds} />
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="flex-1" />
    </div>
  );
}
