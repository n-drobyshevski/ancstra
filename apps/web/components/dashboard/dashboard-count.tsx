import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';

export async function DashboardCount() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const { totalPersons } = await getCachedStatCards(authContext.dbFilename);
  return (
    <p className="text-sm text-muted-foreground">
      {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in your tree.
    </p>
  );
}
