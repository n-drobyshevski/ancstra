# Phase 4: Authentication & Collaboration — Design Spec

> Status: Approved | Date: 2026-03-22
> Phase: 4 | Duration: 4 weeks | Dependencies: Phase 1-3 complete

## Overview

Upgrade Ancstra from single-user to multi-user with role-based access control, family invitations, OAuth, configurable moderation, activity feed, and multi-database architecture. Build locally with SQLite, design for Turso swap on web deployment.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Deployment target | Hybrid: build RBAC locally, design for Turso swap |
| 2 | Role model | 4 roles: Owner, Admin, Editor, Viewer |
| 3 | Editor moderation | Configurable per-family (Owner toggles on/off) |
| 4 | Invite delivery | Link-first (copy/paste), email as optional enhancement later |
| 5 | OAuth providers | Google + Apple in Phase 4 |
| 6 | Activity feed | Dedicated feed table (richer than change_log) |
| 7 | Living person privacy | Full redaction for Viewers |
| 8 | Multi-tenant model | Multi-DB locally too (multiple .sqlite files per family) |
| 9 | Account linking | Auto-link by email match |
| 10 | Conflict handling | Optimistic locking with version field |
| 11 | Session/auth storage | Central `ancstra.sqlite` + per-family `family-{id}.sqlite` |

## Architecture: Layered Auth Package

New `packages/auth/` owns all auth concerns — NextAuth config, RBAC enforcement, invitation tokens, OAuth provider setup. Central `ancstra.sqlite` has its own Drizzle schema. Family DBs keep the existing tree schema with minimal additions.

### File Layout

```
~/.ancstra/
├── ancstra.sqlite                   # Central DB (users, families, invitations, activity)
├── families/
│   ├── family-abc123.sqlite         # Smith Family tree data
│   ├── family-def456.sqlite         # Johnson Family tree data
│   └── ...
└── media/
    ├── family-abc123/
    └── family-def456/
```

### Database Resolution Flow

```
Request → proxy.ts reads JWT → { userId }
  → Query central DB: user's families
  → Resolve active family (URL param > session cookie > first by joined_at)
  → Look up family_registry → db_filename
  → Create Drizzle connection to families/family-{id}.sqlite
  → Attach { userId, role, familyDb, centralDb } to request context
```

### proxy.ts (Next.js 16)

Next.js 16 replaces `middleware.ts` with `proxy.ts` for route-level interception. This is not a custom concept — it is the Next.js 16 equivalent. The proxy handles:
- JWT session validation
- User role resolution for the active family
- Family DB connection setup
- Request context attachment

Public routes (`/login`, `/signup`, `/join`) bypass the proxy. All `/(auth)/` routes require authentication.

## Central Database Schema (`ancstra.sqlite`)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,              -- NULL if OAuth-only user
  name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,          -- 'google', 'apple'
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  UNIQUE(provider, provider_account_id)
);

