import { cacheLife } from 'next/cache';
import { loadMessages } from './load-messages';
import type { Locale } from './routing';

/**
 * Per-locale message lookup wrapped in 'use cache'. Messages are static JSON
 * baked at build time, so cacheLife('max') is appropriate — the cache only
 * needs to invalidate on deploy.
 *
 * Why this exists: under cacheComponents, awaiting next-intl's getMessages()
 * at layout-body level triggers the blocking-route warning because it reads
 * the request locale. Bypassing that helper with a cached, locale-keyed
 * loader keeps the layout prerenderable per locale.
 */
export async function getCachedMessages(locale: Locale) {
  'use cache';
  cacheLife('max');
  return loadMessages(locale);
}
