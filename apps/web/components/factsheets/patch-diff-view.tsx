'use client';
import type { PatchDiff, FieldDelta } from '@ancstra/research';

/**
 * Bundle C 2026-05-24 — read-only textual diff renderer for the dirty-case modal.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §6.2
 */

export interface PatchDiffViewProps {
  diff: PatchDiff;
}

const FIELD_LABEL: Record<FieldDelta['field'], string> = {
  dateOriginal: 'Date',
  dateSort: 'Sort key',
  placeText: 'Place',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

export function PatchDiffView({ diff }: PatchDiffViewProps) {
  const addedCount = diff.events.added.length;
  const modifiedCount = diff.events.modified.length;
  const unchangedCount = diff.events.unchanged.length;
  const citAddedCount = diff.citations.added.length;
  const citUnchangedCount = diff.citations.unchanged.length;
  const totalUnchanged = unchangedCount + citUnchangedCount;
  const totalChanged = addedCount + modifiedCount + citAddedCount;

  return (
    <div className="space-y-3 text-sm">
      {addedCount > 0 ? (
        <section>
          <h4 className="font-medium text-slate-900">{addedCount} new event{addedCount === 1 ? '' : 's'}</h4>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {diff.events.added.map((ev, i) => (
              <li key={i}>
                <span className="font-medium">{ev.eventType}</span>
                {ev.dateOriginal && <> — {ev.dateOriginal}</>}
                {ev.placeText && <> · {ev.placeText}</>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modifiedCount > 0 ? (
        <section>
          <h4 className="font-medium text-slate-900">{modifiedCount} existing event{modifiedCount === 1 ? '' : 's'} updated</h4>
          <ul className="mt-1 space-y-2 text-xs text-slate-700">
            {diff.events.modified.map((ev) => (
              <li key={ev.eventId}>
                <span className="font-medium">{ev.eventType}</span>
                <ul className="ml-3 mt-1 space-y-0.5">
                  {ev.deltas.map((d, j) => (
                    <li key={j} className="text-slate-600">
                      {FIELD_LABEL[d.field] ?? d.field}: <span className="line-through">{formatValue(d.before)}</span> → <span className="text-slate-900">{formatValue(d.after)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {citAddedCount > 0 ? (
        <section>
          <h4 className="font-medium text-slate-900">{citAddedCount} new citation{citAddedCount === 1 ? '' : 's'}</h4>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {diff.citations.added.map((c) => (
              <li key={c.researchItemId}>{c.sourceTitle}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {totalUnchanged > 0 ? (
        <p className="text-[11px] text-slate-500">
          {totalUnchanged} item{totalUnchanged === 1 ? '' : 's'} unchanged
        </p>
      ) : null}

      {totalChanged === 0 && totalUnchanged === 0 ? (
        <p className="text-xs text-slate-500">—</p>
      ) : null}
    </div>
  );
}
