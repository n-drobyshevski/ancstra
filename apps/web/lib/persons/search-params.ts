import {
  createSearchParamsCache,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  parseAsArrayOf,
  parseAsStringLiteral,
  parseAsNumberLiteral,
} from 'nuqs/server';

export const SEX_VALUES = ['M', 'F', 'U'] as const;
export const LIVING_VALUES = ['alive', 'deceased'] as const;
export const VALIDATION_VALUES = ['confirmed', 'proposed'] as const;
export const CITATIONS_VALUES = ['any', 'none', 'gte1', 'gte3'] as const;
export const PLACE_SCOPE_VALUES = ['birth', 'any'] as const;
export const SORT_KEYS = ['name', 'born', 'died', 'compl', 'edited', 'sources'] as const;
export const SORT_DIRS = ['asc', 'desc'] as const;
export const PAGE_SIZES = [20, 50, 100] as const;
export const HIDABLE_COLUMNS = ['sex', 'birthDate', 'deathDate', 'completeness', 'sourcesCount', 'validation', 'updatedAt'] as const;

export type HidableColumn = typeof HIDABLE_COLUMNS[number];

export const personsParsers = {
  q:            parseAsString.withDefault(''),
  sex:          parseAsArrayOf(parseAsStringLiteral(SEX_VALUES)).withDefault([]),
  living:       parseAsArrayOf(parseAsStringLiteral(LIVING_VALUES)).withDefault([]),
  validation:   parseAsArrayOf(parseAsStringLiteral(VALIDATION_VALUES)).withDefault([]),
  bornFrom:     parseAsInteger,
  bornTo:       parseAsInteger,
  diedFrom:     parseAsInteger,
  diedTo:       parseAsInteger,
  place:        parseAsString.withDefault(''),
  placeScope:   parseAsStringLiteral(PLACE_SCOPE_VALUES).withDefault('birth'),
  citations:    parseAsStringLiteral(CITATIONS_VALUES).withDefault('any'),
  hasProposals: parseAsBoolean.withDefault(false),
  complGte:     parseAsInteger,
  sort:         parseAsStringLiteral(SORT_KEYS).withDefault('edited'),
  dir:          parseAsStringLiteral(SORT_DIRS).withDefault('desc'),
  page:         parseAsInteger.withDefault(1),
  size:         parseAsNumberLiteral(PAGE_SIZES).withDefault(20),
  hide:         parseAsArrayOf(parseAsStringLiteral(HIDABLE_COLUMNS)).withDefault([]),
};

export const personsCache = createSearchParamsCache(personsParsers);

export type PersonsFilters = ReturnType<typeof personsCache.all>;