-- NextAuth v5 verification tokens (for email verification, password reset)
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,        -- email address
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE family_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  db_filename TEXT NOT NULL,       -- 'family-{id}.sqlite' or Turso URL
  moderation_enabled INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 50,  -- Cap on total family membership
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_role TEXT,               -- Original role at invitation time (audit)
  joined_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,               -- For unread activity indicator
  UNIQUE(family_id, user_id)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  email TEXT,                      -- NULL if link-only (no specific recipient)
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token TEXT NOT NULL UNIQUE,      -- Random 32-byte hex (not JWT — revocable)
  expires_at TEXT NOT NULL,        -- 7 days from creation
  accepted_at TEXT,
  accepted_by TEXT REFERENCES users(id),
  revoked_at TEXT,
  revoked_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE activity_feed (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,            -- See Activity Feed section for full list
  entity_type TEXT,                -- 'person', 'family', 'event', 'media', 'invitation'
  entity_id TEXT,
  summary TEXT NOT NULL,           -- Human-readable: "Mary added John Jr."
  metadata TEXT,                   -- JSON blob for extra context
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_invitations_family ON invitations(family_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_activity_feed_family_date ON activity_feed(family_id, created_at);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
```

## NextAuth Adapter Strategy

NextAuth v5 with a **custom Drizzle adapter** for the central DB. The adapter maps NextAuth's expected operations to our custom schema:

| NextAuth concept | Our table |
|---|---|
| User | `users` |
| Account (OAuth) | `oauth_accounts` |
| Session | Not stored — JWT strategy (stateless) |
| VerificationToken | `verification_tokens` |

We use JWT session strategy (`session: { strategy: 'jwt' }`), so no `sessions` table is needed. The JWT payload includes `{ userId, email, name }`. Family-specific data (role, familyId) is resolved per-request in `proxy.ts` from the central DB — not baked into the JWT — so role changes take effect immediately without requiring re-login.

The custom adapter is implemented in `packages/auth/src/nextauth-adapter.ts`, wrapping Drizzle queries against the central schema. This is preferred over the standard NextAuth Drizzle adapter because our schema diverges (nullable `password_hash`, custom `oauth_accounts` shape, no `sessions` table).

## Migration Strategy (Existing Data)

### Users table migration

The current `users` table has `password_hash TEXT NOT NULL`. OAuth-only users need this nullable. SQLite does not support `ALTER COLUMN`, so this requires a table rebuild:

```sql
-- 1. Create new table with nullable password_hash + new columns
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,                  -- NOW NULLABLE
  name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. Copy existing data
INSERT INTO users_new (id, email, password_hash, name, created_at, updated_at)
SELECT id, email, password_hash, COALESCE(name, email), created_at, created_at
FROM users;

-- 3. Drop old, rename new
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
```

### Single-DB to multi-DB split

Existing installations have one SQLite file with users + tree data together. A one-time migration script handles the split:

1. Create `~/.ancstra/` directory structure
2. Create `ancstra.sqlite` (central) with new schema
3. Copy `users` rows from old DB to central `users` table
4. Create `family_registry` entry for the existing tree
5. Copy old DB as `families/family-{id}.sqlite` (the tree data)
6. Drop `users` table from the family DB
7. Convert ALL `created_by` and `author_id` FKs in the family DB to plain TEXT columns (drop FK constraints): `persons.created_by`, `research_items.created_by`, `relationship_justifications.author_id`, and any other user-referencing columns
8. Add `version` columns and `pending_contributions` table to family DB
9. Create `family_members` row: existing user as owner

This migration runs automatically on first launch after the Phase 4 upgrade.

### Cross-DB reference handling (persons.createdBy)

The existing `persons.createdBy` references `users.id`, but after the split, `users` lives in the central DB. Resolution:

- **Keep `created_by` as a plain TEXT column** in the family DB (drop the FK constraint)
- It stores the user ID but is not enforced at the DB level
- Application code resolves user names via `family_user_cache`
- This is acceptable because `created_by` is metadata, not structural
- Same treatment applies to all user-referencing columns in the family DB

**Note:** The `persons.privacy_level` column is unrelated to the central DB changes. It remains in the family DB schema unchanged — it controls per-person visibility within the tree, not family-level settings.

## Family Database Changes

Minimal additions to existing per-family schema.

### Cross-DB user resolution

Family DBs reference user IDs (in `created_by`, `pending_contributions.user_id`, etc.) but cannot enforce FKs to the central DB. To display user names/avatars without cross-DB joins:

```sql
-- Denormalized user cache in each family DB
-- Synced from central DB when user joins family or updates their profile
CREATE TABLE family_user_cache (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  updated_at TEXT NOT NULL
);
```

This table is:
- Populated when a user joins a family
- Updated when a user changes their name/avatar (central DB triggers app-level sync)
- Used for display purposes only (not authoritative — central DB is source of truth)
- Cleaned up when a user is removed from the family

### Version columns for optimistic locking

Added to: `persons`, `person_names`, `families`, `children`, `events`, `sources`, `source_citations`, `media`, `proposed_relationships`, `proposed_persons`.

```sql
ALTER TABLE persons ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
-- (same for all mutable tables listed above)
```

`proposed_relationships` and `proposed_persons` get versioning because multiple admins may review proposals concurrently.

### Moderation queue

```sql
CREATE TABLE pending_contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,               -- Editor (references central DB via family_user_cache)
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,           -- 'person', 'family', 'event', 'source', 'media'
  entity_id TEXT,                      -- NULL for creates
  payload TEXT NOT NULL,               -- JSON: full data for create, diff for update
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'revision_requested'
  )),
  reviewer_id TEXT,
  review_comment TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_pending_status ON pending_contributions(status) WHERE status = 'pending';
