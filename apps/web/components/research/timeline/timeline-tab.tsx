'use client';

import { Calendar, Clock } from 'lucide-react';
import {
  usePersonFacts,
  usePersonResearchItems,
  usePersonConflicts,
} from '@/lib/research/evidence-client';
import { TimelineEvent } from './timeline-event';

interface TimelineTabProps {
  personId: string;
}

/**
 * Parse factDate string to a sortable integer (YYYYMMDD).
 * Handles formats like "1890", "1890-03", "1890-03-15", "15 Mar 1890", etc.
 * Returns 0 if unparseable.
 */
function parseDateSort(dateStr: string | null): number {
  if (!dateStr) return 0;

  // Try YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return (
      parseInt(isoMatch[1], 10) * 10000 +
      parseInt(isoMatch[2], 10) * 100 +
      parseInt(isoMatch[3], 10)
    );
  }

  // Try YYYY-MM
  const ymMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    return parseInt(ymMatch[1], 10) * 10000 + parseInt(ymMatch[2], 10) * 100;
  }

  // Try bare year
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 10000;
  }

  // Try Date.parse as fallback
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  return 0;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  // If it looks like an ISO date, format nicely
  const ts = Date.parse(dateStr);
  if (!isNaN(ts)) {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  // Return as-is for partial dates like "1890" or "abt 1890"
  return dateStr;
}

interface TimelineFact {
  id: string;
  factType: string;
  factValue: string;
  factDate: string | null;
  confidence: string;
  researchItemId: string | null;
  dateSort: number;
  hasConflict: boolean;
}

export function TimelineTab({ personId }: TimelineTabProps) {
  const { facts } = usePersonFacts(personId);
  const { items } = usePersonResearchItems(personId);
  const { conflicts } = usePersonConflicts(personId);

  // Build source name map
  const sourceMap = new Map(items.map((it) => [it.id, it.title]));

  // Build conflict fact IDs set
  const conflictFactIds = new Set<string>();
  for (const group of conflicts) {
    for (const f of group.facts) {
      conflictFactIds.add(f.id);
    }
  }

  // Enrich facts with dateSort and conflict flag
  const enriched: TimelineFact[] = facts.map((f) => ({
    id: f.id,
    factType: f.factType,
    factValue: f.factValue,
    factDate: f.factDate,
    confidence: f.confidence,
    researchItemId: f.researchItemId,
    dateSort: parseDateSort(f.factDate),
    hasConflict: conflictFactIds.has(f.id),
  }));

  // Separate dated vs undated
  const dated = enriched
    .filter((f) => f.dateSort > 0)
    .sort((a, b) => a.dateSort - b.dateSort);
  const undated = enriched.filter((f) => f.dateSort === 0);

  // Empty state
  if (facts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calendar className="mb-3 size-10" />
        <p className="text-sm font-medium">No events yet</p>
        <p className="mt-1 text-xs">
          Add facts from the Board tab to build a timeline.
        </p>
      </div>
    );
  }

  // Detect gaps (>20 years between consecutive dated events)
  const GAP_THRESHOLD = 200000; // 20 years in YYYYMMDD units

  // Build the rendered list with gap indicators
  const datedElements: React.ReactNode[] = [];
  for (let i = 0; i < dated.length; i++) {
    const fact = dated[i];
    const isLast = i === dated.length - 1 && undated.length === 0;

    // Gap indicator before this event (not before the first)
    if (i > 0) {
      const gap = fact.dateSort - dated[i - 1].dateSort;
      if (gap >= GAP_THRESHOLD) {
        const gapYears = Math.floor(gap / 10000);
        datedElements.push(
          <div
            key={`gap-${i}`}
            className="relative flex gap-4 py-2"
          >
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

    datedElements.push(
      <TimelineEvent
        key={fact.id}
        date={formatDate(fact.factDate)}
        factType={fact.factType}
        factValue={fact.factValue}
        confidence={fact.confidence}
        sourceName={
          fact.researchItemId
            ? sourceMap.get(fact.researchItemId)
            : undefined
        }
        hasConflict={fact.hasConflict}
        isLast={isLast}
      />,
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Dated events */}
      {datedElements.length > 0 && <div>{datedElements}</div>}

      {/* Undated section */}
      {undated.length > 0 && (
        <div className="space-y-1">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Undated
          </h3>
          <div>
            {undated.map((fact, i) => (
              <TimelineEvent
                key={fact.id}
                date={null}
                factType={fact.factType}
                factValue={fact.factValue}
                confidence={fact.confidence}
                sourceName={
                  fact.researchItemId
                    ? sourceMap.get(fact.researchItemId)
                    : undefined
                }
                hasConflict={fact.hasConflict}
                isLast={i === undated.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
