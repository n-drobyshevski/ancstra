'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceListItem } from './source-list-item';

interface ResearchItem {
  id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  status: string;
  providerId: string | null;
  notes: string | null;
  createdAt: string;
  personIds: string[];
}

interface FactEntry {
  id: string;
  researchItemId: string | null;
}

interface SourceListPanelProps {
  items: ResearchItem[];
  facts: FactEntry[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}

type StatusGroup = 'promoted' | 'draft' | 'dismissed';

const GROUP_ORDER: StatusGroup[] = ['promoted', 'draft', 'dismissed'];

const GROUP_LABELS: Record<StatusGroup, string> = {
  promoted: 'Sources',
  draft: 'Drafts',
  dismissed: 'Dismissed',
};

function groupItems(items: ResearchItem[]): Record<StatusGroup, ResearchItem[]> {
  const groups: Record<StatusGroup, ResearchItem[]> = {
    promoted: [],
    draft: [],
    dismissed: [],
  };
  for (const item of items) {
    const key = (item.status as StatusGroup) in groups ? (item.status as StatusGroup) : 'draft';
    groups[key].push(item);
  }
  return groups;
}

function countFacts(facts: FactEntry[], itemId: string): number {
  return facts.filter((f) => f.researchItemId === itemId).length;
}

export function SourceListPanel({
  items,
  facts,
  selectedItemId,
  onSelectItem,
}: SourceListPanelProps) {
  const [dismissedOpen, setDismissedOpen] = useState(false);
  const groups = groupItems(items);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <Inbox className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          No research items yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Search for sources to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2 space-y-4">
      {GROUP_ORDER.map((group) => {
        const groupItems = groups[group];
        if (groupItems.length === 0) return null;

        const isDismissed = group === 'dismissed';
        const isOpen = isDismissed ? dismissedOpen : true;

        return (
          <div key={group}>
            {/* Section header */}
            <button
              type="button"
              onClick={isDismissed ? () => setDismissedOpen(!dismissedOpen) : undefined}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full',
                isDismissed && 'cursor-pointer hover:text-foreground transition-colors',
              )}
            >
              {isDismissed && (
                isOpen
                  ? <ChevronDown className="size-3" />
                  : <ChevronRight className="size-3" />
              )}
              {GROUP_LABELS[group]}
              <span className="text-[10px] font-normal ml-auto">
                {groupItems.length}
              </span>
            </button>

            {/* Items */}
            {isOpen && (
              <div className="space-y-1 mt-1">
                {groupItems.map((item) => (
                  <SourceListItem
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    snippet={item.snippet}
                    status={item.status}
                    providerId={item.providerId}
                    factCount={countFacts(facts, item.id)}
                    isSelected={selectedItemId === item.id}
                    onClick={() => onSelectItem(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
