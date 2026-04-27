'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FacetBlockProps {
  label: string;
  defaultOpen?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

export function FacetBlock({
  label, defaultOpen = false, active = false, children,
}: FacetBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          {label}
          {active && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
              aria-label="filter active"
            />
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div id={contentId} className="px-3 pb-3 pt-1 space-y-2">
          {children}
        </div>
      )}
    </section>
  );
}
