import { describe, it, expect } from 'vitest';
import type { PersonListItem } from '@ancstra/shared';
import {
  COMPLETENESS_WEIGHTS,
  getCompletenessBreakdown,
} from '../../lib/persons/completeness';

function person(overrides: Partial<PersonListItem> = {}): PersonListItem {
  return {
    id: 'p1',
    givenName: '',
    surname: '',
    sex: 'U',
    isLiving: false,
    ...overrides,
  };
}

describe('COMPLETENESS_WEIGHTS', () => {
  it('sums to 100', () => {
    const total =
      COMPLETENESS_WEIGHTS.name +
      COMPLETENESS_WEIGHTS.birth +
      COMPLETENESS_WEIGHTS.birthPlace +
      COMPLETENESS_WEIGHTS.death +
      COMPLETENESS_WEIGHTS.source;
    expect(total).toBe(100);
  });
});

describe('getCompletenessBreakdown', () => {
  it('returns all hits when all flags are true', () => {
    const r = getCompletenessBreakdown(
      person({
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: true,
        hasDeathEvent: true,
        hasSource: true,
      }),
    );
    expect(r.total).toBe(100);
    expect(r.items.every((i) => i.hit)).toBe(true);
    expect(r.items.map((i) => i.key)).toEqual([
      'name',
      'birth',
      'birthPlace',
      'death',
      'source',
    ]);
  });

  it('returns all misses when all flags are false', () => {
    const r = getCompletenessBreakdown(
      person({
        hasName: false,
        hasBirthEvent: false,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: false,
      }),
    );
    expect(r.total).toBe(0);
    expect(r.items.every((i) => !i.hit)).toBe(true);
  });

  it('sums only the hit weights for partial flags', () => {
    const r = getCompletenessBreakdown(
      person({
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: true,
      }),
    );
    // 20 + 25 + 0 + 0 + 20 = 65
    expect(r.total).toBe(65);
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i.hit]));
    expect(byKey).toEqual({
      name: true,
      birth: true,
      birthPlace: false,
      death: false,
      source: true,
    });
  });

  it('exposes isLiving from the person', () => {
    const r = getCompletenessBreakdown(person({ isLiving: true }));
    expect(r.isLiving).toBe(true);
  });

  it('falls back to deriving flags from raw fields when flags are absent', () => {
    const r = getCompletenessBreakdown(
      person({
        givenName: 'Ada',
        surname: 'Lovelace',
        birthDate: '1815-12-10',
        birthPlace: 'London',
        deathDate: '1852-11-27',
        sourcesCount: 2,
        // no has* flags
      }),
    );
    expect(r.total).toBe(100);
    expect(r.items.every((i) => i.hit)).toBe(true);
  });

  it('fallback: empty strings and zero counts are treated as misses', () => {
    const r = getCompletenessBreakdown(
      person({
        givenName: 'Ada',
        surname: '', // missing
        birthDate: '', // missing
        birthPlace: null,
        deathDate: undefined,
        sourcesCount: 0,
      }),
    );
    expect(r.total).toBe(0);
    expect(r.items.every((i) => !i.hit)).toBe(true);
  });

  it('explicit flags take precedence over raw-field fallbacks', () => {
    // Raw fields say "has everything" but explicit hasSource=false wins
    const r = getCompletenessBreakdown(
      person({
        givenName: 'Ada',
        surname: 'Lovelace',
        birthDate: '1815-12-10',
        birthPlace: 'London',
        deathDate: '1852-11-27',
        sourcesCount: 5,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: true,
        hasDeathEvent: true,
        hasSource: false, // explicit override
      }),
    );
    expect(r.total).toBe(80);
    const sourceItem = r.items.find((i) => i.key === 'source');
    expect(sourceItem?.hit).toBe(false);
  });

  it('item labels are human-readable', () => {
    const r = getCompletenessBreakdown(person());
    expect(r.items.map((i) => i.label)).toEqual([
      'Name',
      'Birth date',
      'Birth place',
      'Death date',
      'Source',
    ]);
  });

  it('item weights match COMPLETENESS_WEIGHTS', () => {
    const r = getCompletenessBreakdown(person());
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i.weight]));
    expect(byKey).toEqual({
      name: 20,
      birth: 25,
      birthPlace: 20,
      death: 15,
      source: 20,
    });
  });
});
