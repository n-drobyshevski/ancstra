import { getPageMap } from 'nextra/page-map';
import type { MetadataRoute } from 'next';
import type { PageMapItem } from 'nextra';

const BASE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_DOCS_URL;
  if (explicit) return explicit;
  const vercelProd = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  if (process.env.NODE_ENV === 'production') {
    console.error('[docs] NEXT_PUBLIC_DOCS_URL is not set — sitemap/canonical URLs will use localhost');
  }
  return 'http://localhost:3002';
})();
const LOCALES = ['en', 'ru'] as const;

function collectRoutes(items: PageMapItem[], acc: Set<string>): void {
  for (const item of items) {
    if ('route' in item && item.route) {
      const stripped = item.route.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';
      acc.add(stripped);
    }
    if ('children' in item && item.children) {
      collectRoutes(item.children, acc);
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const enMap = await getPageMap('/en');
  const routes = new Set<string>();
  collectRoutes(enMap, routes);

  const entries: MetadataRoute.Sitemap = [];
  for (const route of routes) {
    for (const locale of LOCALES) {
      const url = `${BASE_URL}/${locale}${route === '/' ? '' : route}`;
      entries.push({
        url,
        lastModified: new Date(),
        alternates: {
          languages: {
            en: `${BASE_URL}/en${route === '/' ? '' : route}`,
            ru: `${BASE_URL}/ru${route === '/' ? '' : route}`,
            'x-default': `${BASE_URL}/en${route === '/' ? '' : route}`,
          },
        },
      });
    }
  }
  return entries;
}
