import { sqliteTable, text, integer, real, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';
import { users, persons, sources, sourceCitations } from './schema';

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
    enum: ['draft', 'promoted', 'dismissed'],
  }).notNull().default('draft'),
  promotedSourceId: text('promoted_source_id').references(() => sources.id),
  createdBy: text('created_by').notNull().references(() => users.id),
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

// ==================== RESEARCH FACTS ====================
export const researchFacts = sqliteTable('research_facts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  factType: text('fact_type', {
    enum: [
      'name', 'birth_date', 'birth_place', 'death_date', 'death_place',
      'marriage_date', 'marriage_place', 'residence', 'occupation',
      'immigration', 'military_service', 'religion', 'ethnicity',
      'parent_name', 'spouse_name', 'child_name', 'other',
    ],
  }).notNull(),
  factValue: text('fact_value').notNull(),
  factDateSort: integer('fact_date_sort'),
  researchItemId: text('research_item_id').references(() => researchItems.id),
  sourceCitationId: text('source_citation_id').references(() => sourceCitations.id),
  confidence: text('confidence', {
    enum: ['high', 'medium', 'low', 'disputed'],
  }).notNull().default('medium'),
  extractionMethod: text('extraction_method', {
    enum: ['manual', 'ai_extracted', 'ocr_extracted'],
  }).notNull().default('manual'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_research_facts_person').on(table.personId),
  index('idx_research_facts_person_type').on(table.personId, table.factType),
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
