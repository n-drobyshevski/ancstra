import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { getCachedDashboardData } from '@/lib/cached-queries';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const canReview =
    authContext != null && hasPermission(authContext.role, 'contributions:review');

  const { recentPersons, totalPersons } = await getCachedDashboardData(authContext.dbFilename);

  const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

  return (
    <PagePadding>
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
          <Link href="/persons/new">Add New Person</Link>
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
          {recentPersons.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No persons yet.{' '}
              <Link href="/persons/new" className="text-primary underline">
                Add your first person
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              {recentPersons.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/persons/${person.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {person.givenName} {person.surname}
                    </Link>
                    <Badge variant="secondary" className="text-xs">
                      {sexLabel[person.sex]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {person.birthDate ?? ''}
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
    </PagePadding>
  );
}
