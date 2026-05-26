import { sqliteTable, text, integer, real, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { persons, sources, sourceCitations } from './family-schema';
import { RELATIONSHIP_TYPES, CONFIDENCE_BANDS, PROVENANCE_VALUES, RESEARCH_ITEM_STATUSES } from './vocab';

// ==================== SEARCH PROVIDERS ====================
export const searchProviders = sqliteTable('search_providers', {
  id: text('id').primaryKey(), // user-assigned like 'nara'
  name: text('name').notNull(),
  providerType: text('provider_type', {
    enum: ['api', 'scraper', 'web_search'],
  }).notNull(),
  baseUrl: text('base_url'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  config: text('config'), // JSON blob
  rateLimitRpm: integer('rate_limit_rpm').notNull().default(30),
  healthStatus: text('health_status', {
    enum: ['healthy', 'degraded', 'down', 'unknown'],
  }).notNull().default('unknown'),
  lastHealthCheck: text('last_health_check'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== RESEARCH ITEMS ====================
export const researchItems = sqliteTable('research_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  url: text('url'),
  snippet: text('snippet'),
  fullText: text('full_text'),
  notes: text('notes'),
  archivedHtmlPath: text('archived_html_path'),
  screenshotPath: text('screenshot_path'),
  archivedAt: text('archived_at'),
  providerId: text('provider_id').references(() => searchProviders.id),
  providerRecordId: text('provider_record_id'),
  discoveryMethod: text('discovery_method', {
    enum: ['search', 'scrape', 'paste_url', 'paste_text', 'ai_suggestion'],
  }).notNull(),
  searchQuery: text('search_query'),
  status: text('status', {
    enum: RESEARCH_ITEM_STATUSES,
  }).notNull().default('collected'),
  // @deprecated — column retained for backward compat, no longer written
  promotedSourceId: text('promoted_source_id').references(() => sources.id),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_research_items_status').on(table.status),
  index('idx_research_items_provider').on(table.providerId),
  index('idx_research_items_created_by').on(table.createdBy),
  index('idx_research_items_created_at').on(table.createdAt),
]);

// ==================== RESEARCH ITEM <-> PERSONS (M:N) ====================
export const researchItemPersons = sqliteTable('research_item_persons', {
  researchItemId: text('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.researchItemId, table.personId] }),
  index('idx_research_item_persons_person').on(table.personId),
]);

// ==================== FACTSHEETS (Working Hypotheses) ====================
export const factsheets = sqliteTable('factsheets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  entityType: text('entity_type', {
    enum: ['person', 'couple', 'family_unit'],
  }).notNull().default('person'),
  status: text('status', {
    enum: ['draft', 'ready', 'promoted', 'merged', 'dismissed'],
  }).notNull().default('draft'),
  notes: text('notes'),
  promotedPersonId: text('promoted_person_id').references(() => persons.id),
  promotedAt: text('promoted_at'),
  // Bundle D 2026-05-25: cluster identity stamp written by promoteFactsheetCluster.
  // NULL for solo-promoted factsheets and unpromoted factsheets.
  // Shared across all factsheets that were promoted as one cluster — used by
  // getClusterMembership for precise (non-heuristic) cluster detection.
  // See Bundle D spec §2.1.
  clusterPromotionId: text('cluster_promotion_id'),
  createdThreadId: text('created_thread_id'),  // FK to research_threads (added below)
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_factsheets_status').on(table.status),
  index('idx_factsheets_created_by').on(table.createdBy),
  index('idx_factsheets_promoted_person').on(table.promotedPersonId),
  index('idx_factsheets_thread').on(table.createdThreadId),
  // Bundle D 2026-05-25: partial index — only non-NULL cluster_promotion_id rows.
  // Cluster lookup (getClusterMembership / getClusterMembers) is by cluster_promotion_id.
  index('idx_factsheets_cluster_promotion_id')
    .on(table.clusterPromotionId)
    .where(sql`${table.clusterPromotionId} IS NOT NULL`),
]);

// ==================== FACTSHEET LINKS (Relationship Graph) ====================
// Bundle A 2026-05-23: relationshipType now includes 'partner'; confidence now
// includes 'unknown'; new orthogonal `contested` boolean. Enums sourced from
// `./vocab` (single source of truth — see vocab-consistency.test.ts).
export const factsheetLinks = sqliteTable('factsheet_links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  fromFactsheetId: text('from_factsheet_id').notNull().references(() => factsheets.id, { onDelete: 'cascade' }),
  toFactsheetId: text('to_factsheet_id').notNull().references(() => factsheets.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type', {
    enum: RELATIONSHIP_TYPES,
  }).notNull(),
  sourceFactId: text('source_fact_id'),  // FK to research_facts (defined below)
  // Directionality: for parent_child, from=parent, to=child
  // For spouse/sibling/partner, order is arbitrary
  confidence: text('confidence', {
    enum: CONFIDENCE_BANDS,
  }).notNull().default('medium'),
  // Orthogonal to confidence — set true when the same relationship is
  // asserted with conflicting facts (e.g. two different mothers proposed for
  // the same child). UI surfaces this as a warning badge on the edge.
  contested: integer('contested', { mode: 'boolean' }).notNull().default(false),
  // Persisted React Flow handle attachment (top|right|bottom|left) so the
  // edge re-renders on the side the user dragged to, not the default top.
  sourceHandle: text('source_handle'),
  targetHandle: text('target_handle'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_factsheet_links_from').on(table.fromFactsheetId),
  index('idx_factsheet_links_to').on(table.toFactsheetId),
  unique('uq_factsheet_links').on(table.fromFactsheetId, table.toFactsheetId, table.relationshipType),
]);

// ==================== RESEARCH FACTS ====================
// Bundle A 2026-05-23: confidence now drawn from CONFIDENCE_BANDS (drops the
// legacy 'disputed' value, gains 'unknown'); orthogonal `contested` boolean
// supersedes the disputed-as-confidence-level pattern; new `provenance` enum
// captures how the fact was sourced (cited / derived / user_inference);
// `fact_type` enum gains 'sibling_name' for the AI proposeRelationship tool
// path. All enums sourced from `./vocab` — no CHECK constraints at DB level;
// TS is the single source of truth (see vocab-consistency.test.ts).
export const researchFacts = sqliteTable('research_facts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').references(() => persons.id, { onDelete: 'cascade' }),
  factType: text('fact_type', {
    enum: [
      'name', 'birth_date', 'birth_place', 'death_date', 'death_place',
      'marriage_date', 'marriage_place', 'residence', 'occupation',
      'immigration', 'military_service', 'religion', 'ethnicity',
      'parent_name', 'spouse_name', 'sibling_name', 'child_name', 'other',
    ],
  }).notNull(),
  factValue: text('fact_value').notNull(),
  factDateSort: integer('fact_date_sort'),
  researchItemId: text('research_item_id').references(() => researchItems.id),
  sourceCitationId: text('source_citation_id').references(() => sourceCitations.id),
  factsheetId: text('factsheet_id').references(() => factsheets.id),
  accepted: integer('accepted', { mode: 'boolean' }),  // null=unresolved, true=accepted, false=rejected
  confidence: text('confidence', {
    enum: CONFIDENCE_BANDS,
  }).notNull().default('medium'),
  contested: integer('contested', { mode: 'boolean' }).notNull().default(false),
  provenance: text('provenance', {
    enum: PROVENANCE_VALUES,
  }).notNull().default('derived'),
  extractionMethod: text('extraction_method', {
    enum: ['manual', 'ai_extracted', 'ocr_extracted'],
  }).notNull().default('manual'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_research_facts_person').on(table.personId),
  index('idx_research_facts_person_type').on(table.personId, table.factType),
  index('idx_research_facts_factsheet').on(table.factsheetId),
]);

