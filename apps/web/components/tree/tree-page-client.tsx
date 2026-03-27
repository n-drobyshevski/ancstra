'use client';

import type { TreeData } from '@ancstra/shared';
import { TreeLayout } from './tree-layout';

interface TreePageClientProps {
  treeData: TreeData;
  focusPersonId?: string;
}

export function TreePageClient({ treeData, focusPersonId }: TreePageClientProps) {
  return <TreeLayout treeData={treeData} focusPersonId={focusPersonId} />;
}
