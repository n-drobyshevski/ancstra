import { computeMatchScore } from '../scoring/composite-scorer';
import type { MatchWeights } from '../scoring/composite-scorer';

// ── Types ──

export interface LocalPersonData {
  givenName: string;
  surname: string;
  birthDateSort: number | null;
  birthPlace: string | null;
  deathDateSort: number | null;
  deathPlace: string | null;
}

export interface SearchResultInput {
  providerId: string;
  externalId: string;
  title: string;
  snippet: string;
  url: string;
  extractedData: {
    name?: string;
    birthDate?: string;
    deathDate?: string;
    location?: string;
    birthPlace?: string;
    deathPlace?: string;
    [key: string]: unknown;
  };
}

export interface HintGeneratorConfig {
  minScore?: number;
  maxHints?: number;
  weights?: MatchWeights;
}

export interface HintCandidate {
  providerId: string;
  externalId: string;
  externalData: Record<string, unknown>;
  matchScore: number;
  components: Record<string, number>;
  url: string;
  title: string;
}

// ── Helpers ──

/**
 * Parse a year string (e.g. "1820", "1820-05-01", "about 1820") into
 * a YYYYMMDD dateSort integer.  Falls back to YYYY0101 when only a
 * year can be extracted.
 */
function parseDateToSort(dateStr: string | undefined): number | null {
  if (!dateStr) return null;

  // Try full YYYY-MM-DD
  const fullMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (fullMatch) {
    return parseInt(fullMatch[1], 10) * 10000 +
      parseInt(fullMatch[2], 10) * 100 +
      parseInt(fullMatch[3], 10);
  }

  // Extract just the year
  const yearMatch = dateStr.match(/(\d{4})/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 10000 + 101; // Jan 1
  }

  return null;
}

// ── Main Pipeline ──

const DEFAULT_MIN_SCORE = 0.4;
const DEFAULT_MAX_HINTS = 20;

/**
 * Score and filter external search results against a local person.
 *
 * Each search result's `extractedData` is compared to the local person
 * using the composite scorer (Jaro-Winkler names, date tiers, place
 * matching).  Results below `minScore` are dropped, the rest are
 * returned sorted by score descending, capped at `maxHints`.
 */
export function generateHintsForPerson(
  person: LocalPersonData,
  searchResults: SearchResultInput[],
  config?: HintGeneratorConfig,
): HintCandidate[] {
  const minScore = config?.minScore ?? DEFAULT_MIN_SCORE;
  const maxHints = config?.maxHints ?? DEFAULT_MAX_HINTS;

  const localName = `${person.givenName} ${person.surname}`.trim();

  const scored: HintCandidate[] = [];

  for (const result of searchResults) {
    const ext = result.extractedData;
    const externalName = ext.name ?? '';
    const externalBirthDate = parseDateToSort(ext.birthDate);
    const externalBirthPlace = ext.birthPlace ?? ext.location ?? null;
    const externalDeathDate = parseDateToSort(ext.deathDate);
    const externalDeathPlace = ext.deathPlace ?? null;

    const matchResult = computeMatchScore(
      {
        localName,
        externalName,
        localBirthDate: person.birthDateSort,
        externalBirthDate,
        localBirthPlace: person.birthPlace,
        externalBirthPlace,
        localDeathDate: person.deathDateSort,
        externalDeathDate,
        localDeathPlace: person.deathPlace,
        externalDeathPlace,
      },
      config?.weights,
    );

    if (matchResult.score >= minScore) {
      scored.push({
        providerId: result.providerId,
        externalId: result.externalId,
        externalData: ext as Record<string, unknown>,
        matchScore: matchResult.score,
        components: matchResult.components,
        url: result.url,
        title: result.title,
      });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, maxHints);
}
