'use client';
import type { Confidence } from '@ancstra/db/vocab';
import { CONFIDENCE_BAND_META } from '@ancstra/db/vocab';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { useTranslations } from 'next-intl';

/**
 * Bundle C 2026-05-24 — Confidence chip with inline rubric hover-card.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §3
 */

export interface ConfidenceChipProps {
  band: Confidence;
  /** Optional override label (default: lowercase band name) */
  label?: string;
  /** Render without hover-card wrapper (for canvas-overlapped contexts) */
  inert?: boolean;
}

const BAND_COLORS: Record<Confidence, string> = {
  high:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium:  'bg-amber-100 text-amber-800 border-amber-200',
  low:     'bg-orange-100 text-orange-800 border-orange-200',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200',
};

// Typed sub-namespace accessor — each Confidence band has its own sub-namespace
// so we avoid the "too-complex-union" error that comes from dynamic key lookup.
// The `as` casts are needed because TS can't narrow a computed namespace string
// to a literal; the runtime value is always correct (Confidence is exhaustive).
type BandTranslations = {
  meaning: string;
  typical: string;
  formula: string;
};

function useBandTranslations(band: Confidence): BandTranslations {
  const tHigh    = useTranslations('rubric.high');
  const tMedium  = useTranslations('rubric.medium');
  const tLow     = useTranslations('rubric.low');
  const tUnknown = useTranslations('rubric.unknown');
  const map = { high: tHigh, medium: tMedium, low: tLow, unknown: tUnknown } as const;
  const t = map[band];
  return {
    meaning: t('meaning'),
    typical: t('typical'),
    formula: t('formula'),
  };
}

export function ConfidenceChip({ band, label, inert }: ConfidenceChipProps) {
  const rubric = useBandTranslations(band);
  const labels = useTranslations('rubric.labels');
  const displayLabel = label ?? band;

  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${BAND_COLORS[band]}`}
      aria-label={`Confidence: ${band}`}
    >
      {displayLabel}
    </span>
  );

  if (inert) return pill;

  return (
    <HoverCard openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>{pill}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-3" side="top">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BAND_COLORS[band]}`}>
            {band}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {CONFIDENCE_BAND_META[band].scoreLabel}
          </span>
        </div>
        <p className="text-xs text-slate-900 leading-relaxed mb-2">
          <strong>{labels('meaning')}</strong> {rubric.meaning}
        </p>
        <p className="text-[11px] text-slate-600 leading-snug mb-2">
          <strong>{labels('typical')}</strong> {rubric.typical}
        </p>
        <hr className="border-slate-100 my-2" />
        <p className="text-[10px] text-slate-500 leading-snug">
          <strong>{labels('formula')}</strong> {rubric.formula}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
