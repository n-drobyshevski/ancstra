import { getTranslations } from 'next-intl/server';
import { ThemeSelector } from '@/components/settings/theme-selector';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

export default async function AppearancePage() {
  const t = await getTranslations('settings.appearance.page');
  const tNav = await getTranslations('settings.nav.items');
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('appearance')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <ThemeSelector />
    </div>
  );
}
