import { memo } from 'react';
import { Handle, Position, useConnection, type Node, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { PersonNodeData } from './tree-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PersonNodeType = Node<PersonNodeData, 'person'>;

const sexColors = {
  M: { border: 'var(--sex-male)', bg: 'var(--sex-male-bg)', text: 'var(--sex-male)' },
  F: { border: 'var(--sex-female)', bg: 'var(--sex-female-bg)', text: 'var(--sex-female)' },
  U: { border: 'var(--sex-unknown)', bg: 'var(--sex-unknown-bg)', text: 'var(--sex-unknown)' },
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

function PersonNodeComponent({ id, data, selected }: NodeProps<PersonNodeType>) {
  const dimmed = !!data.dimmed;
  const colors = sexColors[data.sex] ?? sexColors.U;
  const initials = `${data.givenName[0] ?? ''}${data.surname[0] ?? ''}`.toUpperCase();
  const showGaps = !!data.showGaps;
  const missingSet = new Set(data.missingFields ?? []);
  const score = data.qualityScore ?? 0;
  const isLiving = data.isLiving;
  const isCompact = data.nodeStyle === 'compact';

  // Drag-connection visual hint: when the user is dragging from another node's
  // handle, light up only the handles on this node where a drop will succeed,
  // and dim the rest. Mirrors isValidConnection in tree-canvas.tsx.
  const connection = useConnection();
  const dragInProgress = !!connection.inProgress;
  const isDragSource = dragInProgress && connection.fromNode?.id === id;
  const fromHandleId = connection.fromHandle?.id ?? null;
  const fromHandleType = connection.fromHandle?.type ?? null;

  function targetState(myHandleId: 'top' | 'bottom' | 'right' | 'left'):
    'valid' | 'invalid' | 'neutral' {
    if (!dragInProgress) return 'neutral';
    if (isDragSource) return 'invalid';
    // Spouse drag (right source) → only the left target is valid.
    if (fromHandleId === 'right' && fromHandleType === 'source') {
      return myHandleId === 'left' ? 'valid' : 'invalid';
    }
    // Parent-child drag (bottom source, no id) → only the top target is valid.
    if (fromHandleId === null && fromHandleType === 'source') {
      return myHandleId === 'top' ? 'valid' : 'invalid';
    }
    // Drag started from a target-type handle: no valid drops under current rules.
    return 'invalid';
  }

  function handleClass(myHandleId: 'top' | 'bottom' | 'right' | 'left') {
    const base = '!border !border-background transition-all';
    const state = targetState(myHandleId);
    if (state === 'valid') {
      return cn(base, '!w-3 !h-3 !bg-primary !ring-2 !ring-primary/40 animate-pulse');
    }
    if (state === 'invalid') {
      return cn(base, '!w-2 !h-2 !bg-muted-foreground/20 !opacity-30');
    }
    return cn(base, '!w-2 !h-2 !bg-muted-foreground/40');
  }

  // Shared: lifespan string for compact layout
  const lifespan = (() => {
    if (data.birthDate && data.deathDate) return `${data.birthDate} \u2013 ${data.deathDate}`;
    if (data.birthDate) return `b. ${data.birthDate}`;
    if (data.deathDate) return `d. ${data.deathDate}`;
    return null;
  })();

  // Shared: 4 connection handles
  const handles = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="target" position={Position.Top} className={handleClass('top')} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Parents</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="source" position={Position.Bottom} className={handleClass('bottom')} />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Children</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="source" position={Position.Right} id="right" className={handleClass('right')} />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Spouse</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="target" position={Position.Left} id="left" className={handleClass('left')} />
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">Spouse</TooltipContent>
      </Tooltip>
    </>
  );

  // Shared: quality gap dots helper
  function gapDots(dotSize: string) {
    return (
      <div className="flex justify-center mt-0.5 -mx-1">
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
                <span className="inline-flex items-center justify-center p-1 cursor-default">
                  <span
                    className={`block ${dotSize} rounded-full`}
                    style={{ backgroundColor: dotColor }}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // Shared: quality bar
  const qualityBar = (
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
  );

  // Shared: card base classes
  const cardBase = `rounded-lg bg-card shadow-sm border transition-all${
    selected ? ' ring-2 ring-primary shadow-md' : ''
  }${dimmed ? ' opacity-30 pointer-events-none' : ''}${showGaps ? ' overflow-hidden' : ''}`;

  return (
    <TooltipProvider delayDuration={300}>
      {handles}
      {isCompact ? (
        <div className={`w-[120px] ${cardBase}`}>
          <div className="flex flex-col items-center gap-1 p-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {initials}
            </div>
            <div className="w-full text-center leading-tight">
              <div className="truncate text-[11px] font-semibold text-foreground">{data.givenName}</div>
              <div className="truncate text-[9px] text-muted-foreground">{data.surname}</div>
            </div>
            {lifespan ? (
              <div className="text-[9px] text-muted-foreground">{lifespan}</div>
            ) : (
              <div className="text-[9px] text-muted-foreground italic">no dates</div>
            )}
            {showGaps && gapDots('size-1')}
          </div>
          {showGaps && qualityBar}
        </div>
      ) : (
        <div className={`w-[240px] ${cardBase}`}>
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
                <div className="text-[11px] text-muted-foreground italic">no dates</div>
              )}
              {showGaps && gapDots('size-1.5')}
            </div>
          </div>
          {showGaps && qualityBar}
        </div>
      )}
    </TooltipProvider>
  );
}

export const PersonNode = memo(PersonNodeComponent);
