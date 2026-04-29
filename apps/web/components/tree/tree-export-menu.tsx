'use client';

import { useCallback, useState } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/components/ui/menubar';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const IMAGE_WIDTH = 4096;
const IMAGE_HEIGHT = 3072;

function getThemeBackground(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-background')
      .trim() || '#f8fafc'
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function TreeExportMenu() {
  const { getNodes } = useReactFlow();
  const [exporting, setExporting] = useState(false);

  const getFlowElement = useCallback(() => {
    return document.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  const exportImage = useCallback(
    async (kind: 'png' | 'svg' | 'pdf') => {
      const element = getFlowElement();
      if (!element) return;

      setExporting(true);
      try {
        const nodes = getNodes();
        if (nodes.length === 0) {
          toast.error('No nodes to export');
          return;
        }

        const bounds = getNodesBounds(nodes);
        const viewport = getViewportForBounds(
          bounds,
          IMAGE_WIDTH,
          IMAGE_HEIGHT,
          0.5,
          2,
          0.1,
        );

        const { toPng, toSvg } = await import('html-to-image');
        const renderer = kind === 'svg' ? toSvg : toPng;
        const dataUrl = await renderer(element, {
          backgroundColor: getThemeBackground(),
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          style: {
            width: `${IMAGE_WIDTH}px`,
            height: `${IMAGE_HEIGHT}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        });

        if (kind === 'pdf') {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [IMAGE_WIDTH, IMAGE_HEIGHT],
          });
          pdf.addImage(dataUrl, 'PNG', 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
          pdf.save('ancstra-tree.pdf');
        } else {
          downloadDataUrl(dataUrl, `ancstra-tree.${kind}`);
        }
        toast.success(`${kind.toUpperCase()} exported`);
      } catch (err) {
        toast.error('Export failed');
        console.error(err);
      } finally {
        setExporting(false);
      }
    },
    [getFlowElement, getNodes],
  );

  return (
    <MenubarMenu>
      <MenubarTrigger className="gap-1 text-xs" disabled={exporting}>
        <Download className="size-3.5" aria-hidden />
        {exporting ? 'Exporting…' : 'Export'}
      </MenubarTrigger>
      <MenubarContent align="end">
        <MenubarItem onSelect={() => void exportImage('png')}>
          Export as PNG
        </MenubarItem>
        <MenubarItem onSelect={() => void exportImage('svg')}>
          Export as SVG
        </MenubarItem>
        <MenubarItem onSelect={() => void exportImage('pdf')}>
          Export as PDF
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
