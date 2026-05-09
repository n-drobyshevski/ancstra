import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAuthContext } from '@/lib/auth/context';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';
import { getDashboardCards } from '@/components/settings/settings-dashboard-cards';
import { SettingsMobileNav } from './settings-mobile-nav';

interface SettingsPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: SettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings.page' });
  return { title: t('title') };
}

async function SettingsDashboardSection({ params }: SettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireAuthContext();
  const tWelcome = await getTranslations('settings.welcome');
  const tCards = await getTranslations('settings.cards');
  const cards = getDashboardCards(ctx.role);

  return (
    <div className="space-y-8">
      {/* Mobile: render the sectioned mobile nav instead of the dashboard.
          The dashboard is desktop-first; mobile users want quick navigation. */}
      <SettingsMobileNav />

      <div className="hidden md:block space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{tWelcome(`${ctx.role}.title`)}</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{tWelcome(`${ctx.role}.tagline`)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className={cn(
                  'group relative flex flex-col gap-3 rounded-xl border p-5 transition-colors',
                  card.primary
                    ? 'border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08]'
                    : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-lg',
                      card.primary ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground/80',
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <ArrowRight
                    className={cn(
                      'size-4 transition-transform group-hover:translate-x-0.5',
                      card.primary ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold leading-tight">{tCards(`${card.key}.title`)}</div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {tCards(`${card.key}.description`)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage({ params }: SettingsPageProps) {
  return (
    <Suspense fallback={null}>
      <SettingsDashboardSection params={params} />
    </Suspense>
  );
}
