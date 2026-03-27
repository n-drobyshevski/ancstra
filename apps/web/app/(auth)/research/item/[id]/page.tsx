import { notFound } from 'next/navigation';
import { getResearchItem } from '@ancstra/research';
import { ItemDetailShell } from '@/components/research/item-detail/item-detail-shell';
import { getAuthContext } from '@/lib/auth/context';
import { getFamilyDb } from '@/lib/db';

export default async function ResearchItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = await getFamilyDb(authContext.dbFilename);
  const item = await getResearchItem(db, id);
  if (!item) notFound();

  return <ItemDetailShell item={item} />;
}
