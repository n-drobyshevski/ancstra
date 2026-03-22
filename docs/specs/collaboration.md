# Collaboration & Multi-User

> Phase: 5 | Status: Not Started
> Depth: design-level
> Dependencies: [data-model.md](../architecture/data-model.md), [relationship-validation.md](../architecture/relationship-validation.md)
> Data model: users, roles, change_log, proposed_relationships tables

## Overview

Multi-user family tree collaboration via NextAuth.js (Phase 1: credentials; Phase 5: OAuth). Multi-tenant architecture (Turso) for independent family databases, role-based access control (RBAC), contribution workflow with editor submissions, and relationship validation as the core approval mechanism.

## Requirements

- [ ] Authentication (NextAuth.js with credentials provider, OAuth expansion in Phase 5)
- [ ] RBAC permission table (Owner, Admin, Editor, Viewer roles)
- [ ] Multi-tenant architecture (Turso) with family isolation
- [ ] Contribution workflow: editors submit changes, admins/owners review and approve
- [ ] Family invitation flow with JWT tokens and 7-day expiry
- [ ] Change log auditing (all operations tracked by user + timestamp)
- [ ] Activity feed (recent changes, invitations, approvals)
- [ ] Conflict detection and notification
- [ ] Living person privacy (Viewer role sees redacted data)

## Design