```

### Moderation flow

1. Editor submits a change -> written to `pending_contributions`
2. Activity feed entry: "{editor} submitted a change to {entity}"
3. Owner/Admin sees pending queue -> reviews diff -> approves/rejects
4. Approve: apply payload to target table, bump version, log activity
5. Reject: update status, log activity with reason

Owner/Admin bypass moderation always. When `moderation_enabled = false`, Editors write directly (with audit trail).

**Double-review guard:** The review UPDATE uses `WHERE id = ? AND status = 'pending'` to prevent two reviewers from acting on the same contribution simultaneously. If 0 rows affected, the contribution was already reviewed — return a "already reviewed" response.

### Places table note

The `places` table defined in `docs/architecture/data-model.md` is not yet implemented in the Drizzle schema. Phase 4 does not address this gap — it is tracked for Phase 1 implementation. The family DB schema changes in Phase 4 are additive (version columns, pending_contributions, family_user_cache) and do not affect the places table design.

## RBAC Permission System

### Permission matrix

| Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| View tree | Yes | Yes | Yes | Yes (redacted) |
| Add persons/events/sources | Yes | Yes | Yes* | No |
| Edit existing data | Yes | Yes | Yes* | No |
| Delete persons/data | Yes | Yes | No | No |
| Import GEDCOM | Yes | Yes | No | No |
| Export GEDCOM | Yes | Yes | Yes | No |
| AI research | Yes | Yes | Yes | No |
| Validate relationships | Yes | Yes | Yes | No |
| Upload media | Yes | Yes | Yes* | No |
| Manage members/invites | Yes | Yes | No | No |
| Change family settings | Yes | No | No | No |
| Delete family tree | Yes | No | No | No |
| View activity feed | Yes | Yes | Yes | Yes (filtered) |

*When moderation is enabled, Editor creates/edits go through `pending_contributions`.*

**GEDCOM export for Editors:** Editors can export the full tree. Living person redaction in exports is a separate concern controlled by the export UI (checkbox: "Include living persons"). This applies equally to all roles that can export. Viewers cannot export at all.

### Implementation

```typescript
// packages/auth/src/permissions.ts

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export type Permission =
  | 'tree:view' | 'tree:export' | 'tree:delete'
  | 'person:create' | 'person:edit' | 'person:delete'
  | 'family:create' | 'family:edit' | 'family:delete'
  | 'event:create' | 'event:edit' | 'event:delete'
  | 'source:create' | 'source:edit' | 'source:delete'
  | 'media:upload' | 'media:delete'
  | 'gedcom:import' | 'gedcom:export'
  | 'ai:research'
  | 'relationship:validate'
  | 'members:manage' | 'members:invite'
  | 'settings:manage'
  | 'contributions:review'
  | 'activity:view';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [/* all permissions */],
  admin: [/* all except settings:manage, tree:delete */],
  editor: ['tree:view', 'person:create', 'person:edit', 'family:create',
           'family:edit', 'event:create', 'event:edit', 'source:create',
           'source:edit', 'media:upload', 'gedcom:export', 'ai:research',
           'relationship:validate', 'activity:view'],
  viewer: ['tree:view', 'activity:view'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(permission);
  }
}

