'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FACT_TYPE_LABELS, FACT_TYPES } from './types';
import type { DraftFact, FactType } from './types';

const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

interface FactCardProps {
  fact: DraftFact;
  onRemove: () => void;
  onUpdate: (updates: Partial<Pick<DraftFact, 'factType' | 'factValue' | 'confidence'>>) => void;
  accentColor?: string;
}

export function FactCard({ fact, onRemove, onUpdate, accentColor = 'rgb(168 85 247)' }: FactCardProps) {
  const [editing, setEditing] = useState(false);
  const isNew = Date.now() - fact.addedAt < 2000;

  return (
    <div
      className={cn(
        'rounded-md border bg-background/50 p-2 transition-all',
        isNew && 'ring-1 ring-primary/40',
        editing && 'ring-1 ring-primary',
      )}
      style={{ borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)` }}
      onClick={() => !editing && setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(!editing); }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {FACT_TYPE_LABELS[fact.factType]}
        </span>
        <button
          className="text-muted-foreground/40 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove fact"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Value */}
      {editing ? (
        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Type selector */}
          <div className="relative">
            <select
              value={fact.factType}
              onChange={(e) => onUpdate({ factType: e.target.value as FactType })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {FACT_TYPES.map((t) => (
                <option key={t} value={t}>{FACT_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1.5 size-3 text-muted-foreground" />
          </div>

          {/* Value editor */}
          <input
            type="text"
            value={fact.factValue}
            onChange={(e) => onUpdate({ factValue: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          />

          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Confidence:</span>
            <div className="flex gap-0.5">
              {CONFIDENCE_LEVELS.map((level, i) => (
                <button
                  key={level}
                  className={cn(
                    'h-1.5 w-4 rounded-full transition-colors',
                    i <= CONFIDENCE_LEVELS.indexOf(fact.confidence)
                      ? 'opacity-100'
                      : 'opacity-30',
                  )}
                  style={{
                    backgroundColor: i <= CONFIDENCE_LEVELS.indexOf(fact.confidence)
                      ? accentColor
                      : undefined,
                  }}
                  onClick={() => onUpdate({ confidence: level })}
                  aria-label={`Set confidence to ${level}`}
                  title={level}
                />
              ))}
            </div>
            <span className="text-[10px] capitalize text-muted-foreground">{fact.confidence}</span>
          </div>

          <button
            className="w-full rounded bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20"
            onClick={() => setEditing(false)}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="mt-1 text-xs text-foreground">{fact.factValue}</div>
          {isNew && (
            <div className="mt-1 text-[10px] italic text-muted-foreground">just added</div>
          )}
        </>
      )}
    </div>
  );
}
