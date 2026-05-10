'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeFiltersList } from './tree-filters-list';
import { TreeActiveFilters } from './tree-active-filters';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface TreeFiltersPanelContentProps {
  yearBounds: TreeYearBounds;
  /** Pass-through for the topology chip in the active-filter strip. */
  topologyReferenceName: string | null;
  /** Renders an X button in the header. Provided by the docked desktop
   *  variant (mobile Drawer has its own swipe-down dismiss). */
  onClose?: () => void;
}

/**
 * Shared body for the canvas filter panel — used by both the desktop docked
 * aside and the mobile Drawer. Renders a header (title + active count +
 * clear-all + optional close X), a scrollable list of filter facets, and a
 * footer with the active-filter chip strip mirroring the table view.
 *
 * The component reads filter state from the URL via `useTreeTableFilters()`,
 * so changes apply live; there is no Apply button.
 */
export function TreeFiltersPanelContent({
  yearBounds,
  topologyReferenceName,
  onClose,
}: TreeFiltersPanelContentProps) {
  const t = useTranslations('tree.canvasFiltersPanel');
  const tSidebar = useTranslations('tree.sidebar');
  const { filters, setFilters } = useTreeTableFilters();
  const activeCount = countActiveTreeFilters(filters);

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
      page: 1,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 items-center justify-between gap-1 border-b border-border/60 px-3">
        <span className="text-xs font-medium tracking-wide text-foreground/90">
          {t('panelTitle')}
          {activeCount > 0 && (
            <span className="ml-1 text-muted-foreground">· {activeCount}</span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-2 text-[11px]"
            >
              {tSidebar('clearAll')}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t('closeAriaLabel')}
              className="h-6 w-6"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <TreeFiltersList yearBounds={yearBounds} />
      </ScrollArea>
      {activeCount > 0 && (
        <div className="border-t border-border/60 px-3 py-2">
          <TreeActiveFilters topologyReferenceName={topologyReferenceName} />
        </div>
      )}
    </div>
  );
}
