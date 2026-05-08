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

  describe('configurable threshold', () => {
    it('60-year threshold: a 70-year-old is no longer presumed living', () => {
      const seventyYearsAgo = (new Date().getFullYear() - 70) * 10000 + 101;
      expect(isPresumablyLiving({ isLiving: true, birthDateSort: seventyYearsAgo })).toBe(true);
      expect(isPresumablyLiving({ isLiving: true, birthDateSort: seventyYearsAgo }, 60)).toBe(false);
    });
    it('150-year threshold: someone born 120 years ago is still presumed living', () => {
      const oneTwentyYearsAgo = (new Date().getFullYear() - 120) * 10000 + 101;
      expect(isPresumablyLiving({ isLiving: true, birthDateSort: oneTwentyYearsAgo })).toBe(false);
      expect(isPresumablyLiving({ isLiving: true, birthDateSort: oneTwentyYearsAgo }, 150)).toBe(true);
    });
    it('explicit threshold of 100 matches default behaviour', () => {
      const ninetyYearsAgo = (new Date().getFullYear() - 90) * 10000 + 101;
      expect(isPresumablyLiving({ isLiving: true, birthDateSort: ninetyYearsAgo })).toBe(
        isPresumablyLiving({ isLiving: true, birthDateSort: ninetyYearsAgo }, 100),
      );
    });
    it('death date short-circuits regardless of threshold', () => {
      expect(
        isPresumablyLiving({ isLiving: true, deathDateSort: 20200101 }, 200),
      ).toBe(false);
    });
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

  it('respects a custom threshold passed by the caller', () => {
    // Born 70 years ago: redacted under default 100, NOT redacted under 60.
    const seventy = {
      ...livingPerson,
      birthDateSort: (new Date().getFullYear() - 70) * 10000 + 101,
    };
    const defaultRedacted = redactForViewer(seventy);
    const lowThresholdRedacted = redactForViewer(seventy, 60);
    expect(defaultRedacted.givenName).toBe('Living');
    expect(lowThresholdRedacted.givenName).toBe('John');
  });
});
