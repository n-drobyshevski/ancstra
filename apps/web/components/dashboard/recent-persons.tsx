import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Upload } from 'lucide-react';
import { PersonAvatar } from './person-avatar';
import { getCachedRecentPersons, getCachedStatCards } from '@/lib/cache/dashboard';

interface RecentPersonsProps {
  dbFilename: string;
}

export async function RecentPersons({ dbFilename }: RecentPersonsProps) {
  // No `'use cache'` here: `getTranslations()` reads request headers, which
  // Next.js 16 cacheComponents forbids inside cache scope. The DB reads are
  // cached at the helper level (`getCachedRecentPersons`, `getCachedStatCards`).
  const [recentPersons, { totalPersons }, t, tSex] = await Promise.all([
    getCachedRecentPersons(dbFilename),
    getCachedStatCards(dbFilename),
    getTranslations('dashboard.recentPersons'),
    getTranslations('common.sexLabels'),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        {totalPersons > 5 && (
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/persons">{t('viewAll')}</Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {recentPersons.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto size-16 text-muted-foreground/30" />
            <p className="text-lg font-semibold mt-4">{t('emptyHeading')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('emptyTagline')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
              <Button asChild>
                <Link href="/persons/new">
                  <UserPlus />
                  {t('addFirstPerson')}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/data">
                  <Upload />
                  {t('importGedcom')}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul role="list" className="space-y-0">
            {recentPersons.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 rounded-lg px-2 -mx-2 py-2.5 hover:bg-muted/50 transition-colors min-h-[44px]"
              >
                <PersonAvatar
                  givenName={person.givenName}
                  surname={person.surname}
                  sex={person.sex}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/persons/${person.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    style={{ viewTransitionName: `person-${person.id}` }}
                  >
                    {person.givenName} {person.surname}
                  </Link>
                  {person.birthDate && (
                    <p className="text-xs text-muted-foreground">{t('birthPrefix', { date: person.birthDate })}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {tSex(person.sex)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
