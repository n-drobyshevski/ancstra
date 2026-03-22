# Collaborative Spaces Design

> Status: Approved (brainstorming)
> Date: 2026-03-21
> Phase: 4 (Auth & Collaboration)
> Dependencies: data-model.md, phase-1-core.md (auth scaffolding)

## Overview

Collaborative spaces allow users to invite family members to work on genealogy trees together. A **space** is a workspace containing multiple trees, backed by a dedicated Turso database. Each user in a space can be linked to their person node in the tree, shown with a "(me)" label.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Space definition | Workspace containing multiple trees | Families research multiple lines; grouping trees under one shared workspace is natural |
| Multi-tenancy | Database-per-space (Turso) | Hard data isolation, clean GDPR story, independent backup/restore, cross-tree queries stay within one DB |
| Roles | Space-level only (owner/admin/editor/viewer) | Simpler than per-tree overrides; sufficient for 20-50 user scale |
| Auth | Email/password + OAuth (Google/Apple) | Maximum flexibility for family members with different comfort levels |
| User-to-person mapping | Owner pre-assigns or user self-claims, owner approves | Flexible; owner maintains control |
| "(me)" privacy | Overrides living-person redaction for that user only | Users should see their own data |
| Cross-tree links | Linked copies with manual/auto sync | Each tree owns its data; sync is explicit and auditable |
| Collaboration mode | Async (refresh to see changes) | Fits local-first SQLite/Turso architecture; avoids websocket complexity |
| Editor trust model | Direct edit (no approval workflow) | Editors write directly; all changes tracked in change_log and activity feed. Supersedes older spec's "submit for review" model — simpler, sufficient for family-scale trust |
| Activity feed | Space-level, all trees aggregated | One place to see everything; privacy-aware for viewers |
| Scale target | 20-50+ users, 10+ trees per space | Genealogy societies and large family projects |

## Architecture

### Database Topology

```
Central DB (Turso)              Space DB (Turso, one per space)
+---------------------+        +-----------------------------+
| users               |        | trees                       |
| spaces              |        | persons      (tree_id FK)   |
| space_members       |  1:N   | families     (tree_id FK)   |
| invitations         | -----> | events       (tree_id FK)   |
| user_person_map     |        | sources, media, places ...  |
+---------------------+        | person_links (cross-tree)   |
                                | activity_feed               |
                                | change_log                  |
                                +-----------------------------+
```

### Central Database Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  auth_provider TEXT DEFAULT 'credentials',
  auth_provider_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE spaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  turso_db_url TEXT NOT NULL,
  turso_db_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'provisioning', 'provisioning_failed')) DEFAULT 'provisioning',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE space_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(space_id, user_id)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  -- person_id and tree_id are logical references to the space DB.
  -- No FK enforcement possible (cross-database). Validated at invite
  -- creation time; stale references handled gracefully at acceptance.
  person_id TEXT,
  tree_id TEXT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE(space_id, email)
);

CREATE TABLE user_person_map (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  tree_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'pending_claim', 'rejected')) DEFAULT 'pending_claim',
  confirmed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, space_id, tree_id)
);

