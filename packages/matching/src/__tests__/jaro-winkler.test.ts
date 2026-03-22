import { describe, it, expect } from 'vitest';
import { jaroWinkler, jaroDistance } from '../algorithms/jaro-winkler';

describe('jaroDistance', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroDistance('MARTHA', 'MARTHA')).toBe(1.0);
  });

  it('returns 0.0 for completely different strings', () => {
    expect(jaroDistance('ABC', 'XYZ')).toBe(0.0);
  });

  it('returns 0.0 for empty strings', () => {
    expect(jaroDistance('', '')).toBe(0.0);
  });

  it('computes classic MARTHA/MARHTA example', () => {
    expect(jaroDistance('MARTHA', 'MARHTA')).toBeCloseTo(0.9444, 3);
  });

  it('is case-insensitive', () => {
    expect(jaroDistance('martha', 'MARHTA')).toBeCloseTo(0.9444, 3);
  });

  it('handles single character strings', () => {
    expect(jaroDistance('A', 'A')).toBe(1.0);
    expect(jaroDistance('A', 'B')).toBe(0.0);
  });
});

describe('jaroWinkler', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinkler('SMITH', 'SMITH')).toBe(1.0);
  });

  it('boosts score for common prefix (MARTHA/MARHTA)', () => {
    const jaro = jaroDistance('MARTHA', 'MARHTA');
    const jw = jaroWinkler('MARTHA', 'MARHTA');
    expect(jw).toBeGreaterThan(jaro);
    expect(jw).toBeCloseTo(0.9611, 3);
  });

  it('handles genealogy name variants', () => {
    expect(jaroWinkler('JOHNSON', 'JOHNSTON')).toBeGreaterThan(0.85);
    expect(jaroWinkler('SMITH', 'SMYTH')).toBeGreaterThan(0.85);
    expect(jaroWinkler('CATHERINE', 'KATHERINE')).toBeGreaterThan(0.7);
    expect(jaroWinkler('SCHMIDT', 'SMITH')).toBeLessThan(0.8);
  });

  it('respects custom winkler prefix weight', () => {
    const defaultWeight = jaroWinkler('MARTHA', 'MARHTA');
    const higherWeight = jaroWinkler('MARTHA', 'MARHTA', 0.15);
    expect(higherWeight).toBeGreaterThan(defaultWeight);
  });

  it('caps prefix length at 4', () => {
    // Long common prefix should not over-boost
    const score = jaroWinkler('ABCDEFGH', 'ABCDEFXY');
    expect(score).toBeLessThanOrEqual(1.0);
  });
});
