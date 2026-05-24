'use client';

import type { InboxItem, InboxItemType, InboxCounts } from '@ancstra/research';

interface InboxListProps {
  locale: string;
  initialItems: InboxItem[];
  initialCounts: InboxCounts;
  initialFilters: {
    type?: InboxItemType | InboxItemType[];
    threadId?: string;
    personId?: string;
  };
}

/**
 * Placeholder list — Bundle B T17 replaces this with the full client-side
 * filter UI + per-type rows. Kept tiny on purpose so T16 ships the route
 * without leaking interaction detail into the server section.
 */
export function InboxList({ initialItems }: InboxListProps) {
  return (
    <div className="space-y-2">
      {initialItems.map((item) => (
        <div key={item.id} className="rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.type}
          </div>
          <div className="font-medium">{item.title}</div>
          {item.subtitle ? (
            <div className="text-sm text-muted-foreground">{item.subtitle}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
