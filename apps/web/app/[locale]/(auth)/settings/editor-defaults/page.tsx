import type { Metadata } from 'next';
import { Suspense } from 'react';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requirePagePermission } from '@/lib/auth/page-guard';
import type { Locale } from '@/i18n/routing';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { EditorDefaultsForm } from '@/components/settings/editor-defaults-form';

interface EditorDefaultsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: EditorDefaultsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'settings.editorDefaults.page',
  });
  return { title: t('metadataTitle') };
}

async function EditorDefaultsContent({ params }: EditorDefaultsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Editor+ tier — anyone who can create persons benefits from setting these.
  const ctx = await requirePagePermission('person:create');
  const db = await getCentralDb();
  const t = await getTranslations('settings.editorDefaults.page');
  const tNav = await getTranslations('settings.nav.items');

  const row = await db
    .select({
      defaultPrivacyLevel: centralSchema.familyRegistry.defaultPrivacyLevel,
      defaultGedcomExportMode: centralSchema.familyRegistry.defaultGedcomExportMode,
      defaultCitationStyle: centralSchema.familyRegistry.defaultCitationStyle,
    })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();

  const initial = {
    defaultPrivacyLevel: row?.defaultPrivacyLevel ?? 'private',
    defaultGedcomExportMode: row?.defaultGedcomExportMode ?? 'shareable',
    defaultCitationStyle: row?.defaultCitationStyle ?? 'evidence-explained',
  };

  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('editorDefaults')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t('tagline')}
        </p>
      </div>
      <EditorDefaultsForm initial={initial} />
    </div>
  );
}

export default function EditorDefaultsPage({ params }: EditorDefaultsPageProps) {
  return (
    <Suspense fallback={null}>
      <EditorDefaultsContent params={params} />
    </Suspense>
  );
}
