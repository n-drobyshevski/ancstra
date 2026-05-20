const DEFAULT_BASE = 'https://docs.ancstra.com';

/**
 * Build an absolute URL into the public docs site at the given locale.
 *
 * @example
 *   docsUrl('en')                       // https://docs.ancstra.com/en
 *   docsUrl('ru', 'getting-started')    // https://docs.ancstra.com/ru/getting-started
 *   docsUrl('en', 'research/threads')   // https://docs.ancstra.com/en/research/threads
 */
export function docsUrl(locale: string, path = ''): string {
  const base = (process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_BASE).replace(/\/+$/, '');
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return `${base}/${locale}${trimmed ? `/${trimmed}` : ''}`;
}
