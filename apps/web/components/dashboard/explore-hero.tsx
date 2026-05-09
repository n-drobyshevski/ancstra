import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GitBranch, Users, Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/dashboard/person-avatar';
import { getCachedRecentPersons } from '@/lib/cache/dashboard';

interface ExploreHeroProps {
  dbFilename: string;
}

/**
 * Viewer hero. The viewer's job is to *explore*, not to act, so the hero
 * surfaces three read-only entry points:
 *   - Open the family tree
 *   - Browse all persons
 *   - View activity feed
 *
 * Plus a "Most recently added" tile pulling from the existing
 * `getCachedRecentPersons` cache (no extra DB hit) — gives the viewer a
 * concrete starting point: the freshest person their relatives added.
 *
 * Heritage Modern: 90% neutral surface, primary indigo only on the headline
 * affordance and the recently-added link. No add/import/edit affordances.
 */
export async function ExploreHero({ dbFilename }: ExploreHeroProps) {
  const [recentPersons, t] = await Promise.all([
    getCachedRecentPersons(dbFilename),
    getTranslations('dashboard.explore'),
  ]);

  const newest = recentPersons[0] ?? null;

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
          <Button asChild size="sm" className="shrink-0 gap-1">
            <Link href="/tree" aria-label={t('openTreeAriaLabel')}>
              <span className="hidden sm:inline">{t('openTree')}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {/* Tree shortcut */}
          <Link
            href="/tree"
            className="group rounded-md border border-border bg-card p-3 md:p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('exploreTree')}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t('exploreTreeAction')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('exploreTreeTagline')}
            </p>
          </Link>

          {/* People shortcut */}
          <Link
            href="/persons"
            className="group rounded-md border border-border bg-card p-3 md:p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('browsePeople')}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t('browsePeopleAction')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('browsePeopleTagline')}
            </p>
          </Link>

          {/* Most recently added — concrete starting point */}
          {newest ? (
            <Link
              href={`/persons/${newest.id}`}
              className="rounded-md border border-border bg-card p-3 md:p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">
                  {t('mostRecent')}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <PersonAvatar
                  givenName={newest.givenName}
                  surname={newest.surname}
                  sex={newest.sex}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {newest.givenName} {newest.surname}
                  </p>
                  {newest.birthDate && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t('birthPrefix', { date: newest.birthDate })}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <Link
              href="/activity"
              className="group rounded-md border border-border bg-card p-3 md:p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">
                  {t('viewActivity')}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {t('viewActivityAction')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('viewActivityTagline')}
              </p>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
