'use client';

import { ChevronDown, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { HIDABLE_COLUMN_IDS } from './persons-columns';
import type { HidableColumn } from '@/lib/persons/search-params';

const COLUMN_LABELS: Record<HidableColumn, string> = {
  sex: 'Sex',
  birthDate: 'Birth',
  deathDate: 'Death',
  completeness: 'Completeness',
  sourcesCount: 'Sources',
  validation: 'Validation',
  updatedAt: 'Last edited',
};

interface ColumnsDropdownProps {
  hidden: readonly HidableColumn[];
  onChange: (next: HidableColumn[]) => void;
}

export function ColumnsDropdown({ hidden, onChange }: ColumnsDropdownProps) {
  const hiddenSet = new Set(hidden);

  const toggle = (col: HidableColumn) => {
    const next = new Set(hiddenSet);
    if (next.has(col)) next.delete(col); else next.add(col);
    onChange(Array.from(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Toggle columns">
          <Columns className="mr-2 h-4 w-4" aria-hidden />
          Columns
          <ChevronDown className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {HIDABLE_COLUMN_IDS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col}
            checked={!hiddenSet.has(col)}
            onCheckedChange={() => toggle(col)}
          >
            {COLUMN_LABELS[col]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
