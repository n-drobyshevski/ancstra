/** Default threshold preserved for callers that haven't been migrated to a
 * family-configured value. Matches the historical project-wide constant. */
export const DEFAULT_LIVING_THRESHOLD_YEARS = 100;

interface LivingCheckInput {
  isLiving: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
}

/**
 * Decides whether a person should be treated as "presumed living" — used by
 * viewer redaction. The threshold is configurable per-family (Phase 4 of
 * role-specific settings, 2026-05-08); passing nothing falls back to the
 * historical default of 100 years to preserve behaviour for any caller not
 * yet wired to read the family-scoped value.
 */
export function isPresumablyLiving(
  person: LivingCheckInput,
  thresholdYears: number = DEFAULT_LIVING_THRESHOLD_YEARS,
): boolean {
  if (!person.isLiving) return false;
  if (person.deathDateSort && person.deathDateSort > 0) return false;
  if (!person.birthDateSort || person.birthDateSort === 0) return true;
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birthDateSort / 10000);
  return (currentYear - birthYear) < thresholdYears;
}

interface RedactablePersonInput {
  id: string;
  givenName: string;
  surname: string;
  sex: string;
  isLiving: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
  notes?: string | null;
  events?: unknown[];
  mediaIds?: string[];
  [key: string]: unknown;
}

export function redactForViewer<T extends RedactablePersonInput>(
  person: T,
  thresholdYears: number = DEFAULT_LIVING_THRESHOLD_YEARS,
): T {
  if (!isPresumablyLiving(person, thresholdYears)) return person;
  return {
    ...person,
    givenName: 'Living',
    surname: '',
    prefix: null,
    suffix: null,
    nickname: null,
    notes: null,
    events: [],
    mediaIds: [],
    birthDateSort: undefined,
    deathDateSort: undefined,
  };
}
