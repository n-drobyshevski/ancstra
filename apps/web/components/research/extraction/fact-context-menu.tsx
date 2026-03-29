'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, Plus, Copy, ChevronRight } from 'lucide-react';
import {
  FACT_TYPE_LABELS,
  SHORTCUT_TYPES,
  TYPE_SHORTCUTS,
  FACT_TYPES,
} from './types';
import type { ContextMenuState, FactType } from './types';

// Quick-access types shown in the main menu (order matters)
const QUICK_TYPES: FactType[] = [
  'birth_date', 'death_date', 'marriage_date',
  'name', 'occupation', 'residence', 'birth_place', 'spouse_name',
];

interface FactContextMenuProps {
  state: ContextMenuState;
  onSelect: (type: FactType) => void;
  onDismiss: () => void;
}

export function FactContextMenu({ state, onSelect, onDismiss }: FactContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);

  // Position adjustment to keep menu within viewport
  useEffect(() => {
    if (!state.visible || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw - 8) {
      el.style.left = `${state.x - rect.width}px`;
    }
    if (rect.bottom > vh - 8) {
      el.style.top = `${state.y - rect.height}px`;
    }
  }, [state.visible, state.x, state.y]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.visible) return;

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in SHORTCUT_TYPES) {
        e.preventDefault();
        onSelect(SHORTCUT_TYPES[key]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.visible, onSelect]);

  // Click outside to dismiss
  useEffect(() => {
    if (!state.visible) return;

    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    // Delay to avoid catching the contextmenu click itself
    const timer = setTimeout(() => {
      window.addEventListener('click', handler);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handler);
    };
  }, [state.visible, onDismiss]);

  if (!state.visible) return null;

  const truncatedText = state.selectedText.length > 40
    ? `${state.selectedText.slice(0, 37)}...`
    : state.selectedText;

  const moreTypes = FACT_TYPES.filter((t) => !QUICK_TYPES.includes(t));

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(state.selectedText);
    } catch { /* ignore */ }
    onDismiss();
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[240px] rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ left: state.x, top: state.y }}
    >
      {/* Header: selected text */}
      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
        <Plus className="size-3.5 shrink-0" />
        <span className="truncate">&ldquo;{truncatedText}&rdquo;</span>
      </div>

      <div className="my-1 h-px bg-border" />

      {/* Suggested type (if any) */}
      {state.suggestedType && (
        <>
          <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
            <Star className="mr-1 inline size-3" />
            Suggested
          </div>
          <button
            className="flex w-full items-center justify-between rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
            onClick={() => onSelect(state.suggestedType!)}
          >
            <span>{FACT_TYPE_LABELS[state.suggestedType]}</span>
            <kbd className="text-[10px] text-muted-foreground">
              {TYPE_SHORTCUTS[state.suggestedType] ?? ''}
            </kbd>
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}

      {/* Quick-assign types */}
      {QUICK_TYPES.filter((t) => t !== state.suggestedType).map((type) => (
        <button
          key={type}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          onClick={() => onSelect(type)}
        >
          <span>{FACT_TYPE_LABELS[type]}</span>
          {TYPE_SHORTCUTS[type] && (
            <kbd className="text-[10px] text-muted-foreground/60">
              {TYPE_SHORTCUTS[type]}
            </kbd>
          )}
        </button>
      ))}

      {/* More types */}
      <div className="relative">
        <button
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          onClick={() => setShowMore(!showMore)}
        >
          <span>More types</span>
          <ChevronRight className="size-3.5" />
        </button>
        {showMore && (
          <div className="absolute left-full top-0 z-50 ml-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {moreTypes.map((type) => (
              <button
                key={type}
                className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                onClick={() => onSelect(type)}
              >
                {FACT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-1 h-px bg-border" />

      {/* Fallback actions */}
      <button
        className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground/60 hover:bg-primary/10 hover:text-foreground"
        onClick={handleCopy}
      >
        <Copy className="mr-2 size-3.5" />
        Copy
      </button>
    </div>
  );
}
