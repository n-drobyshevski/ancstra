'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { SelectionState } from './use-selection';
import type { PersonsFilters } from '@/lib/persons/search-params';

const MAX_EXPLICIT_IDS = 100;

interface ExportButtonProps {
  selection: SelectionState;
  filters: PersonsFilters;
}

function buildExportUrl(
  format: 'csv' | 'gedcom',
  selection: SelectionState,
  filters: PersonsFilters,
): string | { tooMany: number } {
  const params = new URLSearchParams();
  params.set('format', format);

  if (selection.kind === 'ids') {
    if (selection.rowIds.size > MAX_EXPLICIT_IDS) {
      return { tooMany: selection.rowIds.size };
    }
    params.set('ids', Array.from(selection.rowIds).join(','));
  } else if (selection.kind === 'matching') {
    if (filters.q) params.set('q', filters.q);
    for (const v of filters.sex) params.append('sex', v);
    for (const v of filters.living) params.append('living', v);
    for (const v of filters.validation) params.append('validation', v);
    if (filters.bornFrom !== null) params.set('bornFrom', String(filters.bornFrom));
    if (filters.bornTo !== null) params.set('bornTo', String(filters.bornTo));
    if (filters.diedFrom !== null) params.set('diedFrom', String(filters.diedFrom));
    if (filters.diedTo !== null) params.set('diedTo', String(filters.diedTo));
    if (filters.place) params.set('place', filters.place);
    if (filters.placeScope !== 'birth') params.set('placeScope', filters.placeScope);
    if (filters.citations !== 'any') params.set('citations', filters.citations);
    if (filters.hasProposals) params.set('hasProposals', 'true');
    if (filters.complGte !== null) params.set('complGte', String(filters.complGte));
    if (selection.exclude.size > 0) params.set('exclude', Array.from(selection.exclude).join(','));
  }

  return `/api/persons/export?${params.toString()}`;
}

export function ExportButton({ selection, filters }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const trigger = (format: 'csv' | 'gedcom') => {
    const result = buildExportUrl(format, selection, filters);
    if (typeof result !== 'string') {
      toast.error(
        `Cannot export ${result.tooMany} explicit selections. Use "Select all matching" or refine filters.`,
      );
      setOpen(false);
      return;
    }
    const a = document.createElement('a');
    a.href = result;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          <Download className="mr-1 h-3 w-3" aria-hidden /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => trigger('csv')}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => trigger('gedcom')}>GEDCOM</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
