import { getTranslations } from 'next-intl/server';
import { MetricCards } from '@/components/quality/metric-cards';
import { CompletenessChart } from '@/components/quality/completeness-chart';
import { MissingDataChart } from '@/components/quality/missing-data-chart';
import { PriorityTable } from '@/components/quality/priority-table';
import { getQualitySummary } from '@ancstra/db';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { getFamilyDb } from '@/lib/db';
import { PagePadding } from '@/components/page-padding';

export default async function QualityPage() {
  const t = await getTranslations('analytics.page');
  // Quality metrics are read-only; viewer holds activity:view, so they see them too.
  // Lensed-down users below activity:view (none today) would get redirected.
  const ctx = await requirePagePermission('activity:view');
  let metrics: { label: string; value: number; total: number; count: number }[] = [];
  // Generation data would come from a future query; for now pass empty so
  // the chart component renders gracefully.
  const generationData: { generation: number; avgScore: number }[] = [];

  try {
    const familyDb = await getFamilyDb(ctx.dbFilename);
    const summary = await getQualitySummary(familyDb);
    metrics = summary.metrics;
  } catch {
    // Quality summary failures are non-fatal — render empty charts.
  }

  return (
    <PagePadding>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('tagline')}</p>
      </div>

      <MetricCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <CompletenessChart data={generationData} />
        <MissingDataChart metrics={metrics} />
      </div>

      <PriorityTable />
    </div>
    </PagePadding>
  );
}
