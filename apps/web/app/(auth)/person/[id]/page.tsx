import { notFound } from 'next/navigation';
import { assemblePersonDetail } from '@/lib/queries';
import { PersonDetail } from '@/components/person-detail';
import { getAuthContext } from '@/lib/auth/context';
import { getFamilyDb } from '@/lib/db';

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = await getFamilyDb(authContext.dbFilename);
  const person = await assemblePersonDetail(db, id);
  if (!person) notFound();
  return <PersonDetail person={person} />;
}
