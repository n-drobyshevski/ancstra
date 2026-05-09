import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';

export async function DashboardCount() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const { totalPersons } = await getCachedStatCards(authContext.dbFilename);
  const t = await getTranslations('dashboard');
  return (
    <p className="text-sm text-muted-foreground">
      {t('personCount', { count: totalPersons })}
    </p>
  );
}
