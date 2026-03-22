'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SearchProvider {
  id: string;
  name: string;
  providerType: 'api' | 'scraper' | 'web_search';
  baseUrl: string | null;
  isEnabled: boolean;
  config: string | null;
  rateLimitRpm: number;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastHealthCheck: string | null;
  createdAt: string;
}

export interface TestResult {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTimeMs: number;
  message?: string;
}

export function useProviders() {
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/settings/providers');
      if (!res.ok) throw new Error('Failed to fetch providers');
      const data = await res.json();
      setProviders(data.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return { providers, isLoading, error, mutate: fetchProviders };
}

export async function updateProvider(
  id: string,
  data: Partial<Pick<SearchProvider, 'isEnabled' | 'config' | 'rateLimitRpm' | 'baseUrl'>>
): Promise<SearchProvider> {
  const res = await fetch(`/api/settings/providers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update provider');
  }

  return res.json();
}

export async function testProvider(id: string): Promise<TestResult> {
  const res = await fetch(`/api/settings/providers/${id}/test`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('Failed to test provider');
  }

  return res.json();
}
