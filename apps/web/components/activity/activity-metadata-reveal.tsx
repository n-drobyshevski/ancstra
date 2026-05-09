'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ActivityMetadataRevealProps {
  metadata: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function humaniseKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Optional expand toggle for activity entries that carry structured
 * `metadata`. Renders a `<dl>` of human-readable key/value pairs when open.
 */
export function ActivityMetadataReveal({ metadata }: ActivityMetadataRevealProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('activity.metadata');
  const tLabels = useTranslations('activity.metadataLabels');
  // Filter sentinel keys (e.g. `redacted`) that signal rendering hints to the
  // entry component but shouldn't surface as "Redacted: true" in the reveal.
  const HIDDEN_KEYS = new Set(['redacted']);
  const entries = Object.entries(metadata).filter(([k]) => !HIDDEN_KEYS.has(k));
  if (entries.length === 0) return null;

  type LabelKey = Parameters<typeof tLabels.has>[0];
  // Unknown metadata keys (forward-compat for new logActivity callers) fall
  // back to runtime humanisation rather than throwing on a missing message.
  const labelFor = (key: string): string =>
    tLabels.has(key as LabelKey) ? tLabels(key as LabelKey) : humaniseKey(key);

  return (
    <div className="mt-1.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <ChevronDown
          className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
        {open ? t('hideDetails') : t('showDetails')}
      </Button>
      {open ? (
        <dl className="mt-1.5 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs animate-fade-slide-in">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-muted-foreground">{labelFor(k)}</dt>
              <dd className="break-words font-mono text-[11px] text-foreground/90">
                {formatValue(v)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