// ==================== RESEARCH CANVAS POSITIONS ====================
export const researchCanvasPositions = sqliteTable('research_canvas_positions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  nodeType: text('node_type', {
    enum: ['research_item', 'source', 'note', 'conflict'],
  }).notNull(),
  nodeId: text('node_id').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
}, (table) => [
  unique('uq_canvas_person_node').on(table.personId, table.nodeType, table.nodeId),
  index('idx_canvas_positions_person').on(table.personId),
]);

// ==================== SCRAPE JOBS ====================
export const scrapeJobs = sqliteTable('scrape_jobs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => researchItems.id),
  url: text('url').notNull(),
  status: text('status').notNull().default('pending'),
  fullText: text('full_text'),
  title: text('title'),
  snippet: text('snippet'),
  error: text('error'),
  method: text('method'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
}, (table) => [
  index('idx_scrape_jobs_item').on(table.itemId),
  index('idx_scrape_jobs_status').on(table.status),
]);

// ==================== RESEARCH THREADS (Journey Overlay) ====================
export const researchThreads = sqliteTable('research_threads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['active', 'paused', 'resolved', 'abandoned'],
  }).notNull().default('active'),
  seedPersonId: text('seed_person_id').references(() => persons.id, { onDelete: 'set null' }),
  seedFactsheetId: text('seed_factsheet_id').references(() => factsheets.id, { onDelete: 'set null' }),
  seedResearchItemId: text('seed_research_item_id').references(() => researchItems.id, { onDelete: 'set null' }),
  summary: text('summary'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  closedAt: text('closed_at'),
}, (table) => [
  index('idx_threads_status').on(table.status),
  index('idx_threads_created_by').on(table.createdBy),
  index('idx_threads_updated_at').on(table.updatedAt),
]);

