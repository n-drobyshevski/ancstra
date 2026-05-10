import { memo, type CSSProperties } from 'react';
import { Handle, Position, useConnection, type Node, type NodeProps } from '@xyflow/react';
import { Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { personDetailCache } from '@/lib/tree/person-detail-cache';
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

const GAP_FIELD_KEYS = ['name', 'birthDate', 'birthPlace', 'deathDate', 'source'] as const;
type GapFieldKey = (typeof GAP_FIELD_KEYS)[number];

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--completion-high)';
  if (score >= 40) return 'var(--completion-medium)';
  return 'var(--completion-low)';
}

function PersonNodeComponent({ id, data, selected }: NodeProps<PersonNodeType>) {
  const tNode = useTranslations('tree.node');
  const tHandles = useTranslations('tree.node.handles');
  const tFields = useTranslations('tree.node.fields');
  // Surname highlight axis composes with the existing dim path used by
  // sex/living filter mismatches:
  //   - 'nonmatch'      → opacity 0.3, click-blocked (overlay/replace modes)
  //   - 'fadeNonmatch'  → grayscale + opacity 0.5, clicks preserved (fadeOut)
  //   - 'match'         → accent ring drawn below via tonedCardStyle
  const surnameHighlight = data.surnameHighlight;
  const dimmed = !!data.dimmed || surnameHighlight === 'nonmatch';
  const fadedOut = surnameHighlight === 'fadeNonmatch';
  // Active-thread overlay (research threads). Independent of surname
  // highlighting; both can stack. See tree-utils.ts:PersonNodeData for the
  // shape contract.
  const threadOverlay = data.threadOverlay;
  const colors = sexColors[data.sex] ?? sexColors.U;
  const initials = `${data.givenName[0] ?? ''}${data.surname[0] ?? ''}`.toUpperCase();
  const showGaps = !!data.showGaps;
  const missingSet = new Set(data.missingFields ?? []);
  const score = data.qualityScore ?? 0;
  const isLiving = data.isLiving;
  const isCompact = data.nodeStyle === 'compact';
  const showDates = data.showDates ?? true;
  const showLivingIndicator = data.showLivingIndicator ?? true;
  const showCitations = !!data.showCitations;
  const sourcesCount = data.sourcesCount ?? 0;
  const renderCitationBadge = showCitations && sourcesCount > 0;

  // Apply the active coloring tone. 'fill' overrides the card background;
  // 'border' tints the existing 1px border slot in place (no layout shift,
  // no conflict with Tailwind's ring-2 selection state which lives in
  // box-shadow). Vivid border tokens (L≈0.6 light / 0.7 dark) keep the
  // 1px stroke readable against the card surface.
  const baseTonedStyle: CSSProperties | undefined = data.coloringTone
    ? data.coloringStyle === 'border'
      ? { borderColor: data.coloringTone.border }
      : { backgroundColor: data.coloringTone.bg }
    : undefined;
  // Surname-match accent ring. Stacked into box-shadow so it composes with
  // both the 1px border tone (no layout shift) and the selection ring (which
  // lives at ring-2 ring-primary via Tailwind utilities — that ring keeps
  // priority because it's applied as a class, on top of inline styles).
  const tonedCardStyle: CSSProperties | undefined =
    surnameHighlight === 'match'
      ? {
          ...baseTonedStyle,
          boxShadow: '0 0 0 2px var(--tree-coloring-surname-border)',
        }
      : baseTonedStyle;

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
    if (data.birthDate) return tNode('birthPrefix', { date: data.birthDate });
    if (data.deathDate) return tNode('deathPrefix', { date: data.deathDate });
    return null;
  })();

  // Shared: 4 connection handles
  const handles = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="target" position={Position.Top} className={handleClass('top')} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{tHandles('parents')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="source" position={Position.Bottom} className={handleClass('bottom')} />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tHandles('children')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="source" position={Position.Right} id="right" className={handleClass('right')} />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{tHandles('spouse')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="target" position={Position.Left} id="left" className={handleClass('left')} />
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">{tHandles('spouse')}</TooltipContent>
      </Tooltip>
    </>
  );

  // Shared: quality gap dots helper
  function gapDots(dotSize: string) {
    return (
      <div className="flex justify-center mt-0.5 -mx-1">
        {GAP_FIELD_KEYS.map((key: GapFieldKey) => {
          const isNotApplicable = key === 'deathDate' && isLiving;
          const isMissing = missingSet.has(key);
          const dotColor = isNotApplicable
            ? 'var(--border)'
            : isMissing
              ? 'var(--completion-low)'
              : 'var(--completion-high)';
          const label = tFields(key);
          const tooltipText = isNotApplicable
            ? tNode('tooltipNotApplicable', { label })
            : isMissing
              ? tNode('tooltipMissing', { label })
              : tNode('tooltipPresent', { label });
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
  // - dimmed (filter mismatch / overlay+replace surname non-match): hard fade
  //   to opacity 0.3 + block clicks.
  // - fadedOut (fadeOut mode surname non-match): grayscale + soft opacity 0.5
  //   with clicks preserved so the user can still click through to inspect.
  // - threadOverlay='dimmed': active research thread is set but didn't touch
  //   this person — soft opacity 0.4, clicks preserved (deliberately weaker
  //   than dimmed so the canvas stays scannable).
  // - threadOverlay='highlighted': active thread touched this person — amber
  //   ring so they read at a glance.
  const cardBase = `relative rounded-lg bg-card shadow-sm border transition-all${
    selected ? ' ring-2 ring-primary shadow-md' : ''
  }${dimmed ? ' opacity-30 pointer-events-none' : ''}${
    fadedOut ? ' opacity-50 grayscale' : ''
  }${threadOverlay === 'dimmed' ? ' opacity-40' : ''}${
    threadOverlay === 'highlighted' ? ' ring-2 ring-amber-400/70' : ''
  }${showGaps ? ' overflow-hidden' : ''}`;

  // Shared: citation indicator badge (top-right corner, inside card bounds so
  // it survives `overflow-hidden` when the quality bar is on).
  const sourcesLabel = tNode('sources', { count: sourcesCount });
  const citationBadge = renderCitationBadge ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={sourcesLabel}
          className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-background px-1 py-0.5 ring-1 ring-border shadow-sm"
        >
          <Quote className="size-2.5 text-muted-foreground" aria-hidden />
          {sourcesCount > 1 && (
            <span className="text-[9px] font-medium tabular-nums text-muted-foreground leading-none">
              {sourcesCount}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {sourcesLabel}
      </TooltipContent>
    </Tooltip>
  ) : null;

  const prefetchHandlers = {
    onPointerEnter: () => { void personDetailCache.prefetch(id); },
    onPointerDown:  () => { void personDetailCache.prefetch(id); },
    onFocus:        () => { void personDetailCache.prefetch(id); },
  };

  return (
    <TooltipProvider delayDuration={300}>
      {handles}
      {isCompact ? (
        <div
          className={`w-[120px] ${cardBase}`}
          style={tonedCardStyle}
          tabIndex={-1}
          {...prefetchHandlers}
        >
          {citationBadge}
          <div className="flex flex-col items-center gap-1 p-2">
            <div className="relative shrink-0">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {initials}
              </div>
              {showLivingIndicator && isLiving && (
                <span
                  role="img"
                  aria-label={tNode('living')}
                  className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-completion-high ring-1 ring-background"
                />
              )}
            </div>
            <div className="w-full text-center leading-tight">
              <div className="truncate text-[11px] font-semibold text-foreground">{data.givenName}</div>
              <div className="truncate text-[9px] text-muted-foreground">{data.surname}</div>
            </div>
            {showDates && (lifespan ? (
              <div className="text-[9px] text-muted-foreground">{lifespan}</div>
            ) : (
              <div className="text-[9px] text-muted-foreground italic">{tNode('noDates')}</div>
            ))}
            {showGaps && gapDots('size-1')}
          </div>
          {showGaps && qualityBar}
        </div>
      ) : (
        <div
          className={`w-[240px] ${cardBase}`}
          style={tonedCardStyle}
          tabIndex={-1}
          {...prefetchHandlers}
        >
          {citationBadge}
          <div className="flex items-center gap-2.5 p-2.5">
            <div className="relative shrink-0">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {initials}
              </div>
              {showLivingIndicator && isLiving && (
                <span
                  role="img"
                  aria-label={tNode('living')}
                  className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-completion-high ring-1 ring-background"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">
                {data.givenName} {data.surname}
              </div>
              {showDates && data.birthDate && (
                <div className="text-[11px] text-muted-foreground">{tNode('birthPrefix', { date: data.birthDate })}</div>
              )}
              {showDates && data.deathDate && (
                <div className="text-[11px] text-muted-foreground">{tNode('deathPrefix', { date: data.deathDate })}</div>
              )}
              {showDates && !data.birthDate && !data.deathDate && (
                <div className="text-[11px] text-muted-foreground italic">{tNode('noDates')}</div>
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
