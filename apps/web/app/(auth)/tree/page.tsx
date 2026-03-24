import { getTreeData } from '@/lib/queries';
import { TreeCanvas } from '@/components/tree/tree-canvas';
import { TreeTableWrapper } from '@/components/tree/tree-table-wrapper';
import { getAuthContext } from '@/lib/auth/context';
import { getFamilyDb } from '@/lib/db';
import type { TreeData } from '@ancstra/shared';

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

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; view?: string }>;
}) {
  const { focus, view } = await searchParams;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = await getFamilyDb(authContext.dbFilename);
  const treeData = await getTreeData(db);

  if (treeData.persons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-medium">No persons in your tree yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first person to start building your family tree.
          </p>
          <a
            href="/person/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add First Person
          </a>
        </div>
      </div>
    );
  }

  if (view === 'table') {
    const relationships = buildRelationships(treeData);
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <TreeTableWrapper treeData={treeData} relationships={relationships} />
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <TreeCanvas treeData={treeData} focusPersonId={focus} />
    </div>
  );
}
