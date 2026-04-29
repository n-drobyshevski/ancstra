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

export interface TreeExportOpts {
  /** When provided, the export crops to the bounding box of these node ids
   *  and hides any `.react-flow__node` whose `data-id` is not in the set.
   *  Edges are NOT filtered — edges that cross the selection bounds will
   *  still appear (acceptable v1 limitation). */
  onlyIds?: string[];
}

export interface TreeExportApi {
  exporting: boolean;
  exportPng: (opts?: TreeExportOpts) => Promise<void>;
  exportSvg: (opts?: TreeExportOpts) => Promise<void>;
  exportPdf: (opts?: TreeExportOpts) => Promise<void>;
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
    async (kind: ExportKind, opts?: TreeExportOpts) => {
      const element = getFlowElement();
      if (!element) return;

      setExporting(true);
      try {
        const allNodes = getNodes();
        if (allNodes.length === 0) {
          toast.error('No nodes to export');
          return;
        }

        const onlyIdSet =
          opts?.onlyIds && opts.onlyIds.length > 0
            ? new Set(opts.onlyIds)
            : null;
        const boundsNodes = onlyIdSet
          ? allNodes.filter((n) => onlyIdSet.has(n.id))
          : allNodes;
        if (boundsNodes.length === 0) {
          toast.error('Nothing in selection to export');
          return;
        }

        const bounds = getNodesBounds(boundsNodes);
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
          // Hide any non-selected react-flow nodes when exporting a subset.
          filter: onlyIdSet
            ? (node) => {
                if (!(node instanceof HTMLElement)) return true;
                if (node.classList.contains('react-flow__node')) {
                  const id = node.getAttribute('data-id');
                  return id !== null && onlyIdSet.has(id);
                }
                return true;
              }
            : undefined,
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

  const exportPng = useCallback(
    (opts?: TreeExportOpts) => exportImage('png', opts),
    [exportImage],
  );
  const exportSvg = useCallback(
    (opts?: TreeExportOpts) => exportImage('svg', opts),
    [exportImage],
  );
  const exportPdf = useCallback(
    (opts?: TreeExportOpts) => exportImage('pdf', opts),
    [exportImage],
  );

  return { exporting, exportPng, exportSvg, exportPdf };
}
