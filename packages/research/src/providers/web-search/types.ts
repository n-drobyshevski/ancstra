/**
 * A single result from a web search engine.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Adapter interface for pluggable web search backends.
 */
export interface WebSearchAdapter {
  readonly name: string;

  /**
   * Run a search query and return results.
   */
  search(query: string, limit?: number): Promise<WebSearchResult[]>;

  /**
   * Check if the search backend is reachable.
   */
  healthCheck(): Promise<boolean>;
}
