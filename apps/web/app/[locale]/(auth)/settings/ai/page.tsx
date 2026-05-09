import { Suspense } from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { resolveExperimentalState } from '@ancstra/auth/experimental';
import type { Locale } from '@/i18n/routing';
import { AiBudgetSettings } from '@/components/settings/ai-budget-settings';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { Card, CardContent } from '@/components/ui/card';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { requireAuthContext } from '@/lib/auth/context';
import { getCentralDb } from '@/lib/db-singleton';

interface AiSettingsPageProps {
  params: Promise<{ locale: Locale }>;
}

async function AiSettingsContent({ params }: AiSettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Owner-only: AI budget configuration is part of family settings.
  await requirePagePermission('settings:manage');
  const ctx = await requireAuthContext();
  const t = await getTranslations('settings.ai.page');
  const tNav = await getTranslations('settings.nav.items');
  const tNotice = await getTranslations('settings.ai.notice');

  const db = await getCentralDb();
  const experimental = await resolveExperimentalState(db, ctx.userId);
  const userHasNoAiAccess = !experimental.isEnabled('biography')
    && !experimental.isEnabled('researchChat')
    && !experimental.isEnabled('historicalContext');

  return (
    <div className="space-y-6">
      <SettingsMobileHeader title={tNav('ai')} />
      <div>
        <h2 className="text-lg font-semibold">{t('heading')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      {userHasNoAiAccess && (
        <Card className="bg-status-warning-bg border-status-warning-text/20">
          <CardContent className="flex flex-row items-start gap-3 pt-6">
            <FlaskConical className="size-5 text-status-warning-text mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium text-status-warning-text">{tNotice('title')}</p>
              <p className="text-sm text-status-warning-text/80 mt-1">{tNotice('body')}</p>
              <Link
                href="/settings/labs"
                className="inline-block mt-2 text-sm font-medium underline text-status-warning-text"
              >
                {tNotice('linkLabel')} →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      <AiBudgetSettings />
    </div>
  );
}

export default function AiSettingsPage({ params }: AiSettingsPageProps) {
  return (
    <Suspense fallback={null}>
      <AiSettingsContent params={params} />
    </Suspense>
  );
}
