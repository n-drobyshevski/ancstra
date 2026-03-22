'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UsageData {
  spent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  overBudget: boolean;
  totalRequests: number;
  byModel: Record<string, { requests: number; cost: number }>;
}

export function CostBadge() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/ai/usage');
        if (res.ok) {
          setUsage(await res.json());
        }
      } catch {
        // Silently fail — badge is informational
      }
    }
    fetchUsage();

    // Refresh every 60 seconds
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!usage) return null;

  const variant =
    usage.percentUsed > 80
      ? 'destructive'
      : usage.percentUsed > 50
        ? 'outline'
        : 'secondary';

  const colorClass =
    usage.percentUsed > 80
      ? 'text-destructive'
      : usage.percentUsed > 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className={cn('cursor-default text-[10px]', colorClass)}>
            ${usage.spent.toFixed(2)} / ${usage.limit.toFixed(2)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-medium">AI Usage This Month</p>
            <p>{usage.totalRequests} requests</p>
            {Object.entries(usage.byModel).map(([model, data]) => (
              <p key={model}>
                {model}: {data.requests} req, ${data.cost.toFixed(4)}
              </p>
            ))}
            {usage.overBudget && (
              <p className="font-medium text-destructive">Budget exceeded</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
