'use client';

import { useState, useEffect, useRef } from 'react';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';

interface ScrapeJobState {
  status: JobStatus;
  error: string | null;
  itemId: string | null;
}

interface UseScrapeJobOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onCompleted?: (itemId: string) => void;
  onFailed?: (error: string) => void;
  onTimeout?: () => void;
}

export function useScrapeJob(
  jobId: string | null,
  options: UseScrapeJobOptions = {}
): ScrapeJobState {
  const {
    intervalMs = 3_000,
    timeoutMs = 90_000,
    onCompleted,
    onFailed,
    onTimeout,
  } = options;

  const [state, setState] = useState<ScrapeJobState>({
    status: 'pending',
    error: null,
    itemId: null,
  });

  const callbacksRef = useRef({ onCompleted, onFailed, onTimeout });
  callbacksRef.current = { onCompleted, onFailed, onTimeout };

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    const startTime = Date.now();

    const poll = async () => {
      if (!active) return;

      if (Date.now() - startTime > timeoutMs) {
        setState((prev) => ({ ...prev, status: 'timeout' }));
        callbacksRef.current.onTimeout?.();
        return;
      }

      try {
        const res = await fetch(`/api/research/scrape-jobs/${jobId}`);
        if (!res.ok || !active) return;
        const data = await res.json();

        setState({
          status: data.status,
          error: data.error,
          itemId: data.itemId,
        });

        if (data.status === 'completed') {
          callbacksRef.current.onCompleted?.(data.itemId);
          return;
        }

        if (data.status === 'failed') {
          callbacksRef.current.onFailed?.(data.error ?? 'Unknown error');
          return;
        }

        setTimeout(poll, intervalMs);
      } catch {
        if (active) setTimeout(poll, intervalMs);
      }
    };

    const timer = setTimeout(poll, 1_000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, intervalMs, timeoutMs]);

  return state;
}
