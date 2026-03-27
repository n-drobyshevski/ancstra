'use client';

import dynamic from 'next/dynamic';
import type { TreeData } from '@ancstra/shared';

const TreeCanvas = dynamic(
  () => import('@/components/tree/tree-canvas').then(m => m.TreeCanvas),
  { ssr: false }
);

const TreeTableWrapper = dynamic(
  () => import('@/components/tree/tree-table-wrapper').then(m => m.TreeTableWrapper),
  { ssr: false }
);

function buildRelationships(treeData: TreeData) {
  const parents: Record<string, { id: string; name: string }[]> = {};
  const spouses: Record<string, { id: string; name: string }[]> = {};
  const nameMap = new Map(treeData.persons.map(p => [p.id, `${p.givenName} ${p.surname}`]));

  for (const child of treeData.childLinks) {
    const family = treeData.families.find(f => f.id === child.familyId);
    if (!family) continue;
    if (!parents[child.personId]) parents[child.personId] = [];
    if (family.partner1Id && nameMap.has(family.partner1Id)) {
      parents[child.personId].push({ id: family.partner1Id, name: nameMap.get(family.partner1Id)! });
    }
    if (family.partner2Id && nameMap.has(family.partner2Id)) {
      parents[child.personId].push({ id: family.partner2Id, name: nameMap.get(family.partner2Id)! });
    }
  }

  for (const family of treeData.families) {
    if (!family.partner1Id || !family.partner2Id) continue;
    if (!nameMap.has(family.partner1Id) || !nameMap.has(family.partner2Id)) continue;
    if (!spouses[family.partner1Id]) spouses[family.partner1Id] = [];
    spouses[family.partner1Id].push({ id: family.partner2Id, name: nameMap.get(family.partner2Id)! });
    if (!spouses[family.partner2Id]) spouses[family.partner2Id] = [];
    spouses[family.partner2Id].push({ id: family.partner1Id, name: nameMap.get(family.partner1Id)! });
  }

  return { parents, spouses };
}

interface TreePageClientProps {
  treeData: TreeData;
  view?: string;
  focusPersonId?: string;
}

export function TreePageClient({ treeData, view, focusPersonId }: TreePageClientProps) {
  if (view === 'table') {
    const relationships = buildRelationships(treeData);
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <TreeTableWrapper treeData={treeData} relationships={relationships} />
      </div>
    );
  }

  return (
    <div className="-m-3 sm:-m-4 md:-m-6 h-[calc(100vh-3.5rem)]">
      <TreeCanvas treeData={treeData} focusPersonId={focusPersonId} />
    </div>
  );
}
