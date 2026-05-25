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

// FindAGrave provider uses cheerio (server-only) — import directly from
// '@ancstra/research/providers/findagrave/provider' when needed
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
  updateResearchItemNotes,
  updateResearchItemContent,
  tagPersonToItem,
  untagPersonFromItem,
  deleteResearchItem,
  listUnanchoredItems,
  getUnanchoredCount,
} from './items/queries';
export type { CreateResearchItemInput, ResearchItemFilters, UpdateResearchItemContentInput } from './items/queries';

// Research Facts CRUD
export {
  createFact,
  batchCreateFacts,
  getFactsByPerson,
  getFactsByResearchItem,
  getFactsByFactsheet,
  updateFact,
  deleteFact,
} from './facts/queries';
export type { CreateFactInput, UpdateFactInput } from './facts/queries';

// Scraper
export { scrapeUrl } from './scraper/url-scraper';
export { captureScreenshot } from './scraper/screenshot';
export { archiveScrapeResult } from './scraper/archiver';
export type {
  ScrapeOptions,
  ScrapeResult,
  PageMetadata,
  ScreenshotOptions,
  ArchiveResult,
} from './scraper/types';

// Conflict Detection & Resolution
export {
  detectConflicts,
  resolveConflict,
  MULTI_VALUED_TYPES,
} from './facts/conflicts';
export type { ConflictPair } from './facts/conflicts';

// Factsheets
export {
  createFactsheet,
  getFactsheet,
  listFactsheets,
  listFactsheetsWithCounts,
  updateFactsheet,
  deleteFactsheet,
  assignFactToFactsheet,
  removeFactFromFactsheet,
  createFactsheetLink,
  getFactsheetLinks,
  listAllFactsheetLinks,
  deleteFactsheetLink,
  getFactsheetCluster,
  suggestFactsheetLinks,
  detectFactsheetConflicts,
  resolveFactsheetConflict,
  isFactsheetPromotable,
  checkDuplicates,
  promoteSingleFactsheet,
  promoteFactsheetCluster,
  _promoteSingleFactsheetInTransaction,
  batchDismissFactsheets,
  batchLinkFactsheets,
  unmergeFactsheet,
  _unmergeFactsheetInTransaction,
  isPersonDirtySincePromote,
  FactsheetNotPromotedError,
  PersonDirtyError,
  computePatchDiff,
  applyPatchDiff,
  hashPatchDiff,
  LegacyPromotionNotPatchableError,
  computePendingEdgeChanges,
  softDetachFactsheet,
  getClusterMembership,
  getClusterMemberFactsheetIds,
  getClusterMembers,
  getClusterEdgeCount,
  ClusterDetachNotSupportedError,
  ClusterMemberUseClusterUnmergeError,
  LegacyClusterNotSupportedError,
  unmergeFactsheetCluster,
  FactsheetNotPromotedAsClusterError,
  _forceRepromoteClusterMemberInTransaction,
} from './factsheets';
export type {
  CreateFactsheetInput,
  UpdateFactsheetInput,
  FactsheetFilters,
  FactsheetWithCounts,
  CreateFactsheetLinkInput,
  FactsheetConflict,
  PromotabilityResult,
  DuplicateMatch,
  PromoteSingleInput,
  PromoteSingleResult,
  PromoteClusterResult,
  UnmergeFactsheetInput,
  UnmergeFactsheetResult,
  SoftDetachInput,
  SoftDetachResult,
  PatchDiff,
  FieldDelta,
  AddedEvent,
  ModifiedEvent,
  AddedCitation,
  PendingEdgeChanges,
  PendingEdgeChange,
  ClusterMembership,
  ClusterMember,
  UnmergeFactsheetClusterInput,
  UnmergeFactsheetClusterResult,
  ForceRepromoteClusterMemberInput,
  ForceRepromoteClusterMemberResult,
} from './factsheets';

// Scrape Jobs
export {
  createScrapeJob,
  getScrapeJob,
  updateScrapeJob,
  findActiveScrapeJob,
  deleteStaleJobs,
} from './items/scrape-jobs';
export type { CreateScrapeJobInput } from './items/scrape-jobs';

// ==================== AUDIT HELPERS ====================
export * from './audit';

// ==================== INBOX ====================
export * from './inbox';

// ==================== THREADS ====================
export {
  createThread,
  addEvent,
  getThreadTimeline,
  getThreadTimelinePage,
  listThreads,
  getThread,
  getPersonsTouchedByThread,
  getThreadsForPerson,
  pauseThread,
  resolveThread,
  abandonThread,
  resumeThread,
  updateThread,
  cascade,
} from './threads';
export type {
  ThreadStatus,
  ThreadEventType,
  CreateThreadInput,
  UpdateThreadInput,
  AddEventInput,
  ListThreadsFilters,
  ListPersonsTouchedOptions,
  ThreadTimelineCursor,
  ThreadTimelinePage,
  ThreadTouchSummary,
  CascadeInput,
  CascadeResult,
} from './threads';
