import { describe, it, expect } from 'vitest';
import { buildHistoricalContextPrompt } from '../prompts/historical-context-prompt';

const basePerson = {
  name: 'John Smith',
  birthYear: 1850,
  birthPlace: 'Springfield, IL',
  deathYear: 1920,
  deathPlace: 'Chicago, IL',
  events: [
    { type: 'immigration', year: 1870, place: 'New York, NY' },
    { type: 'occupation', year: 1880, place: 'Springfield, IL' },
  ],
};

describe('buildHistoricalContextPrompt', () => {
  it('returns a string containing birth and death years', () => {
    const result = buildHistoricalContextPrompt(basePerson);
    expect(result).toContain('1850');
    expect(result).toContain('1920');
  });

  it('contains locations', () => {
    const result = buildHistoricalContextPrompt(basePerson);
    expect(result).toContain('Springfield, IL');
    expect(result).toContain('Chicago, IL');
    expect(result).toContain('New York, NY');
  });

  it('contains instruction to return JSON array', () => {
    const result = buildHistoricalContextPrompt(basePerson);
    expect(result).toContain('JSON array');
  });

  it('contains instruction for 5-10 events', () => {
    const result = buildHistoricalContextPrompt(basePerson);
    expect(result).toContain('5-10');
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = {
      name: 'Jane Doe',
      events: [{ type: 'birth' }],
    };
    const result = buildHistoricalContextPrompt(minimal);
    expect(result).toContain('Jane Doe');
    expect(result).toContain('unknown');
  });
});
