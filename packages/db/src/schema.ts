import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';

// ==================== USERS (NextAuth) ====================
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== PERSONS ====================
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sex: text('sex', { enum: ['M', 'F', 'U'] }).notNull().default('U'),
  isLiving: integer('is_living', { mode: 'boolean' }).notNull().default(true),
  privacyLevel: text('privacy_level', { enum: ['public', 'private', 'restricted'] }).notNull().default('private'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('idx_persons_sex').on(table.sex),
]);

// ==================== PERSON NAMES ====================
export const personNames = sqliteTable('person_names', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  nameType: text('name_type', { enum: ['birth', 'married', 'aka', 'immigrant', 'religious'] }).notNull().default('birth'),
  prefix: text('prefix'),
  givenName: text('given_name').notNull(),
  surname: text('surname').notNull(),
  suffix: text('suffix'),
  nickname: text('nickname'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_person_names_person').on(table.personId),
  index('idx_person_names_name').on(table.surname, table.givenName),
]);

// ==================== FAMILIES ====================
export const families = sqliteTable('families', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  partner1Id: text('partner1_id').references(() => persons.id, { onDelete: 'set null' }),
  partner2Id: text('partner2_id').references(() => persons.id, { onDelete: 'set null' }),
  relationshipType: text('relationship_type', {
    enum: ['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']
  }).notNull().default('unknown'),
  validationStatus: text('validation_status', {
    enum: ['confirmed', 'proposed', 'disputed']
  }).notNull().default('confirmed'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
});

// ==================== CHILDREN ====================
export const children = sqliteTable('children', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  childOrder: integer('child_order'),
  relationshipToParent1: text('relationship_to_parent1', {
    enum: ['biological', 'adopted', 'foster', 'step', 'unknown']
  }).notNull().default('biological'),
  relationshipToParent2: text('relationship_to_parent2', {
    enum: ['biological', 'adopted', 'foster', 'step', 'unknown']
  }).notNull().default('biological'),
  validationStatus: text('validation_status', {
    enum: ['confirmed', 'proposed', 'disputed']
  }).notNull().default('confirmed'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique('uq_children_family_person').on(table.familyId, table.personId),
  index('idx_children_family').on(table.familyId, table.personId),
  index('idx_children_person').on(table.personId, table.familyId),
]);

// ==================== EVENTS ====================
export const events = sqliteTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text('event_type').notNull(),
  dateOriginal: text('date_original'),
  dateSort: integer('date_sort'),
  dateModifier: text('date_modifier', {
    enum: ['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']
  }).default('exact'),
  dateEndSort: integer('date_end_sort'),
  placeText: text('place_text'),
  description: text('description'),
  personId: text('person_id').references(() => persons.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_events_person').on(table.personId, table.dateSort),
  index('idx_events_family').on(table.familyId),
  index('idx_events_type').on(table.eventType),
]);

// ==================== SOURCES ====================
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  author: text('author'),
  publisher: text('publisher'),
  publicationDate: text('publication_date'),
  repositoryName: text('repository_name'),
  repositoryUrl: text('repository_url'),
  sourceType: text('source_type', {
    enum: ['vital_record', 'census', 'military', 'church', 'newspaper',
      'immigration', 'land', 'probate', 'cemetery', 'photograph',
      'personal_knowledge', 'correspondence', 'book', 'online', 'other']
  }),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== SOURCE CITATIONS ====================
export const sourceCitations = sqliteTable('source_citations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  citationDetail: text('citation_detail'),
  citationText: text('citation_text'),
  confidence: text('confidence', {
    enum: ['high', 'medium', 'low', 'disputed']
  }).notNull().default('medium'),
  personId: text('person_id').references(() => persons.id, { onDelete: 'cascade' }),
  eventId: text('event_id').references(() => events.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  personNameId: text('person_name_id').references(() => personNames.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_citations_source').on(table.sourceId),
  index('idx_citations_person').on(table.personId),
  index('idx_citations_event').on(table.eventId),
  index('idx_citations_family').on(table.familyId),
]);

// ==================== TREE LAYOUTS ====================
export const treeLayouts = sqliteTable('tree_layouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  layoutData: text('layout_data').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export * from './research-schema.js';
