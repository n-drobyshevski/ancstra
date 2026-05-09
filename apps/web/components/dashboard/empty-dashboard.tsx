import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GitBranch, UserPlus, Upload, Telescope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleGate } from '@/components/auth/role-gate';
import { getEffectiveRole } from '@/lib/auth/effective-role';

/**
 * Empty-tree state. Role-aware in two distinct moods:
 *
 *   1. Anyone who *can* act on it (owner / admin / editor) → confident
 *      "let's get started" copy with the relevant CTAs gated by permission.
 *   2. Viewer → polite waiting state. **Zero CTAs.** Before Phase 4 the
 *      RoleGate'd buttons would all hide and a viewer would see the
 *      "your family tree is empty" heading with no action below — a
 *      dead page. This branch fixes the UX bug.
 */
export async function EmptyDashboard() {
  const role = await getEffectiveRole();

  if (role === 'viewer') {
    const t = await getTranslations('dashboard.empty.viewer');
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Telescope className="size-16 text-muted-foreground/30" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold">{t('heading')}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
    );
  }

  const t = await getTranslations('dashboard.empty');
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <GitBranch className="size-16 text-muted-foreground/30" aria-hidden />
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
