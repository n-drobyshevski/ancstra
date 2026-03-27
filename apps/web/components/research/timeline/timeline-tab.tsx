'use client';

import { useState, useCallback } from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Event as PersonEvent } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import {
  usePersonFacts,
  usePersonResearchItems,
  usePersonConflicts,
} from '@/lib/research/evidence-client';
import { TimelineEvent } from './timeline-event';
import { EventForm } from '@/components/event-form';

interface TimelineTabProps {
  personId: string;
  events?: PersonEvent[];
}

/** Unified entry for the combined timeline */
interface TimelineEntry {
  id: string;
  factType: string;
  factValue: string;
  date: string | null;
  dateSort: number;
  confidence: string;
  sourceName?: string;
  hasConflict: boolean;
  entrySource: 'event' | 'fact';
  /** Original event object (only for entrySource=event), used for editing */
  eventData?: PersonEvent;
}

/**
 * Parse a date string to sortable integer (YYYYMMDD).
 * Handles YYYY-MM-DD, YYYY-MM, bare YYYY, and Date.parse fallback.
 */
function parseDateSort(dateStr: string | null): number {
  if (!dateStr) return 0;
  const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return parseInt(isoMatch[1], 10) * 10000 + parseInt(isoMatch[2], 10) * 100 + parseInt(isoMatch[3], 10);
  }
  const ymMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    return parseInt(ymMatch[1], 10) * 10000 + parseInt(ymMatch[2], 10) * 100;
  }
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 10000;
  }
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  return 0;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

const PROTECTED_TYPES = new Set(['birth', 'death']);

