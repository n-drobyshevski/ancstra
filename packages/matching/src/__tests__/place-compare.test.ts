import { describe, it, expect } from 'vitest';
import { comparePlaces, PlaceCompareResult } from '../algorithms/place-compare';

describe('comparePlaces', () => {
  it('returns exact for identical place strings', () => {
    const result = comparePlaces('Springfield, IL', 'Springfield, IL');
    expect(result.level).toBe('exact');
    expect(result.score).toBe(1.0);
  });

  it('returns exact for case-insensitive match', () => {
    const result = comparePlaces('springfield, il', 'Springfield, IL');
    expect(result.level).toBe('exact');
  });

  it('returns county for same county/state but different city', () => {
    const result = comparePlaces('Springfield, Sangamon, IL', 'Chatham, Sangamon, IL');
    expect(result.level).toBe('county');
    expect(result.score).toBeCloseTo(0.8, 1);
  });

  it('returns state for same state but different county', () => {
    const result = comparePlaces('Springfield, IL', 'Chicago, IL');
    expect(result.level).toBe('state');
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it('returns country for same country but different state', () => {
    const result = comparePlaces('Springfield, IL, USA', 'Boston, MA, USA');
    expect(result.level).toBe('country');
    expect(result.score).toBeCloseTo(0.3, 1);
  });

  it('returns no_match for completely different places', () => {
    const result = comparePlaces('Springfield, IL, USA', 'London, England');
    expect(result.level).toBe('no_match');
    expect(result.score).toBe(0.0);
  });

  it('handles null values gracefully', () => {
    const result = comparePlaces(null, 'Springfield, IL');
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5);
  });

  it('normalizes common abbreviations (IL = Illinois)', () => {
    const result = comparePlaces('Springfield, Illinois', 'Springfield, IL');
    expect(result.level).toBe('exact');
  });
});
