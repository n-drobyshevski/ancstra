'use client';

import { useRouter } from 'next/navigation';
import { TreeTable } from './tree-table';
import type { TreeData } from '@ancstra/shared';

interface TreeTableWrapperProps {
  treeData: TreeData;
  relationships: {
    parents: Record<string, { id: string; name: string }[]>;
    spouses: Record<string, { id: string; name: string }[]>;
  };
}

export function TreeTableWrapper({ treeData, relationships }: TreeTableWrapperProps) {
  const router = useRouter();
  return (
    <TreeTable
      treeData={treeData}
      relationships={relationships}
      onSelectPerson={(id) => router.push(`/persons/${id}`)}
    />
  );
}
