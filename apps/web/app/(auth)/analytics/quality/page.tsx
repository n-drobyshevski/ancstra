import { MetricCards } from '@/components/quality/metric-cards';
import { CompletenessChart } from '@/components/quality/completeness-chart';
import { MissingDataChart } from '@/components/quality/missing-data-chart';
import { PriorityTable } from '@/components/quality/priority-table';
import { getQualitySummary } from '@ancstra/db';
import { requireAuthContext } from '@/lib/auth/context';
import { getFamilyDb } from '@/lib/db';
import { PagePadding } from '@/components/page-padding';

export default async function QualityPage() {
  let generationData: { generation: number; avgScore: number }[] = [];
  let metrics: { label: string; value: number; total: number; count: number }[] = [];

  try {
    const ctx = await requireAuthContext();
    const familyDb = await getFamilyDb(ctx.dbFilename);
    const summary = await getQualitySummary(familyDb);
    metrics = summary.metrics;

    // Generation data would come from a future query; for now pass empty
    // This placeholder ensures the chart component renders gracefully
    generationData = [];
  } catch {
    // Auth errors will be handled by the layout middleware
  }

  return (
    <PagePadding>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground">
          Track completeness and identify research priorities across your family tree.
        </p>
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
