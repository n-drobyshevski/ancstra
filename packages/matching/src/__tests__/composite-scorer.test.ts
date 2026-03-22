import { describe, it, expect } from 'vitest';
import { computeMatchScore, defaultWeights, MatchInput, MatchResult } from '../scoring/composite-scorer';

describe('computeMatchScore', () => {
  it('returns high score for near-identical persons', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: 18501215,
      externalBirthDate: 18501215,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: 19230101,
      externalDeathDate: 19230101,
    };
    const result = computeMatchScore(input);
    expect(result.score).toBeGreaterThan(0.95);
    expect(result.components.name).toBeGreaterThan(0.95);
  });

  it('returns moderate score for similar names + close dates', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smyth',
      localBirthDate: 18500101,
      externalBirthDate: 18510101,
      localBirthPlace: null,
      externalBirthPlace: null,
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.score).toBeLessThan(0.95);
  });

  it('returns low score for different names', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'Mary Johnson',
      localBirthDate: 18500101,
      externalBirthDate: 18500101,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    // Name component should be low even though dates/places match
    expect(result.components.name).toBeLessThan(0.5);
    expect(result.score).toBeLessThan(0.7);
  });

  it('accepts custom weights', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: null,
      externalBirthDate: null,
      localBirthPlace: null,
      externalBirthPlace: null,
      localDeathDate: null,
      externalDeathDate: null,
    };
    const heavyName = computeMatchScore(input, { name: 0.8, birthDate: 0.05, birthPlace: 0.05, deathDate: 0.05, deathPlace: 0.05 });
    const lightName = computeMatchScore(input, { name: 0.2, birthDate: 0.2, birthPlace: 0.2, deathDate: 0.2, deathPlace: 0.2 });
    expect(heavyName.score).toBeGreaterThan(lightName.score);
  });

  it('decomposes scores into named components', () => {
    const input: MatchInput = {
      localName: 'John Smith',
      externalName: 'John Smith',
      localBirthDate: 18500101,
      externalBirthDate: 18500101,
      localBirthPlace: 'Springfield, IL',
      externalBirthPlace: 'Springfield, IL',
      localDeathDate: null,
      externalDeathDate: null,
    };
    const result = computeMatchScore(input);
    expect(result.components).toHaveProperty('name');
    expect(result.components).toHaveProperty('birthDate');
    expect(result.components).toHaveProperty('birthPlace');
    expect(result.components).toHaveProperty('deathDate');
  });

  it('default weights sum to 1.0', () => {
    const sum = Object.values(defaultWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
