import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { scoreColor } from '@/lib/quality-utils';
import { getCachedQualityScore } from '@/lib/cache/dashboard';

interface QualityWidgetProps {
  dbFilename: string;
}

export async function QualityWidget({ dbFilename }: QualityWidgetProps) {
  'use cache';
  cacheLife('genealogy');
  cacheTag('quality');

  const score = await getCachedQualityScore(dbFilename);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Data Quality</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/quality">Details</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: scoreColor(score) }}>
            {score}%
          </span>
          <span className="text-sm text-muted-foreground">completeness</span>
        </div>
        <div
          className="h-2 rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Data quality score"
        >
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(score, 100)}%`, backgroundColor: scoreColor(score) }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
