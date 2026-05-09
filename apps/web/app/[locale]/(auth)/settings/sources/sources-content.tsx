'use client';

import { useTranslations } from 'next-intl';
import { useProviders } from '@/lib/settings/providers-client';
import { WorkerStatus } from '@/components/settings/worker-status';
import { ProviderCard } from '@/components/settings/provider-card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

const CATEGORIES = [
  { id: 'databases', color: 'bg-emerald-500', providerIds: ['familysearch', 'nara', 'wikitree', 'openarchives'] },
  { id: 'newspapers', color: 'bg-indigo-500', providerIds: ['chronicling_america'] },
  { id: 'cemeteries', color: 'bg-teal-500', providerIds: ['findagrave'] },
  { id: 'webCommunity', color: 'bg-violet-500', providerIds: ['web_search', 'geneanet'] },
] as const;

export function SearchSourcesContent() {
  const tPage = useTranslations('settings.sources.page');
  const tCats = useTranslations('settings.sources.categories');
  const tNav = useTranslations('settings.nav.items');
  const tAdmin = useTranslations('admin.audit');
  const { providers, isLoading, error, mutate } = useProviders();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SettingsMobileHeader title={tNav('searchSources')} />
        <div>
          <h2 className="text-lg font-semibold">{tPage('heading')}</h2>
          <p className="text-sm text-muted-foreground">
            {tPage('tagline')}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsMobileHeader title={tNav('searchSources')} />
        <div>
          <h2 className="text-lg font-semibold">{tPage('heading')}</h2>
          <p className="text-sm text-muted-foreground">
            {tPage('tagline')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={mutate}>
            <RefreshCw className="size-3.5 mr-1.5" />
            {tAdmin('retry')}
          </Button>
        </div>
      </div>
    );
  }

  const providerMap = new Map(providers.map((p) => [p.id, p]));

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsMobileHeader title={tNav('searchSources')} />
      <div>
        <h2 className="text-lg font-semibold">{tPage('heading')}</h2>
        <p className="text-sm text-muted-foreground">
          {tPage('tagline')}
        </p>
      </div>

      <WorkerStatus />

      {CATEGORIES.map((cat) => {
        const categoryProviders = cat.providerIds
          .map((id) => providerMap.get(id))
          .filter(Boolean);

        if (categoryProviders.length === 0) return null;

        return (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${cat.color}`} />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {tCats(cat.id)}
              </h3>
            </div>
            <div className="space-y-3">
              {categoryProviders.map((provider) => (
                <ProviderCard
                  key={provider!.id}
                  provider={provider!}
                  onUpdate={mutate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
