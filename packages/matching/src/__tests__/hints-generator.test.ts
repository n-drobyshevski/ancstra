import { describe, it, expect } from 'vitest';
import { generateHintsForPerson } from '../pipeline/hints-generator';
import type { LocalPersonData, SearchResultInput } from '../pipeline/hints-generator';

const mockSearchResults: SearchResultInput[] = [
  {
    providerId: 'familysearch',
    externalId: 'fs-123',
    title: 'John Smith - 1850 Census',
    snippet: 'John Smith, age 30, Springfield IL',
    url: 'https://familysearch.org/ark:/123',
    extractedData: {
      name: 'John Smith',
      birthDate: '1820',
      location: 'Springfield, IL',
    },
  },
  {
    providerId: 'familysearch',
    externalId: 'fs-456',
    title: 'Johan Schmidt - Ship Manifest',
    snippet: 'Johan Schmidt, age 28',
    url: 'https://familysearch.org/ark:/456',
    extractedData: {
      name: 'Johan Schmidt',
      birthDate: '1822',
      location: 'Hamburg, Germany',
    },
  },
];

describe('generateHintsForPerson', () => {
  it('scores and filters search results against local person', () => {
    const localPerson: LocalPersonData = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: 'Springfield, IL',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    expect(hints.length).toBeGreaterThan(0);
    // First result should score higher (exact name + place match)
    expect(hints[0].externalId).toBe('fs-123');
    expect(hints[0].matchScore).toBeGreaterThan(0.7);
  });

  it('filters out results below score threshold', () => {
    const localPerson: LocalPersonData = {
      givenName: 'Mary',
      surname: 'Johnson',
      birthDateSort: 19000101,
      birthPlace: 'Boston, MA',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults, { minScore: 0.5 });
    expect(hints).toHaveLength(0); // None should match
  });

  it('respects maxHints config', () => {
    const localPerson: LocalPersonData = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: null,
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults, { maxHints: 1 });
    expect(hints.length).toBeLessThanOrEqual(1);
  });

  it('returns sorted by matchScore descending', () => {
    const localPerson: LocalPersonData = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: null,
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    for (let i = 1; i < hints.length; i++) {
      expect(hints[i - 1].matchScore).toBeGreaterThanOrEqual(hints[i].matchScore);
    }
  });

  it('includes match score components for transparency', () => {
    const localPerson: LocalPersonData = {
      givenName: 'John',
      surname: 'Smith',
      birthDateSort: 18200101,
      birthPlace: 'Springfield, IL',
      deathDateSort: null,
      deathPlace: null,
    };
    const hints = generateHintsForPerson(localPerson, mockSearchResults);
    expect(hints[0].components).toHaveProperty('name');
    expect(hints[0].components).toHaveProperty('birthDate');
    expect(hints[0].components).toHaveProperty('birthPlace');
  });
});
