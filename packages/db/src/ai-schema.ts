import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users, persons } from './schema';

// ==================== AI USAGE TRACKING ====================
export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  taskType: text('task_type', {
    enum: ['chat', 'extraction', 'analysis', 'citation'],
  }).notNull(),
  sessionId: text('session_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_ai_usage_user_month').on(table.userId, table.createdAt),
]);

// ==================== PROPOSED RELATIONSHIPS ====================
export const proposedRelationships = sqliteTable('proposed_relationships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  relationshipType: text('relationship_type', {
    enum: ['parent_child', 'partner', 'sibling'],
  }).notNull(),
  person1Id: text('person1_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  person2Id: text('person2_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', {
    enum: ['familysearch', 'nara', 'ai_suggestion', 'record_match', 'ocr_extraction', 'user_proposal'],
  }).notNull(),
  sourceDetail: text('source_detail'),
  confidence: real('confidence'),
  status: text('status', {
    enum: ['pending', 'validated', 'rejected', 'needs_info'],
  }).notNull().default('pending'),
  validatedBy: text('validated_by').references(() => users.id),
  validatedAt: text('validated_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_proposed_rels_status').on(table.status),
  index('idx_proposed_rels_person1').on(table.person1Id),
  index('idx_proposed_rels_person2').on(table.person2Id),
]);
