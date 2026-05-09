import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FileStack } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFormatRelativeTime } from '@/lib/format-server';
import { getCachedRecentFactsheets } from '@/lib/cache/dashboard-editor';

interface FactsheetsRecentProps {
  dbFilename: string;
}

const STATUS_CLASS = {
  draft:
    'border-status-info-text/30 bg-status-info-bg/30 text-status-info-text',
  ready:
    'border-status-success-text/30 bg-status-success-bg/30 text-status-success-text',
  promoted:
    'border-primary/30 bg-primary/10 text-primary',
  merged:
    'border-status-merged-text/30 bg-status-merged-bg/30 text-status-merged-text',
  // dismissed is filtered out at the cache layer; case kept for type safety.
  dismissed: 'border-border bg-muted/40 text-muted-foreground',
} as const;

/**
 * Editor's secondary card. Top 5 recently-updated factsheets across the
 * family. Status chip uses semantic tokens so editors can scan at a glance.
 *
 * Empty state collapses to nothing (returns `null`); the slot itself decides
 * the surrounding behavior so we don't render an empty card on clean trees.
 */
export async function FactsheetsRecent({ dbFilename }: FactsheetsRecentProps) {
  const [items, t, tStatus, formatRelative] = await Promise.all([
    getCachedRecentFactsheets(dbFilename, 5),
    getTranslations('dashboard.factsheetsRecent'),
    getTranslations('dashboard.factsheetsRecent.status'),
    getFormatRelativeTime(),
  ]);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/research/factsheets">{t('viewAll')}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul role="list" className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <FileStack
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/research/factsheets/${item.id}`}
                  className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                  title={item.title}
                >
                  {item.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatRelative(item.updatedAt)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] font-normal ${STATUS_CLASS[item.status]}`}
              >
                {tStatus(item.status)}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
