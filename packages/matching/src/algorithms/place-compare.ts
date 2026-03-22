export type PlaceCompareLevel =
  | 'exact'
  | 'county'
  | 'state'
  | 'country'
  | 'no_match'
  | 'unknown';

export interface PlaceCompareResult {
  level: PlaceCompareLevel;
  score: number;
}

/**
 * US state abbreviation -> full name mapping (lowercase).
 */
const US_STATE_ABBREVS: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas',
  ca: 'california', co: 'colorado', ct: 'connecticut', de: 'delaware',
  fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho',
  il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas',
  ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
  mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york',
  nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma',
  or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah',
  vt: 'vermont', va: 'virginia', wa: 'washington', wv: 'west virginia',
  wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
};

/**
 * Reverse mapping: full name -> abbreviation (for normalisation).
 */
const US_STATE_FULL_TO_ABBREV: Record<string, string> = {};
for (const [abbrev, full] of Object.entries(US_STATE_ABBREVS)) {
  US_STATE_FULL_TO_ABBREV[full] = abbrev;
}

/**
 * Normalise a single place part: lowercase, trim, and expand/collapse
 * US state abbreviations to a canonical form (the abbreviation).
 */
function normalisePart(part: string): string {
  const trimmed = part.trim().toLowerCase();
  // If it's a full state name, return the abbreviation
  if (US_STATE_FULL_TO_ABBREV[trimmed] != null) {
    return US_STATE_FULL_TO_ABBREV[trimmed];
  }
  return trimmed;
}

/**
 * Parse a place string into normalised parts, from most specific to least.
 * e.g. "Springfield, Sangamon, IL" -> ["springfield", "sangamon", "il"]
 */
function parsePlaceParts(place: string): string[] {
  return place.split(',').map(normalisePart).filter((p) => p.length > 0);
}

/**
 * Compare two place strings and return a tiered similarity score.
 *
 * Strategy: parse both into hierarchical parts (city, county/state, country).
 * Compare from most specific (full normalised match) down to least specific
 * (last part = broadest geographic region).
 *
 * Scoring:
 * - exact (1.0): all normalised parts match
 * - county (0.8): all parts except the first (city) match (3+ parts)
 * - state (0.5): last part matches (2-part places) or second-to-last matches
 * - country (0.3): only the last part matches (3+ parts)
 * - no_match (0.0): nothing matches
 * - unknown (0.5): one or both inputs are null
 */
export function comparePlaces(
  place1: string | null,
  place2: string | null,
): PlaceCompareResult {
  if (place1 == null || place2 == null) {
    return { level: 'unknown', score: 0.5 };
  }

  const parts1 = parsePlaceParts(place1);
  const parts2 = parsePlaceParts(place2);

  if (parts1.length === 0 || parts2.length === 0) {
    return { level: 'unknown', score: 0.5 };
  }

  // Check exact match (all normalised parts identical)
  const norm1 = parts1.join(', ');
  const norm2 = parts2.join(', ');
  if (norm1 === norm2) {
    return { level: 'exact', score: 1.0 };
  }

  // For hierarchical comparison, work from the end (broadest) to start (most specific)
  const maxParts = Math.max(parts1.length, parts2.length);

  // Check if last parts match (broadest region — state or country)
  const last1 = parts1[parts1.length - 1];
  const last2 = parts2[parts2.length - 1];
  const lastMatch = last1 === last2;

  if (!lastMatch) {
    return { level: 'no_match', score: 0.0 };
  }

  // Both have 3+ parts: check county-level match (parts except city)
  if (parts1.length >= 3 && parts2.length >= 3) {
    const tail1 = parts1.slice(1).join(', ');
    const tail2 = parts2.slice(1).join(', ');
    if (tail1 === tail2) {
      return { level: 'county', score: 0.8 };
    }
    // Only country (last part) matches
    return { level: 'country', score: 0.3 };
  }

  // Both have 2 parts: last part matches = same state
  if (parts1.length >= 2 && parts2.length >= 2) {
    return { level: 'state', score: 0.5 };
  }

  // Mixed lengths where last parts match — treat as state-level
  if (maxParts >= 2) {
    // One has more parts than the other but broadest region matches
    // e.g. "Springfield, IL, USA" vs "Boston, MA, USA" won't reach here
    // but "IL" vs "Springfield, IL" would
    return { level: 'state', score: 0.5 };
  }

  return { level: 'no_match', score: 0.0 };
}
