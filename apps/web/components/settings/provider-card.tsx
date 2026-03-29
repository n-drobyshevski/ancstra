'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  type SearchProvider,
  type TestResult,
  updateProvider,
  testProvider,
} from '@/lib/settings/providers-client';

// Category colors for the icon background
const CATEGORY_COLORS: Record<string, string> = {
  databases: 'bg-emerald-500/15 text-status-success-text',
  newspapers: 'bg-primary/15 text-primary',
  cemeteries: 'bg-teal-500/15 text-[oklch(0.35_0.12_180)] dark:text-[oklch(0.75_0.10_180)]',
  web: 'bg-violet-500/15 text-[oklch(0.35_0.12_300)] dark:text-[oklch(0.75_0.10_300)]',
};

// Map provider IDs to categories
const PROVIDER_CATEGORIES: Record<string, string> = {
  familysearch: 'databases',
  nara: 'databases',
  wikitree: 'databases',
  openarchives: 'databases',
  chronicling_america: 'newspapers',
  findagrave: 'cemeteries',
  web_search: 'web',
  geneanet: 'web',
};

// Provider descriptions
const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  familysearch: 'Census, vital records, immigration records',
  nara: 'National Archives catalog and digitized records',
  wikitree: 'Collaborative genealogy community',
  openarchives: 'Dutch and European archive records',
  chronicling_america: 'Historical newspaper archives (LOC)',
  findagrave: 'Cemetery and burial records',
  web_search: 'General web search via SearXNG or Brave',
  geneanet: 'European genealogy database',
};

// Which providers need API keys
const NEEDS_API_KEY: Set<string> = new Set(['familysearch']);

// Which providers have configurable base URLs
const HAS_BASE_URL: Set<string> = new Set(['web_search']);

function getStatusBadge(provider: SearchProvider): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
} {
  if (!provider.isEnabled) {
    return { label: 'Disabled', variant: 'secondary' };
  }

  if (provider.healthStatus === 'healthy') {
    return {
      label: 'Online',
      variant: 'outline',
      className: 'border-emerald-500/50 text-status-success-text',
    };
  }

  if (provider.healthStatus === 'down') {
    return { label: 'Offline', variant: 'destructive' };
  }

  if (provider.healthStatus === 'degraded') {
    return {
      label: 'Degraded',
      variant: 'outline',
      className: 'border-amber-500/50 text-status-warning-text',
    };
  }

  // If it needs an API key and doesn't have one
  if (NEEDS_API_KEY.has(provider.id)) {
    const config = provider.config ? JSON.parse(provider.config) : {};
    if (!config.apiKey) {
      return {
        label: 'Needs Auth',
        variant: 'outline',
        className: 'border-amber-500/50 text-status-warning-text',
      };
    }
  }

  return { label: 'Not Checked', variant: 'secondary' };
}

interface ProviderCardProps {
  provider: SearchProvider;
  onUpdate: () => void;
}

