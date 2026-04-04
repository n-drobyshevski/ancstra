'use client';

import { useCallback } from 'react';
import { TreeTable } from './tree-table';
import type { TreeData, PersonListItem } from '@ancstra/shared';

interface TreeTableWrapperProps {
  treeData: TreeData;
  relationships: {
    parents: Record<string, { id: string; name: string }[]>;
    spouses: Record<string, { id: string; name: string }[]>;
  };
  onSelectPerson: (person: PersonListItem) => void;
}

export function TreeTableWrapper({ treeData, relationships, onSelectPerson }: TreeTableWrapperProps) {
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
    />
  );
}
