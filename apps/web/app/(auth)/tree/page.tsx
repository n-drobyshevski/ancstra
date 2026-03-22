import { createDb } from '@ancstra/db';
import { getTreeData } from '@/lib/queries';
import { TreeCanvas } from '@/components/tree/tree-canvas';

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const db = createDb();
  const treeData = getTreeData(db);

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

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <TreeCanvas treeData={treeData} focusPersonId={focus} />
    </div>
  );
}
