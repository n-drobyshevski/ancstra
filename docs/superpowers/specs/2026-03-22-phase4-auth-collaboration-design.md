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

CREATE TABLE family_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  db_filename TEXT NOT NULL,       -- 'family-{id}.sqlite' or Turso URL
  moderation_enabled INTEGER NOT NULL DEFAULT 0,
  privacy_level TEXT NOT NULL DEFAULT 'strict',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
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
```

## Family Database Changes

Minimal additions to existing per-family schema.

### Version columns for optimistic locking

Added to: `persons`, `person_names`, `families`, `children`, `events`, `sources`, `source_citations`, `media`.

```sql
ALTER TABLE persons ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
-- (same for all mutable tables listed above)
```

### Moderation queue

```sql
CREATE TABLE pending_contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,               -- Editor (references central DB)
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

## RBAC Permission System

### Permission matrix

| Permission | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| View tree | Yes | Yes | Yes | Yes (redacted) |
| Add persons/events/sources | Yes | Yes | Yes* | No |
| Edit existing data | Yes | Yes | Yes* | No |
| Delete persons/data | Yes | Yes | No | No |
| Import GEDCOM | Yes | Yes | No | No |
| Export GEDCOM | Yes | Yes | Yes (redacted) | No |
| AI research | Yes | Yes | Yes | No |
| Validate relationships | Yes | Yes | Yes | No |
| Upload media | Yes | Yes | Yes* | No |
| Manage members/invites | Yes | Yes | No | No |
| Change family settings | Yes | No | No | No |
| Delete family tree | Yes | No | No | No |
| View activity feed | Yes | Yes | Yes | Yes (filtered) |

*When moderation is enabled, Editor creates/edits go through `pending_contributions`.*

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

### Invite + OAuth interaction

User visits `/join?token=xxx` -> shown family name + role -> can sign up/in via credentials or OAuth -> after auth, validate token -> create `family_members` row -> redirect to tree.

## Invitation System

### Token design

Random 32-byte hex string stored in DB (not JWT). Revocable by setting `revoked_at`. Expires after 7 days.

### Creation flow

Owner/Admin clicks "Invite Member" -> optional email + role picker -> generates token -> UI shows copyable link `/join?token={token}` -> activity feed logged.

### Join flow

```
/join?token=xxx
  → Validate: exists, not expired, not revoked, not accepted
    → Invalid: error page
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

### API

```
GET /api/families/{id}/activity?cursor={id}&limit=50
```

Cursor-based pagination. Viewer sees redacted summaries. Filter by `?action=` and `?userId=`.

### Unread indicator

`last_seen_at` column on `family_members` tracks when user last viewed the feed.

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

`persons`, `person_names`, `families`, `children`, `events`, `sources`, `source_citations`, `media`.

NOT versioned: `change_log`, `pending_contributions`, `tree_layouts`, `ancestor_paths`, `person_summary`.

### Interaction with moderation

When moderation is on, Editor changes go to `pending_contributions` (no conflict possible). On approval, reviewer's apply uses current version — if conflict, reviewer resolves.

## Package Structure

### New: `packages/auth/`

```
packages/auth/src/
├── index.ts              # Public exports
├── permissions.ts        # RBAC: Role, Permission, hasPermission, requirePermission
├── privacy.ts            # redactForViewer, isPresumablyLiving
├── invitations.ts        # generateInviteToken, validateToken, acceptInvite, revokeInvite
├── activity.ts           # logActivity, getActivityFeed
├── moderation.ts         # submitContribution, reviewContribution, shouldModerate
├── families.ts           # createFamily, getFamilyForUser, switchFamily
├── oauth-linking.ts      # linkOAuthAccount, findUserByEmail, mergeAccounts
└── types.ts              # Shared types
```

### Changes to `packages/db/`

```
packages/db/src/
├── index.ts              # createCentralDb, createFamilyDb exports
├── central-schema.ts     # NEW: users, oauth_accounts, family_registry, etc.
├── family-schema.ts      # RENAMED from schema.ts + version columns + pending_contributions
├── research-schema.ts    # Unchanged
├── ai-schema.ts          # Unchanged
├── matching-schema.ts    # Unchanged
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
