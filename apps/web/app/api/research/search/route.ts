import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  ProviderRegistry,
  MockProvider,
  NARAProvider,
  ChroniclingAmericaProvider,
} from '@ancstra/research';
import type { SearchRequest } from '@ancstra/research';

function buildRegistry(providerIds?: string[]): ProviderRegistry {
  const registry = new ProviderRegistry();

  // In dev mode, register MockProvider
  if (process.env.NODE_ENV === 'development') {
    registry.register(new MockProvider());
  }

  registry.register(new NARAProvider());
  registry.register(new ChroniclingAmericaProvider());

  // If specific providers requested, disable all others
  if (providerIds && providerIds.length > 0) {
    const requestedSet = new Set(providerIds);
    for (const p of registry.listAll()) {
      if (!requestedSet.has(p.id)) {
        registry.setEnabled(p.id, false);
      }
    }
  }

  return registry;
}

export async function GET(request: Request) {
  try {
    await withAuth('ai:research');

    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');
    const givenName = searchParams.get('givenName');
    const surname = searchParams.get('surname');
    const birthYear = searchParams.get('birthYear');
    const birthPlace = searchParams.get('birthPlace');
    const providers = searchParams.get('providers');
    const limit = searchParams.get('limit');

    // Must have at least one search criterion
    if (!q && !givenName && !surname) {
      return NextResponse.json(
        { error: 'At least one search parameter (q, givenName, or surname) is required' },
        { status: 400 }
      );
    }

    const searchRequest: SearchRequest = {
      freeText: q ?? undefined,
      givenName: givenName ?? undefined,
      surname: surname ?? undefined,
      birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
      birthPlace: birthPlace ?? undefined,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20,
    };

    const providerIds = providers
      ? providers.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const registry = buildRegistry(providerIds);
    const results = await registry.searchAll(searchRequest);

    return NextResponse.json({ results, count: results.length });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/search GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
