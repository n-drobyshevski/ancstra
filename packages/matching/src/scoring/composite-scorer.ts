import { jaroWinkler } from '../algorithms/jaro-winkler';
import { compareDates } from '../algorithms/date-compare';
import { comparePlaces } from '../algorithms/place-compare';

export interface MatchInput {
  localName: string;
  externalName: string;
  localBirthDate: number | null;
  externalBirthDate: number | null;
  localBirthPlace: string | null;
  externalBirthPlace: string | null;
  localDeathDate: number | null;
  externalDeathDate: number | null;
  localDeathPlace?: string | null;
  externalDeathPlace?: string | null;
}

export interface MatchWeights {
  name: number;
  birthDate: number;
  birthPlace: number;
  deathDate: number;
  deathPlace: number;
}

export interface MatchResult {
  score: number;
  components: Record<string, number>;
  weights: MatchWeights;
}

export const defaultWeights: MatchWeights = {
  name: 0.35,
  birthDate: 0.25,
  birthPlace: 0.20,
  deathDate: 0.10,
  deathPlace: 0.10,
};

/**
 * Compare two names by splitting into given + surname parts and
 * computing Jaro-Winkler on each, then averaging.
 */
function compareName(name1: string, name2: string): number {
  const parts1 = name1.trim().split(/\s+/);
  const parts2 = name2.trim().split(/\s+/);

  if (parts1.length === 0 || parts2.length === 0) return 0;

  // Last part = surname, everything before = given name(s)
  const surname1 = parts1[parts1.length - 1];
  const surname2 = parts2[parts2.length - 1];
  const given1 = parts1.slice(0, -1).join(' ');
  const given2 = parts2.slice(0, -1).join(' ');

  const surnameScore = jaroWinkler(surname1, surname2);

  // If either has no given name, just use surname
  if (!given1 || !given2) return surnameScore;

  const givenScore = jaroWinkler(given1, given2);
  return (givenScore + surnameScore) / 2;
}

/**
 * Compute a composite match score between a local person and an
 * external candidate, using configurable weights.
 *
 * Default weights: name 35%, birthDate 25%, birthPlace 20%,
 * deathDate 10%, deathPlace 10%.
 */
export function computeMatchScore(
  input: MatchInput,
  weights: MatchWeights = defaultWeights,
): MatchResult {
  const nameScore = compareName(input.localName, input.externalName);
  const birthDateScore = compareDates(input.localBirthDate, input.externalBirthDate).score;
  const birthPlaceScore = comparePlaces(input.localBirthPlace, input.externalBirthPlace).score;
  const deathDateScore = compareDates(input.localDeathDate, input.externalDeathDate).score;
  const deathPlaceScore = comparePlaces(
    input.localDeathPlace ?? null,
    input.externalDeathPlace ?? null,
  ).score;

  const score =
    nameScore * weights.name +
    birthDateScore * weights.birthDate +
    birthPlaceScore * weights.birthPlace +
    deathDateScore * weights.deathDate +
    deathPlaceScore * weights.deathPlace;

  return {
    score,
    components: {
      name: nameScore,
      birthDate: birthDateScore,
      birthPlace: birthPlaceScore,
      deathDate: deathDateScore,
      deathPlace: deathPlaceScore,
    },
    weights,
  };
}
