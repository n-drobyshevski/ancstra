'use client';

import { TreeLayout, type TreeViewData } from './tree-layout';

interface TreePageClientProps {
  viewData: TreeViewData;
  focusPersonId?: string;
}

export function TreePageClient({ viewData, focusPersonId }: TreePageClientProps) {
  return <TreeLayout viewData={viewData} focusPersonId={focusPersonId} />;
}
