import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { GitBranch, UserPlus, Upload } from 'lucide-react';
import { RoleGate } from '@/components/auth/role-gate';

export async function EmptyDashboard() {
  const t = await getTranslations('dashboard.empty');
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <GitBranch className="size-16 text-muted-foreground/30" />
      <h2 className="mt-4 text-lg font-semibold">{t('heading')}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t('tagline')}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <RoleGate permission="person:create">
          <Button asChild>
            <Link href="/persons/new">
              <UserPlus className="mr-2 size-4" />
              {t('addFirstPerson')}
            </Link>
          </Button>
        </RoleGate>
        <RoleGate permission="gedcom:import">
          <Button variant="outline" asChild>
            <Link href="/data">
              <Upload className="mr-2 size-4" />
              {t('importGedcom')}
            </Link>
          </Button>
        </RoleGate>
      </div>
    </div>
  );
}