export function shouldModerate(role: Role, moderationEnabled: boolean): boolean {
  return role === 'editor' && moderationEnabled;
}
```

### Route protection

`proxy.ts` (Next.js 16) checks JWT session, resolves user role for active family, attaches `{ userId, familyId, role, dbFilename }` to request context. Public routes: `/login`, `/signup`, `/join`. Protected: everything under `/(auth)/`.

## OAuth Integration

### Providers

NextAuth v5 with Google + Apple alongside existing Credentials provider.

### Auto-link by email flow

```
OAuth sign-in returns profile { email, name, avatar }
  → Check central DB: user with this email exists?
    → YES: Create oauth_accounts row, sign in as existing user, merge name/avatar if missing
    → NO: Create new user + oauth_accounts row, sign in as new user
```

### Apple-specific handling

- Apple relay emails (`xyz@privaterelay.appleid.com`): can't auto-link, creates new account
- Apple only sends name on first sign-in: store immediately
- **Local development:** Apple Sign In requires HTTPS and a registered domain. For local dev, Apple OAuth is skipped (button hidden when `NODE_ENV=development`). Google OAuth works locally via `localhost` redirect URIs. Credentials auth is always available.

### Invite + OAuth interaction

User visits `/join?token=xxx` -> shown family name + role -> can sign up/in via credentials or OAuth -> after auth, validate token -> create `family_members` row -> redirect to tree.

## Invitation System

### Token design

Random 32-byte hex string stored in DB (not JWT). Revocable by setting `revoked_at`. Expires after 7 days.

### Rate limiting

The `/join?token=xxx` endpoint is rate-limited to 10 attempts per IP per minute. Failed token validations (expired, revoked, not found) count toward the limit. This prevents brute-force probing.

### Limits

- Max active (unexpired, unaccepted, unrevoked) invitations per family: 20
- Max total members per family: configurable via `family_registry.max_members` (default 50)
- Attempting to invite beyond limits returns 429

### Creation flow

Owner/Admin clicks "Invite Member" -> optional email + role picker -> generates token -> UI shows copyable link `/join?token={token}` -> activity feed logged.

### Join flow

```
/join?token=xxx
  → Rate limit check (10/min per IP)
  → Validate token:
    → Exists in DB?
    → Not expired?
    → Not revoked?
    → Not already accepted?
    → Family not at max_members?
      → Invalid: error page with explanation
      → Valid: show join page
        → Already logged in: "Join [Family] as [Role]" button
        → Not logged in: sign up/in form (credentials or OAuth)
        → After auth: create family_members, mark accepted, redirect to tree
