'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/event-form';
import type { Event } from '@ancstra/shared';
import { RoleGate } from '@/components/auth/role-gate';

interface EventListProps {
  events: Event[];
  personId: string;
  onUpdate?: () => void;
}

const PROTECTED_TYPES = new Set(['birth', 'death']);

export function EventList({ events, personId, onUpdate }: EventListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this event?')) return;

    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onUpdate?.();
    }
  }

  function handleSaved() {
    setEditingId(null);
    setShowAdd(false);
    onUpdate?.();
  }

  return (
    <div className="space-y-2">
      {events.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground">No events recorded</p>
      )}

      {events.map((evt) => {
        if (editingId === evt.id) {
          return (
            <EventForm
              key={evt.id}
              personId={personId}
              event={evt}
              onSave={handleSaved}
              onCancel={() => setEditingId(null)}
            />
          );
        }

        const isProtected = PROTECTED_TYPES.has(evt.eventType);

        return (
          <div
            key={evt.id}
            className="flex min-h-11 items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              {evt.eventType.charAt(0).toUpperCase() + evt.eventType.slice(1)}
            </Badge>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-foreground">
                {evt.dateOriginal && <span>{evt.dateOriginal}</span>}
                {evt.dateOriginal && evt.placeText && (
                  <span className="text-muted-foreground">&middot;</span>
                )}
                {evt.placeText && (
                  <span className="text-muted-foreground">{evt.placeText}</span>
                )}
              </div>
              {evt.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{evt.description}</p>
              )}
            </div>

            {!isProtected && (
              <div className="flex shrink-0 gap-1">
                <RoleGate permission="event:edit">
                  <button
                    type="button"
                    onClick={() => setEditingId(evt.id)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit event"
                    title="Edit event"
                  >
                    <Pencil className="size-4" />
                  </button>
                </RoleGate>
                <RoleGate permission="event:delete">
                  <button
                    type="button"
                    onClick={() => handleDelete(evt.id)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Delete event"
                    title="Delete event"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </RoleGate>
              </div>
            )}
          </div>
        );
      })}

      {showAdd ? (
        <EventForm
          personId={personId}
          onSave={handleSaved}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <RoleGate permission="event:create">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdd(true)}
          >
            + Add Event
          </Button>
        </RoleGate>
      )}
    </div>
  );
}
