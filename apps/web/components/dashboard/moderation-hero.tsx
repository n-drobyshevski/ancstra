import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldAlert, ListChecks, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCachedModerationSummary } from '@/lib/cache/dashboard-heroes';

interface ModerationHeroProps {
  dbFilename: string;
}

/**
 * Admin hero. Surfaces the queue admins came here to triage:
 *   - Pending count (large, primary signal)
 *   - Age of the oldest pending item (orange when >3 days, red when >7)
 *   - Breakdown by entity type so admins can plan their pass
 *
 * Renders nothing-but-positive when the queue is empty (admins like a clean
 * inbox feeling — confirms their work). The dashboard layout puts the actual
 * queue list below in @primary, so this card is a strategic summary only.
 */
export async function ModerationHero({ dbFilename }: ModerationHeroProps) {
  const [{ pendingCount, oldestAgeDays, byEntityType }, t] = await Promise.all([
    getCachedModerationSummary(dbFilename),
    getTranslations('dashboard.moderation'),
  ]);

  // Empty-queue celebration variant.
  if (pendingCount === 0) {
    return (
      <Card
        className="border-status-success-text/20 bg-gradient-to-br from-status-success-bg/40 via-card to-card"
        style={{ viewTransitionName: 'dashboard-hero' }}
      >
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('eyebrow')}
              </p>
              <h2 className="text-lg font-semibold md:text-xl">
                {t('emptyHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('emptyTagline')}</p>
            </div>
            <div className="rounded-full bg-status-success-bg p-2.5">
              <ListChecks
                className="size-5 text-status-success-text"
                aria-hidden
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Severity from queue age — drives accent color, not message tone.
  const severity = oldestAgeDays == null
    ? 'normal'
    : oldestAgeDays >= 7
      ? 'high'
      : oldestAgeDays >= 3
        ? 'warn'
        : 'normal';

  const severityClasses = {
    normal: {
      border: 'border-primary/20',
      bg: 'from-primary/5 via-card to-card',
      icon: 'text-primary',
      ageBg: 'bg-card',
      ageText: 'text-foreground',
    },
    warn: {
      border: 'border-status-warning-text/30',
      bg: 'from-status-warning-bg/40 via-card to-card',
      icon: 'text-status-warning-text',
      ageBg: 'bg-status-warning-bg/30',
      ageText: 'text-status-warning-text',
    },
    high: {
      border: 'border-destructive/30',
      bg: 'from-destructive/10 via-card to-card',
      icon: 'text-destructive',
      ageBg: 'bg-destructive/10',
      ageText: 'text-destructive',
    },
  }[severity];

  return (
    <Card
      className={`${severityClasses.border} bg-gradient-to-br ${severityClasses.bg}`}
      style={{ viewTransitionName: 'dashboard-hero' }}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('eyebrow')}
            </p>
            <h2 className="text-lg font-semibold md:text-xl">
              {t('heading', { count: pendingCount })}
            </h2>
            <p className="text-sm text-muted-foreground">{t('tagline')}</p>
          </div>
          <Button asChild size="sm" className="shrink-0 gap-1">
            <Link href="#contribution-queue" aria-label={t('reviewAriaLabel')}>
              <span className="hidden sm:inline">{t('review')}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {/* Pending count KPI */}
          <div className="rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`size-4 ${severityClasses.icon}`} aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('pending')}
              </span>
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${severityClasses.icon}`}>
              {pendingCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('pendingFootnote')}
            </p>
          </div>

          {/* Oldest age KPI */}
          <div className={`rounded-md border border-border p-3 md:p-4 ${severityClasses.ageBg}`}>
            <div className="flex items-center gap-2">
              <Clock className={`size-4 ${severityClasses.icon}`} aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('oldest')}
              </span>
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${severityClasses.ageText}`}>
              {oldestAgeDays === null
                ? '—'
                : oldestAgeDays === 0
                  ? t('oldestToday')
                  : t('oldestDays', { count: oldestAgeDays })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {severity === 'high'
                ? t('oldestHighFootnote')
                : severity === 'warn'
                  ? t('oldestWarnFootnote')
                  : t('oldestNormalFootnote')}
            </p>
          </div>

          {/* Breakdown by entity type */}
          <div className="col-span-2 rounded-md border border-border bg-card p-3 md:col-span-1 md:p-4">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('breakdown')}
              </span>
            </div>
            {byEntityType.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('noBreakdown')}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5" role="list">
                {byEntityType.slice(0, 4).map(({ entityType, count }) => (
                  <li key={entityType}>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {t(`entity.${entityType}` as `entity.person`)} {count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
