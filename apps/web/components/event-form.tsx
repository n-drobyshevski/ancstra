'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Event } from '@ancstra/shared';

const EVENT_TYPES = [
  'birth', 'death', 'marriage', 'divorce', 'residence', 'occupation',
  'immigration', 'emigration', 'military', 'education', 'census',
  'burial', 'baptism', 'other',
] as const;

const DATE_MODIFIERS = [
  'exact', 'about', 'estimated', 'before', 'after', 'between',
] as const;

interface EventFormProps {
  personId: string;
  event?: Event;
  onSave?: () => void;
  onCancel?: () => void;
}

export function EventForm({ personId, event, onSave, onCancel }: EventFormProps) {
  const isEdit = !!event;

  const [eventType, setEventType] = useState(event?.eventType ?? 'other');
  const [dateOriginal, setDateOriginal] = useState(event?.dateOriginal ?? '');
  const [dateModifier, setDateModifier] = useState<string>(event?.dateModifier ?? 'exact');
  const [placeText, setPlaceText] = useState(event?.placeText ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body = {
      eventType,
      dateOriginal: dateOriginal || undefined,
      dateModifier: dateModifier || undefined,
      placeText: placeText || undefined,
      description: description || undefined,
      personId,
    };

    try {
      const url = isEdit ? `/api/events/${event.id}` : '/api/events';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save event');
        setLoading(false);
        return;
      }

      onSave?.();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ef-type" className="text-xs">Event Type</Label>
          <select
            id="ef-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef-modifier" className="text-xs">Date Modifier</Label>
          <select
            id="ef-modifier"
            value={dateModifier}
            onChange={(e) => setDateModifier(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {DATE_MODIFIERS.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ef-date" className="text-xs">Date</Label>
          <Input
            id="ef-date"
            value={dateOriginal}
            onChange={(e) => setDateOriginal(e.target.value)}
            placeholder="15 Mar 1845"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef-place" className="text-xs">Place</Label>
          <Input
            id="ef-place"
            value={placeText}
            onChange={(e) => setPlaceText(e.target.value)}
            placeholder="Springfield, IL"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ef-desc" className="text-xs">Description</Label>
        <Textarea
          id="ef-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Add Event'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