-- Indexes
CREATE INDEX idx_space_members_space ON space_members(space_id);
CREATE INDEX idx_space_members_user ON space_members(user_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_space_email ON invitations(space_id, email);
CREATE INDEX idx_user_person_map_user ON user_person_map(user_id, space_id);
```

### Space Database Schema Extensions

The existing data model (persons, families, events, sources, etc.) is extended with:

```sql
CREATE TABLE trees (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- All existing tables gain a tree_id column:
-- ALTER TABLE persons ADD COLUMN tree_id TEXT NOT NULL REFERENCES trees(id);
-- ALTER TABLE families ADD COLUMN tree_id TEXT NOT NULL REFERENCES trees(id);
-- ALTER TABLE events ADD COLUMN tree_id TEXT NOT NULL REFERENCES trees(id);
-- (etc. for sources, places, media, and all related tables)

CREATE TABLE person_links (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source_tree_id TEXT NOT NULL REFERENCES trees(id),
  source_person_id TEXT NOT NULL,
  target_tree_id TEXT NOT NULL REFERENCES trees(id),
  target_person_id TEXT NOT NULL,
  sync_mode TEXT CHECK (sync_mode IN ('manual', 'auto')) DEFAULT 'manual',
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(source_tree_id, source_person_id, target_tree_id, target_person_id)
);

-- Existing change_log table gains tree_id:
-- ALTER TABLE change_log ADD COLUMN tree_id TEXT NOT NULL REFERENCES trees(id);
-- change_log.user_id is a logical reference to central DB users (no FK enforcement)

CREATE TABLE activity_feed (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tree_id TEXT REFERENCES trees(id),
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes
CREATE INDEX idx_persons_tree ON persons(tree_id);
CREATE INDEX idx_families_tree ON families(tree_id);
CREATE INDEX idx_events_tree ON events(tree_id);
CREATE INDEX idx_person_links_source ON person_links(source_tree_id, source_person_id);
CREATE INDEX idx_person_links_target ON person_links(target_tree_id, target_person_id);
CREATE INDEX idx_activity_feed_date ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_tree ON activity_feed(tree_id);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
```

## Connection Routing

```typescript
// Central DB — always connected
const centralDb = drizzle(createClient({
  url: process.env.TURSO_CENTRAL_DB_URL,
  authToken: process.env.TURSO_CENTRAL_DB_TOKEN,
}));

// Space DB — resolved per-request
const spaceDbCache = new Map<string, { client: DrizzleClient; lastAccess: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSpaceDb(spaceId: string): DrizzleClient {
  const cached = spaceDbCache.get(spaceId);
  if (cached && Date.now() - cached.lastAccess < CACHE_TTL_MS) {
    cached.lastAccess = Date.now();
    return cached.client;
  }

  // Look up space in central DB → get turso_db_url + token
  // Create drizzle client, cache it
  const space = centralDb.select().from(spaces).where(eq(spaces.id, spaceId)).get();
  const client = drizzle(createClient({
    url: space.tursoDbUrl,
    authToken: space.tursoDbToken,
  }));

  spaceDbCache.set(spaceId, { client, lastAccess: Date.now() });
  return client;
}
```

### Request Flow

```
Request → NextAuth session (userId)
  → URL param or cookie (spaceId)
  → Central DB: check space_members for (userId, spaceId) → role
  → If no membership: 403
  → Resolve space DB connection (cached)
  → Attach { userId, spaceId, role, spaceDb } to request context
  → Route handler executes queries against spaceDb
```

### Local Development

In local mode, spaces map to separate SQLite files:

```
data/
  central.sqlite        ← users, spaces, memberships
  space-abc123.sqlite   ← all trees for space abc123
  space-def456.sqlite   ← all trees for space def456
```

The Drizzle abstraction handles the driver swap (better-sqlite3 vs @libsql/client).

## Space Database Provisioning

### Turso (Web Deployment)

Space databases are created programmatically via the [Turso Platform API](https://docs.turso.tech/api-reference):

```typescript
// Pseudocode — packages/db/turso-provisioning.ts
async function provisionSpaceDatabase(spaceId: string): Promise<{ url: string; token: string }> {
  // 1. Create database via Turso Platform API
  const db = await tursoApi.createDatabase({
    name: `ancstra-space-${spaceId}`,
    group: 'default', // Turso placement group
  });

  // 2. Create auth token for the new database
  const token = await tursoApi.createToken(db.name, { expiration: 'none' });

  // 3. Run schema migrations on the new database
  const client = createClient({ url: db.url, authToken: token });
  await runMigrations(client);

  return { url: db.url, token };
}
```

**Authentication:** The Turso Platform API requires an organization-level API token, stored as `TURSO_PLATFORM_TOKEN` env var. This token is never exposed to clients.

**Failure handling:** If provisioning fails mid-flow (e.g., database created but migrations fail), the space record in the central DB is marked with a `provisioning_failed` status. A retry mechanism re-runs migrations on the next access attempt. The user sees "Space is being set up, please try again in a moment."

**Turso free tier limits:** 500 databases, 9GB total storage. Sufficient for early adoption. Monitor usage and upgrade plan when approaching limits.

### Local Development

In local mode, "provisioning" creates a new SQLite file:

```typescript
async function provisionLocalSpaceDatabase(spaceId: string): Promise<string> {
  const dbPath = path.join(DATA_DIR, `space-${spaceId}.sqlite`);
  const db = new Database(dbPath); // better-sqlite3
  runMigrationsSync(db);
  return dbPath;
}
```

No Turso API calls needed locally. The `turso_db_url` field in the central DB stores the file path instead.

## tree_id Migration Strategy

Since Phase 1 has not started implementation yet, `tree_id` should be included in the initial schema from day one. This avoids a painful retrofit migration later.

**Approach: Include tree_id in Phase 1 schema, with a default tree.**

1. All tables (`persons`, `families`, `events`, `sources`, `places`, `media`, `children`, `person_names`, `source_citations`, `media_persons`, `media_events`, `media_sources`, `face_regions`, `match_candidates`, `proposed_relationships`, `relationship_justifications`, `proposed_persons`) include a `tree_id TEXT NOT NULL REFERENCES trees(id)` column from the start
2. Phase 1 creates a single default tree automatically when a space is created: `INSERT INTO trees (id, name, created_by) VALUES ('default', 'My Family Tree', :userId)`
3. All Phase 1 UI operates on the default tree transparently — no tree picker needed until Phase 4
4. Phase 4 adds the multi-tree UI (tree creation, tree switching, cross-tree links)

**Impact on Phase 1:**
- Schema definitions in `packages/db/schema/` include `tree_id` on all relevant tables
- All queries include `WHERE tree_id = :treeId` (hidden behind a query helper)
- The `trees` table exists from Phase 1 but only holds one row
- No user-facing tree management UI in Phase 1

This is the cleanest path: zero migration debt, and the Phase 4 multi-tree feature is purely additive UI work.

## Cross-Database References

The following fields in the space DB reference entities in the central DB (users). These are **logical references only** — no FK enforcement is possible across databases:

- `trees.created_by` → `users.id`
- `activity_feed.user_id` → `users.id`
- `change_log.user_id` → `users.id`

**Validation strategy:** User IDs are validated at write time (the request context always has a verified userId from the session). For display, user names are resolved by batch-fetching from the central DB. If a user is deleted from the central DB, their entries display as "[removed user]".

## Invite Flow

### Flow 1: Owner Invites with Pre-Assignment

1. Owner opens invite dialog in space settings
2. Enters email, selects role (admin/editor/viewer)
3. Optionally picks a person node from any tree ("This is who they are")
4. System generates JWT invite token (7-day expiry, signed with NEXTAUTH_SECRET)
5. Invite link sent: `/join?token={token}`
6. Invitation record created in central DB

### Flow 2: Invitee Joins

1. Clicks invite link → join page
2. Sees space name, inviter, assigned role
3. Signs up via Google/Apple OAuth or email/password
4. Account created in `users` table
5. Membership created in `space_members` with assigned role
6. If person was pre-assigned: `user_person_map` entry created with status `confirmed`
7. Redirect to space tree view

### Flow 3: Self-Claim "(me)"

1. User visits a tree for the first time with no person mapping
2. Prompt shown: "Which person are you?" with search and browse
3. User clicks a person node to claim it
4. `user_person_map` entry created with status `pending_claim`
5. Owner/admin receives notification in activity feed
6. Owner/admin approves → status changes to `confirmed`, "(me)" badge appears
7. Owner/admin rejects → status changes to `rejected`, user can try again

### Invite Token Structure

```typescript
interface InviteToken {
  invitationId: string;
  spaceId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  personId?: string;   // Pre-assigned person
  treeId?: string;     // Which tree the person belongs to
  expiresAt: string;   // ISO date, 7 days from creation
  createdBy: string;   // Owner/admin user ID
}
```

## "(me)" Label

### Display

- Person node gets a purple border and floating "(me)" badge
- Badge position: top-right corner of the node card
- Only visible to the mapped user (other users see the node normally)

### Privacy Override

```typescript
// Pseudocode — actual implementation will be async
function filterForPrivacy(persons, viewerRole, userId, userPersonMap) {
  // Owners, admins, and editors see all persons unredacted
  if (viewerRole === 'owner' || viewerRole === 'admin' || viewerRole === 'editor') return persons;

  // Viewers: redact living persons, except their own "(me)" node
  return persons.map(p => {
    // "(me)" override — only when status is 'confirmed'
    const mapping = userPersonMap[userId];
    if (mapping?.personId === p.id && mapping?.status === 'confirmed') return p;

    // Standard living-person redaction for viewers
    if (isPresumablyLiving(p)) {
      return { ...p, given_name: 'Living', surname: '', notes: null };
    }
    return p;
  });
}
```

The `user_person_map` for the current user is loaded at session start and cached in the JWT (only `confirmed` mappings), so the "(me)" check adds zero latency. Pending claims do NOT grant the privacy override — the user must wait for owner/admin approval before seeing their node unredacted.

## Cross-Tree Person Links

### How Linking Works

Each tree owns its own copy of a person. Links create a bidirectional reference between copies, stored as a **single row** per link. Queries must check both `source_*` and `target_*` columns to find all links for a given person:

```sql
-- Find all links for person_abc in tree_1
SELECT * FROM person_links
WHERE (source_tree_id = 'tree_1' AND source_person_id = 'person_abc')
   OR (target_tree_id = 'tree_1' AND target_person_id = 'person_abc');
```

### Rules

1. **Each tree owns its copy** — edits don't auto-propagate unless sync_mode is 'auto'
2. **Manual sync (default)** — edited linked person shows "sync available" indicator. Editor reviews diff, accepts/rejects per field
3. **Auto sync (opt-in)** — changes propagate automatically. Logged in activity feed
4. **Link creation** — when adding a person who exists in another tree, system suggests linking. Can also link after the fact
5. **Conflict resolution** — if both copies edited before sync, show per-field diff with both versions

### What Syncs

- Core person data: names, sex, birth/death dates & places, notes
- Events, sources, and media are tree-specific and do NOT sync

## RBAC Permission Matrix

| Permission | Owner | Admin | Editor | Viewer |
|-----------|-------|-------|--------|--------|
| Create/delete spaces | Yes | No | No | No |
| Create trees in space | Yes | Yes | No | No |
| Delete trees | Yes | Yes | No | No |
| Edit persons/events | Yes | Yes | Yes | No |
| View tree | Yes | Yes | Yes | Yes (living filtered) |
| Invite members | Yes | Yes | No | No |
| Manage roles | Yes | Yes | No | No |
| Approve "(me)" claims | Yes | Yes | No | No |
| See own "(me)" node unredacted | Yes | Yes | Yes | Yes |
| Import GEDCOM | Yes | Yes | No | No |
| Export GEDCOM | Yes | Yes | Yes (filtered) | No |
| View activity feed | Yes | Yes | Yes | Yes |
| Manage person links | Yes | Yes | Yes | No |

### Enforcement

```
Layer 1: proxy.ts (Next.js 16)
  → Authenticated?
  → Member of space?
  → Attach { userId, spaceId, role } to context

Layer 2: API route / Server action
  → Check role against required permission
  → Apply living-person privacy filter
  → Apply "(me)" privacy override
```

## Activity Feed

### Logged Actions

| Action | Example Summary |
|--------|----------------|
| `person_created` | "Mary added **John Smith** to Paternal Line" |
| `person_updated` | "Robert updated birth date for **Helen Smith**" |
| `person_deleted` | "Mary removed **Unknown Child** from Johnson Branch" |
| `tree_created` | "John created tree **Maternal Line**" |
| `relationship_created` | "Mary linked **John Jr.** as child of **John & Helen**" |
| `gedcom_imported` | "John imported 342 persons into Paternal Line" |
| `person_linked` | "Mary linked **Helen** across Paternal Line and Johnson Branch" |
| `member_joined` | "**Aunt Sarah** joined the space as Editor" |
| `me_claimed` | "Sarah claimed **Sarah Johnson** as their node" |
| `me_confirmed` | "John confirmed Sarah's claim on **Sarah Johnson**" |

### Privacy in Feed

Activity entries involving living persons are redacted for viewers: "Robert updated a living person" instead of full name.

### No Real-Time Push

Feed is loaded on page visit and refreshed manually, matching the async collaboration model.

## Proposed Relationships in Collaborative Context

The existing `proposed_relationships` and `proposed_persons` tables gain `tree_id` like all other tables. In a collaborative space:

- **Who creates proposals:** AI/API discoveries create proposed relationships within a specific tree (scoped by `tree_id`)
- **Who validates:** Owner, admin, and editor roles can validate proposed relationships (per the existing RBAC matrix)
- **Scope:** Validation is per-tree, not per-space. A proposed relationship in Tree A is reviewed by members working on Tree A
- **Cross-tree implications:** If a proposed person is accepted and that person is linked to another tree, the link's "sync available" indicator appears (no auto-propagation)

## Edge Cases

- **Multiple invites to same email:** Latest invite replaces previous (UNIQUE constraint on space_id + email)
- **Invite expiration:** 7-day TTL. Expired invite shows "expired" page with "request new invite" option
- **Invite single-use:** Once accepted (`accepted_at` is set), the token is invalidated. Subsequent uses show "already accepted" page. Rate limiting on the join endpoint prevents abuse
- **User in multiple spaces:** Fully supported. Each space has independent roles, trees, and person mappings
- **Person claimed by two users:** `user_person_map` has UNIQUE(user_id, space_id, tree_id) — one person per user per tree. But two different users could claim the same person node; owner resolves conflicts
- **Space deletion:** Drops the Turso space DB entirely. Central DB records (space_members, invitations, user_person_map) cascade-delete
- **User removal from space:** Revoke membership, remove user_person_map entries. Their past activity feed entries remain (attributed to "[removed user]")
- **Cross-tree link with deleted person:** Link becomes stale. Show "linked person no longer exists" indicator. Auto-cleanup on next tree load

## Impact on Existing Specs

- **Phase 1 (data model):** All tables gain `tree_id` column. Schema must account for this from the start
- **Phase 1 (auth):** NextAuth.js v5 setup must support the central DB user model and space-scoped sessions
- **Phase 4 (collaboration):** This spec supersedes the existing `docs/specs/collaboration.md`. The "family" concept is replaced by "space"
- **Existing `change_log` table:** Gains `tree_id` column and `user_id` references the central DB user

## Open Questions (Resolved)

| Question | Resolution |
|----------|-----------|
| Space = what? | Workspace containing multiple trees |
| Auth method | Email/password + OAuth (Google/Apple) |
| Permissions granularity | Space-level roles only |
| Real-time vs async | Async (refresh to see changes) |
| Activity feed scope | Space-level, all trees aggregated |
| Cross-tree linking | Linked copies with manual/auto sync |

## Implementation Notes

Key files (planned locations):
- `packages/db/schema/central/` — users, spaces, space_members, invitations, user_person_map
- `packages/db/schema/space/` — trees table, tree_id additions to existing tables, person_links, activity_feed
- `packages/db/space-connection.ts` — connection routing and caching
- `apps/web/app/api/spaces/` — space CRUD, member management
- `apps/web/app/api/invitations/` — invite generation and acceptance
- `apps/web/app/(auth)/join/page.tsx` — invite join page
- `apps/web/app/(auth)/spaces/[spaceId]/` — space-scoped routes
- `apps/web/components/tree/me-badge.tsx` — "(me)" label component
- `apps/web/components/spaces/invite-dialog.tsx` — invite UI
- `apps/web/components/spaces/activity-feed.tsx` — activity feed component
- `apps/web/lib/auth/rbac.ts` — permission checking utilities
- `apps/web/lib/auth/privacy.ts` — living-person filter with "(me)" override
