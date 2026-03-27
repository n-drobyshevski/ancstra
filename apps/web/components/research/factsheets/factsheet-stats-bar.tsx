'use client';

import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';

interface FactsheetStatsBarProps {
  factsheets: FactsheetWithCounts[];
}

export function FactsheetStatsBar({ factsheets }: FactsheetStatsBarProps) {
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
    <div className="grid grid-cols-4 gap-2 border-b border-border px-3 py-3 text-center">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className={`text-lg font-bold ${stat.className}`}>{stat.value}</div>
          <div className="text-[10px] font-medium uppercase text-muted-foreground">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
