import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

export const TREE_SEX_VALUES = ['M', 'F', 'U'] as const;
export const TREE_LIVING_VALUES = ['living', 'deceased'] as const;
export const TREE_SORT_KEYS = [
  'name',
  'lifespan',
  'sex',
  'children',
] as const;
export const TREE_SORT_DIRS = ['asc', 'desc'] as const;
export const TREE_DENSITY_VALUES = ['compact', 'comfortable', 'spacious'] as const;
export const TREE_HIDABLE_COLUMNS = [
  'sex',
  'status',
  'completeness',
  'parents',
  'spouses',
  'children',
] as const;
export const TREE_PAGE_SIZES = [50, 100, 200] as const;
export const TREE_VIEW_VALUES = ['canvas', 'table'] as const;
export const TREE_TOPOLOGY_MODES = ['all', 'ancestors', 'descendants'] as const;
export const TREE_VALIDATION_VALUES = ['confirmed', 'proposed'] as const;
export const TREE_CITATIONS_VALUES = ['any', 'none', 'gte1', 'gte3'] as const;
export const TREE_PLACE_SCOPES = ['birth', 'any'] as const;

export type TreeSexValue = (typeof TREE_SEX_VALUES)[number];
export type TreeLivingValue = (typeof TREE_LIVING_VALUES)[number];
export type TreeDensity = (typeof TREE_DENSITY_VALUES)[number];
export type TreeSortKey = (typeof TREE_SORT_KEYS)[number];
export type TreeSortDir = (typeof TREE_SORT_DIRS)[number];
export type TreeHidableColumn = (typeof TREE_HIDABLE_COLUMNS)[number];
export type TreeView = (typeof TREE_VIEW_VALUES)[number];
export type TreeTopologyMode = (typeof TREE_TOPOLOGY_MODES)[number];

/** Empty arrays mean "all values pass" — same convention as personsParsers. */
export const treeTableParsers = {
  q: parseAsString.withDefault(''),
  sex: parseAsArrayOf(parseAsStringLiteral(TREE_SEX_VALUES)).withDefault([]),
  living: parseAsArrayOf(parseAsStringLiteral(TREE_LIVING_VALUES)).withDefault([]),
  sort: parseAsStringLiteral(TREE_SORT_KEYS).withDefault('name'),
  dir: parseAsStringLiteral(TREE_SORT_DIRS).withDefault('asc'),
  hide: parseAsArrayOf(parseAsStringLiteral(TREE_HIDABLE_COLUMNS)).withDefault([]),
  page: parseAsInteger.withDefault(1),
  size: parseAsNumberLiteral(TREE_PAGE_SIZES).withDefault(100),
  topologyAnchor: parseAsString.withDefault(''),
  topologyMode: parseAsStringLiteral(TREE_TOPOLOGY_MODES).withDefault('all'),
  // Filter parity with /persons (data-layer only — UI is a follow-up).
  validation: parseAsArrayOf(parseAsStringLiteral(TREE_VALIDATION_VALUES)).withDefault([]),
  bornFrom: parseAsInteger,
  bornTo: parseAsInteger,
  diedFrom: parseAsInteger,
  diedTo: parseAsInteger,
  place: parseAsString.withDefault(''),
  placeScope: parseAsStringLiteral(TREE_PLACE_SCOPES).withDefault('birth'),
  citations: parseAsStringLiteral(TREE_CITATIONS_VALUES).withDefault('any'),
  hasProposals: parseAsBoolean.withDefault(false),
  complGte: parseAsInteger,
};

export const treeTableCache = createSearchParamsCache(treeTableParsers);

export type TreeTableFilters = ReturnType<typeof treeTableCache.all>;
