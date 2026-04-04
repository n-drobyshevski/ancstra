import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Upload } from 'lucide-react';
import { PersonAvatar } from './person-avatar';
import { getCachedRecentPersons, getCachedStatCards } from '@/lib/cache/dashboard';

interface RecentPersonsProps {
  dbFilename: string;
}

const SEX_LABELS: Record<'M' | 'F' | 'U', string> = {
  M: 'Male',
  F: 'Female',
  U: 'Unknown',
};

export async function RecentPersons({ dbFilename }: RecentPersonsProps) {
  const [recentPersons, { totalPersons }] = await Promise.all([
    getCachedRecentPersons(dbFilename),
    getCachedStatCards(dbFilename),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Persons</CardTitle>
        {totalPersons > 5 && (
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/persons">View all</Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {recentPersons.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto size-16 text-muted-foreground/30" />
            <p className="text-lg font-semibold mt-4">Start building your tree</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first family member or import an existing GEDCOM file
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
              <Button asChild>
                <Link href="/persons/new">
                  <UserPlus />
                  Add First Person
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/data">
                  <Upload />
                  Import GEDCOM
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
                    <p className="text-xs text-muted-foreground">b. {person.birthDate}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {SEX_LABELS[person.sex]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
