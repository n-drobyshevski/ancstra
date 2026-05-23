import { describe, it, expect } from 'vitest';
import { bandConfidence } from '@ancstra/db';

describe('bandConfidence (Bundle A §3.2)', () => {
  it.each<[number, ReturnType<typeof bandConfidence>]>([
    [0,    'unknown'],
    [0.19, 'unknown'],
    [0.20, 'low'],
    [0.54, 'low'],
    [0.55, 'medium'],
    [0.84, 'medium'],
    [0.85, 'high'],
    [1.0,  'high'],
  ])('%f -> %s', (score, expected) => {
    expect(bandConfidence(score)).toBe(expected);
  });
});
