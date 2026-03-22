const LIVING_THRESHOLD_YEARS = 100;

interface LivingCheckInput {
  isLiving: boolean;
  birthDateSort?: number;
  deathDateSort?: number;
}

export function isPresumablyLiving(person: LivingCheckInput): boolean {
  if (!person.isLiving) return false;
  if (person.deathDateSort && person.deathDateSort > 0) return false;
  if (!person.birthDateSort || person.birthDateSort === 0) return true;
  const currentYear = new Date().getFullYear();
  const birthYear = Math.floor(person.birthDateSort / 10000);
  return (currentYear - birthYear) < LIVING_THRESHOLD_YEARS;
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

export function redactForViewer<T extends RedactablePersonInput>(person: T): T {
  if (!isPresumablyLiving(person)) return person;
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
