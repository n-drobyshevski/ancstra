# Phase 4: Authentication & Collaboration

> Weeks 27-30 (4 weeks) | Started: TBD | Target: TBD

## Goals

- Upgrade authentication to support multiple family members
- Implement role-based access control (owner, contributor, viewer, restricted viewer)
- Build family invitation and onboarding flow
- Create contribution workflow with optional moderation
- Add activity feed and audit trail

## Systems in Scope

- [Collaboration](../specs/collaboration.md)
- [Architecture Overview](../architecture/overview.md)

## Task Breakdown

### Week 27-28: NextAuth.js Multi-User & RBAC

**Goal:** Upgrade authentication to support family members with role-based access.

- [ ] Expand database for multi-user:
  - [ ] `users` table -- id, email, password_hash, full_name, role, family_id, created_at, is_active
  - [ ] `families` table (new) -- id, family_name, owner_id, created_at, privacy_level
  - [ ] `family_members` table (new) -- id, family_id, user_id, role (owner, contributor, viewer), invited_at, joined_at, is_active
  - [ ] `user_sessions` table -- id, user_id, token, expires_at (for token management)
- [ ] Implement roles and permissions:
  - [ ] **Owner**: full access, manage members, export/import, delete tree
  - [ ] **Contributor**: add persons, events, media; edit own contributions
  - [ ] **Viewer**: read-only access to tree
  - [ ] **Restricted Viewer**: limited view (e.g., only living persons, specific branches)
- [ ] Set up NextAuth.js v5:
  - [ ] Configure credential provider with email/password (local database)
  - [ ] Implement session management
  - [ ] Add proxy to check role and apply permissions (Next.js 16: `proxy.ts` replaces `middleware.ts`)
  - [ ] Create auth guard component for protected pages
- [ ] Build permission checking utilities `apps/web/lib/auth/permissions.ts`:
  - [ ] `canViewPerson(userId, personId): boolean`
  - [ ] `canEditPerson(userId, personId): boolean`
  - [ ] `canViewMedia(userId, mediaId): boolean`
  - [ ] Apply permissions globally: API routes, components, server actions
- [ ] Create user management API:
  - [ ] `POST /api/users` -- create new user (family member)
  - [ ] `GET /api/users` -- list family members
  - [ ] `PUT /api/users/[id]` -- update user details, role
  - [ ] `DELETE /api/users/[id]` -- remove user from family
  - [ ] `POST /api/users/invite` -- send invite link
- [ ] Build user management UI `apps/web/app/(auth)/settings/members/page.tsx`:
  - [ ] List current family members with roles
  - [ ] Edit role dropdown for each member
  - [ ] Remove member button
  - [ ] Invite new member form (email input)
  - [ ] Pending invites list with resend button

### Week 28-29: Family Invitation & Contribution Workflow

**Goal:** Make it easy for family to join and contribute.

- [ ] Create invite system:
  - [ ] Owner generates invite link with token
  - [ ] Link format: `yourapp.com/join?token={token}`
  - [ ] Link expires after 7 days or first use
  - [ ] Email invite with pre-filled link
  - [ ] Revoke invite if needed (before use)
- [ ] Build join page `apps/web/app/join/page.tsx`:
  - [ ] Display: "You've been invited to [Family Name]'s family tree"
  - [ ] Sign-up form (email, name, password)
  - [ ] If already logged in: "Join [Family]" button
  - [ ] Auto-join to family on confirmation
- [ ] Implement contribution workflow:
  - [ ] Contributor can add new persons (checked against privacy rules)
  - [ ] Contributor can upload documents/photos and link to persons
  - [ ] Contributor can add events and sources
  - [ ] Owner reviews contributions before publishing (optional moderation)
  - [ ] Track contributor for each entry (audit trail)
- [ ] Create contribution review interface (if moderation enabled):
  - [ ] Queue of pending contributions
  - [ ] Diff view: before/after
  - [ ] Approve, reject, or request changes
  - [ ] Notify contributor of decision
- [ ] Build activity feed:
  - [ ] Show recent additions: "Mary added 3 photos", "John added John Jr. as child"
  - [ ] Filter by contributor, action type, person
  - [ ] Configurable privacy (hide living person changes from viewers)

### Week 29-30: OAuth & Collaboration Testing

**Goal:** Add social login and thoroughly test multi-user flows.

- [ ] Integrate Google OAuth:
  - [ ] Register app in Google Cloud Console
  - [ ] Configure NextAuth.js Google provider
  - [ ] Add "Sign in with Google" button
  - [ ] Link Google account to existing user if email matches
- [ ] Integrate Apple OAuth (Nice-to-have):
  - [ ] Register app in Apple Developer
  - [ ] Configure NextAuth.js Apple provider
  - [ ] Handle Apple's privacy features (hide email, etc.)
- [ ] Comprehensive auth/collaboration testing:
  - [ ] Test role-based access for all endpoints
  - [ ] Test invitation flow end-to-end
  - [ ] Test contribution moderation workflow
  - [ ] Test concurrent users (3+ simultaneous)
  - [ ] Test permission boundaries (viewer can't edit, etc.)

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | NextAuth.js RBAC (owner, contributor, viewer) |
| **Must** | Permission checking on all API routes |
| **Must** | Family invitation flow (token-based) |
| **Must** | Activity feed / audit trail |
| **Should** | Contribution moderation workflow |
| **Should** | Google OAuth |
| **Should** | Email notifications for invites |
| **Could** | Apple OAuth |
| **Could** | Restricted Viewer role |

## Documentation (write during this phase)

- [ ] Collaboration user guide: how to invite family, manage roles
- [ ] Security model documentation: RBAC permissions matrix

## Exit Gate: Phase 4 to Phase 5

- [ ] Multi-user flow tested with 3+ concurrent users
- [ ] RBAC tested for all 3 core roles (owner, contributor, viewer)
- [ ] Invitation flow works end-to-end
- [ ] Permission boundaries verified (no privilege escalation)
- [ ] Activity feed shows accurate contribution history

## Feedback Loop

- Invite 1-2 family members to test the collaboration flow
- Document their experience and friction points

## Key Risks

1. **Authentication complexity** -- Adding RBAC introduces security surface. Mitigate: use proven NextAuth.js patterns, comprehensive permission checking, thorough testing.
2. **Data privacy with shared tree** -- Sharing risks exposing living persons' data. Mitigate: strict living person filter, role-based restrictions, audit logging.

## Decisions Made During This Phase

(Empty -- filled during implementation)

## Retrospective

(Empty -- filled at phase end)
