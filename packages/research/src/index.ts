export type {
  RecordType,
  SearchRequest,
  SearchResult,
  RecordDetail,
  HealthStatus,
  ProviderType,
  SearchProvider,
} from './providers/types.js';

export { ProviderRegistry } from './providers/registry.js';
export { RateLimiter } from './providers/rate-limiter.js';

export { MockProvider } from './providers/mock/provider.js';
export { NARAProvider } from './providers/nara/provider.js';
export { ChroniclingAmericaProvider } from './providers/chronicling-america/provider.js';
export { FamilySearchProvider } from './providers/familysearch/provider.js';
export { generateAuthUrl, exchangeCodeForTokens } from './providers/familysearch/auth.js';
export type { FSTokens, FSPerson, FSSearchResponse } from './providers/familysearch/types.js';

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
} from './items/queries.js';
export type { CreateResearchItemInput, ResearchItemFilters } from './items/queries.js';
