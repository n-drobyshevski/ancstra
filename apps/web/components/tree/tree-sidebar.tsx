'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FacetSearch } from './facets/facet-search';
import { FacetSex } from './facets/facet-sex';
import { FacetLiving } from './facets/facet-living';
import { FacetValidation } from './facets/facet-validation';
import { FacetYearRange } from './facets/facet-year-range';
import { FacetPlace } from './facets/facet-place';
import { FacetCitations } from './facets/facet-citations';
import { FacetCompleteness } from './facets/facet-completeness';
import { FacetHasProposals } from './facets/facet-has-proposals';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

const FALLBACK_BOUNDS = { minYear: 1700, maxYear: new Date().getFullYear() };

interface TreeSidebarProps {
  yearBounds: TreeYearBounds;
}

export function TreeSidebar({ yearBounds }: TreeSidebarProps) {
  const { filters, setFilters } = useTreeTableFilters();
  const activeCount = countActiveTreeFilters(filters);

  const visualBounds = {
    minYear: yearBounds.minYear ?? FALLBACK_BOUNDS.minYear,
    maxYear: yearBounds.maxYear ?? FALLBACK_BOUNDS.maxYear,
  };

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
    <aside aria-label="Filter people" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">
          Filters {activeCount > 0 && <span className="text-muted-foreground">· {activeCount}</span>}
        </span>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
            <X className="mr-1 h-3 w-3" aria-hidden /> Clear all
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <FacetSearch />
        <FacetSex />
        <FacetLiving />
        <FacetValidation />
        <FacetYearRange label="Born" fromKey="bornFrom" toKey="bornTo" defaultOpen visualBounds={visualBounds} />
        <FacetYearRange label="Died" fromKey="diedFrom" toKey="diedTo" visualBounds={visualBounds} />
        <FacetPlace />
        <FacetCitations />
        <FacetCompleteness />
        <FacetHasProposals />
      </ScrollArea>
    </aside>
  );
}
