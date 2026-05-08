'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  count: number;
  /** Subset of names to render in the tooltip body — typically capped server-side at ~10. */
  names: string[];
  /** Header line above the list, e.g. "Active members" or "Owned families". */
  hint: string;
  /** Singular noun for screen-reader fallback, e.g. "active members". */
  ariaNoun: string;
}

/**
 * Number cell for admin tables that reveals up to {@link Props.names} names on
 * hover/focus. Touch users get the count + screen-reader label; keyboard users
 * tab to the trigger and Radix opens the tooltip on focus. When `count` exceeds
 * `names.length` we surface "and N more" rather than silently truncating.
 *
 * Relies on a {@link TooltipProvider} mounted higher in the tree (admin layout).
 */
export function CountWithNamesTooltip({ count, names, hint, ariaNoun }: Props) {
  if (count === 0) {
    return (
      <span className="text-muted-foreground tabular-nums" aria-label={`0 ${ariaNoun}`}>
        0
      </span>
    );
  }

  const overflow = count - names.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${count} ${ariaNoun}`}
          className="cursor-help rounded-sm tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {count}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
            {hint}
          </p>
          <ul className="space-y-0.5">
            {names.map((n, i) => (
              <li key={`${i}-${n}`} className="truncate">
                {n}
              </li>
            ))}
            {overflow > 0 ? (
              <li className="italic opacity-70">and {overflow} more</li>
            ) : null}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
