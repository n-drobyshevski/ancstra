import type { MetadataRoute } from 'next';

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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
