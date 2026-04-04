import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ancstra.com';
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
    { url: `${base}/signup`, lastModified: new Date() },
  ];
}
