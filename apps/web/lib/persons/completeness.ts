import type { PersonListItem } from '@ancstra/shared';

export const COMPLETENESS_WEIGHTS = {
  name: 20,
  birth: 25,
  birthPlace: 20,
  death: 15,
  source: 20,
} as const;

export type CompletenessKey = keyof typeof COMPLETENESS_WEIGHTS;

export interface CompletenessBreakdownItem {
  key: CompletenessKey;
  label: string;
  weight: number;
  hit: boolean;
  /** False for the `death` item when the person is effective-living. */
  applicable: boolean;
}

export interface CompletenessBreakdown {
  items: CompletenessBreakdownItem[];
  /** Sum of weights for hit items (raw 0..100). */
  score: number;
  /** Sum of weights for applicable items (85 for effective-living, 100 otherwise). */
  maxScore: number;
  /** Displayed integer percentage 0..100, equal to round(score * 100 / maxScore). */
  total: number;
  /** Passthrough of person.isLiving — does NOT account for death-event override. */
  isLiving: boolean;
}

const LABELS: Record<CompletenessKey, string> = {
  name: 'Name',
  birth: 'Birth date',
  birthPlace: 'Birth place',
  death: 'Death date',
  source: 'Source',
};

const ORDER: readonly CompletenessKey[] = [
  'name',
  'birth',
  'birthPlace',
  'death',
  'source',
];

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.length > 0;
}

function deriveFlags(person: PersonListItem): Record<CompletenessKey, boolean> {
  return {
    // Both parts required to match the SQL formula:
    // CASE WHEN given_name <> '' AND surname <> '' THEN 1 ELSE 0 END
    name: nonEmpty(person.givenName) && nonEmpty(person.surname),
    birth: nonEmpty(person.birthDate),
    birthPlace: nonEmpty(person.birthPlace),
    death: nonEmpty(person.deathDate),
    source: (person.sourcesCount ?? 0) > 0,
  };
}

export function getCompletenessBreakdown(
  person: PersonListItem,
): CompletenessBreakdown {
  const fallback = deriveFlags(person);
  const flags: Record<CompletenessKey, boolean> = {
    name: person.hasName ?? fallback.name,
    birth: person.hasBirthEvent ?? fallback.birth,
    birthPlace: person.hasBirthPlace ?? fallback.birthPlace,
    death: person.hasDeathEvent ?? fallback.death,
    source: person.hasSource ?? fallback.source,
  };

  // Effective-living: living-flagged AND no death event (matches SQL logic and
  // the privacy-filter rule in docs/architecture/patterns/filter-for-privacy.ts).
  const effectiveLiving = person.isLiving && !flags.death;

  const items: CompletenessBreakdownItem[] = ORDER.map((key) => ({
    key,
    label: LABELS[key],
    weight: COMPLETENESS_WEIGHTS[key],
    hit: flags[key],
    applicable: key === 'death' ? !effectiveLiving : true,
  }));

  const score = items.reduce(
    (sum, it) => sum + (it.hit ? it.weight : 0),
    0,
  );
  const maxScore = items.reduce(
    (sum, it) => sum + (it.applicable ? it.weight : 0),
    0,
  );
  const total = maxScore === 0 ? 0 : Math.round((score * 100) / maxScore);

  return { items, score, maxScore, total, isLiving: person.isLiving };
}
