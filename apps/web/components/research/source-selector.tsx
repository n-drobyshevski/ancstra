'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Settings2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface ProviderConfig {
  id: string;
  name: string;
  category: string;
}

export interface SourcePreset {
  id: string;
  label: string;
  providerIds: string[];
}

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'databases', label: 'Databases', color: 'text-emerald-500' },
  { id: 'newspapers', label: 'Newspapers & Media', color: 'text-primary' },
  { id: 'cemeteries', label: 'Cemeteries', color: 'text-teal-500' },
  { id: 'web', label: 'Web & Community', color: 'text-violet-500' },
];

const ALL_PROVIDERS: ProviderConfig[] = [
  { id: 'familysearch', name: 'FamilySearch', category: 'databases' },
  { id: 'nara', name: 'NARA', category: 'databases' },
  { id: 'wikitree', name: 'WikiTree', category: 'databases' },
  { id: 'openarchives', name: 'OpenArchives', category: 'databases' },
  { id: 'chronicling_america', name: 'Chronicling America', category: 'newspapers' },
  { id: 'findagrave', name: 'Find A Grave', category: 'cemeteries' },
  { id: 'web_search', name: 'Web Search', category: 'web' },
  { id: 'geneanet', name: 'Geneanet', category: 'web' },
];

const PRESETS: SourcePreset[] = [
  { id: 'all', label: 'All Sources', providerIds: ALL_PROVIDERS.map(p => p.id) },
  { id: 'census', label: 'Census & Vital', providerIds: ['familysearch', 'nara'] },
  { id: 'newspapers', label: 'Newspapers', providerIds: ['chronicling_america'] },
  { id: 'web', label: 'Web Only', providerIds: ['web_search', 'geneanet'] },
];

const STORAGE_KEY = 'ancstra:selected-providers';

function loadSelectedProviders(): Set<string> {
  if (typeof window === 'undefined') return new Set(ALL_PROVIDERS.map(p => p.id));
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch { /* ignore */ }
  return new Set(ALL_PROVIDERS.map(p => p.id));
}

interface SourceSelectorProps {
  onSelectionChange: (providerIds: string[]) => void;
}

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'checking';

const HEALTH_DOT_COLORS: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  unknown: 'bg-muted-foreground/40',
  checking: 'bg-muted-foreground/40 animate-pulse',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: 'Online',
  degraded: 'Degraded',
  down: 'Offline',
  unknown: 'Not checked',
  checking: 'Checking...',
};

export function SourceSelector({ onSelectionChange }: SourceSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(loadSelectedProviders);
  const [open, setOpen] = useState(false);
  const [healthMap, setHealthMap] = useState<Record<string, HealthStatus>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const lastChecked = useRef<number>(0);

  // Fetch health when popover opens (throttled to once per 30s)
  useEffect(() => {
    if (!open) return;
    const now = Date.now();
    if (now - lastChecked.current < 30_000 && Object.keys(healthMap).length > 0) return;

    setHealthLoading(true);
    // Set all to 'checking' initially
    const checking: Record<string, HealthStatus> = {};
    ALL_PROVIDERS.forEach(p => { checking[p.id] = 'checking'; });
    setHealthMap(checking);

    fetch('/api/research/providers/health')
      .then(res => res.json())
      .then(data => {
        setHealthMap(data.statuses ?? {});
        lastChecked.current = Date.now();
      })
      .catch(() => {
        const failed: Record<string, HealthStatus> = {};
        ALL_PROVIDERS.forEach(p => { failed[p.id] = 'unknown'; });
        setHealthMap(failed);
      })
      .finally(() => setHealthLoading(false));
  }, [open]);

  // Persist and notify on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    onSelectionChange([...selected]);
  }, [selected, onSelectionChange]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    const categoryProviders = ALL_PROVIDERS.filter(p => p.category === categoryId);
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = categoryProviders.every(p => next.has(p.id));
      categoryProviders.forEach(p => {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      });
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: SourcePreset) => {
    setSelected(new Set(preset.providerIds));
  }, []);

  const activePreset = PRESETS.find(p =>
    p.providerIds.length === selected.size &&
    p.providerIds.every(id => selected.has(id))
  );

  const providersByCategory = CATEGORIES.map(cat => ({
    ...cat,
    providers: ALL_PROVIDERS.filter(p => p.category === cat.id),
  }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Settings2 className="size-3.5" />
          Sources
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-semibold">
            {selected.size}/{ALL_PROVIDERS.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Quick Presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    activePreset?.id === preset.id
                      ? 'bg-accent/20 border-accent text-accent-foreground'
                      : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Categories with providers */}
          <div className="space-y-3">
            {providersByCategory.map(cat => {
              const allChecked = cat.providers.every(p => selected.has(p.id));
              const someChecked = cat.providers.some(p => selected.has(p.id));

              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 text-xs font-semibold mb-1.5 hover:opacity-80 ${cat.color}`}
                  >
                    <div className={`size-3 rounded border flex items-center justify-center ${
                      allChecked
                        ? 'bg-primary border-primary'
                        : someChecked
                        ? 'border-primary bg-primary/30'
                        : 'border-muted-foreground'
                    }`}>
                      {allChecked && <Check className="size-2 text-primary-foreground" />}
                      {someChecked && !allChecked && <div className="size-1 bg-primary rounded-full" />}
                    </div>
                    {cat.label}
                  </button>
                  <div className="grid grid-cols-2 gap-0.5 ml-5">
                    {cat.providers.map(provider => {
                      const health = healthMap[provider.id] ?? 'unknown';
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => toggle(provider.id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left group"
                          title={HEALTH_LABELS[health]}
                        >
                          <div className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                            selected.has(provider.id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground'
                          }`}>
                            {selected.has(provider.id) && (
                              <Check className="size-2.5 text-primary-foreground" />
                            )}
                          </div>
                          <span className={`flex-1 ${selected.has(provider.id) ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {provider.name}
                          </span>
                          <span
                            className={`size-1.5 rounded-full shrink-0 ${HEALTH_DOT_COLORS[health]}`}
                            title={HEALTH_LABELS[health]}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-border" />

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {selected.size}/{ALL_PROVIDERS.length} sources
              </span>
              {healthMap['_worker'] && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={`size-1.5 rounded-full ${HEALTH_DOT_COLORS[healthMap['_worker'] as HealthStatus]}`} />
                  Worker {HEALTH_LABELS[healthMap['_worker'] as HealthStatus]?.toLowerCase()}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
