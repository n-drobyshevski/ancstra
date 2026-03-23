import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { createFamilyDb, persons, personNames, events } from '@ancstra/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const db = createFamilyDb(authContext.dbFilename);
  const canReview =
    authContext != null && hasPermission(authContext.role, 'contributions:review');

  // Fetch last 5 persons ordered by created_at desc
  const recentRows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
      createdAt: persons.createdAt,
    })
    .from(persons)
    // @ts-expect-error -- libsql driver type mismatch with schema join conditions
    .innerJoin(personNames, eq(personNames.personId, persons.id))
    .where(and(isNull(persons.deletedAt), eq(personNames.isPrimary, true)))
    .orderBy(sql`${persons.createdAt} DESC`)
    .limit(5)
    .all();

  // Get birth dates for recent persons
  const recentIds = recentRows.map((r) => r.id);
  const birthEvents =
    recentIds.length > 0
      ? await db
          .select({
            personId: events.personId,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              recentIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} = 'birth'`
          )
          .all()
      : [];

  const birthByPerson = new Map(
    birthEvents.map((e) => [e.personId, e.dateOriginal])
  );

  const totalPersons = db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all()[0].count;

  const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

  return (
    <div className="space-y-6">
      <WelcomeCard />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Welcome to Ancstra</h1>
          <p className="text-sm text-muted-foreground">
            {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in your
            tree.
          </p>
        </div>
        <Button asChild>
          <Link href="/person/new">Add New Person</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Persons</CardTitle>
          {totalPersons > 5 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/persons">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No persons yet.{' '}
              <Link href="/person/new" className="text-primary underline">
                Add your first person
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              {recentRows.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/person/${person.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {person.givenName} {person.surname}
                    </Link>
                    <Badge variant="secondary" className="text-xs">
                      {sexLabel[person.sex]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {birthByPerson.get(person.id) ?? ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canReview && authContext && (
        <ContributionQueue familyId={authContext.familyId} />
      )}
    </div>
  );
}
