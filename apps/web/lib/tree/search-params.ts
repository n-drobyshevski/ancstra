import {
  createSearchParamsCache,
  parseAsArrayOf,
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

export type TreeSexValue = (typeof TREE_SEX_VALUES)[number];
export type TreeLivingValue = (typeof TREE_LIVING_VALUES)[number];
export type TreeDensity = (typeof TREE_DENSITY_VALUES)[number];
export type TreeSortKey = (typeof TREE_SORT_KEYS)[number];
export type TreeSortDir = (typeof TREE_SORT_DIRS)[number];
export type TreeHidableColumn = (typeof TREE_HIDABLE_COLUMNS)[number];

/** Empty arrays mean "all values pass" — same convention as personsParsers. */
export const treeTableParsers = {
  q: parseAsString.withDefault(''),
  sex: parseAsArrayOf(parseAsStringLiteral(TREE_SEX_VALUES)).withDefault([]),
  living: parseAsArrayOf(parseAsStringLiteral(TREE_LIVING_VALUES)).withDefault([]),
  sort: parseAsStringLiteral(TREE_SORT_KEYS).withDefault('name'),
  dir: parseAsStringLiteral(TREE_SORT_DIRS).withDefault('asc'),
  hide: parseAsArrayOf(parseAsStringLiteral(TREE_HIDABLE_COLUMNS)).withDefault([]),
};

export const treeTableCache = createSearchParamsCache(treeTableParsers);

export type TreeTableFilters = ReturnType<typeof treeTableCache.all>;
