import type { Metadata } from 'next';
import { Suspense } from 'react';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { centralSchema } from '@ancstra/db';
import type { ExperimentalFeatureKey } from '@ancstra/auth/experimental';
import { getCentralDb } from '@/lib/db-singleton';
import { requireAuthContext } from '@/lib/auth/context';
import type { Locale } from '@/i18n/routing';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { ExperimentalFeaturesForm } from '@/components/settings/experimental-features-form';

interface LabsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: LabsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings.nav.items' });
  return { title: t('labs') };
}

function parseOverrides(raw: string | null | undefined): Partial<Record<ExperimentalFeatureKey, boolean>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Partial<Record<ExperimentalFeatureKey, boolean>> = {};
    for (const key of ['biography', 'researchChat', 'historicalContext'] as const) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'boolean') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

async function LabsContent({ params }: LabsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  const db = await getCentralDb();
  const t = await getTranslations('settings.labs');
  const tNav = await getTranslations('settings.nav.items');

  const [prefsRow, policyRow] = await Promise.all([
    db.select({
      experimentalEnabled: centralSchema.userPreferences.experimentalEnabled,
      experimentalFeatures: centralSchema.userPreferences.experimentalFeatures,
    })
      .from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, ctx.userId))
      .get(),
    db.select({
      experimentalFeaturesAllowUsers: centralSchema.platformSettings.experimentalFeaturesAllowUsers,
    })
      .from(centralSchema.platformSettings)
      .where(eq(centralSchema.platformSettings.id, 'global'))
      .get(),
  ]);

  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('labs')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('tagline')}</p>
      </div>
      <ExperimentalFeaturesForm
        initial={{
          policyAllowsUsers: policyRow?.experimentalFeaturesAllowUsers === 1,
          masterEnabled: prefsRow?.experimentalEnabled === 1,
          overrides: parseOverrides(prefsRow?.experimentalFeatures),
        }}
      />
    </div>
  );
}

export default function LabsPage({ params }: LabsPageProps) {
  return (
    <Suspense fallback={null}>
      <LabsContent params={params} />
    </Suspense>
  );
}
