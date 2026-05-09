import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { TrendingUp, UserPlus, CalendarPlus, BookPlus } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCachedWhatsNewMilestones } from '@/lib/cache/dashboard-viewer';

interface WhatsNewMilestonesProps {
  dbFilename: string;
}

/**
 * Viewer's weekly rollup. Three counters: persons / events / sources added
 * in the last 7 days. Each is a chevron-style row to keep it scannable on
 * mobile. Self-suppresses to `null` when the week is quiet so we don't
 * render an "all zeros" card.
 *
 * Distinct from RecentActivity (which is the raw audit-log feed): this view
 * answers "what *changed* in the data" rather than "what did people *do*".
 */
export async function WhatsNewMilestones({ dbFilename }: WhatsNewMilestonesProps) {
  const [milestones, t] = await Promise.all([
    getCachedWhatsNewMilestones(dbFilename),
    getTranslations('dashboard.whatsNew'),
  ]);

  if (milestones.isQuiet) return null;

  const rows: Array<{
    key: string;
    icon: typeof UserPlus;
    count: number;
    label: string;
    href: string | null;
  }> = [
    {
      key: 'persons',
      icon: UserPlus,
      count: milestones.personsAdded,
      label: t('personsAdded', { count: milestones.personsAdded }),
      href: '/persons',
    },
    {
      key: 'events',
      icon: CalendarPlus,
      count: milestones.eventsAdded,
      label: t('eventsAdded', { count: milestones.eventsAdded }),
      href: null,
    },
    {
      key: 'sources',
      icon: BookPlus,
      count: milestones.sourcesAdded,
      label: t('sourcesAdded', { count: milestones.sourcesAdded }),
      href: null,
    },
  ].filter((r) => r.count > 0);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href="/activity">{t('viewAll')}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {t('window', { days: milestones.windowDays })}
        </p>
        <ul role="list" className="mt-3 space-y-2">
          {rows.map(({ key, icon: Icon, label, href }) => {
            const inner = (
              <span className="flex items-center gap-2 text-sm">
                <Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="text-foreground">{label}</span>
              </span>
            );
            return (
              <li key={key}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded px-1 py-0.5 -mx-1 transition-colors hover:bg-muted/50"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
