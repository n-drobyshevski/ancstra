'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Server, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WorkerHealth {
  status: 'healthy' | 'down' | 'unknown';
  uptime?: string;
  url?: string;
}

export function WorkerStatus() {
  const [health, setHealth] = useState<WorkerHealth>({ status: 'unknown' });
  const [testing, setTesting] = useState(false);

  const checkHealth = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/research/providers/health');
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      const workerStatus = data.statuses?.['_worker'] ?? 'unknown';
      setHealth({
        status: workerStatus === 'healthy' ? 'healthy' : workerStatus === 'down' ? 'down' : 'unknown',
      });
    } catch {
      setHealth({ status: 'unknown' });
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const borderColor =
    health.status === 'healthy'
      ? 'border-emerald-500/30'
      : health.status === 'down'
        ? 'border-red-500/30'
        : 'border-border';

  const dotColor =
    health.status === 'healthy'
      ? 'bg-emerald-500'
      : health.status === 'down'
        ? 'bg-red-500'
        : 'bg-muted-foreground/40';

  const statusLabel =
    health.status === 'healthy'
      ? 'Connected'
      : health.status === 'down'
        ? 'Unreachable'
        : 'Not configured';

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-4',
        borderColor
      )}
    >
      <div className="flex items-center gap-3">
        <Server className="size-5 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', dotColor)} />
            <span className="text-sm font-medium">Background Worker</span>
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
          {health.status === 'unknown' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Set WORKER_URL in your environment to enable scraper-based providers.
            </p>
          )}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={checkHealth}
        disabled={testing}
      >
        {testing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ExternalLink className="size-3.5" />
        )}
        <span className="ml-1.5">Test</span>
      </Button>
    </div>
  );
}
