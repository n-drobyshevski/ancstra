import { notFound } from 'next/navigation';
import { createDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { WorkspaceShell } from '@/components/research/workspace/workspace-shell';

export default async function ResearchPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createDb();
  const person = assemblePersonDetail(db, id);
  if (!person) notFound();

  return (
    <WorkspaceShell
      person={{
        id: person.id,
        givenName: person.givenName,
        surname: person.surname,
        birthDate: person.birthDate ?? null,
        deathDate: person.deathDate ?? null,
        sex: person.sex,
      }}
    />
  );
}
