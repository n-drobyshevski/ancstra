import Link from 'next/link';
import { Users, Heart, BarChart3, TrendingUp, ShieldAlert } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { scoreColor } from '@/lib/quality-utils';
import { getCachedStatCards, getCachedQualityScore } from '@/lib/cache/dashboard';
import { getCachedModerationSummary } from '@/lib/cache/dashboard-heroes';
import type { StatKey } from '@/lib/dashboard/stat-cards';

interface StatCardsProps {
  dbFilename: string;
  /**
   * Ordered list of stat keys to render. Defaults to the original four-card
   * KPI layout when omitted (back-compat for any caller that doesn't want
   * role-aware reordering).
   */
  keys?: readonly StatKey[];
}

const DEFAULT_KEYS: readonly StatKey[] = ['people', 'families', 'dataQuality', 'last30Days'];

const GRID_COLS_LG: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export async function StatCards({ dbFilename, keys = DEFAULT_KEYS }: StatCardsProps) {
  'use cache';
  cacheLife('dashboard');
  // Tags mirror the inner data fns so any revalidateTag() invalidates this too.
  // `contributions` is included unconditionally because the cached fragment
  // would otherwise survive a queue change made *after* it was first rendered
  // for an admin and stayed stale.
  cacheTag('dashboard-stats', 'persons', 'quality', 'contributions');

  const needsPending = keys.includes('pendingContributions');
  const [stats, overallQualityScore, moderation, t] = await Promise.all([
    getCachedStatCards(dbFilename),
    getCachedQualityScore(dbFilename),
    needsPending ? getCachedModerationSummary(dbFilename) : Promise.resolve(null),
    getTranslations('dashboard.statCards'),
  ]);

  const renderers: Record<StatKey, () => React.ReactNode> = {
    people: () => (
      <Card key="people" size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {t('peopleInTree')}
          </CardTitle>
          <CardAction>
            <Users className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.totalPersons.toLocaleString()}</p>
        </CardContent>
      </Card>
    ),
    families: () => (
      <Card key="families" size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {t('families')}
          </CardTitle>
          <CardAction>
            <Heart className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.totalFamilies.toLocaleString()}</p>
        </CardContent>
      </Card>
    ),
    dataQuality: () => (
      <Link key="dataQuality" href="/analytics/quality" className="contents">
        <Card size="sm" className="transition-opacity hover:opacity-80">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t('dataQuality')}
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
    ),
    last30Days: () => (
      <Card key="last30Days" size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {t('last30Days')}
          </CardTitle>
          <CardAction>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {stats.recentAdditionsCount.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    ),
    pendingContributions: () => {
      const pendingCount = moderation?.pendingCount ?? 0;
      return (
        <Card key="pendingContributions" size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {t('pendingContributions')}
            </CardTitle>
            <CardAction>
              <ShieldAlert
                className={
                  'size-4 ' +
                  (pendingCount > 0 ? 'text-status-warning-text' : 'text-muted-foreground')
                }
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p
              className={
                'text-2xl font-bold ' +
                (pendingCount > 0 ? 'text-status-warning-text' : '')
              }
            >
              {pendingCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      );
    },
  };

  // Adaptive lg grid prevents stretched columns when fewer than 4 cards are
  // present (viewer = 2, editor = 3). Mobile stays 2-col regardless.
  const lgCols = GRID_COLS_LG[Math.min(keys.length, 4)] ?? GRID_COLS_LG[4];

  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${lgCols}`}>
      {keys.map((k) => renderers[k]())}
    </div>
  );
}
