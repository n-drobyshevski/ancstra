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
import {
  TREE_HIDABLE_COLUMNS,
  type TreeHidableColumn,
} from '@/lib/tree/search-params';

const COLUMN_LABELS: Record<TreeHidableColumn, string> = {
  sex: 'Sex',
  status: 'Status',
  completeness: 'Completeness',
  parents: 'Parents',
  spouses: 'Spouses',
  children: 'Children',
};

interface TreeColumnsDropdownProps {
  hidden: readonly TreeHidableColumn[];
  onChange: (next: TreeHidableColumn[]) => void;
}

export function TreeColumnsDropdown({ hidden, onChange }: TreeColumnsDropdownProps) {
  const hiddenSet = new Set(hidden);

  const toggle = (col: TreeHidableColumn) => {
    const next = new Set(hiddenSet);
    if (next.has(col)) next.delete(col); else next.add(col);
    onChange(Array.from(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs" aria-label="Toggle columns">
          <Columns className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Columns
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TREE_HIDABLE_COLUMNS.map((col) => (
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
