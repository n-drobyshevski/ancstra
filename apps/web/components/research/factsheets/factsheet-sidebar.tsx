'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';
import { batchDismiss, batchLink } from '@/lib/research/factsheet-client';
import { FactsheetStatsBar } from './factsheet-stats-bar';
import { FactsheetCard } from './factsheet-card';
import { BatchActionsBar } from './batch-actions-bar';

type StatusFilter = 'all' | 'draft' | 'ready' | 'promoted' | 'unanchored';

const STATUS_ORDER: Record<string, number> = {
  draft: 0,
  ready: 1,
  promoted: 2,
  merged: 3,
  dismissed: 4,
};

interface FactsheetSidebarProps {
  factsheets: FactsheetWithCounts[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDataChanged: () => void;
  onCreate: () => void;
}

export function FactsheetSidebar({
  factsheets,
  selectedId,
  onSelect,
  onDataChanged,
  onCreate,
}: FactsheetSidebarProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const filtered = useMemo(() => {
    let items = factsheets;

    if (filter === 'unanchored') {
      items = items.filter((fs) => fs.isUnanchored);
    } else if (filter !== 'all') {
      items = items.filter((fs) => fs.status === filter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((fs) => fs.title.toLowerCase().includes(q));
    }

    return [...items].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    );
  }, [factsheets, filter, search]);

  const isAllSelected =
    filtered.length > 0 && filtered.every((fs) => selected.has(fs.id));

  function handleSelectAll() {
    if (isAllSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((fs) => fs.id)));
    }
  }

  function handleCheckChange(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const handleBatchDismiss = useCallback(async () => {
    if (selected.size === 0) return;
    try {
      await batchDismiss([...selected]);
      toast.success(`Dismissed ${selected.size} factsheets`);
      setSelected(new Set());
      setBatchMode(false);
      onDataChanged();
    } catch {
      toast.error('Failed to batch dismiss');
    }
  }, [selected, onDataChanged]);

  const handleBatchLink = useCallback(async () => {
    if (selected.size < 2) return;
    try {
      await batchLink([...selected], 'parent_child');
      toast.success(`Linked ${selected.size} factsheets`);
      setSelected(new Set());
      setBatchMode(false);
      onDataChanged();
    } catch {
      toast.error('Failed to batch link');
    }
  }, [selected, onDataChanged]);

  const handleLongPress = useCallback((id: string) => {
    setBatchMode(true);
    setSelected(new Set([id]));
  }, []);

  const filterOptions: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Ready', value: 'ready' },
    { label: 'Promoted', value: 'promoted' },
    { label: 'Unanchored', value: 'unanchored' },
  ];

  return (
    <div className="flex flex-col overflow-hidden md:border-r border-border">
      {/* Stats bar */}
      <FactsheetStatsBar factsheets={factsheets} />

      {/* Search + filter pills */}
      <div className="space-y-2 border-b border-border px-3 py-2">
        <Input
          placeholder="Search factsheets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Factsheets ({filtered.length})
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-xs',
              batchMode && 'bg-accent text-accent-foreground'
            )}
            onClick={() => {
              setBatchMode((v) => !v);
              if (batchMode) setSelected(new Set());
            }}
          >
            {batchMode ? 'Done' : 'Select'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onCreate}
          >
            + New
          </Button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {search || filter !== 'all' ? 'No matching factsheets.' : 'No factsheets yet.'}
          </p>
        ) : (
          filtered.map((fs) => (
            <FactsheetCard
              key={fs.id}
              factsheet={fs}
              isSelected={fs.id === selectedId}
              factCount={fs.factCount}
              linkCount={fs.linkCount}
              conflictCount={fs.conflictCount}
              onClick={() => {
                if (batchMode) {
                  handleCheckChange(fs.id, !selected.has(fs.id));
                } else {
                  onSelect(fs.id);
                }
              }}
              onLongPress={() => handleLongPress(fs.id)}
              isUnanchored={fs.isUnanchored}
              isSelectable={batchMode}
              isChecked={selected.has(fs.id)}
              onCheckChange={(checked) => handleCheckChange(fs.id, checked)}
            />
          ))
        )}
      </div>

      {/* Batch actions bar */}
      {batchMode && (
        <BatchActionsBar
          selectedCount={selected.size}
          onSelectAll={handleSelectAll}
          onBatchDismiss={handleBatchDismiss}
          onBatchLink={handleBatchLink}
          isAllSelected={isAllSelected}
          onCancel={() => {
            setBatchMode(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
