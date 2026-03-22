import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { searchProviders } from '@ancstra/db';
import { sql } from 'drizzle-orm';

const DEFAULT_PROVIDERS = [
  {
    id: 'familysearch',
    name: 'FamilySearch',
    providerType: 'api' as const,
    baseUrl: 'https://www.familysearch.org',
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'nara',
    name: 'NARA',
    providerType: 'api' as const,
    baseUrl: 'https://catalog.archives.gov',
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'wikitree',
    name: 'WikiTree',
    providerType: 'api' as const,
    baseUrl: 'https://api.wikitree.com',
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'openarchives',
    name: 'OpenArchives',
    providerType: 'api' as const,
    baseUrl: 'https://www.openarch.nl',
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'chronicling_america',
    name: 'Chronicling America',
    providerType: 'api' as const,
    baseUrl: 'https://chroniclingamerica.loc.gov',
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'findagrave',
    name: 'Find A Grave',
    providerType: 'scraper' as const,
    baseUrl: 'https://www.findagrave.com',
    isEnabled: true,
    rateLimitRpm: 10,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'web_search',
    name: 'Web Search',
    providerType: 'web_search' as const,
    baseUrl: null,
    isEnabled: true,
    rateLimitRpm: 30,
    healthStatus: 'unknown' as const,
  },
  {
    id: 'geneanet',
    name: 'Geneanet',
    providerType: 'scraper' as const,
    baseUrl: 'https://www.geneanet.org',
    isEnabled: true,
    rateLimitRpm: 10,
    healthStatus: 'unknown' as const,
  },
];

export async function GET() {
  try {
    const { familyDb } = await withAuth('tree:view');

    // Check if table has data
    const [{ count }] = await familyDb
      .select({ count: sql<number>`count(*)` })
      .from(searchProviders)
      .all();

    // Seed defaults if empty
    if (count === 0) {
      for (const provider of DEFAULT_PROVIDERS) {
        await familyDb.insert(searchProviders).values(provider).run();
      }
    }

    const providers = await familyDb.select().from(searchProviders).all();

    return NextResponse.json({ providers });
  } catch (error) {
    return handleAuthError(error);
  }
}
