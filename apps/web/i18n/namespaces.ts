// Single source of truth for the message namespace list. Adding a namespace
// here + a JSON file under messages/<locale>/ is the only step required to
// expose new translation keys.
export const NAMESPACES = [
  'common',
  'errors',
  'error-pages',
  'navigation',
  'auth',
  'dashboard',
  'activity',
  'analytics',
  'persons',
  'tree',
  'settings',
  'admin',
  'rubric',
  'factsheet',
  'inbox',
] as const;

export type Namespace = (typeof NAMESPACES)[number];
