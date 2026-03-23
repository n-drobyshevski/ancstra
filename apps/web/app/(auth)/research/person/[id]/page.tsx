import { notFound } from 'next/navigation';
import { createFamilyDb } from '@ancstra/db';
import { assemblePersonDetail } from '@/lib/queries';
import { WorkspaceShell } from '@/components/research/workspace/workspace-shell';
import { getAuthContext } from '@/lib/auth/context';

export default async function ResearchPersonPage({
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
