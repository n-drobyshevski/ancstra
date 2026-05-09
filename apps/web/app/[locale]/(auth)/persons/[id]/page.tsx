import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('persons.page');
  const authContext = await getAuthContext();
  if (!authContext) return { title: t('metadataPerson') };
  const person = await getCachedPersonDetail(authContext.dbFilename, id);
  if (!person) return { title: t('metadataNotFound') };
  const name =
    person.givenName || person.surname
      ? `${person.givenName ?? ''} ${person.surname ?? ''}`.trim()
      : null;
  return { title: name || t('metadataPerson') };
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
