import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';
import { getFormatRelativeTime } from '@/lib/format-server';
import { getActionConfig } from '@/lib/activity-config';
import { getCachedActivityFeed } from '@/lib/cache/activity';

interface RecentActivityProps {
  familyId: string;
}

export async function RecentActivity({ familyId }: RecentActivityProps) {
  'use cache: private';
  cacheLife('activity');
  cacheTag('activity', `activity-${familyId}`);

  const feed = await getCachedActivityFeed(familyId, 5);
  const items = feed.items;
  const formatRelative = await getFormatRelativeTime();
  const t = await getTranslations('dashboard.recentActivity');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">{t('viewAll')}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t('none')}</p>
        ) : (
          <ul role="list" className="space-y-0">
            {items.map((item) => {
              const config = getActionConfig(item.action);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <div className={`size-2 shrink-0 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                  <span className="text-sm flex-1 min-w-0 truncate">{item.summary}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelative(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
