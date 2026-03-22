import type { SearchProvider, SearchRequest, SearchResult } from './types.js';

/**
 * Registry that manages search providers and dispatches federated queries.
 */
export class ProviderRegistry {
  private providers = new Map<string, SearchProvider>();
  private disabledIds = new Set<string>();

  /**
   * Register a search provider.
   */
  register(provider: SearchProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get a provider by id.
   */
  get(id: string): SearchProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Enable or disable a provider.
   */
  setEnabled(id: string, enabled: boolean): void {
    if (enabled) {
      this.disabledIds.delete(id);
    } else {
      this.disabledIds.add(id);
    }
  }

  /**
   * Check if a provider is enabled.
   */
  isEnabled(id: string): boolean {
    return !this.disabledIds.has(id);
  }

  /**
   * List all enabled providers.
   */
  listEnabled(): SearchProvider[] {
    return [...this.providers.values()].filter((p) => !this.disabledIds.has(p.id));
  }

  /**
   * List all registered providers regardless of enabled state.
   */
  listAll(): SearchProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Search across all enabled providers. Uses Promise.allSettled to
   * gracefully handle individual provider failures.
   */
  async searchAll(query: SearchRequest): Promise<SearchResult[]> {
    const enabled = this.listEnabled();

    const settled = await Promise.allSettled(
      enabled.map((provider) => provider.search(query)),
    );

    const results: SearchResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      }
      // Rejected promises are silently ignored (graceful degradation)
    }

    return results;
  }
}
