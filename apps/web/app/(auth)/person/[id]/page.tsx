import { notFound } from 'next/navigation';
import { createFamilyDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { PersonDetail } from '@/components/person-detail';
import { getAuthContext } from '@/lib/auth/context';

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = createFamilyDb(authContext.dbFilename);
  const person = await assemblePersonDetail(db, id);
  if (!person) notFound();
  return <PersonDetail person={person} />;
}