export function TimelineTab({ personId, events = [] }: TimelineTabProps) {
  const { facts } = usePersonFacts(personId);
  const { items } = usePersonResearchItems(personId);
  const { conflicts } = usePersonConflicts(personId);

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PersonEvent | null>(null);

  // Source name map for research items
  const sourceMap = new Map(items.map((it) => [it.id, it.title]));

  // Conflict fact IDs
  const conflictFactIds = new Set<string>();
  for (const group of conflicts) {
    for (const f of group.facts) {
      conflictFactIds.add(f.id);
    }
  }

  // Build unified timeline entries from facts
  const factEntries: TimelineEntry[] = facts.map((f) => ({
    id: f.id,
    factType: f.factType,
    factValue: f.factValue,
    date: f.factDate,
    dateSort: parseDateSort(f.factDate),
    confidence: f.confidence,
    sourceName: f.researchItemId ? sourceMap.get(f.researchItemId) : undefined,
    hasConflict: conflictFactIds.has(f.id),
    entrySource: 'fact' as const,
  }));

  // Build unified timeline entries from events
  const eventEntries: TimelineEntry[] = events.map((e) => ({
    id: e.id,
    factType: e.eventType,
    factValue: [e.dateOriginal, e.placeText, e.description].filter(Boolean).join(' — '),
    date: e.dateOriginal,
    dateSort: e.dateSort ?? parseDateSort(e.dateOriginal),
    confidence: 'high',
    hasConflict: false,
    entrySource: 'event' as const,
    eventData: e,
  }));

  // Merge and separate dated vs undated
  const all = [...factEntries, ...eventEntries];
  const dated = all.filter((e) => e.dateSort > 0).sort((a, b) => a.dateSort - b.dateSort);
  const undated = all.filter((e) => e.dateSort === 0);

  // Delete event handler
  const handleDeleteEvent = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Event deleted');
      window.location.reload();
    } catch {
      toast.error('Failed to delete event');
    }
  }, []);

  // Empty state
  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calendar className="mb-3 size-10" />
        <p className="text-sm font-medium">No events yet</p>
        <p className="mt-1 text-xs">
          Add facts from the Board tab or add events below.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddEvent(true)}>
          <Plus className="mr-1.5 size-3" /> Add Event
        </Button>
        {showAddEvent && (
          <div className="mt-4 w-full max-w-md">
            <EventForm
              personId={personId}
              onSave={() => { setShowAddEvent(false); window.location.reload(); }}
              onCancel={() => setShowAddEvent(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Gap detection
  const GAP_THRESHOLD = 200000; // 20 years in YYYYMMDD units

  const datedElements: React.ReactNode[] = [];
  for (let i = 0; i < dated.length; i++) {
    const entry = dated[i];
    const isLast = i === dated.length - 1 && undated.length === 0;

    // Gap indicator
    if (i > 0) {
      const gap = entry.dateSort - dated[i - 1].dateSort;
      if (gap >= GAP_THRESHOLD) {
        const gapYears = Math.floor(gap / 10000);
        datedElements.push(
          <div key={`gap-${i}`} className="relative flex gap-4 py-2">
            <div className="flex flex-col items-center">
              <div className="w-px flex-1 border-l border-dashed border-muted-foreground/30" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
              <Clock className="size-3" />
              ~{gapYears} year gap
            </div>
          </div>,
        );
      }
    }

    // Inline edit form
    if (editingEvent && editingEvent.id === entry.id) {
      datedElements.push(
        <div key={`edit-${entry.id}`} className="mb-4 ml-7">
          <EventForm
            personId={personId}
            event={editingEvent}
            onSave={() => { setEditingEvent(null); window.location.reload(); }}
            onCancel={() => setEditingEvent(null)}
          />
        </div>,
      );
      continue;
    }

    const isEditable = entry.entrySource === 'event' && !PROTECTED_TYPES.has(entry.factType);

    datedElements.push(
      <TimelineEvent
        key={entry.id}
        date={formatDate(entry.date)}
        factType={entry.factType}
        factValue={entry.factValue}
        confidence={entry.confidence}
        sourceName={entry.sourceName}
        hasConflict={entry.hasConflict}
        isLast={isLast}
        entrySource={entry.entrySource}
        editable={isEditable}
        onEdit={() => entry.eventData && setEditingEvent(entry.eventData)}
        onDelete={() => entry.eventData && handleDeleteEvent(entry.eventData.id)}
      />,
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Add event button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowAddEvent(true)}>
          <Plus className="mr-1.5 size-3" /> Add Event
        </Button>
      </div>

      {/* Add event form */}
      {showAddEvent && (
        <div className="mb-4">
          <EventForm
            personId={personId}
            onSave={() => { setShowAddEvent(false); window.location.reload(); }}
            onCancel={() => setShowAddEvent(false)}
          />
        </div>
      )}

      {/* Dated events */}
      {datedElements.length > 0 && <div>{datedElements}</div>}

      {/* Undated section */}
      {undated.length > 0 && (
        <div className="space-y-1">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Undated
          </h3>
          <div>
            {undated.map((entry, i) => {
              const isEditable = entry.entrySource === 'event' && !PROTECTED_TYPES.has(entry.factType);

              if (editingEvent && editingEvent.id === entry.id) {
                return (
                  <div key={`edit-${entry.id}`} className="mb-4 ml-7">
                    <EventForm
                      personId={personId}
                      event={editingEvent}
                      onSave={() => { setEditingEvent(null); window.location.reload(); }}
                      onCancel={() => setEditingEvent(null)}
                    />
                  </div>
                );
              }

              return (
                <TimelineEvent
                  key={entry.id}
                  date={null}
                  factType={entry.factType}
                  factValue={entry.factValue}
                  confidence={entry.confidence}
                  sourceName={entry.sourceName}
                  hasConflict={entry.hasConflict}
                  isLast={i === undated.length - 1}
                  entrySource={entry.entrySource}
                  editable={isEditable}
                  onEdit={() => entry.eventData && setEditingEvent(entry.eventData)}
                  onDelete={() => entry.eventData && handleDeleteEvent(entry.eventData.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
