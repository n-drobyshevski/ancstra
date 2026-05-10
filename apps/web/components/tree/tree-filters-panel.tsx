'use client';

import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { TreeFiltersPanelContent } from './tree-filters-panel-content';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface TreeFiltersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearBounds: TreeYearBounds;
  /** Pass-through for the topology chip in the active-filter strip. */
  topologyReferenceName: string | null;
}

/**
 * Filter panel mounted inside the canvas viewport.
 *
 * Desktop: a left-docked overlay that slides in from the canvas's left edge
 * via translateX. No backdrop — the canvas remains pannable/clickable while
 * the panel is open (Figma layers-panel pattern). The parent must be
 * `position: relative` and `overflow: hidden`; in tree-canvas.tsx that is
 * the wrapper around `<ReactFlow>`. When closed the panel is `inert` so it
 * can't trap tab focus or be clicked while off-screen.
 *
 * Mobile: a bottom Vaul Drawer with snap points. The trigger that opens
 * this is currently desktop-only (lives in TreeToolbar); a mobile parity
 * trigger in MobileViewBar is a follow-up.
 */
export function TreeFiltersPanel({
  open,
  onOpenChange,
  yearBounds,
  topologyReferenceName,
}: TreeFiltersPanelProps) {
  const t = useTranslations('tree.canvasFiltersPanel');
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={[0.4, 0.85]}
        fadeFromIndex={1}
      >
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t('panelTitle')}</DrawerTitle>
            <DrawerDescription>{t('panelDescription')}</DrawerDescription>
          </DrawerHeader>
          <TreeFiltersPanelContent
            yearBounds={yearBounds}
            topologyReferenceName={topologyReferenceName}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  // Figma-style floating card: inset from the canvas edges (~12px), rounded
  // corners, soft prominent shadow, translucent fill with backdrop-blur. The
  // panel slides + fades in from the left; when closed it shifts past the
  // viewport edge (`-translate-x-[calc(100%+1rem)]`) so the shadow doesn't
  // bleed at the canvas's left edge while overflow:hidden clips it.
  return (
    <aside
      role="region"
      aria-label={t('panelTitle')}
      aria-hidden={!open}
      // `inert` keeps off-screen children out of the tab order and click-
      // through path while the slide-out animation finishes. React typings
      // expect a boolean — absent (or false) means interactive.
      inert={!open}
      className={cn(
        // Position: inset from the canvas viewport edges
        'absolute left-3 top-3 bottom-3 z-10',
        // Size
        'flex w-80 max-w-[calc(100vw-1.5rem)] flex-col',
        // Floating card chrome
        'rounded-lg border border-border/60 bg-clip-padding overflow-hidden',
        'bg-card/95 supports-backdrop-filter:bg-card/80 supports-backdrop-filter:backdrop-blur-xl',
        'shadow-2xl shadow-black/10 dark:shadow-black/40',
        // Slide + fade animation
        'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
        open
          ? 'translate-x-0 opacity-100'
          : '-translate-x-[calc(100%+1rem)] opacity-0 pointer-events-none',
      )}
    >
      <TreeFiltersPanelContent
        yearBounds={yearBounds}
        topologyReferenceName={topologyReferenceName}
        onClose={() => onOpenChange(false)}
      />
    </aside>
  );
}
