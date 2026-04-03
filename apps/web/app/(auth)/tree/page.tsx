import Link from 'next/link';
import { getCachedTreeData } from '@/lib/cached-queries';
import { getAuthContext } from '@/lib/auth/context';
import { TreePageClient } from '@/components/tree/tree-page-client';

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const treeData = await getCachedTreeData(authContext.dbFilename);

  if (treeData.persons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-medium">No persons in your tree yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first person to start building your family tree.
          </p>
          <Link
            href="/persons/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add First Person
          </Link>
        </div>
      </div>
    );
  }

  return <TreePageClient treeData={treeData} focusPersonId={focus} />;
}
