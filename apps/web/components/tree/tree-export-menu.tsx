'use client';

import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/components/ui/menubar';
import { Download } from 'lucide-react';
import { useTreeExport } from '@/lib/tree/use-tree-export';
import { RoleGate } from '@/components/auth/role-gate';

export function TreeExportMenu() {
  const { exporting, exportPng, exportSvg, exportPdf } = useTreeExport();

  // Gate the whole MenubarMenu (trigger + content) rather than each item
  // individually: if the user lacks tree:export the menu would open empty,
  // which is a worse UX than hiding the trigger entirely.
  return (
    <RoleGate permission="tree:export">
      <MenubarMenu>
        <MenubarTrigger className="gap-1 text-xs" disabled={exporting}>
          <Download className="size-3.5" aria-hidden />
          {exporting ? 'Exporting…' : 'Export'}
        </MenubarTrigger>
        <MenubarContent align="end">
          <MenubarItem onSelect={() => void exportPng()}>
            Export as PNG
          </MenubarItem>
          <MenubarItem onSelect={() => void exportSvg()}>
            Export as SVG
          </MenubarItem>
          <MenubarItem onSelect={() => void exportPdf()}>
            Export as PDF
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </RoleGate>
  );
}
