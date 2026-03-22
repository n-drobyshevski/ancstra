import { describe, it, expect } from 'vitest';
import { isPresumablyLiving, redactForViewer } from '../src/privacy';

describe('isPresumablyLiving', () => {
  it('returns false if isLiving flag is false', () => {
    expect(isPresumablyLiving({ isLiving: false, birthDateSort: 19900101 })).toBe(false);
  });
  it('returns false if death date exists', () => {
    expect(isPresumablyLiving({ isLiving: true, deathDateSort: 20200101 })).toBe(false);
  });
  it('returns true if no birth date (conservative)', () => {
    expect(isPresumablyLiving({ isLiving: true })).toBe(true);
  });
  it('returns true if born within 100 years', () => {
    const recentYear = (new Date().getFullYear() - 50) * 10000 + 101;
    expect(isPresumablyLiving({ isLiving: true, birthDateSort: recentYear })).toBe(true);
  });
  it('returns false if born more than 100 years ago with no death', () => {
    expect(isPresumablyLiving({ isLiving: true, birthDateSort: 19000101 })).toBe(false);
  });
});

describe('redactForViewer', () => {
  const livingPerson = {
    id: '123', givenName: 'John', surname: 'Doe', sex: 'M' as const,
    isLiving: true, birthDateSort: (new Date().getFullYear() - 30) * 10000 + 101,
    notes: 'Private', events: [{ id: 'e1', eventType: 'birth' }], mediaIds: ['m1'],
  };
  const deceasedPerson = {
    id: '456', givenName: 'Jane', surname: 'Doe', sex: 'F' as const,
    isLiving: false, deathDateSort: 19500101,
    notes: 'Historical', events: [{ id: 'e2', eventType: 'death' }], mediaIds: ['m2'],
  };

  it('redacts living person completely', () => {
    const r = redactForViewer(livingPerson);
    expect(r.givenName).toBe('Living');
    expect(r.surname).toBe('');
    expect(r.notes).toBeNull();
    expect(r.events).toEqual([]);
    expect(r.mediaIds).toEqual([]);
    expect(r.id).toBe('123');
    expect(r.sex).toBe('M');
  });
  it('does not redact deceased person', () => {
    const r = redactForViewer(deceasedPerson);
    expect(r.givenName).toBe('Jane');
    expect(r.surname).toBe('Doe');
  });
});
