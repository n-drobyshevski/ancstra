import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Microscope, Sparkles, ListTodo, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFormatRelativeTime } from '@/lib/format-server';
import {
  getCachedMyContributionsStatus,
  getCachedAiSuggestionsCount,
  getCachedLastFactsheetForUser,
} from '@/lib/cache/dashboard-editor';

interface ResearchFocusHeroProps {
  dbFilename: string;
  userId: string;
}

/**
 * Editor hero. Three signals editors care about most when they land:
 *   - "Continue" — last factsheet they touched (or a "start one" CTA when none)
 *   - AI suggestions — unprocessed `ai_suggestion` research items in draft
 *   - My contributions — pending / approved / needs-revision counts
 *
 * Visual register: Heritage Modern. Primary indigo only on hero numbers; the
 * status counts use semantic chip colors (status-info / status-success /
 * status-warning) so editors can scan the queue at a glance without a
 * decoder ring.
 */
export async function ResearchFocusHero({ dbFilename, userId }: ResearchFocusHeroProps) {
  const [lastFactsheet, aiSuggestionsCount, myStatus, t, tStatus, formatRelative] = await Promise.all([
    getCachedLastFactsheetForUser(dbFilename, userId),
    getCachedAiSuggestionsCount(dbFilename),
    getCachedMyContributionsStatus(dbFilename, userId),
    getTranslations('dashboard.researchFocus'),
    getTranslations('dashboard.researchFocus.statusBadges'),
    getFormatRelativeTime(),
  ]);

  return (
    <Card
      className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card"
      style={{ viewTransitionName: 'dashboard-hero' }}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('eyebrow')}
            </p>
            <h2 className="text-lg font-semibold md:text-xl">{t('heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('tagline')}</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link
              href="/research"
              aria-label={t('openResearchAriaLabel')}
              className="gap-1"
            >
              <span className="hidden sm:inline">{t('openResearch')}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {/* Continue tile */}
          <div className="rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <Microscope className="size-4 text-primary" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('continue')}
              </span>
            </div>
            {lastFactsheet ? (
              <>
                <Link
                  href={`/research/factsheets/${lastFactsheet.id}`}
                  className="mt-2 block truncate text-base font-semibold text-foreground underline-offset-4 hover:underline"
                  title={lastFactsheet.title}
                >
                  {lastFactsheet.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('lastUpdated', {
                    relative: formatRelative(lastFactsheet.updatedAt),
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('noSession')}
                </p>
                <Link
                  href="/research"
                  className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
                >
                  {t('startNewSession')}
                </Link>
              </>
            )}
          </div>

          {/* AI suggestions tile */}
          <div className="rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <Sparkles
                className={
                  'size-4 ' +
                  (aiSuggestionsCount > 0 ? 'text-primary' : 'text-muted-foreground')
                }
                aria-hidden
              />
              <span className="text-xs font-medium text-muted-foreground">
                {t('aiSuggestions')}
              </span>
            </div>
            <p
              className={
                'mt-2 text-2xl font-bold tabular-nums ' +
                (aiSuggestionsCount > 0 ? 'text-primary' : 'text-foreground')
              }
            >
              {aiSuggestionsCount.toLocaleString()}
            </p>
            {aiSuggestionsCount > 0 ? (
              <Link
                href="/research?filter=ai_suggestion"
                className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                {t('reviewSuggestions')}
              </Link>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('noSuggestions')}
              </p>
            )}
          </div>

          {/* My contributions tile */}
          <div className="rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('myContributions')}
              </span>
            </div>
            {myStatus.total === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('noContributions')}</p>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                  {myStatus.total.toLocaleString()}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5" role="list">
                  {myStatus.pending > 0 && (
                    <li>
                      <Badge
                        variant="outline"
                        className="border-status-info-text/30 bg-status-info-bg/30 text-status-info-text text-[10px] font-normal"
                      >
                        {tStatus('pending', { count: myStatus.pending })}
                      </Badge>
                    </li>
                  )}
                  {myStatus.approved > 0 && (
                    <li>
                      <Badge
                        variant="outline"
                        className="border-status-success-text/30 bg-status-success-bg/30 text-status-success-text text-[10px] font-normal"
                      >
                        {tStatus('approved', { count: myStatus.approved })}
                      </Badge>
                    </li>
                  )}
                  {myStatus.revisionRequested > 0 && (
                    <li>
                      <Badge
                        variant="outline"
                        className="border-status-warning-text/30 bg-status-warning-bg/30 text-status-warning-text text-[10px] font-normal"
                      >
                        {tStatus('revisionRequested', { count: myStatus.revisionRequested })}
                      </Badge>
                    </li>
                  )}
                  {myStatus.rejected > 0 && (
                    <li>
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/50 text-muted-foreground text-[10px] font-normal"
                      >
                        {tStatus('rejected', { count: myStatus.rejected })}
                      </Badge>
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

