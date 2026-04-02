import { EXAMPLE_SEARCHES } from './search-history';

export interface PersonGap {
  personId: string;
  personName: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  missingTypes: string[];
}

export interface SearchSuggestion {
  query: string;
  personId: string;
  personName: string;
  missingTypes: string[];
}

export function buildSearchQuery(gap: PersonGap): string {
  const parts = [gap.personName];

  if (gap.birthDate || gap.birthPlace) {
    parts.push('born');
    if (gap.birthDate) parts.push(gap.birthDate);
    if (gap.birthPlace) parts.push(gap.birthPlace);
  } else if (gap.deathDate || gap.deathPlace) {
    parts.push('died');
    if (gap.deathDate) parts.push(gap.deathDate);
    if (gap.deathPlace) parts.push(gap.deathPlace);
  }

  return parts.join(' ');
}

export async function getSuggestions(limit = 5): Promise<SearchSuggestion[]> {
  try {
    const res = await fetch(`/api/research/suggestions?limit=${limit}`);
    if (!res.ok) return [];
    const data: { gaps: PersonGap[] } = await res.json();
    return data.gaps.map((gap) => ({
      query: buildSearchQuery(gap),
      personId: gap.personId,
      personName: gap.personName,
      missingTypes: gap.missingTypes,
    }));
  } catch {
    return [];
  }
}

export function getFallbackSuggestions(): string[] {
  return EXAMPLE_SEARCHES;
}
