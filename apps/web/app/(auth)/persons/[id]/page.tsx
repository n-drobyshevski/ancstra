import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCachedPersonDetail } from '@/lib/cache/person';
import { WorkspaceShell } from '@/components/research/workspace/workspace-shell';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return { title: 'Person' };
  const person = await getCachedPersonDetail(authContext.dbFilename, id);
  if (!person) return { title: 'Person not found' };
  const name =
    person.givenName || person.surname
      ? `${person.givenName ?? ''} ${person.surname ?? ''}`.trim()
      : null;
  return { title: name || 'Person' };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const person = await getCachedPersonDetail(authContext.dbFilename, id);
  if (!person) notFound();
  return <PagePadding><WorkspaceShell person={person} /></PagePadding>;
}
