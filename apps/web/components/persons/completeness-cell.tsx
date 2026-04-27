'use client';

import { Check, X } from 'lucide-react';
import type { PersonListItem } from '@ancstra/shared';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getCompletenessBreakdown } from '@/lib/persons/completeness';

interface CompletenessCellProps {
  person: PersonListItem;
}

export function CompletenessCell({ person }: CompletenessCellProps) {
  const { items, total } = getCompletenessBreakdown(person);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="group"
          aria-label={`Completeness ${total}%`}
          className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Progress
            value={total}
            aria-label={`Completeness ${total}%`}
            className="h-2 w-20"
          />
          <span
            aria-hidden="true"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {total}%
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <div className="flex min-w-[180px] flex-col gap-1.5">
          <div className="font-medium">Completeness {total}%</div>
          <div className="border-t border-current/20" />
          <ul className="flex flex-col gap-0.5">
            {items.map((it) => (
              <li
                key={it.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-1.5">
                  {it.hit ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <X className="size-3 opacity-60" aria-hidden />
                  )}
                  {it.label}
                </span>
                <span className="tabular-nums">
                  {it.hit ? it.weight : `0/${it.weight}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
