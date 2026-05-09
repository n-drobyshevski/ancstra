'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TreeViewToggleProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
}

export function TreeViewToggle({ view, onSetView }: TreeViewToggleProps) {
  const t = useTranslations('tree.viewToggle');
  return (
    <Tabs
      value={view}
      onValueChange={(v) => onSetView(v as 'canvas' | 'table')}
      className="flex-row gap-0"
    >
      <TabsList className="h-7">
        <TabsTrigger value="canvas" className="text-xs px-3 py-0.5">
          {t('canvas')}
        </TabsTrigger>
        <TabsTrigger value="table" className="text-xs px-3 py-0.5">
          {t('table')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
