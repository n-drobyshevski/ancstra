'use client';

import { useCallback, useState } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toast } from 'sonner';

const IMAGE_WIDTH = 4096;
const IMAGE_HEIGHT = 3072;

type ExportKind = 'png' | 'svg' | 'pdf';

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

export interface TreeExportApi {
  exporting: boolean;
  exportPng: () => Promise<void>;
  exportSvg: () => Promise<void>;
  exportPdf: () => Promise<void>;
}

/**
 * Encapsulates tree-canvas export to PNG / SVG / PDF.
 *
 * Both `TreeExportMenu` (desktop Menubar) and `TreeCanvas`'s mobile
 * toolbar slot consume this hook, so the export pipeline lives in one
 * place. Each consumer keeps its own `exporting` state — that is fine
 * because only one of the two UIs is mounted at a time (mobile vs
 * desktop, gated by `isMobile`).
 *
 * Caller must be inside a `<ReactFlowProvider>` (the canvas wrapper).
 */
export function useTreeExport(): TreeExportApi {
  const { getNodes } = useReactFlow();
  const [exporting, setExporting] = useState(false);

  const getFlowElement = useCallback(() => {
    return document.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  const exportImage = useCallback(
    async (kind: ExportKind) => {
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

  const exportPng = useCallback(() => exportImage('png'), [exportImage]);
  const exportSvg = useCallback(() => exportImage('svg'), [exportImage]);
  const exportPdf = useCallback(() => exportImage('pdf'), [exportImage]);

  return { exporting, exportPng, exportSvg, exportPdf };
}
