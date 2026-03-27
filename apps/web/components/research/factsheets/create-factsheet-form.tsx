'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createFactsheet } from '@/lib/research/factsheet-client';
import { toast } from 'sonner';

interface CreateFactsheetFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateFactsheetForm({ onCreated, onCancel }: CreateFactsheetFormProps) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createFactsheet(title.trim());
      toast.success('Factsheet created');
      onCreated();
    } catch {
      toast.error('Failed to create factsheet');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-2.5 space-y-2">
      <Input
        autoFocus
        placeholder="Factsheet title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!title.trim() || saving}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
