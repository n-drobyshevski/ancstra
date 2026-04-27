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
}

export interface CompletenessBreakdown {
  items: CompletenessBreakdownItem[];
  total: number;
  isLiving: boolean;
}

const LABELS: Record<CompletenessKey, string> = {
  name: 'Name',
  birth: 'Birth date',
  birthPlace: 'Birth place',
  death: 'Death date',
  source: 'Source',
};

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

  const order: CompletenessKey[] = ['name', 'birth', 'birthPlace', 'death', 'source'];
  const items: CompletenessBreakdownItem[] = order.map((key) => ({
    key,
    label: LABELS[key],
    weight: COMPLETENESS_WEIGHTS[key],
    hit: flags[key],
  }));

  const total = items.reduce((sum, it) => sum + (it.hit ? it.weight : 0), 0);
  return { items, total, isLiving: person.isLiving };
}
