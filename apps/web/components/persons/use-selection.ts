'use client';

import { useReducer, useCallback } from 'react';

export type SelectionState =
  | { kind: 'none' }
  | { kind: 'ids'; rowIds: Set<string> }
  | { kind: 'matching'; exclude: Set<string> };

export type SelectionAction =
  | { type: 'toggleRow'; id: string }
  | { type: 'togglePage'; pageIds: readonly string[]; allChecked: boolean }
  | { type: 'selectAllMatching' }
  | { type: 'clear' };

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'clear':
      return { kind: 'none' };

    case 'selectAllMatching':
      return { kind: 'matching', exclude: new Set() };

    case 'toggleRow': {
      if (state.kind === 'none') {
        return { kind: 'ids', rowIds: new Set([action.id]) };
      }
      if (state.kind === 'ids') {
        const next = new Set(state.rowIds);
        if (next.has(action.id)) next.delete(action.id);
        else next.add(action.id);
        if (next.size === 0) return { kind: 'none' };
        return { kind: 'ids', rowIds: next };
      }
      // matching mode: toggle adds/removes from exclude
      const exclude = new Set(state.exclude);
      if (exclude.has(action.id)) exclude.delete(action.id);
      else exclude.add(action.id);
      return { kind: 'matching', exclude };
    }

    case 'togglePage': {
      if (state.kind === 'matching') {
        const exclude = new Set(state.exclude);
        if (action.allChecked) {
          for (const id of action.pageIds) exclude.add(id);
        } else {
          for (const id of action.pageIds) exclude.delete(id);
        }
        return { kind: 'matching', exclude };
      }
      const current = state.kind === 'ids' ? new Set(state.rowIds) : new Set<string>();
      if (action.allChecked) {
        for (const id of action.pageIds) current.delete(id);
      } else {
        for (const id of action.pageIds) current.add(id);
      }
      if (current.size === 0) return { kind: 'none' };
      return { kind: 'ids', rowIds: current };
    }

    default:
      return state;
  }
}

export function useSelection() {
  const [state, dispatch] = useReducer(selectionReducer, { kind: 'none' } as SelectionState);

  const toggleRow = useCallback((id: string) => dispatch({ type: 'toggleRow', id }), []);
  const togglePage = useCallback(
    (pageIds: readonly string[], allChecked: boolean) =>
      dispatch({ type: 'togglePage', pageIds, allChecked }),
    [],
  );
  const selectAllMatching = useCallback(() => dispatch({ type: 'selectAllMatching' }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { state, toggleRow, togglePage, selectAllMatching, clear };
}

/**
 * Convenience: count of selected rows visible on the current page.
 * Returns null in matching mode (true count requires server resolution).
 */
export function selectedOnPageCount(state: SelectionState, pageIds: readonly string[]): number {
  if (state.kind === 'none') return 0;
  if (state.kind === 'ids') return pageIds.filter((id) => state.rowIds.has(id)).length;
  return pageIds.filter((id) => !state.exclude.has(id)).length;
}

/** True when the user has explicitly selected one or more items. */
export function isSelectionActive(state: SelectionState): boolean {
  return state.kind !== 'none';
}
