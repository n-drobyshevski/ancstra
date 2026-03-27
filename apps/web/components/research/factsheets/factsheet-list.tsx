'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FactsheetCard } from './factsheet-card';
import { CreateFactsheetForm } from './create-factsheet-form';
import type { Factsheet } from '@/lib/research/factsheet-client';

interface FactsheetListProps {
  factsheets: Factsheet[];
  selectedId: string | null;
  details: Map<string, { factCount: number; linkCount: number; conflictCount: number }>;
  onSelect: (id: string) => void;
  onCreated: () => void;
}

const STATUS_ORDER = ['draft', 'ready', 'promoted', 'merged', 'dismissed'];

export function FactsheetList({ factsheets, selectedId, details, onSelect, onCreated }: FactsheetListProps) {
  const [showCreate, setShowCreate] = useState(false);

  const sorted = [...factsheets].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Factsheets</h3>
        <Button variant="default" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 size-3" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {showCreate && (
          <CreateFactsheetForm
            onCreated={() => { setShowCreate(false); onCreated(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {sorted.length === 0 && !showCreate && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm font-medium mb-1">No factsheets yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Group extracted facts into hypotheses about a person.
            </p>
            <Button variant="default" size="sm" onClick={() => setShowCreate(true)}>
              Create First Factsheet
            </Button>
          </div>
        )}

        {sorted.map((fs) => {
          const d = details.get(fs.id) ?? { factCount: 0, linkCount: 0, conflictCount: 0 };
          return (
            <FactsheetCard
              key={fs.id}
              factsheet={fs}
              isSelected={selectedId === fs.id}
              factCount={d.factCount}
              linkCount={d.linkCount}
              conflictCount={d.conflictCount}
              onClick={() => onSelect(fs.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