```

### Constraints

- Only Owner can invite Admins
- Admin can invite Editors and Viewers
- Owner role can't be assigned via invite (must be transferred explicitly)
- If email is set on invite, only that email can accept
- If email is NULL, anyone with link can accept (one-time use)

### Owner transfer

Owner can transfer ownership to an existing Admin via Settings > Members. The flow:

1. Owner selects an Admin and clicks "Transfer Ownership"
2. Confirmation dialog with warning
3. On confirm: the Admin becomes Owner, the former Owner becomes Admin
4. Both `family_members` roles updated atomically
5. `family_registry.owner_id` updated to new Owner
6. Activity feed entry logged
7. Former Owner retains Admin access (not kicked out)

If the Owner's account becomes inaccessible, there is no self-service recovery path. This is a known limitation — a future admin tool or support flow could handle this edge case.

## Living Person Redaction

Full redaction at API layer for Viewer role. The API never sends sensitive data for living persons.

### Redaction rules

| Field | Redacted to |
|---|---|
| given_name | "Living" |
| surname | "" (empty) |
| all other name fields | NULL |
| birth date/place | NULL |
| all events | stripped entirely |
| notes | NULL |
| media links | stripped |
| face regions | stripped |

### Preserved fields

- Person ID (tree structure)
- Sex (tree rendering)
- `is_living: true` flag
- Relationship links (parent/child/spouse connections)

### Activity feed filtering

Entries referencing living persons show redacted summaries for Viewers: "A family member was added" instead of "Mary added Baby John, born 2024".

## Activity Feed

### Event types

| Action | Summary Template |
|---|---|
| `person_added` | "{user} added {person_name}" |
| `person_edited` | "{user} updated {person_name}" |
| `person_deleted` | "{user} removed {person_name}" |
| `relationship_added` | "{user} linked {person1} and {person2}" |
| `media_uploaded` | "{user} uploaded {count} file(s)" |
| `gedcom_imported` | "{user} imported {count} persons from GEDCOM" |
| `invite_sent` | "{user} invited {email/someone} as {role}" |
| `invite_accepted` | "{user} joined the family tree" |
| `role_changed` | "{user} changed {target_user} role to {role}" |
| `member_removed` | "{user} removed {target_user} from the tree" |
| `contribution_submitted` | "{user} submitted a change to {entity}" |
| `contribution_approved` | "{user} approved {editor}'s change to {entity}" |
| `contribution_rejected` | "{user} rejected {editor}'s change to {entity}" |
| `owner_transferred` | "{user} transferred ownership to {new_owner}" |

### API

```
GET /api/families/{id}/activity?cursor={id}&limit=50
```

Cursor-based pagination. Viewer sees redacted summaries. Filter by `?action=` and `?userId=`.

### Unread indicator

`last_seen_at` column on `family_members` tracks when user last viewed the feed.

### Retention

No automatic pruning for now. A personal genealogy app with a handful of users generates minimal feed volume. If needed later, add a configurable retention period (e.g., archive entries older than 2 years).

## Optimistic Locking

### Mechanism

Every mutable table has `version INTEGER NOT NULL DEFAULT 1`. On update, client sends the version it read. Server uses `WHERE id = ? AND version = ?`, bumps version on success.

### API contract

```
PATCH /api/persons/{id}
Body: { version: 3, givenName: "Jonathan", ... }

200: { ...person, version: 4 }
409: { error: "conflict", current: { ...person, version: 5 } }
```

### Client handling

On 409: show toast "This record was updated by someone else", refresh form with current data, user re-applies changes. No automatic merge.

### Tables with versioning

`persons`, `person_names`, `families`, `children`, `events`, `sources`, `source_citations`, `media`, `proposed_relationships`, `proposed_persons`.

NOT versioned: `change_log`, `pending_contributions`, `tree_layouts`, `ancestor_paths`, `person_summary`, `family_user_cache`.

### Interaction with moderation

When moderation is on, Editor changes go to `pending_contributions` (no conflict possible). On approval, reviewer's apply uses current version — if conflict, reviewer resolves.

## Package Structure

### New: `packages/auth/`

```
packages/auth/src/
├── index.ts              # Public exports
├── nextauth-adapter.ts   # Custom Drizzle adapter for central DB
├── permissions.ts        # RBAC: Role, Permission, hasPermission, requirePermission
├── privacy.ts            # redactForViewer, isPresumablyLiving
├── invitations.ts        # generateInviteToken, validateToken, acceptInvite, revokeInvite
├── activity.ts           # logActivity, getActivityFeed
├── moderation.ts         # submitContribution, reviewContribution, shouldModerate
├── families.ts           # createFamily, getFamilyForUser, switchFamily, transferOwnership
├── oauth-linking.ts      # linkOAuthAccount, findUserByEmail, mergeAccounts
└── types.ts              # Shared types
```

### Changes to `packages/db/`

```
packages/db/src/
├── index.ts              # createCentralDb, createFamilyDb exports
├── central-schema.ts     # NEW: users, oauth_accounts, family_registry, etc.
├── family-schema.ts      # RENAMED from schema.ts + version columns + pending_contributions + family_user_cache
├── research-schema.ts    # Unchanged
├── ai-schema.ts          # Unchanged
├── matching-schema.ts    # Unchanged
├── migrations/
│   └── split-to-multi-db.ts  # NEW: one-time migration from single DB to central + family
├── seed.ts               # Updated: seeds both central + family DBs
└── turso.ts              # Updated: supports central + per-family Turso URLs
```

### Changes to `apps/web/`

```
apps/web/
├── auth.ts                            # Updated: Google + Apple providers, linking callbacks
├── proxy.ts                           # NEW: Next.js 16 route auth, family DB resolution
├── app/
│   ├── login/page.tsx                 # Updated: OAuth buttons
│   ├── signup/page.tsx                # Updated: OAuth buttons
│   ├── join/page.tsx                  # NEW: invite acceptance
│   ├── (auth)/
│   │   ├── settings/members/page.tsx  # NEW: member management + invitations
│   │   ├── activity/page.tsx          # NEW: activity feed
│   │   └── ...
│   ├── api/families/[id]/
│   │   ├── members/route.ts           # NEW
│   │   ├── members/[userId]/route.ts  # NEW
│   │   ├── invitations/route.ts       # NEW
│   │   ├── activity/route.ts          # NEW
│   │   ├── contributions/route.ts     # NEW
│   │   └── contributions/[id]/route.ts # NEW
│   └── actions/auth.ts               # Updated: family creation on signup
├── components/
│   ├── auth/                          # oauth-buttons, family-picker, role-badge
│   ├── members/                       # member-list, invite-dialog, pending-invites
│   ├── activity/                      # activity-feed, activity-entry
│   └── moderation/                    # contribution-queue, contribution-review
└── lib/auth/context.ts                # Request context helpers
```

### Existing API route updates

All routes under `/api/persons`, `/api/families`, `/api/events`, `/api/sources`, `/api/search` gain:
- Permission check via `requirePermission()`
- Moderation check via `shouldModerate()`
- Optimistic locking: accept `version` in request body
- Activity logging via `logActivity()`

## Family Creation Flow

```
User signs up (first time, no families)
  → Prompt: "Create your first family tree"
  → Enter family name
  → Create family_registry row + family-{id}.sqlite with full tree schema
  → Create family_members row: user as 'owner'
  → Redirect to empty tree
