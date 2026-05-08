import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { EditorDefaultsForm } from '@/components/settings/editor-defaults-form';

export const metadata = { title: 'Editor defaults' };

export default async function EditorDefaultsPage() {
  // Editor+ tier — anyone who can create persons benefits from setting these.
  const ctx = await requirePagePermission('person:create');
  const db = await getCentralDb();

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
      <SettingsMobileHeader title="Editor defaults" />
      <div>
        <h2 className="text-lg font-semibold">Editor defaults</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Family-wide defaults applied to new records. Anyone able to create
          persons can adjust these — owners override them per-record.
        </p>
      </div>
      <EditorDefaultsForm initial={initial} />
    </div>
  );
}
