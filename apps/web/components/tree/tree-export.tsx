'use client';

import { useCallback, useState } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

const IMAGE_WIDTH = 4096;
const IMAGE_HEIGHT = 3072;

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function TreeExport() {
  const { getNodes } = useReactFlow();
  const [exporting, setExporting] = useState(false);

  const getFlowElement = useCallback(() => {
    return document.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  const exportPng = useCallback(async () => {
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
      const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

      const dataUrl = await toPng(element, {
        backgroundColor: '#f8fafc',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      downloadDataUrl(dataUrl, 'ancstra-tree.png');
      toast.success('PNG exported');
    } catch (err) {
      toast.error('Export failed');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [getFlowElement, getNodes]);

  const exportSvg = useCallback(async () => {
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
      const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

      const dataUrl = await toSvg(element, {
        backgroundColor: '#f8fafc',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      downloadDataUrl(dataUrl, 'ancstra-tree.svg');
      toast.success('SVG exported');
    } catch (err) {
      toast.error('Export failed');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [getFlowElement, getNodes]);

  const exportPdf = useCallback(async () => {
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
      const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [IMAGE_WIDTH, IMAGE_HEIGHT],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      pdf.save('ancstra-tree.pdf');
      toast.success('PDF exported');
    } catch (err) {
      toast.error('Export failed');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [getFlowElement, getNodes]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled={exporting}>
          <Download className="size-3.5 mr-1" />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportPng}>
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportSvg}>
          Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf}>
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
