import { sqliteTable, text, integer, real, index, unique } from 'drizzle-orm/sqlite-core';
import { persons, families, children, sourceCitations } from './family-schema';

// ==================== MATCH CANDIDATES ====================
export const matchCandidates = sqliteTable('match_candidates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  sourceSystem: text('source_system').notNull(),
  externalId: text('external_id').notNull(),
  externalData: text('external_data').notNull(), // JSON blob
  matchScore: real('match_score').notNull(),
  matchStatus: text('match_status', {
    enum: ['pending', 'accepted', 'rejected', 'maybe'],
  }).notNull().default('pending'),
  reviewedAt: text('reviewed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique('uq_match_candidate').on(table.personId, table.sourceSystem, table.externalId),
  index('idx_match_candidates_person').on(table.personId),
  index('idx_match_candidates_status').on(table.matchStatus),
]);

// ==================== RELATIONSHIP JUSTIFICATIONS ====================
export const relationshipJustifications = sqliteTable('relationship_justifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  childLinkId: text('child_link_id').references(() => children.id, { onDelete: 'cascade' }),
  justificationText: text('justification_text').notNull(),
  sourceCitationId: text('source_citation_id').references(() => sourceCitations.id),
  authorId: text('author_id').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_justifications_family').on(table.familyId),
  index('idx_justifications_child_link').on(table.childLinkId),
]);
