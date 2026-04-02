'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const SCRAPE_TIMEOUT_MS = 30_000;

type ScrapeStatus = 'idle' | 'scraping' | 'done' | 'error' | 'timeout';

interface ScrapeResponse {
  // Worker path
  jobId?: string;
  // Fallback/common fields
  itemId?: string;
  title?: string;
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
  elapsed: number;
  reset: () => void;
}

export function useScrapeUrl(): UseScrapeUrlReturn {
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Elapsed-second counter that ticks while scraping
  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setStatus('idle');
    setResult(null);
    setError(null);
    setElapsed(0);
  }, [stopTimer]);

  const scrape = useCallback(async (url: string, opts?: ScrapeOptions): Promise<ScrapeResponse | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('scraping');
    setError(null);
    setResult(null);
    startTimer();

    // Auto-abort after timeout
    timeoutRef.current = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

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
      stopTimer();
      setResult(data);
      setStatus('done');
      return data;
    } catch (err) {
      stopTimer();
      if (err instanceof Error && err.name === 'AbortError') {
        // Distinguish user-cancel from timeout
        setStatus('timeout');
        setError(new Error('Scraping took too long. The page may be slow or unreachable.'));
        return null;
      }
      const e = err instanceof Error ? err : new Error('Scrape failed');
      setError(e);
      setStatus('error');
      return null;
    }
  }, [startTimer, stopTimer]);

  return { scrape, status, result, error, isLoading: status === 'scraping', elapsed, reset };
}
