import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  ProviderRegistry,
  MockProvider,
  NARAProvider,
  ChroniclingAmericaProvider,
  FamilySearchProvider,
  WikiTreeProvider,
  WebSearchProvider,
  type HealthStatus,
} from '@ancstra/research';

// Build registry with all known providers
function buildRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  if (process.env.NODE_ENV === 'development') {
    registry.register(new MockProvider());
  }
  registry.register(new NARAProvider());
  registry.register(new ChroniclingAmericaProvider());
  registry.register(new WikiTreeProvider());

  // FamilySearch needs a token — skip if not configured
  // FindAGrave and Geneanet are scraper-based — check worker instead

  return registry;
}

export async function GET() {
  try {
    await withAuth('tree:view');

    const registry = buildRegistry();
    const providers = registry.listAll();

    const results: Record<string, HealthStatus> = {};

    // Check all providers in parallel with 5s timeout each
    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const status = await provider.healthCheck();
          clearTimeout(timeout);
          results[provider.id] = status;
        } catch {
          results[provider.id] = 'down';
        }
      })
    );

    // Check Hono worker health separately
    const workerUrl = process.env.WORKER_URL;
    if (workerUrl) {
      try {
        const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(3000) });
        results['_worker'] = res.ok ? 'healthy' : 'down';
        // If worker is healthy, scraper-based providers are available
        if (res.ok) {
          results['findagrave'] = 'healthy';
          results['geneanet'] = 'healthy';
        } else {
          results['findagrave'] = 'down';
          results['geneanet'] = 'down';
        }
      } catch {
        results['_worker'] = 'down';
        results['findagrave'] = 'down';
        results['geneanet'] = 'down';
      }
    } else {
      results['_worker'] = 'unknown';
      results['findagrave'] = 'unknown';
      results['geneanet'] = 'unknown';
    }

    // Web search depends on config
    if (!process.env.SEARXNG_URL && !process.env.BRAVE_API_KEY) {
      results['web_search'] = 'unknown';
    }

    return NextResponse.json({ statuses: results, checkedAt: new Date().toISOString() });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/providers/health GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
