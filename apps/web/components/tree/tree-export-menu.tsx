'use client';

import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/components/ui/menubar';
import { Download } from 'lucide-react';
import { useTreeExport } from '@/lib/tree/use-tree-export';

export function TreeExportMenu() {
  const { exporting, exportPng, exportSvg, exportPdf } = useTreeExport();

  return (
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
  );
}
