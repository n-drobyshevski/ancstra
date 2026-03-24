'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface ItemNotesEditorProps {
  itemId: string;
  initialNotes: string | null;
  onNotesChange: (notes: string) => void;
}

export function ItemNotesEditor({ itemId, initialNotes, onNotesChange }: ItemNotesEditorProps) {
  const [value, setValue] = useState(initialNotes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? '');

  const save = useCallback(async (notes: string) => {
    if (notes === lastSavedRef.current) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/research/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to save');
      lastSavedRef.current = notes;
      onNotesChange(notes);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [itemId, onNotesChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(newValue), 500);
  }, [save]);

  const handleBlur = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save(value);
  }, [save, value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
        <span aria-live="polite" className="text-[11px] text-muted-foreground">
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={() => save(value)}
              className="text-destructive hover:underline"
            >
              Failed to save — retry
            </button>
          )}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Click to add research notes..."
        className="min-h-24 resize-y"
        aria-label="Research notes"
      />
    </div>
  );
}
