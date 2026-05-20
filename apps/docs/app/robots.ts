import type { MetadataRoute } from 'next';

const BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_DOCS_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    console.error('[docs] NEXT_PUBLIC_DOCS_URL is not set — sitemap/canonical URLs will use localhost');
  }
  return url ?? 'http://localhost:3002';
})();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
