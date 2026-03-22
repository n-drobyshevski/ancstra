export type {
  RecordType,
  SearchRequest,
  SearchResult,
  RecordDetail,
  HealthStatus,
  ProviderType,
  SearchProvider,
} from './providers/types';

export { ProviderRegistry } from './providers/registry';
export { RateLimiter } from './providers/rate-limiter';

export { MockProvider } from './providers/mock/provider';
export { NARAProvider } from './providers/nara/provider';
export { ChroniclingAmericaProvider } from './providers/chronicling-america/provider';
export { FamilySearchProvider } from './providers/familysearch/provider';
export { generateAuthUrl, exchangeCodeForTokens } from './providers/familysearch/auth';
export type { FSTokens, FSPerson, FSSearchResponse } from './providers/familysearch/types';

// Research Items CRUD
export {
  createResearchItem,
  getResearchItem,
  listResearchItems,
  updateResearchItemStatus,
  updateResearchItemNotes,
  tagPersonToItem,
  untagPersonFromItem,
  deleteResearchItem,
} from './items/queries';
export type { CreateResearchItemInput, ResearchItemFilters } from './items/queries';

// Research Facts CRUD
export {
  createFact,
  getFactsByPerson,
  getFactsByResearchItem,
  updateFact,
  deleteFact,
} from './facts/queries';
export type { CreateFactInput, UpdateFactInput } from './facts/queries';

// Source Promotion
export { promoteToSource } from './facts/promote';
export type { PromoteInput, PromoteResult } from './facts/promote';

// URL Scraper
export type {
  ScrapeOptions,
  ScrapeResult,
  PageMetadata,
  ScreenshotOptions,
  ArchiveResult,
} from './scraper/types';
export { scrapeUrl } from './scraper/url-scraper';
export { captureScreenshot } from './scraper/screenshot';
export { archiveScrapeResult } from './scraper/archiver';

// Conflict Detection & Resolution
export {
  detectConflicts,
  resolveConflict,
  MULTI_VALUED_TYPES,
} from './facts/conflicts';
export type { ConflictPair } from './facts/conflicts';
