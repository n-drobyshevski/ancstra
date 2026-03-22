import { describe, it, expect } from 'vitest';
import { compareDates, DateCompareResult } from '../algorithms/date-compare';

describe('compareDates', () => {
  it('returns exact for identical dateSort values', () => {
    const result = compareDates(18501215, 18501215);
    expect(result.level).toBe('exact');
    expect(result.score).toBe(1.0);
  });

  it('returns within_1yr for dates 6 months apart', () => {
    const result = compareDates(18500615, 18501215);
    expect(result.level).toBe('within_1yr');
    expect(result.score).toBeCloseTo(0.9, 1);
  });

  it('returns within_2yr for dates 18 months apart', () => {
    const result = compareDates(18500101, 18510701);
    expect(result.level).toBe('within_2yr');
    expect(result.score).toBeCloseTo(0.75, 1);
  });

  it('returns same_decade for dates 5 years apart', () => {
    const result = compareDates(18500101, 18550101);
    expect(result.level).toBe('same_decade');
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it('returns no_match for dates > 10 years apart', () => {
    const result = compareDates(18500101, 18700101);
    expect(result.level).toBe('no_match');
    expect(result.score).toBe(0.0);
  });

  it('handles null values gracefully', () => {
    const result = compareDates(null, 18500101);
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5); // neutral — don't penalize missing data
  });

  it('handles both null values', () => {
    const result = compareDates(null, null);
    expect(result.level).toBe('unknown');
    expect(result.score).toBe(0.5);
  });

  it('handles year-only dateSort values (YYYYMMDD with MM=01, DD=01)', () => {
    // Year-only dates: 1850 stored as 18500101
    const result = compareDates(18500101, 18510101);
    expect(result.level).toBe('within_1yr');
  });
});