// ==================== RESEARCH THREAD EVENTS (Chronological Journey) ====================
// Bundle B 2026-05-24: thread_id becomes nullable for Inbox-context reversals
// (events not tied to a research thread). 6 new event types added for STR-3.
export const researchThreadEvents = sqliteTable('research_thread_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Bundle B: NULLable. Inbox-context reverse transitions may not be tied to a thread.
  threadId: text('thread_id').references(() => researchThreads.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: [
      // Bundle A 15 values:
      'thread_started', 'item_attached', 'fact_extracted',
      'factsheet_created', 'factsheet_linked', 'mention_followed',
      'mention_extracted',
      'conflict_resolved', 'duplicate_resolved', 'factsheet_promoted',
      'relationship_proposed',
      'note_added', 'thread_paused', 'thread_resolved', 'thread_abandoned',
      // Bundle B 2026-05-24 — STR-3 reverse transitions:
      'factsheet_unmerged',
      'factsheet_restored',
      'fact_unaccepted',
      'fact_unrejected',
      'hint_reset',
      'gedcom_disputed',
      // Bundle C 2026-05-24:
      'factsheet_patched',
      'factsheet_detached',
      'factsheet_force_repromoted',
    ],
  }).notNull(),
  actorId: text('actor_id').notNull(), // user uuid or 'ai'
  factsheetId: text('factsheet_id').references(() => factsheets.id, { onDelete: 'set null' }),
  personId: text('person_id').references(() => persons.id, { onDelete: 'set null' }),
  researchItemId: text('research_item_id').references(() => researchItems.id, { onDelete: 'set null' }),
  researchFactId: text('research_fact_id').references(() => researchFacts.id, { onDelete: 'set null' }),
  sourceId: text('source_id').references(() => sources.id, { onDelete: 'set null' }),
  linkId: text('link_id').references(() => factsheetLinks.id, { onDelete: 'set null' }),
  reason: text('reason'),
  payloadJson: text('payload_json'),
  occurredAt: text('occurred_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_thread_events_thread').on(table.threadId, table.occurredAt),
  index('idx_thread_events_factsheet').on(table.factsheetId),
  index('idx_thread_events_person').on(table.personId),
]);

// ==================== SEARCH ATTEMPTS (Research Log) ====================
// Bundle E 2026-05-26: F1 + F2 — search attempts (negative + inconclusive
// results first-class). Per-person research log surfaced as a Research log
// workspace tab. See spec §2.1 + §4.
//
// FK rules (spec §2.1):
//   person_id        ON DELETE CASCADE   — drop log when person is deleted
//   thread_id        ON DELETE SET NULL  — search survives thread deletion
//   research_item_id ON DELETE SET NULL  — search survives item deletion
//
// Notes-required invariant is enforced at the route layer (spec E-Q8),
// NOT via DB CHECK constraint — keeps the schema portable and lets a future
// admin override edit a row without rewriting the DDL.
// Keep in sync with ensureFamilySchemaInner in packages/db/src/index.ts (Bundle E mirror block).
export const searchAttempts = sqliteTable('search_attempts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').references(() => researchThreads.id, { onDelete: 'set null' }),
  researchItemId: text('research_item_id').references(() => researchItems.id, { onDelete: 'set null' }),
  // SEARCH_PROVIDER_KINDS enum — enforced by Zod at the route layer.
  providerKind: text('provider_kind').notNull(),
  // Free-text label, used when provider_kind ∈ {archive, library, family, other}.
  providerLabel: text('provider_label'),
  // Nullable — browsing an archive in person has no query string.
  query: text('query'),
  searchedAt: integer('searched_at', { mode: 'timestamp_ms' }).notNull(),
  // SEARCH_OUTCOMES enum — enforced by Zod at the route layer.
  outcome: text('outcome').notNull(),
  // Required at route layer when outcome ∈ SEARCH_OUTCOMES_REQUIRING_NOTES.
  notes: text('notes'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('idx_search_attempts_person').on(table.personId, table.searchedAt),
  index('idx_search_attempts_thread').on(table.threadId),
  index('idx_search_attempts_research_item').on(table.researchItemId),
]);
