'use client';

import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type TopologyMode = 'all' | 'ancestors' | 'descendants';

interface TopologyToggleProps {
  mode: TopologyMode;
  onModeChange: (mode: TopologyMode) => void;
  referenceName: string | null;
}

export function TopologyToggle({ mode, onModeChange, referenceName }: TopologyToggleProps) {
  const disabled = !referenceName;
  const disabledHint = 'Select a person in the tree first to filter by their ancestors or descendants';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <Network className="size-3.5 text-muted-foreground" aria-hidden />
        <Button
          variant={mode === 'all' ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onModeChange('all')}
        >
          All
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={disabled ? 0 : -1}>
              <Button
                variant={mode === 'ancestors' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={() => onModeChange('ancestors')}
              >
                Ancestors
              </Button>
            </span>
          </TooltipTrigger>
          {disabled && <TooltipContent>{disabledHint}</TooltipContent>}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={disabled ? 0 : -1}>
              <Button
                variant={mode === 'descendants' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                disabled={disabled}
                onClick={() => onModeChange('descendants')}
              >
                Descendants
              </Button>
            </span>
          </TooltipTrigger>
          {disabled && <TooltipContent>{disabledHint}</TooltipContent>}
        </Tooltip>
        {mode !== 'all' && referenceName && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">
              of {referenceName}
            </span>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
