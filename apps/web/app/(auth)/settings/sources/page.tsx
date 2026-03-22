'use client';

import { useProviders } from '@/lib/settings/providers-client';
import { WorkerStatus } from '@/components/settings/worker-status';
import { ProviderCard } from '@/components/settings/provider-card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

const CATEGORIES = [
  { id: 'databases', label: 'Databases', color: 'bg-emerald-500', providerIds: ['familysearch', 'nara', 'wikitree', 'openarchives'] },
  { id: 'newspapers', label: 'Newspapers & Media', color: 'bg-amber-500', providerIds: ['chronicling_america'] },
  { id: 'cemeteries', label: 'Cemeteries', color: 'bg-teal-500', providerIds: ['findagrave'] },
  { id: 'web', label: 'Web & Community', color: 'bg-violet-500', providerIds: ['web_search', 'geneanet'] },
];

export default function SearchSourcesPage() {
  const { providers, isLoading, error, mutate } = useProviders();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Search Sources</h2>
          <p className="text-sm text-muted-foreground">
            Configure which genealogy databases and search providers to use.
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
        <div>
          <h2 className="text-lg font-semibold">Search Sources</h2>
          <p className="text-sm text-muted-foreground">
            Configure which genealogy databases and search providers to use.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={mutate}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const providerMap = new Map(providers.map((p) => [p.id, p]));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Search Sources</h2>
        <p className="text-sm text-muted-foreground">
          Configure which genealogy databases and search providers to use during research.
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
                {cat.label}
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