export function ProviderCard({ provider, onUpdate }: ProviderCardProps) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Local state for debounced fields
  const config = provider.config ? JSON.parse(provider.config) : {};
  const [apiKey, setApiKey] = useState<string>(config.apiKey ?? '');
  const [rateLimit, setRateLimit] = useState<string>(String(provider.rateLimitRpm));
  const [baseUrl, setBaseUrl] = useState<string>(provider.baseUrl ?? '');

  // Debounce timer refs
  const apiKeyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const baseUrlTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timers
  useEffect(() => {
    return () => {
      clearTimeout(apiKeyTimerRef.current);
      clearTimeout(rateLimitTimerRef.current);
      clearTimeout(baseUrlTimerRef.current);
    };
  }, []);

  const category = PROVIDER_CATEGORIES[provider.id] ?? 'web';
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.web;
  const abbrev = provider.name.slice(0, 2).toUpperCase();
  const description = PROVIDER_DESCRIPTIONS[provider.id] ?? '';
  const statusBadge = getStatusBadge(provider);

  const needsApiKey = NEEDS_API_KEY.has(provider.id);
  const hasBaseUrl = HAS_BASE_URL.has(provider.id);
  const hasConfigSection = needsApiKey || hasBaseUrl;

  const handleToggle = useCallback(
    async (checked: boolean) => {
      try {
        await updateProvider(provider.id, { isEnabled: checked });
        toast.success(`${provider.name} ${checked ? 'enabled' : 'disabled'}`);
        onUpdate();
      } catch {
        toast.error(`Failed to update ${provider.name}`);
      }
    },
    [provider.id, provider.name, onUpdate]
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);
      clearTimeout(apiKeyTimerRef.current);
      apiKeyTimerRef.current = setTimeout(async () => {
        try {
          const existingConfig = provider.config
            ? JSON.parse(provider.config)
            : {};
          await updateProvider(provider.id, {
            config: JSON.stringify({ ...existingConfig, apiKey: value }),
          });
          toast.success('API key saved');
          onUpdate();
        } catch {
          toast.error('Failed to save API key');
        }
      }, 500);
    },
    [provider.id, provider.config, onUpdate]
  );

  const handleRateLimitChange = useCallback(
    (value: string) => {
      setRateLimit(value);
      clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(async () => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 1000) return;
        try {
          await updateProvider(provider.id, { rateLimitRpm: num });
          toast.success('Rate limit saved');
          onUpdate();
        } catch {
          toast.error('Failed to save rate limit');
        }
      }, 500);
    },
    [provider.id, onUpdate]
  );

  const handleBaseUrlChange = useCallback(
    (value: string) => {
      setBaseUrl(value);
      clearTimeout(baseUrlTimerRef.current);
      baseUrlTimerRef.current = setTimeout(async () => {
        try {
          await updateProvider(provider.id, {
            baseUrl: value || null,
          });
          toast.success('Base URL saved');
          onUpdate();
        } catch {
          toast.error('Failed to save base URL');
        }
      }, 500);
    },
    [provider.id, onUpdate]
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProvider(provider.id);
      setTestResult(result);
      onUpdate();
    } catch {
      setTestResult({ status: 'down', responseTimeMs: 0, message: 'Test failed' });
    } finally {
      setTesting(false);
    }
  }, [provider.id, onUpdate]);

  const healthDotColor =
    provider.healthStatus === 'healthy'
      ? 'bg-emerald-500'
      : provider.healthStatus === 'down'
        ? 'bg-red-500'
        : provider.healthStatus === 'degraded'
          ? 'bg-amber-500'
          : 'bg-muted-foreground/40';

  return (
    <Card size="sm">
      <CardHeader className="flex-row items-center gap-3">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-md text-xs font-bold shrink-0',
            colorClass
          )}
        >
          {abbrev}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('size-1.5 rounded-full shrink-0', healthDotColor)} />
            <span className="text-sm font-medium truncate">{provider.name}</span>
            <Badge
              variant={statusBadge.variant}
              className={cn('ml-auto shrink-0', statusBadge.className)}
            >
              {statusBadge.label}
            </Badge>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
        <Switch
          checked={provider.isEnabled}
          onCheckedChange={handleToggle}
          size="sm"
        />
      </CardHeader>

      {hasConfigSection && (
        <CardContent className="space-y-3">
          {needsApiKey && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Enter API key..."
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {hasBaseUrl && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Base URL (SearXNG)
              </label>
              <Input
                type="url"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder="http://localhost:8080"
              />
            </div>
          )}
        </CardContent>
      )}

      <CardContent
        className={cn(
          'flex flex-wrap items-center gap-3',
          !hasConfigSection && 'pt-0'
        )}
      >
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-medium text-muted-foreground">
            Rate limit (req/min)
          </label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={rateLimit}
            onChange={(e) => handleRateLimitChange(e.target.value)}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2 self-end">
          {testResult && (
            <span
              className={cn(
                'text-xs',
                testResult.status === 'healthy'
                  ? 'text-status-success-text'
                  : testResult.status === 'down'
                    ? 'text-red-500'
                    : 'text-muted-foreground'
              )}
            >
              {testResult.status === 'healthy'
                ? `OK ${testResult.responseTimeMs}ms`
                : testResult.message ?? 'Failed'}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            <span className="ml-1">Test</span>
          </Button>
        </div>
      </CardContent>

      {provider.lastHealthCheck && (
        <CardContent className="pt-0">
          <p className="text-[11px] text-muted-foreground">
            Last checked: {new Date(provider.lastHealthCheck).toLocaleString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
