'use client';

import { useCallback } from 'react';
import { TreeTable } from './tree-table';
import type { TreeData, PersonListItem } from '@ancstra/shared';
import type { FilterState } from './tree-utils';
import type {
  TreeDensity,
  TreeSortKey,
  TreeSortDir,
  TreeHidableColumn,
} from '@/lib/tree/search-params';

interface TreeTableWrapperProps {
  treeData: TreeData;
  relationships: {
    parents: Record<string, { id: string; name: string }[]>;
    spouses: Record<string, { id: string; name: string }[]>;
  };
  onSelectPerson: (person: PersonListItem) => void;
  onSetTopologyAnchor?: (person: PersonListItem) => void;
  filterState?: FilterState;
  topologyVisibleIds?: Set<string> | null;
  search?: string;
  sort?: TreeSortKey;
  dir?: TreeSortDir;
  onSortChange?: (sort: TreeSortKey, dir: TreeSortDir) => void;
  density?: TreeDensity;
  hiddenColumns?: readonly TreeHidableColumn[];
  onClearFilters?: () => void;
  topologyMode?: 'all' | 'ancestors' | 'descendants';
  selectedPersonId?: string | null;
  isLoading?: boolean;
}

export function TreeTableWrapper({
  treeData,
  relationships,
  onSelectPerson,
  onSetTopologyAnchor,
  filterState,
  topologyVisibleIds,
  search,
  sort,
  dir,
  onSortChange,
  density,
  hiddenColumns,
  onClearFilters,
  topologyMode,
  selectedPersonId,
  isLoading,
}: TreeTableWrapperProps) {
  const handleSelect = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) onSelectPerson(person);
    },
    [treeData.persons, onSelectPerson],
  );

  return (
    <TreeTable
      treeData={treeData}
      relationships={relationships}
      onSelectPerson={handleSelect}
      onSetTopologyAnchor={onSetTopologyAnchor}
      filterState={filterState}
      topologyVisibleIds={topologyVisibleIds}
      search={search}
      sort={sort}
      dir={dir}
      onSortChange={onSortChange}
      density={density}
      hiddenColumns={hiddenColumns}
      onClearFilters={onClearFilters}
      topologyMode={topologyMode}
      selectedPersonId={selectedPersonId}
      isLoading={isLoading}
    />
  );
}
