import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasPermission } from '@ancstra/auth';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requireAuthContext } from '@/lib/auth/context';
import type { Locale } from '@/i18n/routing';
import { FamilySettingsForm } from '@/components/family/family-settings-form';
import { FamilySettingsFormSkeleton } from '@/components/skeletons/family-settings-form-skeleton';

interface FamilySettingsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: FamilySettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings.family' });
  return { title: t('metadataTitle') };
}

async function FamilySettingsContent({ params }: FamilySettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();

  // Read view requires members:manage; editors/viewers don't see this page.
  if (!hasPermission(ctx.role, 'members:manage')) {
    redirect('/dashboard');
  }

  const canEdit = hasPermission(ctx.role, 'settings:manage');
  const t = await getTranslations('settings.family.page');

  const db = await getCentralDb();
  const row = await db
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();

  if (!row) {
    redirect('/dashboard');
  }

  const settings = {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    dbFilename: row.dbFilename,
    moderationEnabled: row.moderationEnabled === 1,
    maxMembers: row.maxMembers,
    monthlyAiBudgetUsd: row.monthlyAiBudgetUsd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">
          {canEdit ? t('taglineCanEdit') : t('taglineReadOnly')}
        </p>
      </div>
      <FamilySettingsForm initialSettings={settings} canEdit={canEdit} />
    </div>
  );
}

export default function FamilySettingsPage({ params }: FamilySettingsPageProps) {
  return (
    <Suspense fallback={<FamilySettingsFormSkeleton />}>
      <FamilySettingsContent params={params} />
    </Suspense>
  );
}
