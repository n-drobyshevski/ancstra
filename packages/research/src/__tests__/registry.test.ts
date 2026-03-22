import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../providers/registry.js';
import type { SearchProvider, SearchRequest, SearchResult, HealthStatus } from '../providers/types.js';

class FakeProvider implements SearchProvider {
  readonly id: string;
  readonly name: string;
  readonly type = 'api' as const;

  private results: SearchResult[];
  private shouldFail: boolean;

  constructor(id: string, results: SearchResult[] = [], shouldFail = false) {
    this.id = id;
    this.name = `Fake ${id}`;
    this.results = results;
    this.shouldFail = shouldFail;
  }

  async search(_query: SearchRequest): Promise<SearchResult[]> {
    if (this.shouldFail) {
      throw new Error(`Provider ${this.id} failed`);
    }
    return this.results;
  }

  async healthCheck(): Promise<HealthStatus> {
    return 'healthy';
  }
}

function makeResult(providerId: string, externalId: string): SearchResult {
  return {
    providerId,
    externalId,
    title: `Result ${externalId}`,
    snippet: 'A test result',
    url: `https://example.com/${externalId}`,
  };
}

describe('ProviderRegistry', () => {
  it('registers and retrieves a provider', () => {
    const registry = new ProviderRegistry();
    const provider = new FakeProvider('test-1');

    registry.register(provider);

    expect(registry.get('test-1')).toBe(provider);
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('lists all providers', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('a'));
    registry.register(new FakeProvider('b'));

    const all = registry.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('lists only enabled providers by default', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('a'));
    registry.register(new FakeProvider('b'));

    // All should be enabled by default
    expect(registry.listEnabled()).toHaveLength(2);
    expect(registry.isEnabled('a')).toBe(true);
  });

  it('disables and re-enables a provider', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('a'));
    registry.register(new FakeProvider('b'));

    registry.setEnabled('a', false);

    expect(registry.isEnabled('a')).toBe(false);
    expect(registry.listEnabled()).toHaveLength(1);
    expect(registry.listEnabled()[0].id).toBe('b');

    registry.setEnabled('a', true);
    expect(registry.isEnabled('a')).toBe(true);
    expect(registry.listEnabled()).toHaveLength(2);
  });

  it('searchAll aggregates results from all enabled providers', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('p1', [makeResult('p1', 'r1')]));
    registry.register(new FakeProvider('p2', [makeResult('p2', 'r2'), makeResult('p2', 'r3')]));

    const results = await registry.searchAll({ surname: 'Smith' });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.externalId)).toEqual(['r1', 'r2', 'r3']);
  });

  it('searchAll skips disabled providers', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('p1', [makeResult('p1', 'r1')]));
    registry.register(new FakeProvider('p2', [makeResult('p2', 'r2')]));

    registry.setEnabled('p2', false);

    const results = await registry.searchAll({ surname: 'Smith' });
    expect(results).toHaveLength(1);
    expect(results[0].providerId).toBe('p1');
  });

  it('searchAll gracefully handles provider failures', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('good', [makeResult('good', 'r1')]));
    registry.register(new FakeProvider('bad', [], true)); // will throw

    const results = await registry.searchAll({ surname: 'Smith' });

    // Should still get results from the good provider
    expect(results).toHaveLength(1);
    expect(results[0].providerId).toBe('good');
  });
});
