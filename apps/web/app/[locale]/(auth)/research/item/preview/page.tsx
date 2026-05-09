import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ItemPreviewShell } from '@/components/research/item-detail/item-preview-shell';
import { PagePadding } from '@/components/page-padding';
import { requirePagePermission } from '@/lib/auth/page-guard';

interface ResearchItemPreviewProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function ResearchItemPreviewContent({ searchParams }: ResearchItemPreviewProps) {
  await requirePagePermission('ai:research');
  const params = await searchParams;

  const title = params.title;
  if (!title) redirect('/research');

  return (
    <PagePadding>
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
    </PagePadding>
  );
}

export default function ResearchItemPreviewPage({ searchParams }: ResearchItemPreviewProps) {
  return (
    <Suspense fallback={null}>
      <ResearchItemPreviewContent searchParams={searchParams} />
    </Suspense>
  );
}
