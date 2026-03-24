import { redirect } from 'next/navigation';
import { ItemPreviewShell } from '@/components/research/item-detail/item-preview-shell';

export default async function ResearchItemPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const title = params.title;
  if (!title) redirect('/research');

  return (
    <ItemPreviewShell
      result={{
        title,
        url: params.url ?? null,
        snippet: params.snippet ?? null,
        providerId: params.providerId ?? null,
        externalId: params.externalId ?? null,
        relevanceScore: params.relevanceScore ? Number(params.relevanceScore) : null,
        extractedName: params.extractedName ?? null,
        extractedBirthDate: params.extractedBirthDate ?? null,
        extractedDeathDate: params.extractedDeathDate ?? null,
        extractedLocation: params.extractedLocation ?? null,
      }}
    />
  );
}
