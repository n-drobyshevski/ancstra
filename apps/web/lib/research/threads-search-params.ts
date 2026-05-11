import {
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

// URL state shared between the list page and the preview pane. Keeping
// all of it in one URL means a refresh — or sharing the link — restores
// the same view, status filter, sort order, and preview selection.

export const THREAD_STATUS_FILTER = ['all', 'active', 'paused', 'resolved', 'abandoned'] as const;
export type ThreadStatusFilter = (typeof THREAD_STATUS_FILTER)[number];

export const THREAD_SORT_KEYS = ['updated', 'created', 'title'] as const;
export type ThreadSortKey = (typeof THREAD_SORT_KEYS)[number];

export const threadsParsers = {
  status:   parseAsStringLiteral(THREAD_STATUS_FILTER).withDefault('all'),
  sort:     parseAsStringLiteral(THREAD_SORT_KEYS).withDefault('updated'),
  q:        parseAsString.withDefault(''),
  selected: parseAsString.withDefault(''),
};
