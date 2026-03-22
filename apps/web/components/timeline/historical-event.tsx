'use client';

import { Globe } from 'lucide-react';

interface HistoricalEventProps {
  year: number;
  title: string;
  description: string;
  relevance: string;
}

export function HistoricalEvent({
  year,
  title,
  description,
  relevance,
}: HistoricalEventProps) {
  return (
    <div className="flex items-start gap-3 py-2 pl-4 border-l-2 border-dashed border-muted-foreground/30">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Globe className="h-3 w-3 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{year}</span> —{' '}
          <span className="font-medium">{title}</span>
        </p>
        <p className="text-xs text-muted-foreground/80">{description}</p>
        <p className="text-xs italic text-muted-foreground/60">{relevance}</p>
      </div>
    </div>
  );
}
