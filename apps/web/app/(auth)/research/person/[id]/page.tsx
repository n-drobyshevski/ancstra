import { redirect } from 'next/navigation';

export default async function ResearchPersonRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view = typeof sp.view === 'string' ? sp.view : undefined;
  const qs = view ? `?view=${view}` : '';
  redirect(`/person/${id}${qs}`);
}
