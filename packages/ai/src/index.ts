// Context
export { buildTreeContext } from './context/tree-context';
export type { TreeContext, PersonSummary } from './context/tree-context';

// Prompts
export { buildSystemPrompt } from './prompts/research-assistant';

// Client
export { createAnthropicClient, getModel } from './client';

// Core Tools
export { createSearchLocalTreeTool, executeSearchLocalTree } from './tools/search-local-tree';
export { createComputeRelationshipTool, executeComputeRelationship } from './tools/compute-relationship';
export { createAnalyzeTreeGapsTool, executeAnalyzeTreeGaps } from './tools/analyze-tree-gaps';
export { explainRecordTool } from './tools/explain-record';
export { createProposeRelationshipTool, executeProposeRelationship } from './tools/propose-relationship';
export { createSearchFamilySearchTool } from './tools/search-familysearch';

// Research Tools
export { createSearchWebTool, executeSearchWeb } from './tools/research/search-web';
export { createScrapeUrlTool } from './tools/research/scrape-url';
export { createGetResearchItemsTool } from './tools/research/get-research-items';
export { createExtractFactsTool, parseExtractedFacts, validateFactType } from './tools/research/extract-facts';
export { createDetectConflictsTool, executeDetectConflicts } from './tools/research/detect-conflicts';
export { createSuggestSearchesTool, executeSuggestSearches } from './tools/research/suggest-searches';
