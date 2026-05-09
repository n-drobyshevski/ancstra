import { ResearchLayout } from '@/components/research/research-layout';
import { PagePadding } from '@/components/page-padding';
import { requirePagePermission } from '@/lib/auth/page-guard';

export default async function ResearchPage() {
  await requirePagePermission('ai:research');
  return <PagePadding><ResearchLayout /></PagePadding>;
}
