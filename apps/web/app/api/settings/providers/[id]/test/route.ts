import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { searchProviders } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import {
  NARAProvider,
  ChroniclingAmericaProvider,
  WikiTreeProvider,
  type HealthStatus,
} from '@ancstra/research';

function getProviderInstance(providerId: string) {
  switch (providerId) {
    case 'nara':
      return new NARAProvider();
    case 'chronicling_america':
      return new ChroniclingAmericaProvider();
    case 'wikitree':
      return new WikiTreeProvider();
    default:
      return null;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('settings:manage');

    const { id } = await params;

    const [provider] = familyDb
      .select()
      .from(searchProviders)
      .where(eq(searchProviders.id, id))
      .all();

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // For scraper-based providers, check worker health instead
    if (provider.providerType === 'scraper') {
      const workerUrl = process.env.WORKER_URL;
      if (!workerUrl) {
        return NextResponse.json({
          status: 'unknown' as HealthStatus,
          responseTimeMs: 0,
          message: 'Worker URL not configured',
        });
      }

      const start = Date.now();
      try {
        const res = await fetch(`${workerUrl}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const responseTimeMs = Date.now() - start;
        const status: HealthStatus = res.ok ? 'healthy' : 'down';

        familyDb.update(searchProviders)
          .set({ healthStatus: status, lastHealthCheck: new Date().toISOString() })
          .where(eq(searchProviders.id, id))
          .run();

        return NextResponse.json({ status, responseTimeMs });
      } catch {
        const responseTimeMs = Date.now() - start;
        familyDb.update(searchProviders)
          .set({ healthStatus: 'down', lastHealthCheck: new Date().toISOString() })
          .where(eq(searchProviders.id, id))
          .run();
        return NextResponse.json({ status: 'down' as HealthStatus, responseTimeMs });
      }
    }

    // For web_search, check configured engine
    if (provider.providerType === 'web_search') {
      const config = provider.config ? JSON.parse(provider.config) : {};
      const searxngUrl = config.baseUrl || process.env.SEARXNG_URL;
      const braveKey = config.apiKey || process.env.BRAVE_API_KEY;

      if (!searxngUrl && !braveKey) {
        return NextResponse.json({
          status: 'unknown' as HealthStatus,
          responseTimeMs: 0,
          message: 'No search engine configured',
        });
      }

      const start = Date.now();
      try {
        const testUrl = searxngUrl
          ? `${searxngUrl}/search?q=test&format=json`
          : 'https://api.search.brave.com/res/v1/web/search?q=test';
        const headers: Record<string, string> = {};
        if (braveKey && !searxngUrl) {
          headers['X-Subscription-Token'] = braveKey;
        }

        await fetch(testUrl, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        const responseTimeMs = Date.now() - start;

        familyDb.update(searchProviders)
          .set({ healthStatus: 'healthy', lastHealthCheck: new Date().toISOString() })
          .where(eq(searchProviders.id, id))
          .run();

        return NextResponse.json({ status: 'healthy' as HealthStatus, responseTimeMs });
      } catch {
        const responseTimeMs = Date.now() - start;
        familyDb.update(searchProviders)
          .set({ healthStatus: 'down', lastHealthCheck: new Date().toISOString() })
          .where(eq(searchProviders.id, id))
          .run();
        return NextResponse.json({ status: 'down' as HealthStatus, responseTimeMs });
      }
    }

    // For API-based providers with a provider class
    const instance = getProviderInstance(id);
    if (!instance) {
      // Provider exists in DB but no implementation yet (familysearch, openarchives)
      // Try a simple fetch to baseUrl
      if (provider.baseUrl) {
        const start = Date.now();
        try {
          await fetch(provider.baseUrl, { signal: AbortSignal.timeout(5000) });
          const responseTimeMs = Date.now() - start;
          familyDb.update(searchProviders)
            .set({ healthStatus: 'healthy', lastHealthCheck: new Date().toISOString() })
            .where(eq(searchProviders.id, id))
            .run();
          return NextResponse.json({ status: 'healthy' as HealthStatus, responseTimeMs });
        } catch {
          const responseTimeMs = Date.now() - start;
          familyDb.update(searchProviders)
            .set({ healthStatus: 'down', lastHealthCheck: new Date().toISOString() })
            .where(eq(searchProviders.id, id))
            .run();
          return NextResponse.json({ status: 'down' as HealthStatus, responseTimeMs });
        }
      }
      return NextResponse.json({
        status: 'unknown' as HealthStatus,
        responseTimeMs: 0,
        message: 'No health check available',
      });
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const status = await instance.healthCheck();
      clearTimeout(timeout);
      const responseTimeMs = Date.now() - start;

      familyDb.update(searchProviders)
        .set({ healthStatus: status, lastHealthCheck: new Date().toISOString() })
        .where(eq(searchProviders.id, id))
        .run();

      return NextResponse.json({ status, responseTimeMs });
    } catch {
      const responseTimeMs = Date.now() - start;
      familyDb.update(searchProviders)
        .set({ healthStatus: 'down', lastHealthCheck: new Date().toISOString() })
        .where(eq(searchProviders.id, id))
        .run();
      return NextResponse.json({ status: 'down' as HealthStatus, responseTimeMs });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
