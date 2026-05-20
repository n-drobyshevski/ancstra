import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Block crawlers entirely on the dev staging deployment so it doesn't end
  // up in search results. SENTRY_ENVIRONMENT is set per Vercel scope; on
  // the dev branch's Preview env vars it's "development".
  if (process.env.SENTRY_ENVIRONMENT === 'development') {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/persons', '/tree', '/research', '/settings', '/activity'],
    },
  };
}
