'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FactsheetStatsBarProps {
  factsheets: FactsheetWithCounts[];
}

export function FactsheetStatsBar({ factsheets }: FactsheetStatsBarProps) {
  const [expanded, setExpanded] = useState(false);

  const total = factsheets.length;
  const draft = factsheets.filter((fs) => fs.status === 'draft').length;
  const ready = factsheets.filter((fs) => fs.status === 'ready').length;
  const conflicts = factsheets.reduce((sum, fs) => sum + fs.conflictCount, 0);

  const stats = [
    { label: 'Total', value: total, className: 'text-foreground' },
    { label: 'Draft', value: draft, className: 'text-amber-500' },
    { label: 'Ready', value: ready, className: 'text-green-600' },
    { label: 'Conflicts', value: conflicts, className: 'text-red-500' },
  ] as const;

  return (
    <div className="border-b border-border px-3 py-2">
      {/* Condensed row — mobile only */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between md:hidden"
      >
        <span className="text-xs text-muted-foreground">
          {total} factsheets · {draft} draft
          {conflicts > 0 && <span className="text-red-500"> · {conflicts} conflicts</span>}
        </span>
        {expanded ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Full grid — always on desktop, conditionally on mobile */}
      <div
        className={`grid grid-cols-4 gap-2 text-center ${
          expanded ? 'grid mt-2' : 'hidden'
        } md:grid md:mt-0`}
      >
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className={`text-lg font-bold ${stat.className}`}>{stat.value}</div>
            <div className="text-[10px] font-medium uppercase text-muted-foreground">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
