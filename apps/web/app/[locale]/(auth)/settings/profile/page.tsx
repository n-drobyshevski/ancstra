import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requireAuthContext } from '@/lib/auth/context';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { ProfileForm } from '@/components/settings/profile-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings.nav.items');
  return { title: t('profile') };
}

export default async function ProfilePage() {
  const ctx = await requireAuthContext();
  const db = await getCentralDb();
  const t = await getTranslations('settings.profile.page');
  const tNav = await getTranslations('settings.nav.items');

  const [user, prefsRow] = await Promise.all([
    db.select({
      name: centralSchema.users.name,
      email: centralSchema.users.email,
      avatarUrl: centralSchema.users.avatarUrl,
    })
      .from(centralSchema.users)
      .where(eq(centralSchema.users.id, ctx.userId))
      .get(),
    db.select()
      .from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, ctx.userId))
      .get(),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  const initialPrefs = {
    locale: prefsRow?.locale ?? 'en-US',
    timezone: prefsRow?.timezone ?? 'UTC',
    density: (prefsRow?.density ?? 'comfortable') as 'comfortable' | 'compact',
    notifyEmail: prefsRow ? prefsRow.notifyEmail === 1 : true,
    notifyActivity: prefsRow ? prefsRow.notifyActivity === 1 : true,
  };

  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('profile')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <ProfileForm
        initialProfile={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
        }}
        initialPrefs={initialPrefs}
      />
    </div>
  );
}
