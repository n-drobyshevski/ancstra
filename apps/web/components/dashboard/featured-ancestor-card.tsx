import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Sparkles, ArrowRight } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/dashboard/person-avatar';
import { getCachedFeaturedAncestor } from '@/lib/cache/dashboard-viewer';

interface FeaturedAncestorCardProps {
  dbFilename: string;
  familyId: string;
}

/**
 * Daily-rotating spotlight on a deceased person from the family tree. Same
 * person all day (UTC), refreshes at midnight. Self-suppresses to `null`
 * when the cache returns nothing — keeps the slot empty rather than rendering
 * a placeholder card.
 */
export async function FeaturedAncestorCard({
  dbFilename,
  familyId,
}: FeaturedAncestorCardProps) {
  // YYYY-MM-DD in UTC — same value all day, flips at 00:00 UTC.
  const dateSeed = new Date().toISOString().slice(0, 10);
  const ancestor = await getCachedFeaturedAncestor(dbFilename, familyId, dateSeed);
  if (!ancestor) return null;

  const t = await getTranslations('dashboard.featuredAncestor');
  const lifespan = formatLifespan(ancestor.birthDate, ancestor.deathDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/persons/${ancestor.id}`} className="gap-1">
              <span>{t('viewProfile')}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Link
          href={`/persons/${ancestor.id}`}
          className="flex items-center gap-4 rounded-md p-2 -m-2 transition-colors hover:bg-muted/50"
          style={{ viewTransitionName: `person-${ancestor.id}` }}
        >
          <PersonAvatar
            givenName={ancestor.givenName}
            surname={ancestor.surname}
            sex={ancestor.sex}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">
              {ancestor.givenName} {ancestor.surname}
            </p>
            {lifespan && (
              <p className="truncate text-sm text-muted-foreground">{lifespan}</p>
            )}
            {ancestor.birthPlace && (
              <p className="truncate text-xs text-muted-foreground">
                {t('bornIn', { place: ancestor.birthPlace })}
              </p>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * Builds a human lifespan string from raw `dateOriginal` strings. Returns an
 * empty string when both are missing so the caller can drop the line.
 */
function formatLifespan(birth: string | null, death: string | null): string {
  if (!birth && !death) return '';
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  return `d. ${death}`;
}
