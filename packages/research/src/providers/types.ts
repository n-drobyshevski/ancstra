/**
 * Record types matching the source_type enum from the database schema.
 */
export type RecordType =
  | 'vital_record'
  | 'census'
  | 'military'
  | 'church'
  | 'newspaper'
  | 'immigration'
  | 'land'
  | 'probate'
  | 'cemetery'
  | 'photograph'
  | 'personal_knowledge'
  | 'correspondence'
  | 'book'
  | 'online'
  | 'other';

/**
 * Query structure for searching across providers.
 */
export interface SearchRequest {
  givenName?: string;
  surname?: string;
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  freeText?: string;
  recordType?: RecordType;
  dateRange?: { start: number; end: number };
  location?: string;
  limit?: number;
  offset?: number;
}

/**
 * A single result returned from a provider search.
 */
export interface SearchResult {
  providerId: string;
  externalId: string;
  title: string;
  snippet: string;
  url: string;
  recordType?: RecordType;
  relevanceScore?: number;
  extractedData?: {
    name?: string;
    birthDate?: string;
    deathDate?: string;
    location?: string;
  };
  thumbnailUrl?: string;
}

/**
 * Full record detail fetched from a provider.
 */
export interface RecordDetail {
  providerId: string;
  externalId: string;
  title: string;
  fullText: string;
  url: string;
  recordType?: RecordType;
  metadata: Record<string, string>;
}

/**
 * Health status of a provider.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/**
 * Provider type classification.
 */
export type ProviderType = 'api' | 'scraper' | 'web_search';

/**
 * Interface that all search providers must implement.
 */
export interface SearchProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;

  search(query: SearchRequest): Promise<SearchResult[]>;
  getRecord?(recordId: string): Promise<RecordDetail>;
  healthCheck(): Promise<HealthStatus>;
}
