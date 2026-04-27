import Link from 'next/link';
import { Users, Heart, BarChart3, TrendingUp } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { scoreColor } from '@/lib/quality-utils';
import { getCachedStatCards, getCachedQualityScore } from '@/lib/cache/dashboard';

interface StatCardsProps {
  dbFilename: string;
}

export async function StatCards({ dbFilename }: StatCardsProps) {
  'use cache';
  cacheLife('dashboard');
  // Tags mirror inner data fns so any revalidateTag() invalidates this too.
  cacheTag('dashboard-stats', 'persons', 'quality');

  const [
    { totalPersons, totalFamilies, recentAdditionsCount },
    overallQualityScore,
  ] = await Promise.all([
    getCachedStatCards(dbFilename),
    getCachedQualityScore(dbFilename),
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            People in tree
          </CardTitle>
          <CardAction>
            <Users className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalPersons.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Families
          </CardTitle>
          <CardAction>
            <Heart className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalFamilies.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Link href="/analytics/quality" className="contents">
        <Card size="sm" className="transition-opacity hover:opacity-80">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Data quality
            </CardTitle>
            <CardAction>
              <BarChart3 className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              style={{ color: scoreColor(overallQualityScore) }}
            >
              {overallQualityScore}%
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Last 30 days
          </CardTitle>
          <CardAction>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {recentAdditionsCount.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