```

## Turso Web Deployment

For web mode, `createFamilyDb()` uses `@libsql/client` instead of `better-sqlite3`. The `db_filename` in `family_registry` becomes a Turso URL (`libsql://ancstra-family-{id}-username.turso.io`). Same Drizzle schema, different driver.

**Turso DB provisioning:** New family databases are created via the Turso Platform API (`POST /v1/organizations/{org}/databases`). This is called from `packages/auth/src/families.ts#createFamily()` when in web mode. Turso's free tier supports up to 500 databases. The API call takes ~2-3 seconds, which is acceptable for family creation (a rare operation).

## Hono Worker Interaction

The Hono worker (introduced in Phase 2) authenticates via a shared service secret (`WORKER_AUTH_SECRET`). It does not use NextAuth or `proxy.ts`. Instead:

- Worker receives job payloads that include `{ familyId, userId }`
- Worker resolves the family DB the same way: query `family_registry` for `db_filename`, create Drizzle connection
- Worker uses the central DB for activity feed logging
- Worker does not enforce RBAC (the API route that enqueued the job already checked permissions)

## Family Switching

Family picker dropdown in top nav (visible when user belongs to multiple families). Selecting a family updates session cookie and reloads data. Each family is completely isolated.

## Exit Criteria

- [ ] Multi-user flow tested with 3+ concurrent users
- [ ] RBAC tested for all 4 roles (owner, admin, editor, viewer)
- [ ] Invitation flow works end-to-end (link-based)
- [ ] Google + Apple OAuth working with auto-link
- [ ] Permission boundaries verified (no privilege escalation)
- [ ] Optimistic locking handles concurrent edits
- [ ] Moderation queue works when enabled
- [ ] Activity feed shows accurate history
- [ ] Living person full redaction verified for Viewers
- [ ] Multi-DB architecture works (central + multiple family DBs)
- [ ] Single-DB to multi-DB migration tested
- [ ] Owner transfer flow works
- [ ] Rate limiting on join endpoint verified
