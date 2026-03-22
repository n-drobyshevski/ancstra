import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, searchProviders } from '@ancstra/db';
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createDb();

  // Check if table has data
  const [{ count }] = db
    .select({ count: sql<number>`count(*)` })
    .from(searchProviders)
    .all();

  // Seed defaults if empty
  if (count === 0) {
    for (const provider of DEFAULT_PROVIDERS) {
      db.insert(searchProviders).values(provider).run();
    }
  }

  const providers = db.select().from(searchProviders).all();

  return NextResponse.json({ providers });
}
