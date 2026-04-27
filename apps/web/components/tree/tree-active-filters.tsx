'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FilterState } from './tree-utils';
import type { TopologyMode } from './topology-toggle';

const SEX_LABELS = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

interface TreeActiveFiltersProps {
  filterState: FilterState;
  search: string;
  topologyMode: TopologyMode;
  topologyReferenceName: string | null;
  onClearSearch: () => void;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  onClearTopology: () => void;
}

export function TreeActiveFilters({
  filterState,
  search,
  topologyMode,
  topologyReferenceName,
  onClearSearch,
  onToggleFilter,
  onClearTopology,
}: TreeActiveFiltersProps) {
  const chips: Chip[] = [];

  if (search.trim()) {
    chips.push({
      key: 'q',
      label: `Search: "${search.trim()}"`,
      remove: onClearSearch,
    });
  }

  for (const k of ['M', 'F', 'U'] as const) {
    if (!filterState.sex[k]) {
      chips.push({
        key: `sex-${k}`,
        label: `Hide ${SEX_LABELS[k]}`,
        remove: () => onToggleFilter('sex', k),
      });
    }
  }

  if (!filterState.living.living) {
    chips.push({
      key: 'no-living',
      label: 'Hide living',
      remove: () => onToggleFilter('living', 'living'),
    });
  }
  if (!filterState.living.deceased) {
    chips.push({
      key: 'no-deceased',
      label: 'Hide deceased',
      remove: () => onToggleFilter('living', 'deceased'),
    });
  }

  if (topologyMode !== 'all' && topologyReferenceName) {
    chips.push({
      key: 'topology',
      label: `${topologyMode === 'ancestors' ? 'Ancestors' : 'Descendants'} of ${topologyReferenceName}`,
      remove: onClearTopology,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-1"
      role="region"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="pl-2 pr-1 gap-1">
          <span className="text-xs">{chip.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-background"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.remove}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
