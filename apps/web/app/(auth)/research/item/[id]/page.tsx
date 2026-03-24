import { notFound } from 'next/navigation';
import { createFamilyDb } from '@ancstra/db';
import { getResearchItem } from '@ancstra/research';
import { ItemDetailShell } from '@/components/research/item-detail/item-detail-shell';
import { getAuthContext } from '@/lib/auth/context';

export default async function ResearchItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = createFamilyDb(authContext.dbFilename);
  const item = await getResearchItem(db, id);
  if (!item) notFound();

  return <ItemDetailShell item={item} />;
}
