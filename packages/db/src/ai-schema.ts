import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ==================== AI USAGE TRACKING ====================
export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd: real('cost_usd').notNull(),
  taskType: text('task_type', {
    enum: ['chat', 'extraction', 'analysis', 'citation', 'biography', 'historical_context'],
  }).notNull(),
  sessionId: text('session_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_ai_usage_user_month').on(table.userId, table.createdAt),
]);
