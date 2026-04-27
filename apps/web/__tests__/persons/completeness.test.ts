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
  it('returns all hits when all flags are true (deceased)', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: true,
        hasDeathEvent: true,
        hasSource: true,
      }),
    );
    expect(r.score).toBe(100);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(100);
    expect(r.items.every((i) => i.hit)).toBe(true);
    expect(r.items.every((i) => i.applicable)).toBe(true);
    expect(r.items.map((i) => i.key)).toEqual([
      'name',
      'birth',
      'birthPlace',
      'death',
      'source',
    ]);
  });

  it('returns all misses when all flags are false (deceased)', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
        hasName: false,
        hasBirthEvent: false,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: false,
      }),
    );
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(0);
    expect(r.items.every((i) => !i.hit)).toBe(true);
  });

  it('partial flags sum hit weights (deceased)', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: true,
      }),
    );
    // 20 + 25 + 0 + 0 + 20 = 65; deceased → maxScore = 100; total = 65
    expect(r.score).toBe(65);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(65);
  });

  it('exposes isLiving from the person', () => {
    const r = getCompletenessBreakdown(person({ isLiving: true }));
    expect(r.isLiving).toBe(true);
  });

  it('falls back to deriving flags from raw fields when flags are absent', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
        givenName: 'Ada',
        surname: 'Lovelace',
        birthDate: '1815-12-10',
        birthPlace: 'London',
        deathDate: '1852-11-27',
        sourcesCount: 2,
      }),
    );
    expect(r.score).toBe(100);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(100);
  });

  it('fallback: empty strings and zero counts are misses', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
        givenName: 'Ada',
        surname: '',
        birthDate: '',
        birthPlace: null,
        deathDate: undefined,
        sourcesCount: 0,
      }),
    );
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(0);
  });

  it('explicit false flag overrides a raw-field hit', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: false,
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
        hasSource: false,
      }),
    );
    expect(r.score).toBe(80);
    expect(r.total).toBe(80);
    expect(r.items.find((i) => i.key === 'source')?.hit).toBe(false);
  });

  it('explicit true flag overrides a raw-field miss', () => {
    const r = getCompletenessBreakdown(
      person({ isLiving: false, sourcesCount: 0, hasSource: true }),
    );
    expect(r.items.find((i) => i.key === 'source')?.hit).toBe(true);
    expect(r.score).toBe(20);
    expect(r.total).toBe(20);
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

  // ----- Effective-living renormalization tests -----

  it('effective-living with all four applicable hits → total 100', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: true,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: true,
        hasDeathEvent: false,
        hasSource: true,
      }),
    );
    expect(r.score).toBe(85);
    expect(r.maxScore).toBe(85);
    expect(r.total).toBe(100);
    const death = r.items.find((i) => i.key === 'death')!;
    expect(death.applicable).toBe(false);
    expect(death.hit).toBe(false);
  });

  it('effective-living with name only → score 20, total 24', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: true,
        hasName: true,
        hasBirthEvent: false,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: false,
      }),
    );
    expect(r.score).toBe(20);
    expect(r.maxScore).toBe(85);
    expect(r.total).toBe(24); // round(20 * 100 / 85) = round(23.529) = 24
  });

  it('effective-living with name + birth + source → total 76', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: true,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: false,
        hasDeathEvent: false,
        hasSource: true,
      }),
    );
    expect(r.score).toBe(65);
    expect(r.maxScore).toBe(85);
    expect(r.total).toBe(76); // round(65 * 100 / 85) = round(76.47) = 76
  });

  it('isLiving=true AND hasDeathEvent=true → effective-deceased', () => {
    const r = getCompletenessBreakdown(
      person({
        isLiving: true,
        hasName: true,
        hasBirthEvent: true,
        hasBirthPlace: true,
        hasDeathEvent: true,
        hasSource: true,
      }),
    );
    // Death event present → effective-deceased; full 100/100
    expect(r.score).toBe(100);
    expect(r.maxScore).toBe(100);
    expect(r.total).toBe(100);
    const death = r.items.find((i) => i.key === 'death')!;
    expect(death.applicable).toBe(true);
    expect(death.hit).toBe(true);
  });

  it('all items have applicable=true for deceased persons', () => {
    const r = getCompletenessBreakdown(person({ isLiving: false }));
    expect(r.items.every((i) => i.applicable)).toBe(true);
  });

  it('only death item is non-applicable for effective-living', () => {
    const r = getCompletenessBreakdown(
      person({ isLiving: true, hasDeathEvent: false }),
    );
    const nonApplicable = r.items.filter((i) => !i.applicable);
    expect(nonApplicable.map((i) => i.key)).toEqual(['death']);
  });
});
