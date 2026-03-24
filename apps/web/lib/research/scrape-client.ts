'use client';

import { useState, useCallback, useRef } from 'react';

type ScrapeStatus = 'idle' | 'scraping' | 'done' | 'error';

interface ScrapeResponse {
  // Worker path
  jobId?: string;
  // Fallback/common fields
  itemId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fullText?: string | null;
  error?: string;
}

interface ScrapeOptions {
  itemId?: string;
  extractEntities?: boolean;
  personId?: string;
}

interface UseScrapeUrlReturn {
  scrape: (url: string, opts?: ScrapeOptions) => Promise<ScrapeResponse | null>;
  status: ScrapeStatus;
  result: ScrapeResponse | null;
  error: Error | null;
  isLoading: boolean;
}

export function useScrapeUrl(): UseScrapeUrlReturn {
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrape = useCallback(async (url: string, opts?: ScrapeOptions): Promise<ScrapeResponse | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('scraping');
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/research/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          itemId: opts?.itemId,
          extractEntities: opts?.extractEntities,
          personId: opts?.personId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Scrape failed (${res.status})` }));
        throw new Error(body.error ?? `Scrape failed (${res.status})`);
      }

      const data: ScrapeResponse = await res.json();
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      const e = err instanceof Error ? err : new Error('Scrape failed');
      setError(e);
      setStatus('error');
      return null;
    }
  }, []);

  return { scrape, status, result, error, isLoading: status === 'scraping' };
}