### Authentication (NextAuth.js)

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Verify email + password against users table
        // Hash comparison with bcrypt (no plaintext storage)
      },
    }),
    // Phase 5: Add OAuth providers
    // GoogleProvider({ ... }),
    // AppleProvider({ ... }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;        // 'owner' | 'admin' | 'editor' | 'viewer'
        token.treeId = user.treeId;    // Family tree database ID
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.treeId = token.treeId;
      session.user.userId = token.userId;
      return session;
    },
  },
};
```

**Workflow:**

1. User submits email + password
2. Server hashes password, compares to users table
3. Create JWT with role and treeId
4. Set secure session cookie
5. Redirect to tree

**Phase 5 expansion:** Google/Apple OAuth for family invitations (no password management for shared families).

### Role-Based Access Control (RBAC)

| Permission | Owner | Admin | Editor | Viewer |
|-----------|-------|-------|--------|--------|
| View tree | Yes | Yes | Yes | Yes (living filtered) |
| Edit persons | Yes | Yes | Submit for review | No |
| Delete persons | Yes | Yes | No | No |
| Import GEDCOM | Yes | Yes | No | No |
| Export GEDCOM | Yes | Yes | Yes (living filtered) | No |
| AI research | Yes | Yes | Yes | No |
| **Validate relationships** | **Yes** | **Yes** | **Yes** | **No** |
| **Add justifications** | **Yes** | **Yes** | **Yes** | **No** |
| **View validation queue** | **Yes** | **Yes** | **Yes** | **No** |
| DNA data | Yes | No | No | No |
| Manage users | Yes | Yes | No | No |
| App settings | Yes | No | No | No |

**Key permission notes:**

- Editors **submit changes**, don't directly modify tree (Phase 5)
- Editors and above can **validate relationships** (core feature)
- Viewers see tree **with living persons redacted** (privacy)
- Only Owner manages app settings (exports, backups, etc.)
- DNA data restricted to Owner (genetic privacy)

**Enforcement:**

```typescript
// Middleware for protected endpoints
export function requireRole(...roles: string[]) {
  return (req, res, next) => {
    if (!roles.includes(req.session.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

### Multi-Tenant Architecture

Each family gets its own Turso database (managed Postgres-compatible SQLite):

```
Family A → turso://ancstra-family-abc123.turso.io
Family B → turso://ancstra-family-def456.turso.io
...
```

**Benefits:**

- Complete data isolation (no row-level security complexity)
- Independent backup/restore per family
- Scalable: family growth doesn't affect others
- Privacy: no possibility of cross-family leakage
- Compliance: easier GDPR compliance (delete = drop database)

**Initialization:**

```typescript
async function createFamilyDatabase(familyId: string): Promise<string> {
  // 1. Create Turso database
  const dbUrl = `turso://ancstra-family-${familyId}.turso.io`;

  // 2. Run migration (schema)
  await runMigrations(dbUrl);

  // 3. Store URL in users table (keyed by user + family)
  await updateUserFamilyDatabases(userId, { [familyId]: dbUrl });

  return dbUrl;
}
```

### Contribution Workflow (Phase 5)

```
Editor submits change (edit person, add relationship, delete)
  │
  v
Change logged as "pending_review" in change_log
  │
  v
Admin/Owner receives notification (activity feed)
  │
  v
Review UI: Accept | Reject | Request Changes
  │
  ├─→ Accept: apply change, update tree, notify editor
  │
  ├─→ Reject: discard change, notify editor with reason
  │
  └─→ Request Changes: change marked "awaiting_revision", editor notified
      (editor resubmits updated change)
```

**Data structure:**

```typescript
table change_log {
  id: string PRIMARY KEY
  tree_id: string
  user_id: string
  timestamp: string ISO
  operation: 'create' | 'update' | 'delete'
  entity_type: 'person' | 'relationship' | 'event'
  entity_id: string
  old_values: JSON         // Before state
  new_values: JSON         // After state
  status: 'pending_review' | 'accepted' | 'rejected' | 'awaiting_revision'
  reviewer_id?: string
  review_timestamp?: string
  review_comment?: string
}
```

### Family Invitation Flow

```
Owner clicks "Invite Family Member"
  │
  v
Enter email + role (viewer | editor)
  │
  v
System generates invite link (JWT token, 7-day expiry)
  │ Link: /invite?token=eyJ...
  v
System sends email with link
  │
  v
Recipient clicks link → creates account → assigned role
  │
  v
Account created in users table with family_id + role
  │
  v
Can now access the family tree with role-based permissions
```

**Invite token structure:**

```typescript
interface InviteToken {
  email: string
  familyId: string
  role: 'viewer' | 'editor'
  expiresAt: string ISO date  // 7 days from creation
  createdBy: string           // Owner user ID
}

// JWT signed with NEXTAUTH_SECRET
// Invalid after 7 days or if email doesn't match signup
```

**Workflow:**

1. Owner enters email + desired role
2. Generate JWT with 7-day expiry
3. Send email with `/invite?token=...`
4. Recipient clicks, lands on signup page with role pre-filled
5. Creates account (email-password or OAuth)
6. Assigned to family with specified role
7. Can immediately access tree

## Edge Cases & Error Handling

- **Multiple invites to same email:** Earlier invites expire, new one sent
- **Invite expiration:** User sees "expired invite" page, can request new one
- **Role change:** Owner can promote/demote users; logged in change_log
- **User removal:** Revoke all sessions, hide user's contributions? (policy TBD)
- **Concurrent edits:** Change log timestamp ordering determines conflict
- **Offline changes (PWA):** Queued in IndexedDB, sync on reconnect, conflict detection by timestamp

## Open Questions

- Contribution workflow complexity vs. simplicity for small families?
- Editor changes: require approval or auto-accept with audit trail?
- Notifications: email vs. in-app activity feed vs. both?
- Export permissions: can Editors export (with living persons redacted)?
- Guest access (time-limited, view-only)?
- Integration with family social network (comments, discussions)?

## Implementation Notes

Location: `apps/web/api/auth/*`, `packages/auth/`, `packages/collaboration/`

Key files:
- `auth/[...nextauth].ts` - NextAuth configuration
- `auth/rbac.ts` - Permission checking middleware (note: the Next.js route-level file is `proxy.ts` not `middleware.ts` in Next.js 16)
- `collaboration/invitations.ts` - Invite token generation and validation
- `collaboration/change-log.ts` - Change tracking and audit trail
- `collaboration/activity-feed.ts` - User-facing activity notifications

**Session storage:**

- Secure cookie (httpOnly, secure flag)
- JWT payload: { userId, treeId, role, iat, exp }
- Refresh token rotation for long-lived sessions (optional, Phase 5)
