import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AiBudgetSettings } from '@/components/settings/ai-budget-settings';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { requirePagePermission } from '@/lib/auth/page-guard';

async function AiSettingsContent() {
  // Owner-only: AI budget configuration is part of family settings.
  await requirePagePermission('settings:manage');
  const t = await getTranslations('settings.ai.page');
  const tNav = await getTranslations('settings.nav.items');
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('ai')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <AiBudgetSettings />
    </div>
  );
}

export default function AiSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AiSettingsContent />
    </Suspense>
  );
}
