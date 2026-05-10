'use client';

import { Filter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { useTreeTableFilters } from './use-tree-table-filters';
import { countActiveTreeFilters } from '@/lib/tree/active-filter-count';

interface TreeFiltersTriggerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Toolbar button that opens the canvas filter panel. Renders an active-count
 *  badge derived from the URL filters, plus a tooltip exposing the Cmd/Ctrl+\
 *  toggle shortcut (Figma's universal sidebar shortcut). */
export function TreeFiltersTrigger({
  open,
  onOpenChange,
}: TreeFiltersTriggerProps) {
  const t = useTranslations('tree.canvasFiltersPanel');
  const { filters } = useTreeTableFilters();
  const activeCount = countActiveTreeFilters(filters);

  // Modifier glyph for the shortcut hint. Starts as 'Ctrl' on the server
  // and the very first client render, then swaps to '⌘' on Mac after
  // hydration. `useIsHydrated` keeps the swap out of useEffect+setState so
  // the `react-hooks/set-state-in-effect` rule stays satisfied.
  const isHydrated = useIsHydrated();
  const isMac =
    isHydrated &&
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={activeCount > 0 || open ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-expanded={open}
          aria-label={
            activeCount > 0
              ? t('triggerLabelWithCount', { count: activeCount })
              : t('triggerLabel')
          }
          onClick={() => onOpenChange(!open)}
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          <span>{t('triggerLabel')}</span>
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              aria-hidden
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{t('triggerLabel')}</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {modKey} \
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
