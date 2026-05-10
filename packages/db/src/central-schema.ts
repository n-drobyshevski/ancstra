import { sqliteTable, text, integer, real, index, unique, primaryKey } from 'drizzle-orm/sqlite-core';

// ==================== USERS ====================
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').notNull().default(0),
  membershipsVersion: integer('memberships_version').notNull().default(0),
  // Cross-family super-admin flag. Independent of family-scoped roles.
  // Granted via promote-platform-admin script or platformAdmin.toggle mutation.
  isPlatformAdmin: integer('is_platform_admin').notNull().default(0),
  // Soft-delete timestamp (ISO 8601). NULL means active. Set by the
  // platform-admin delete action. Read paths must filter `deletedAt IS NULL`
  // — see audit list in PR description.
  deletedAt: text('deleted_at'),
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
  // Editor defaults (Phase 3 of role-specific settings, 2026-05-08).
  // Editors+ can update these via family.updateEditorDefaults; they seed
  // privacy/export/citation choices for new records.
  defaultPrivacyLevel: text('default_privacy_level', { enum: ['public', 'private', 'restricted'] }).notNull().default('private'),
  defaultGedcomExportMode: text('default_gedcom_export_mode', { enum: ['full', 'shareable'] }).notNull().default('shareable'),
  defaultCitationStyle: text('default_citation_style', { enum: ['evidence-explained', 'chicago', 'apa'] }).notNull().default('evidence-explained'),
  // Living-person redaction threshold (Phase 4 of role-specific settings,
  // 2026-05-08). Person born within last N years with no death is presumed
  // living. Owner-configurable via family.updateSettings; range 50-150.
  livingThresholdYears: integer('living_threshold_years').notNull().default(100),
  // Soft-delete timestamp (ISO 8601). NULL means active. Per-family DB
  // (dbFilename) is preserved on soft-delete; full reclamation is a
  // separate, future purge job.
  deletedAt: text('deleted_at'),
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

// ==================== PLATFORM AUDIT LOG ====================
// Cross-family audit trail for platform-admin actions. Separate from
// activityFeed (which is family-scoped + FK NOT NULL on familyId) so we
// don't pollute per-family feeds with system-level events.
export const platformAuditLog = sqliteTable('platform_audit_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorUserId: text('actor_user_id').notNull().references(() => users.id),
  action: text('action').notNull(),                   // e.g. 'platform_admin.toggle'
  targetType: text('target_type').notNull(),          // 'user' | 'family'
  targetId: text('target_id').notNull(),
  summary: text('summary').notNull(),
  metadata: text('metadata'),                          // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_platform_audit_actor_date').on(table.actorUserId, table.createdAt),
  index('idx_platform_audit_target').on(table.targetType, table.targetId),
]);

// ==================== USER PREFERENCES ====================
// Per-user, platform-wide settings owned by the user themselves. No role
// gating — every authenticated user controls their own row.
export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull().default('en-US'),
  timezone: text('timezone').notNull().default('UTC'),
  density: text('density', { enum: ['comfortable', 'compact'] }).notNull().default('comfortable'),
  notifyEmail: integer('notify_email').notNull().default(1),
  notifyActivity: integer('notify_activity').notNull().default(1),
  // Experimental-features opt-in (added 2026-05-09).
  // Master switch + per-feature override JSON. Both gates AND with the
  // platform-level `platform_settings.experimentalFeaturesAllowUsers` policy
  // before a feature is considered enabled. See packages/auth/src/experimental.ts.
  experimentalEnabled: integer('experimental_enabled').notNull().default(0),
  // JSON: Partial<Record<ExperimentalFeatureKey, boolean>>. Defaults to '{}'
  // meaning "respect master switch with all features on by default" — only an
  // explicit `false` value disables a single feature.
  experimentalFeatures: text('experimental_features').notNull().default('{}'),
  // Tree visualization: when on, switching node-style mode (compact ↔ wide)
  // nudges any overlapping nodes apart per rank. Default ON — fixes a real
  // overlap bug; opt-out for users who prefer the unmodified positions.
  treeAutoSpread: integer('tree_auto_spread').notNull().default(1),
  // Tree visualization: when on, the layout orders siblings left-to-right by
  // birth date (eldest leftmost) and places mother left / father right at every
  // generation, so the paternal lineage trends to the right side of the canvas.
  // Default ON. Off restores DB insertion order for siblings; the immediate
  // partner-pair swap (mother-left for the direct couple) still applies.
  treeGenealogicalOrdering: integer('tree_genealogical_ordering').notNull().default(1),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== PLATFORM SETTINGS ====================
// Singleton row (id='global') holding platform-wide policies. Created and
// mutated only by platform admins via `/admin`. Read by every server entry
// point that needs to know whether a global feature gate is open.
//
// CHECK on `id='global'` is enforced at the application layer rather than in
// SQLite — keeps the migration trivially additive.
export const platformSettings = sqliteTable('platform_settings', {
  id: text('id').primaryKey().default('global'),
  // Whether users may opt into experimental AI features. Default OFF — a
  // fresh install must take an explicit admin action to expose experimental
  // features to users.
  experimentalFeaturesAllowUsers: integer('experimental_features_allow_users').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedBy: text('updated_by').references(() => users.id),
});

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
