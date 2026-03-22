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

export { FindAGraveProvider } from './providers/findagrave/provider';
export { parseMemorialPage } from './providers/findagrave/parser';
export type { MemorialData, FamilyLink } from './providers/findagrave/parser';

export { WikiTreeProvider } from './providers/wikitree/provider';
export type { WikiTreePerson, WikiTreeSearchResponse } from './providers/wikitree/types';

export { WebSearchProvider, createWebSearchProvider } from './providers/web-search/provider';
export { SearXNGAdapter } from './providers/web-search/searxng';
export { BraveSearchAdapter } from './providers/web-search/brave';
export type { WebSearchAdapter, WebSearchResult } from './providers/web-search/types';

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
export { RobotsChecker } from './scraper/robots';
export { DomainRateLimiter } from './scraper/rate-limiter-domain';

// Conflict Detection & Resolution
export {
  detectConflicts,
  resolveConflict,
  MULTI_VALUED_TYPES,
} from './facts/conflicts';
export type { ConflictPair } from './facts/conflicts';
