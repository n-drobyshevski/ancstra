import { sqliteTable, text, integer, real, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';

// ==================== USERS ====================
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== OAUTH ACCOUNTS ====================
export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at'),
}, (table) => [
  unique('uq_oauth_provider_account').on(table.provider, table.providerAccountId),
  index('idx_oauth_accounts_user').on(table.userId),
]);

// ==================== VERIFICATION TOKENS ====================
export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: text('expires').notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ==================== FAMILY REGISTRY ====================
export const familyRegistry = sqliteTable('family_registry', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  dbFilename: text('db_filename').notNull(),
  moderationEnabled: integer('moderation_enabled').notNull().default(0),
  maxMembers: integer('max_members').notNull().default(50),
  monthlyAiBudgetUsd: real('monthly_ai_budget_usd').notNull().default(10.0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== FAMILY MEMBERS ====================
export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => familyRegistry.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'editor', 'viewer'] }).notNull(),
  invitedRole: text('invited_role'),
  joinedAt: text('joined_at').notNull().$defaultFn(() => new Date().toISOString()),
  isActive: integer('is_active').notNull().default(1),
  lastSeenAt: text('last_seen_at'),
}, (table) => [
  unique('uq_family_members_family_user').on(table.familyId, table.userId),
  index('idx_family_members_family').on(table.familyId),
  index('idx_family_members_user').on(table.userId),
]);

// ==================== INVITATIONS ====================
export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => familyRegistry.id, { onDelete: 'cascade' }),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  email: text('email'),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  acceptedBy: text('accepted_by').references(() => users.id),
  revokedAt: text('revoked_at'),
  revokedBy: text('revoked_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_invitations_family').on(table.familyId),
  index('idx_invitations_token').on(table.token),
]);

// ==================== ACTIVITY FEED ====================
export const activityFeed = sqliteTable('activity_feed', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => familyRegistry.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  summary: text('summary').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_activity_feed_family_date').on(table.familyId, table.createdAt),
  index('idx_activity_feed_user').on(table.userId),
]);
