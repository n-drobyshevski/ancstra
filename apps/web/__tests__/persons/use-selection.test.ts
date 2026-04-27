import { describe, it, expect } from 'vitest';
import { selectionReducer, type SelectionState, type SelectionAction } from '../../components/persons/use-selection';

const initial: SelectionState = { kind: 'none' };

describe('selectionReducer', () => {
  it('starts in none mode', () => {
    expect(initial).toEqual({ kind: 'none' });
  });

  it('toggleRow on none → ids with one row', () => {
    const r = selectionReducer(initial, { type: 'toggleRow', id: 'p1' });
    expect(r).toEqual({ kind: 'ids', rowIds: new Set(['p1']) });
  });

  it('toggleRow adds and removes rows in ids mode', () => {
    let s: SelectionState = { kind: 'ids', rowIds: new Set(['p1']) };
    s = selectionReducer(s, { type: 'toggleRow', id: 'p2' });
    expect((s as Extract<SelectionState, { kind: 'ids' }>).rowIds).toEqual(new Set(['p1', 'p2']));
    s = selectionReducer(s, { type: 'toggleRow', id: 'p1' });
    expect((s as Extract<SelectionState, { kind: 'ids' }>).rowIds).toEqual(new Set(['p2']));
  });

  it('toggleRow drops to none when removing last id', () => {
    const s: SelectionState = { kind: 'ids', rowIds: new Set(['p1']) };
    expect(selectionReducer(s, { type: 'toggleRow', id: 'p1' })).toEqual({ kind: 'none' });
  });

  it('togglePage with allChecked=false adds page ids', () => {
    const r = selectionReducer(initial, {
      type: 'togglePage',
      pageIds: ['p1', 'p2', 'p3'],
      allChecked: false,
    });
    expect(r).toEqual({ kind: 'ids', rowIds: new Set(['p1', 'p2', 'p3']) });
  });

  it('togglePage with allChecked=true removes page ids', () => {
    const s: SelectionState = { kind: 'ids', rowIds: new Set(['p1', 'p2', 'p3', 'p4']) };
    const r = selectionReducer(s, { type: 'togglePage', pageIds: ['p1', 'p2'], allChecked: true });
    expect((r as Extract<SelectionState, { kind: 'ids' }>).rowIds).toEqual(new Set(['p3', 'p4']));
  });

  it('selectAllMatching switches to matching mode with empty exclude', () => {
    const r = selectionReducer(initial, { type: 'selectAllMatching' });
    expect(r).toEqual({ kind: 'matching', exclude: new Set() });
  });

  it('toggleRow in matching mode adds to exclude', () => {
    const s: SelectionState = { kind: 'matching', exclude: new Set() };
    const r = selectionReducer(s, { type: 'toggleRow', id: 'p1' });
    expect((r as Extract<SelectionState, { kind: 'matching' }>).exclude).toEqual(new Set(['p1']));
  });

  it('toggleRow in matching mode removes from exclude when re-checked', () => {
    const s: SelectionState = { kind: 'matching', exclude: new Set(['p1']) };
    const r = selectionReducer(s, { type: 'toggleRow', id: 'p1' });
    expect((r as Extract<SelectionState, { kind: 'matching' }>).exclude).toEqual(new Set());
  });

  it('clear returns to none', () => {
    const s: SelectionState = { kind: 'matching', exclude: new Set(['p1']) };
    expect(selectionReducer(s, { type: 'clear' })).toEqual({ kind: 'none' });
  });

  it('clear from ids returns to none', () => {
    const s: SelectionState = { kind: 'ids', rowIds: new Set(['p1', 'p2']) };
    expect(selectionReducer(s, { type: 'clear' })).toEqual({ kind: 'none' });
  });

  it('toggleRow ignores unknown action target gracefully', () => {
    let s: SelectionState = initial;
    s = selectionReducer(s, { type: 'toggleRow', id: 'p1' });
    s = selectionReducer(s, { type: 'clear' });
    s = selectionReducer(s, { type: 'toggleRow', id: 'p1' });
    expect(s).toEqual({ kind: 'ids', rowIds: new Set(['p1']) });
  });
});
