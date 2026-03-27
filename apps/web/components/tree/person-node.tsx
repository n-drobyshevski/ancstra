import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './tree-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PersonNodeType = Node<PersonNodeData, 'person'>;

const sexColors = {
  M: { border: '#4f6bed', bg: '#e8ecf4', text: '#4f6bed' },
  F: { border: '#ec4899', bg: '#fce7f3', text: '#ec4899' },
  U: { border: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
} as const;

const GAP_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'birthDate', label: 'Birth Date' },
  { key: 'birthPlace', label: 'Birth Place' },
  { key: 'deathDate', label: 'Death Date' },
  { key: 'source', label: 'Source' },
] as const;

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--completion-high)';
  if (score >= 40) return 'var(--completion-medium)';
  return 'var(--completion-low)';
}

function PersonNodeComponent({ data, selected }: NodeProps<PersonNodeType>) {
  const dimmed = !!(data as any).dimmed;
  const colors = sexColors[data.sex] ?? sexColors.U;
  const initials = `${data.givenName[0] ?? ''}${data.surname[0] ?? ''}`.toUpperCase();
  const showGaps = !!data.showGaps;
  const missingSet = new Set(data.missingFields ?? []);
  const score = data.qualityScore ?? 0;
  const isLiving = data.isLiving;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[200px] rounded-lg bg-card shadow-sm border transition-all ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        } ${dimmed ? 'opacity-30 pointer-events-none' : ''} ${showGaps ? 'overflow-hidden' : ''}`}
        style={{ borderLeftWidth: 4, borderLeftColor: colors.border }}
      >
        <div className="flex items-center gap-2.5 p-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {data.givenName} {data.surname}
            </div>
            {data.birthDate && (
              <div className="text-[11px] text-muted-foreground">b. {data.birthDate}</div>
            )}
            {data.deathDate && (
              <div className="text-[11px] text-muted-foreground">d. {data.deathDate}</div>
            )}
            {!data.birthDate && !data.deathDate && (
              <div className="text-[11px] text-amber-500/80">no dates</div>
            )}
            {showGaps && (
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-[3px] mt-0.5">
                  {GAP_FIELDS.map(({ key, label }) => {
                    const isNotApplicable = key === 'deathDate' && isLiving;
                    const isMissing = missingSet.has(key);
                    const dotColor = isNotApplicable
                      ? 'var(--border)'
                      : isMissing
                        ? 'var(--completion-low)'
                        : 'var(--completion-high)';
                    const tooltipText = isNotApplicable
                      ? `${label}: N/A (living)`
                      : isMissing
                        ? `${label}: missing`
                        : `${label}: ✓`;
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
        {showGaps && (
          <div className="h-[3px]" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${score}%`,
                backgroundColor: scoreColor(score),
                borderRadius: '0 2px 0 0',
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

export const PersonNode = memo(PersonNodeComponent);
