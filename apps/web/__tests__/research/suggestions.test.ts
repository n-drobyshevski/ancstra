import { describe, it, expect } from 'vitest';
import { buildSearchQuery, type PersonGap } from '../../lib/research/suggestions';

describe('buildSearchQuery', () => {
  it('builds query from name and birth info', () => {
    const gap: PersonGap = {
      personId: 'p1',
      personName: 'Maria Kowalski',
      birthDate: '1885',
      birthPlace: 'Kraków',
      deathDate: null,
      deathPlace: null,
      missingTypes: ['immigration'],
    };
    expect(buildSearchQuery(gap)).toBe('Maria Kowalski born 1885 Kraków');
  });

  it('builds query from name and death info when no birth', () => {
    const gap: PersonGap = {
      personId: 'p2',
      personName: 'Jan Kowalski',
      birthDate: null,
      birthPlace: null,
      deathDate: '1952',
      deathPlace: 'Chicago, IL',
      missingTypes: ['birth record'],
    };
    expect(buildSearchQuery(gap)).toBe('Jan Kowalski died 1952 Chicago, IL');
  });

  it('builds query from name only when no dates/places', () => {
    const gap: PersonGap = {
      personId: 'p3',
      personName: 'Anna Nowak',
      birthDate: null,
      birthPlace: null,
      deathDate: null,
      deathPlace: null,
      missingTypes: ['birth record', 'death record'],
    };
    expect(buildSearchQuery(gap)).toBe('Anna Nowak');
  });

  it('uses birth info over death info when both available', () => {
    const gap: PersonGap = {
      personId: 'p4',
      personName: 'Józef Kowalski',
      birthDate: '1860',
      birthPlace: 'Warsaw',
      deathDate: '1920',
      deathPlace: 'New York',
      missingTypes: ['census 1900'],
    };
    expect(buildSearchQuery(gap)).toBe('Józef Kowalski born 1860 Warsaw');
  });
});
