import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Activity, CalendarDays, Clock, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getFormatRelativeTime } from '@/lib/format-server';
import {
  getCachedActivityCounts,
  type CachedActivityCountRow,
} from '@/lib/cache/activity';
import type { ActivityVisibility } from '@/lib/activity-visibility';
import { filterEntriesByVisibility } from '@/lib/activity-visibility';

interface ActivityStatBandProps {
  familyId: string;
  visibility: ActivityVisibility;
}

interface ContributorAggregate {
  userId: string;
  name: string;
  count: number;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function topContributor(
  rows: CachedActivityCountRow[],
  userNames: Record<string, string>,
  unknownLabel: string,
): ContributorAggregate | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  if (!best) return null;
  return {
    userId: best[0],
    name: userNames[best[0]] ?? unknownLabel,
    count: best[1],
  };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card size="sm" className="ring-foreground/5">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-base font-semibold leading-tight">
            {value}
          </p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export async function ActivityStatBand({
  familyId,
  visibility,
}: ActivityStatBandProps) {
  const counts = await getCachedActivityCounts(familyId);
  const visibleRows = filterEntriesByVisibility(counts.recentEntries, visibility);
  const formatRelative = await getFormatRelativeTime();
  const t = await getTranslations('activity.stats');

  const todayCount = visibleRows.filter((r) => isToday(r.createdAt)).length;
  const weekCount = visibleRows.length;
  const top = topContributor(visibleRows, counts.userNames, t('noActivityYet'));
  const last = visibleRows[0]?.createdAt ?? counts.lastUpdate;

  // Hide the band on a brand-new family with nothing to summarise; the empty
  // feed below is enough.
  if (!last && weekCount === 0) return null;

  return (
    <section
      aria-label={t('summaryAriaLabel')}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <StatCard
        label={t('today')}
        value={String(todayCount)}
        hint={t('eventCount', { count: todayCount })}
        icon={<Activity className="size-4" />}
      />
      <StatCard
        label={t('thisWeek')}
        value={String(weekCount)}
        hint={t('eventCount', { count: weekCount })}
        icon={<CalendarDays className="size-4" />}
      />
      {top ? (
        <Card size="sm" className="ring-foreground/5">
          <CardContent className="flex items-center gap-3 px-4">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(top.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('topContributor')}
              </p>
              <p className="truncate text-base font-semibold leading-tight">
                {top.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {t('eventCountThisWeek', { count: top.count })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <StatCard
          label={t('topContributor')}
          value={t('emDash')}
          hint={t('noActivityYet')}
          icon={<Users className="size-4" />}
        />
      )}
      <StatCard
        label={t('lastUpdate')}
        value={last ? formatRelative(last) : t('emDash')}
        hint={last ? new Date(last).toLocaleDateString() : t('noActivityYet')}
        icon={<Clock className="size-4" />}
      />
    </section>
  );
}
