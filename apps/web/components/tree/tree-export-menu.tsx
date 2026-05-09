'use client';

import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/components/ui/menubar';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTreeExport } from '@/lib/tree/use-tree-export';
import { RoleGate } from '@/components/auth/role-gate';

export function TreeExportMenu() {
  const t = useTranslations('tree.exportMenu');
  const { exporting, exportPng, exportSvg, exportPdf } = useTreeExport();

  // Gate the whole MenubarMenu (trigger + content) rather than each item
  // individually: if the user lacks tree:export the menu would open empty,
  // which is a worse UX than hiding the trigger entirely.
  return (
    <RoleGate permission="tree:export">
      <MenubarMenu>
        <MenubarTrigger className="gap-1 text-xs" disabled={exporting}>
          <Download className="size-3.5" aria-hidden />
          {exporting ? t('exporting') : t('label')}
        </MenubarTrigger>
        <MenubarContent align="end">
          <MenubarItem onSelect={() => void exportPng()}>
            {t('png')}
          </MenubarItem>
          <MenubarItem onSelect={() => void exportSvg()}>
            {t('svg')}
          </MenubarItem>
          <MenubarItem onSelect={() => void exportPdf()}>
            {t('pdf')}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </RoleGate>
  );
}
