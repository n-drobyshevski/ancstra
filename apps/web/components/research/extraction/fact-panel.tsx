'use client';

import { useState } from 'react';
import {
  ClipboardList,
  ChevronLeft,
  Plus,
  Link2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FactCard } from './fact-card';
import type { ExtractionSession, DraftFact } from './types';

interface FactPanelProps {
  session: ExtractionSession;
  onRemoveFact: (factId: string) => void;
  onUpdateFact: (factId: string, updates: Partial<Pick<DraftFact, 'factType' | 'factValue' | 'confidence'>>) => void;
  onClearAll: () => void;
  onSave: () => Promise<void>;
  onCollapse: () => void;
  onTitleChange: (title: string) => void;
  researchItemTitle?: string;
  accentColor?: string;
}

export function FactPanel({
  session,
  onRemoveFact,
  onUpdateFact,
  onClearAll,
  onSave,
  onCollapse,
  onTitleChange,
  researchItemTitle,
  accentColor = 'rgb(168 85 247)',
}: FactPanelProps) {
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-[250px] shrink-0 flex-col border-l border-border bg-muted/10">
      {/* Header */}
      <div className="border-b border-border p-2.5" style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 5%, transparent)` }}>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="size-3.5" style={{ color: accentColor }} />
            <span className="text-xs font-semibold text-foreground">Factsheet</span>
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              DRAFT
            </span>
          </div>
          <button
            onClick={onCollapse}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Collapse panel"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        </div>

        {/* Factsheet title (editable) */}
        {editingTitle ? (
          <input
            type="text"
            value={session.factsheetTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
            autoFocus
          />
        ) : (
          <button
            className="w-full rounded border border-border/50 bg-background/50 px-2 py-1.5 text-left"
            onClick={() => setEditingTitle(true)}
          >
            <div className="truncate text-xs text-foreground">{session.factsheetTitle}</div>
            <div className="text-[10px] text-muted-foreground">
              person &middot; {session.factsheetId ? 'saved' : 'auto-created on save'}
            </div>
          </button>
        )}
      </div>

      {/* Source link */}
      {researchItemTitle && (
        <div className="flex items-center gap-1 border-b border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <Link2 className="size-3 shrink-0" />
          <span className="truncate">{researchItemTitle}</span>
        </div>
      )}

      {/* Fact list */}
      <div className="flex-1 overflow-auto p-2">
        {session.facts.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {session.facts.map((fact) => (
              <FactCard
                key={fact.id}
                fact={fact}
                onRemove={() => onRemoveFact(fact.id)}
                onUpdate={(updates) => onUpdateFact(fact.id, updates)}
                accentColor={accentColor}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-[10px] text-muted-foreground">
            Select text + right-click to extract facts
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2.5">
        <Button
          size="sm"
          className="w-full text-xs"
          style={{ backgroundColor: accentColor }}
          onClick={handleSave}
          disabled={session.facts.length === 0 || saving}
        >
          {saving ? (
            <><Loader2 className="mr-1.5 size-3 animate-spin" />Saving...</>
          ) : (
            <>Save to Factsheet ({session.facts.length})</>
          )}
        </Button>
        {session.facts.length > 0 && (
          <button
            className="mt-1.5 w-full text-center text-[10px] text-muted-foreground hover:text-destructive"
            onClick={onClearAll}
          >
            Discard all
          </button>
        )}
      </div>
    </div>
  );
}

/** Collapsed badge shown when panel is hidden but has facts */
export function FactPanelBadge({
  count,
  onClick,
  accentColor = 'rgb(168 85 247)',
}: {
  count: number;
  onClick: () => void;
  accentColor?: string;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-20 md:bottom-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 shadow-lg hover:bg-accent"
    >
      <ClipboardList className="size-4" style={{ color: accentColor }} />
      <span className="text-xs font-medium text-foreground">{count} facts</span>
      <Plus className="size-3 text-muted-foreground" />
    </button>
  );
}
