import { notFound } from 'next/navigation';
import { getResearchItem } from '@ancstra/research';
import { ItemDetailShell } from '@/components/research/item-detail/item-detail-shell';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { getFamilyDb } from '@/lib/db';
import { PagePadding } from '@/components/page-padding';

export default async function ResearchItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Replaces the previous getAuthContext + null-return pattern: viewers and
  // editors-without-AI now get a server redirect with a toast instead of
  // landing on a blank page.
  const authContext = await requirePagePermission('ai:research');
  const db = await getFamilyDb(authContext.dbFilename);
  const item = await getResearchItem(db, id);
  if (!item) notFound();

  return <PagePadding><div style={{ viewTransitionName: `research-${id}` }}><ItemDetailShell item={item} /></div></PagePadding>;
}
