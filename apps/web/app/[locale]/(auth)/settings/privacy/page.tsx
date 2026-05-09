import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { LivingThresholdSection } from '@/components/settings/living-threshold-section';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { requirePagePermission } from '@/lib/auth/page-guard';

export default async function PrivacyPage() {
  // Family-wide privacy controls are owner-only (settings:manage).
  const ctx = await requirePagePermission('settings:manage');
  const db = await getCentralDb();
  const t = await getTranslations('settings.privacy.page');
  const tNav = await getTranslations('settings.nav.items');
  const row = await db
    .select({ livingThresholdYears: centralSchema.familyRegistry.livingThresholdYears })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();

  return (
    <div className="space-y-8">
      <SettingsMobileHeader title={tNav('privacy')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t('tagline')}
        </p>
      </div>
      <LivingThresholdSection initialThreshold={row?.livingThresholdYears ?? 100} />
      <Link
        href="/settings/editor-defaults"
        className="group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
      >
        <div className="space-y-1">
          <div className="font-medium">{t('linkText')}</div>
          <p className="text-sm text-muted-foreground">
            {t('linkDescription')}
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
