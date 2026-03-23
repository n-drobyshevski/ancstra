import { notFound } from 'next/navigation';
import { createDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { PersonDetail } from '@/components/person-detail';

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createDb();
  const person = await assemblePersonDetail(db, id);
  if (!person) notFound();
  return <PersonDetail person={person} />;
}
